-- Perf pass: aggregate lead counts in the DB (one call) + indexes. Run once.

create index if not exists idx_leads_status   on public.leads(status);
create index if not exists idx_leads_source    on public.leads(source);
create index if not exists idx_leads_created   on public.leads(created_at desc);
create index if not exists idx_leads_assigned2 on public.leads(assigned_bd);
create index if not exists idx_students_created on public.students(created_at desc);

-- Returns total + counts grouped by status / source / bd in a single round-trip.
create or replace function public.lead_stats(p_bd uuid default null)
returns json
language sql stable
set search_path = public
as $$
  select json_build_object(
    'total', (select count(*) from leads where p_bd is null or assigned_bd = p_bd),
    'by_status', coalesce((select json_object_agg(status::text, c) from (
        select status, count(*) c from leads where p_bd is null or assigned_bd = p_bd group by status) a), '{}'::json),
    'by_source', coalesce((select json_object_agg(source::text, c) from (
        select source, count(*) c from leads where p_bd is null or assigned_bd = p_bd group by source) b), '{}'::json),
    'by_bd', coalesce((select json_object_agg(coalesce(assigned_bd::text,'none'), c) from (
        select assigned_bd, count(*) c from leads where p_bd is null or assigned_bd = p_bd group by assigned_bd) d), '{}'::json)
  );
$$;

grant execute on function public.lead_stats(uuid) to anon, authenticated, service_role;
