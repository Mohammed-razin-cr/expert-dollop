-- Lead Detail: extra fields + BD delete permission. Run once in Supabase SQL Editor.
alter table public.leads     add column if not exists college  text;
alter table public.leads     add column if not exists plan     text;
alter table public.leads     add column if not exists pathway  text;
alter table public.leads     add column if not exists fu_count int default 0;
alter table public.followups add column if not exists type     text;
alter table public.followups add column if not exists outcome  text;

drop policy if exists leads_bd_delete on public.leads;
create policy leads_bd_delete on public.leads
  for delete
  using (public.auth_role() = 'bd' and assigned_bd = auth.uid());
