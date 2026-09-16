-- =============================================================================
-- Therapist profile photos are uploaded, not linked.
-- -----------------------------------------------------------------------------
-- The practice dashboard used to ask for a photo URL, which meant a therapist
-- needed somewhere else to host the picture. It now takes a JPG or PNG from
-- their computer or phone, and the file lives in the `therapist-photos` bucket:
--
--   therapist-photos/<auth user id>/photo.jpg
--
-- The bucket is public so the directory (therapists.html) and the profile page
-- (therapist.html) can show the picture to visitors with no account, exactly as
-- they showed a linked one. therapist_profiles.photo_url keeps holding the
-- address, now the bucket's public URL, so nothing that displays it changes.
--
-- One file per user, always at the same path: uploading again overwrites it,
-- and the page adds a ?v= cache-buster so browsers fetch the new one. Only the
-- signed-in user can read, write or remove inside the folder named after their
-- own id, which is the rule the assignremind bucket already uses (ar_owns on
-- the first path segment). Public downloads go through the bucket's public URL,
-- which does not consult these policies, so visitors need none of their own.
--
-- The page shrinks the picture to 800px and re-encodes it as a JPEG before
-- uploading, so the 5 MB limit here is a backstop, not the working size.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('therapist-photos', 'therapist-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "therapist reads own photo" on storage.objects;
create policy "therapist reads own photo" on storage.objects
  for select to authenticated
  using (bucket_id = 'therapist-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "therapist uploads own photo" on storage.objects;
create policy "therapist uploads own photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'therapist-photos'
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "therapist replaces own photo" on storage.objects;
create policy "therapist replaces own photo" on storage.objects
  for update to authenticated
  using (bucket_id = 'therapist-photos'
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'therapist-photos'
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "therapist removes own photo" on storage.objects;
create policy "therapist removes own photo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'therapist-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);
