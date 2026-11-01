-- Subscriptions platform. PENDING: written for review, NOT applied to any live database.
--
-- Apply after 0008_approved_members.sql (this file replaces handle_new_user from that file).
--
-- What this adds
--   * children: profiles the parent creates (no email, no login)
--   * plan prices, sibling tiers, offers, referral codes, academic periods, settings: all editable by admins
--   * subscriptions that decide who can see lessons and videos
--   * live sessions (slots, requests, prices), kept separate from subscriptions
--   * payments and invoices tables, left EMPTY: no payment provider is connected
--   * units (grade > subject > unit > lesson) and a private video path on lessons
--
-- Sensitive tables (subscriptions, live_sessions, referral_codes, payments, invoices) are read-only
-- for signed-in users; the app writes them from server functions with the service role after it has
-- checked the caller, so a client can never set its own price or status.

-- ---------------------------------------------------------------- helpers

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.has_role(auth.uid(), 'admin'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'), false)
$$;

-- ---------------------------------------------------------------- settings and periods

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Starting values from the product spec. Every one is editable in the admin panel.
INSERT INTO public.app_settings (key, value) VALUES
  ('promo_cap_percent', '15'),          -- offers + referral together
  ('referral_percent', '5'),            -- friend's discount; the referrer's plan is unchanged
  ('referral_valid_days', '30'),        -- ASSUMPTION: the spec says "time-limited" without a length
  ('expiry_warning_days', '7'),
  ('live_modes_enabled', '["individual","group"]'),
  ('currency_label', '""');             -- shown after prices; empty until the admin sets it

CREATE TABLE public.academic_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('term', 'year')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on > starts_on)
);

-- ---------------------------------------------------------------- prices and discounts

CREATE TABLE public.full_plan_prices (
  grade_group text NOT NULL CHECK (grade_group IN ('g1-4', 'g5-8', 'g9-10', 'first-secondary', 'tawjihi')),
  plan_type text NOT NULL CHECK (plan_type IN ('monthly', 'term', 'yearly')),
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  PRIMARY KEY (grade_group, plan_type)
);

CREATE TABLE public.subject_plan_prices (
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  plan_type text NOT NULL CHECK (plan_type IN ('monthly', 'term', 'yearly')),
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  PRIMARY KEY (subject_id, plan_type)
);

-- position 4 means "4th child and beyond".
CREATE TABLE public.sibling_discounts (
  position int PRIMARY KEY CHECK (position >= 2),
  percent numeric(5, 2) NOT NULL CHECK (percent BETWEEN 0 AND 100)
);
INSERT INTO public.sibling_discounts (position, percent) VALUES (2, 10), (3, 15), (4, 20);

CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  percent numeric(5, 2) NOT NULL CHECK (percent BETWEEN 0 AND 100),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  plan_types text[] NOT NULL CHECK (plan_types <@ ARRAY['monthly', 'term', 'yearly']),
  renewal_only boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

-- ---------------------------------------------------------------- children

CREATE TABLE public.children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  grade int NOT NULL CHECK (grade BETWEEN 1 AND 12),
  -- Fixed at creation and never reassigned, so one child's change never moves another's discount.
  position int NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, position)
);

CREATE OR REPLACE FUNCTION public.children_set_position() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT coalesce(max(position), 0) + 1 INTO NEW.position FROM public.children WHERE parent_id = NEW.parent_id;
  RETURN NEW;
END $$;
CREATE TRIGGER children_position BEFORE INSERT ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.children_set_position();

CREATE OR REPLACE FUNCTION public.children_lock_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.position <> OLD.position OR NEW.parent_id <> OLD.parent_id THEN
    RAISE EXCEPTION 'position and parent cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER children_lock BEFORE UPDATE ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.children_lock_identity();

-- ---------------------------------------------------------------- referral, subscriptions, live

CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  plan_type text NOT NULL CHECK (plan_type IN ('monthly', 'term', 'yearly')),
  scope text NOT NULL CHECK (scope IN ('grade', 'subject')),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  period_id uuid REFERENCES public.academic_periods(id) ON DELETE SET NULL,
  -- 'pending' until an admin confirms it (payments are not connected yet); access needs 'active'.
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  list_price numeric(10, 2) NOT NULL CHECK (list_price >= 0),
  discount_percent numeric(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  discount_kind text NOT NULL DEFAULT 'none' CHECK (discount_kind IN ('none', 'sibling', 'offer', 'referral', 'offer+referral')),
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  referral_code_id uuid REFERENCES public.referral_codes(id) ON DELETE SET NULL,
  final_price numeric(10, 2) NOT NULL CHECK (final_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  CHECK (ends_at > starts_at),
  CHECK ((scope = 'grade' AND subject_id IS NULL) OR scope = 'subject')
);
CREATE INDEX subscriptions_parent_idx ON public.subscriptions (parent_id, status, ends_at);
CREATE INDEX subscriptions_child_idx ON public.subscriptions (child_id, status, ends_at);

CREATE TABLE public.live_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 45 CHECK (duration_minutes BETWEEN 10 AND 240),
  mode text NOT NULL CHECK (mode IN ('individual', 'group')),
  capacity int NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Priced separately from subscriptions; one price per mode, set by the admin.
CREATE TABLE public.live_session_prices (
  mode text PRIMARY KEY CHECK (mode IN ('individual', 'group')),
  price numeric(10, 2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid,
  mode text NOT NULL CHECK (mode IN ('individual', 'group')),
  slot_id uuid REFERENCES public.live_slots(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL,
  -- Set when the admin suggests a different time; the parent accepts or declines it.
  proposed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  price numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  note text CHECK (char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_sessions_status_idx ON public.live_sessions (status, requested_at);

-- ---------------------------------------------------------------- payments (empty, no provider)

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  provider text NOT NULL,
  -- Only the provider's payment id and a status are stored. Never card data.
  provider_payment_id text NOT NULL,
  status text NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  number text NOT NULL UNIQUE,
  amount numeric(10, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL,
  status text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- units and private videos

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lessons
  ADD COLUMN unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  -- Object path inside the PRIVATE lesson-media bucket: <grade>/<subject id>/<unit id>/<lesson id>/<file>
  ADD COLUMN video_path text;

-- Notifications can be de-duplicated (one expiry warning per subscription).
ALTER TABLE public.notifications ADD COLUMN ref text;
CREATE UNIQUE INDEX notifications_ref_unique ON public.notifications (user_id, kind, ref) WHERE ref IS NOT NULL;

-- ---------------------------------------------------------------- access check used by RLS

-- Does the signed-in parent have an active subscription, for any of their children, that covers
-- this subject? A full-grade plan covers every subject of the child's grade; a single-subject plan
-- covers only its subject. Access ends by itself when ends_at passes.
CREATE OR REPLACE FUNCTION public.parent_can_view_subject(_subject uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.children c ON c.id = s.child_id
    JOIN public.subjects sub ON sub.id = _subject
    WHERE s.parent_id = auth.uid()
      AND c.parent_id = auth.uid()
      AND c.archived_at IS NULL
      AND s.status = 'active'
      AND s.starts_at <= now() AND now() < s.ends_at
      AND ((s.scope = 'grade' AND sub.grade = c.grade) OR (s.scope = 'subject' AND s.subject_id = _subject))
  )
$$;

-- <grade>/<subject id>/... -> subject id (null when the path is not in that shape).
CREATE OR REPLACE FUNCTION public.media_subject_id(_name text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN split_part(_name, '/', 2)::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

-- Lessons (and their video links) are visible only to staff and to parents with a covering subscription.
DROP POLICY IF EXISTS "students read lessons" ON public.lessons;
CREATE POLICY "entitled read lessons" ON public.lessons FOR SELECT TO authenticated
  USING (public.is_staff() OR public.parent_can_view_subject(subject_id));

-- Video files live in a private bucket: no public URL works, only signed URLs for entitled users.
UPDATE storage.buckets SET public = false WHERE id = 'lesson-media';
DROP POLICY IF EXISTS "students read lesson media" ON storage.objects;
CREATE POLICY "entitled read lesson media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-media' AND (public.is_staff() OR public.parent_can_view_subject(public.media_subject_id(name))));

-- ---------------------------------------------------------------- grants and RLS

REVOKE ALL ON
  public.app_settings, public.academic_periods, public.full_plan_prices, public.subject_plan_prices,
  public.sibling_discounts, public.offers, public.children, public.referral_codes, public.subscriptions,
  public.live_slots, public.live_session_prices, public.live_sessions, public.payments, public.invoices, public.units
FROM anon, authenticated;

GRANT SELECT ON
  public.app_settings, public.academic_periods, public.full_plan_prices, public.subject_plan_prices,
  public.sibling_discounts, public.offers, public.children, public.referral_codes, public.subscriptions,
  public.live_slots, public.live_session_prices, public.live_sessions, public.payments, public.invoices, public.units
TO authenticated;

-- Admins edit configuration through RLS; staff manage units and live slots.
GRANT INSERT, UPDATE, DELETE ON
  public.app_settings, public.academic_periods, public.full_plan_prices, public.subject_plan_prices,
  public.sibling_discounts, public.offers, public.live_session_prices, public.units, public.live_slots
TO authenticated;
-- Parents create and edit their own children (never delete: archive instead, to keep positions).
GRANT INSERT, UPDATE ON public.children TO authenticated;

GRANT ALL ON
  public.app_settings, public.academic_periods, public.full_plan_prices, public.subject_plan_prices,
  public.sibling_discounts, public.offers, public.children, public.referral_codes, public.subscriptions,
  public.live_slots, public.live_session_prices, public.live_sessions, public.payments, public.invoices, public.units
TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.full_plan_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_plan_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sibling_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_session_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Configuration: everyone signed in can read (parents need prices), only admins write.
CREATE POLICY "read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write settings" ON public.app_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "read periods" ON public.academic_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write periods" ON public.academic_periods FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "read full prices" ON public.full_plan_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write full prices" ON public.full_plan_prices FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "read subject prices" ON public.subject_plan_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write subject prices" ON public.subject_plan_prices FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "read sibling tiers" ON public.sibling_discounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write sibling tiers" ON public.sibling_discounts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "read offers" ON public.offers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write offers" ON public.offers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "read live prices" ON public.live_session_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write live prices" ON public.live_session_prices FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "read units" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff write units" ON public.units FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "read live slots" ON public.live_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write live slots" ON public.live_slots FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Children: a parent sees and edits only their own; admins can read all.
CREATE POLICY "parents read own children" ON public.children FOR SELECT TO authenticated USING (parent_id = auth.uid());
CREATE POLICY "admins read children" ON public.children FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "parents add own children" ON public.children FOR INSERT TO authenticated WITH CHECK (parent_id = auth.uid() AND archived_at IS NULL);
CREATE POLICY "parents edit own children" ON public.children FOR UPDATE TO authenticated USING (parent_id = auth.uid()) WITH CHECK (parent_id = auth.uid());

-- Sensitive tables: owners and admins read; writes happen only through the service role.
CREATE POLICY "owners read referral codes" ON public.referral_codes FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "parents read own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (parent_id = auth.uid() OR public.is_admin());
CREATE POLICY "parents read own live sessions" ON public.live_sessions FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR public.is_admin() OR teacher_id = auth.uid());
CREATE POLICY "parents read own payments" ON public.payments FOR SELECT TO authenticated USING (parent_id = auth.uid() OR public.is_admin());
CREATE POLICY "parents read own invoices" ON public.invoices FOR SELECT TO authenticated USING (parent_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------- sign-up

-- Replaces 0008's version. Sign-up is free: everyone becomes a parent and adds children later.
-- Teachers are the exception: their school email (issued by an admin) makes them teachers.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text := lower(NEW.email);
  _is_teacher boolean := EXISTS (SELECT 1 FROM public.teacher_accounts WHERE school_email = _email);
BEGIN
  INSERT INTO public.profiles (id, display_name, grade)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;

  IF _is_teacher THEN
    UPDATE public.teacher_accounts SET user_id = NEW.id WHERE school_email = _email AND user_id IS NULL;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'parent') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- People who already signed up but hold no role (e.g. waiting on the old approval step) become parents.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'parent' FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------- expiry warnings

-- One notification per subscription, _days before it ends (default 7), and one when it has ended.
-- Safe to run as often as needed. Called by the app and callable from a schedule.
CREATE OR REPLACE FUNCTION public.notify_subscription_expiry(_days int DEFAULT 7) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int := 0; _c int;
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, ref)
  SELECT s.parent_id, 'subscription',
         'اشتراك ' || c.name || ' ينتهي قريبًا',
         'ينتهي اشتراك ' || c.name || ' بتاريخ ' || to_char(s.ends_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') || '. جدّد الاشتراك ليستمر الوصول إلى الدروس.',
         'expiring:' || s.id
  FROM public.subscriptions s JOIN public.children c ON c.id = s.child_id
  WHERE s.status = 'active' AND s.ends_at > now() AND s.ends_at <= now() + make_interval(days => _days)
  ON CONFLICT (user_id, kind, ref) WHERE ref IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;

  INSERT INTO public.notifications (user_id, kind, title, body, ref)
  SELECT s.parent_id, 'subscription',
         'انتهى اشتراك ' || c.name,
         'توقف الوصول إلى الدروس. جدّد الاشتراك لاستعادته.',
         'expired:' || s.id
  FROM public.subscriptions s JOIN public.children c ON c.id = s.child_id
  WHERE s.status = 'active' AND s.ends_at <= now()
  ON CONFLICT (user_id, kind, ref) WHERE ref IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  RETURN _n;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_subscription_expiry(int) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.notify_subscription_expiry(int) TO service_role;
