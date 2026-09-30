-- =====================================================================
-- Electrobtech OMS — Sprint 0 schema
-- Postgres / Supabase. Run in the Supabase SQL Editor (or `supabase db push`).
-- Covers: identity & RBAC, CRM, catalog, students, academics, finance,
--         internship/placement, tasks, documents, audit.
-- RLS baseline: staff (super_admin/admin) full access; role-scoped policies
--         on the sensitive tables. Trainer/BD/student scoping is tightened
--         further in their respective sprints.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
create type user_role         as enum ('super_admin','admin','bd','trainer','student');
create type lead_source       as enum ('website','college','referral','social_media','walk_in');
create type lead_status       as enum ('new','contacted','interested','demo_scheduled','aptitude_shared','passed','enrolled','lost');
create type batch_status      as enum ('planned','active','completed','cancelled');
create type enrollment_status as enum ('active','completed','dropped');
create type attendance_status as enum ('present','absent','late','not_marked');
create type task_status       as enum ('pending','in_progress','done','cancelled');
create type invoice_status    as enum ('paid','pending','overdue','cancelled');
create type internship_status as enum ('ongoing','completed','dropped');
create type placement_status  as enum ('in_process','offered','placed','declined');
create type assessment_type   as enum ('quiz','assignment','mock_test','exam','aptitude');
create type submission_status as enum ('pending','submitted','graded','late');

-- ---------------------------------------------------------------------
-- 2. IDENTITY & RBAC
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  email        text unique not null,
  role         user_role not null default 'student',
  department   text,
  phone        text,
  avatar_url   text,
  status       text not null default 'active',     -- active | inactive | suspended
  last_login_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. CATALOG: courses & batches
-- ---------------------------------------------------------------------
create table public.courses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  code          text unique,
  domain        text,                               -- e.g. AI & ML, Data Analytics
  fee           numeric(12,2) not null default 0,
  duration_weeks int,
  status        text not null default 'active',
  created_at    timestamptz not null default now()
);

