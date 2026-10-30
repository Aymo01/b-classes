-- Messaging between a teacher and a student or a student's parent. No attachments.

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  student_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, participant_id, student_id),
  CHECK (teacher_id <> participant_id)
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_created_idx ON public.messages (conversation_id, created_at);

-- A notification can point back at the conversation it came from.
ALTER TABLE public.notifications
  ADD COLUMN conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;

GRANT SELECT, INSERT ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.conversations, public.messages TO service_role;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Only the two participants can read or write a conversation.
CREATE POLICY "participants read conversations" ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() IN (teacher_id, participant_id));

-- A conversation is started by the student or parent, never by the teacher, and a parent
-- must be linked to the student. The teacher must hold the teacher role.
CREATE POLICY "participant starts conversation" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    participant_id = auth.uid()
    AND (public.has_role(teacher_id, 'teacher') OR public.has_role(teacher_id, 'admin'))
    AND (
      student_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.parent_links l WHERE l.parent_id = auth.uid() AND l.student_id = conversations.student_id)
    )
  );

CREATE POLICY "participants read messages" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND auth.uid() IN (c.teacher_id, c.participant_id)
  ));

CREATE POLICY "participants send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND auth.uid() IN (c.teacher_id, c.participant_id)
    )
  );

-- The recipient (not the sender) marks messages read.
CREATE POLICY "recipient marks messages read" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id <> auth.uid() AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND auth.uid() IN (c.teacher_id, c.participant_id)
  ))
  WITH CHECK (sender_id <> auth.uid());

-- Every new message notifies the other participant.
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  conv public.conversations;
  student_name text;
  sender_name text;
  recipient uuid;
  notice_title text;
BEGIN
  SELECT * INTO conv FROM public.conversations WHERE id = NEW.conversation_id;
  SELECT coalesce(nullif(btrim(display_name), ''), 'طالب') INTO student_name FROM public.profiles WHERE id = conv.student_id;
  student_name := coalesce(student_name, 'طالب');

  IF NEW.sender_id = conv.teacher_id THEN
    recipient := conv.participant_id;
    SELECT coalesce(nullif(btrim(display_name), ''), 'المعلم') INTO sender_name FROM public.profiles WHERE id = conv.teacher_id;
    notice_title := 'المعلم ' || coalesce(sender_name, 'المعلم') || ' أرسل لك رسالة';
  ELSE
    recipient := conv.teacher_id;
    IF NEW.sender_id = conv.student_id THEN
      notice_title := student_name || ' أرسل لك رسالة';
    ELSE
      notice_title := 'ولي أمر ' || student_name || ' أرسل لك رسالة';
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, kind, title, body, conversation_id)
  VALUES (recipient, 'message', notice_title, left(NEW.body, 140), NEW.conversation_id);
  RETURN NEW;
END $$;

CREATE TRIGGER messages_notify AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();
