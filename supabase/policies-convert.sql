-- Allow BD/admins to create students (needed for "Convert lead -> student").
-- Run once in the Supabase SQL Editor.
create policy students_bd_insert on public.students
  for insert
  with check (public.auth_role() in ('bd','super_admin','admin'));