create table public.batches (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete restrict,
  name         text not null,                       -- e.g. AIML - Batch 01
  trainer_id   uuid references public.profiles(id) on delete set null,
  start_date   date,
  end_date     date,
  capacity     int default 30,
  progress     int default 0,                       -- 0-100 (% of syllabus)
  status       batch_status not null default 'active',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. CRM: leads & follow-ups
-- ---------------------------------------------------------------------
create table public.leads (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  mobile          text,
  email           text,
  source          lead_source not null default 'website',
  course_interest uuid references public.courses(id) on delete set null,
  status          lead_status not null default 'new',
  assigned_bd     uuid references public.profiles(id) on delete set null,
  next_followup_at timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.followups (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads(id) on delete cascade,
  bd_id        uuid references public.profiles(id) on delete set null,
  scheduled_at timestamptz not null,
  status       task_status not null default 'pending',
  notes        text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. STUDENTS & ENROLLMENTS
-- ---------------------------------------------------------------------
create table public.students (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references public.profiles(id) on delete set null, -- if they log in
  source_lead    uuid references public.leads(id) on delete set null,
  full_name      text not null,
  email          text,
  mobile         text,
  primary_course uuid references public.courses(id) on delete set null,
  status         text not null default 'active',
  avatar_url     text,
  joined_at      date default current_date,
  created_at     timestamptz not null default now()
);

create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  batch_id    uuid not null references public.batches(id) on delete cascade,
  status      enrollment_status not null default 'active',
  progress    int default 0,
  enrolled_at date default current_date,
  unique (student_id, batch_id)
);

-- ---------------------------------------------------------------------
-- 6. ACADEMICS: attendance, assignments, assessments, materials
-- ---------------------------------------------------------------------
create table public.attendance (
  id         uuid primary key default gen_random_uuid(),
  batch_id   uuid not null references public.batches(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  date       date not null default current_date,
  status     attendance_status not null default 'not_marked',
  marked_by  uuid references public.profiles(id) on delete set null,
  unique (batch_id, student_id, date)
);

create table public.assignments (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references public.batches(id) on delete cascade,
  title       text not null,
  description text,
  due_date    timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.assignment_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  submitted_at  timestamptz,
  score         numeric(5,2),
  status        submission_status not null default 'pending',
  unique (assignment_id, student_id)
);

create table public.assessments (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid references public.batches(id) on delete cascade,
  title        text not null,
  type         assessment_type not null default 'quiz',
  total_marks  numeric(6,2) default 100,
  scheduled_at timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.assessment_results (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  score         numeric(6,2),
  status        submission_status not null default 'pending',
  unique (assessment_id, student_id)
);

create table public.materials (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid references public.courses(id) on delete cascade,
  batch_id    uuid references public.batches(id) on delete cascade,
  title       text not null,
  type        text,                                 -- pdf | video | link | doc
  file_url    text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. APTITUDE (lightweight for Sprint 0)
-- ---------------------------------------------------------------------
create table public.aptitude_shares (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid references public.leads(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  shared_by  uuid references public.profiles(id) on delete set null,
  shared_at  timestamptz not null default now(),
  status     text not null default 'shared',        -- shared | attempted | passed | failed
  score      numeric(6,2)
);

-- ---------------------------------------------------------------------
-- 8. TRAINER ASSIGNMENT (BD screen fidelity)
-- ---------------------------------------------------------------------
create table public.trainer_assignments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  course_id   uuid references public.courses(id) on delete set null,
  trainer_id  uuid references public.profiles(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at date default current_date
);

-- ---------------------------------------------------------------------
-- 9. INTERNSHIP & PLACEMENT
-- ---------------------------------------------------------------------
create table public.internships (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  company    text,
  role       text,
  mentor_id  uuid references public.profiles(id) on delete set null,
  start_date date,
  status     internship_status not null default 'ongoing',
  created_at timestamptz not null default now()
);

create table public.placements (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  company    text,
  role       text,
  package    numeric(12,2),
  status     placement_status not null default 'in_process',
  placed_at  date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 10. FINANCE: invoices & expenses
-- ---------------------------------------------------------------------
create table public.invoices (
  id          uuid primary key default gen_random_uuid(),
  invoice_no  text unique not null,
  student_id  uuid references public.students(id) on delete set null,
  amount      numeric(12,2) not null default 0,
  status      invoice_status not null default 'pending',
  issued_date date default current_date,
  due_date    date,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.expenses (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  amount     numeric(12,2) not null default 0,
  spent_on   date default current_date,
  notes      text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 11. TASKS, DOCUMENTS, NOTIFICATIONS, AUDIT
-- ---------------------------------------------------------------------
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  assigned_to  uuid references public.profiles(id) on delete cascade,
  related_type text,                                -- lead | batch | student | invoice
  related_id   uuid,
  batch_id     uuid references public.batches(id) on delete set null,
  due_date     date,
  status       task_status not null default 'pending',
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text,
  owner_id     uuid references public.profiles(id) on delete set null,
  related_type text,
  related_id   uuid,
  file_url     text,
  created_at   timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.system_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  uuid,
  meta       jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 12. HELPER FUNCTIONS  (SECURITY DEFINER — read role without RLS recursion)
-- ---------------------------------------------------------------------
create or replace function public.auth_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('super_admin','admin'), false)
$$;

-- true if current user is the trainer who owns this batch
create or replace function public.owns_batch(p_batch uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.batches b
    where b.id = p_batch and b.trainer_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------------
-- 13. AUTO-PROFILE on signup  +  updated_at touch
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 14. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
-- Enable on all tables
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname='public'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- PROFILES: read own + staff read all; users update own; staff manage all
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or public.is_staff()
);
create policy profiles_update_self on public.profiles for update using (id = auth.uid());
create policy profiles_staff_all on public.profiles for all using (public.is_staff()) with check (public.is_staff());

-- Generic helper macro: staff full access + authenticated read.
-- Applied to catalog / operational tables that aren't user-sensitive.
do $$
declare t text;
begin
  foreach t in array array[
    'courses','batches','materials','enrollments','assignments',
    'assessments','aptitude_shares','trainer_assignments','documents',
    'internships','placements','expenses','system_logs'
  ]
  loop
    execute format('create policy %I_read on public.%I for select using (auth.role() = ''authenticated'')', t, t);
    execute format('create policy %I_staff on public.%I for all using (public.is_staff()) with check (public.is_staff())', t, t);
  end loop;
end $$;

-- LEADS: staff all; BD sees all leads, writes own assigned
create policy leads_read on public.leads for select using (auth.role()='authenticated');
create policy leads_staff on public.leads for all using (public.is_staff()) with check (public.is_staff());
create policy leads_bd_write on public.leads for update using (
  public.auth_role()='bd' and assigned_bd = auth.uid()
);
create policy leads_bd_insert on public.leads for insert with check (
  public.auth_role() in ('bd','super_admin','admin')
);

-- FOLLOWUPS: staff all; BD manages own
create policy followups_read on public.followups for select using (auth.role()='authenticated');
create policy followups_staff on public.followups for all using (public.is_staff()) with check (public.is_staff());
create policy followups_bd on public.followups for all using (bd_id = auth.uid()) with check (bd_id = auth.uid());

-- STUDENTS: staff all; authenticated read; student reads own
create policy students_read on public.students for select using (auth.role()='authenticated');
create policy students_staff on public.students for all using (public.is_staff()) with check (public.is_staff());
create policy students_self on public.students for select using (profile_id = auth.uid());

-- ATTENDANCE: staff all; trainer manages own batch; student reads own
create policy attendance_staff on public.attendance for all using (public.is_staff()) with check (public.is_staff());
create policy attendance_trainer on public.attendance for all
  using (public.owns_batch(batch_id)) with check (public.owns_batch(batch_id));
create policy attendance_student on public.attendance for select using (
  exists (select 1 from public.students s where s.id = attendance.student_id and s.profile_id = auth.uid())
);

-- ASSIGNMENT_SUBMISSIONS / ASSESSMENT_RESULTS: staff all; trainer via batch; student own
create policy subs_staff on public.assignment_submissions for all using (public.is_staff()) with check (public.is_staff());
create policy subs_read on public.assignment_submissions for select using (auth.role()='authenticated');
create policy results_staff on public.assessment_results for all using (public.is_staff()) with check (public.is_staff());
create policy results_read on public.assessment_results for select using (auth.role()='authenticated');

-- INVOICES: staff + BD full; students read own
create policy invoices_staff on public.invoices for all using (public.is_staff()) with check (public.is_staff());
create policy invoices_bd on public.invoices for all using (public.auth_role()='bd') with check (public.auth_role()='bd');
create policy invoices_self on public.invoices for select using (
  exists (select 1 from public.students s where s.id = invoices.student_id and s.profile_id = auth.uid())
);

-- TASKS: staff all; users see/manage own
create policy tasks_staff on public.tasks for all using (public.is_staff()) with check (public.is_staff());
create policy tasks_own on public.tasks for all using (assigned_to = auth.uid()) with check (assigned_to = auth.uid());

-- NOTIFICATIONS: each user their own
create policy notif_own on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 15. INDEXES
-- ---------------------------------------------------------------------
create index on public.leads (assigned_bd, status);
create index on public.leads (next_followup_at);
create index on public.batches (trainer_id);
create index on public.enrollments (batch_id);
create index on public.attendance (batch_id, date);
create index on public.invoices (status);
create index on public.tasks (assigned_to, status);

-- =====================================================================
-- End of 0001_init.sql
-- =====================================================================
