create policy "students upload own submissions" on storage.objects for insert to authenticated
with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "students read own submissions" on storage.objects for select to authenticated
using (bucket_id = 'submissions' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'teacher') or public.has_role(auth.uid(), 'admin')));

create policy "teachers read all submissions" on storage.objects for update to authenticated
using (bucket_id = 'submissions' and (public.has_role(auth.uid(), 'teacher') or public.has_role(auth.uid(), 'admin')));

create policy "students read lesson media" on storage.objects for select to authenticated
using (bucket_id = 'lesson-media');

create policy "teachers manage lesson media" on storage.objects for insert to authenticated
with check (bucket_id = 'lesson-media' and (public.has_role(auth.uid(), 'teacher') or public.has_role(auth.uid(), 'admin')));

create policy "teachers delete lesson media" on storage.objects for delete to authenticated
using (bucket_id = 'lesson-media' and (public.has_role(auth.uid(), 'teacher') or public.has_role(auth.uid(), 'admin')));