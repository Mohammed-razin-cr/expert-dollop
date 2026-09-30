# Electrobtech OMS

Multi-role operations platform (Trainer · BD · Admin) on **Next.js 16 (App Router) + Supabase + Vercel**.

## Stack
- Next.js 16 / React 19, TypeScript, Tailwind v4
- Supabase (Postgres + Auth + RLS), `@supabase/ssr` cookie sessions
- lucide-react icons

## Sprint 0 — what's in here
- `supabase/migrations/0001_init.sql` — full schema (23 tables), enums, RLS, auth-profile trigger
- Auth wiring: browser + server Supabase clients, session-refresh middleware, route protection
- RBAC: role enum + per-role sidebar nav transcribed from the mockups
- App shell (sidebar + topbar), login, sign-out, role-routed dashboard with live KPIs
- `scripts/seed.ts` — creates the 6 demo users + seed data so every dashboard renders

---

## Setup (Windows / PowerShell)

**0. Prereqs:** Node 20+ and a Supabase project (free tier is fine).

**1. Install**
```powershell
cd electrobtech-oms
npm install
```

**2. Configure env**
```powershell
Copy-Item .env.local.example .env.local
```
Fill in from Supabase → **Project Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, used by the seed script)

**3. Run the migration**
Supabase Dashboard → **SQL Editor** → paste the contents of
`supabase/migrations/0001_init.sql` → **Run**.

**4. Seed demo users + data**
```powershell
npm run seed
```
Creates these logins (password `Password@123` — change after first login):

| Role        | Email                     |
|-------------|---------------------------|
| super_admin | admin@electrobtech.in     |
| admin       | megha@electrobtech.in     |
| bd          | sangee@electrobtech.in    |
| trainer     | harish@electrobtech.in    |

**5. Run**
```powershell
npm run dev
```
Open http://localhost:3000 → you'll be sent to `/login`. Sign in as any user above
and the dashboard adapts to that role.

**6. Generate accurate DB types (recommended)**
```powershell
npx supabase login
npx supabase gen types typescript --project-id <your-ref> --schema public > src/lib/database.types.ts
```

---

## Deploy to Vercel
1. Push to your `Electrobtech/electrobtech-oms` repo.
2. Import the repo in Vercel.
3. Add the three env vars in Vercel → Project → Settings → Environment Variables
   (keep `SUPABASE_SERVICE_ROLE_KEY` out of any client code).
4. Deploy. Set the Supabase **Site URL** + redirect URLs to your Vercel domain.

## Project layout
```
src/
  app/
    (auth)/login/         sign-in
    (dashboard)/          protected shell + layout
      dashboard/          role-routed dashboard
      [...module]/        placeholder for unbuilt modules
    auth/signout/         POST sign-out
  components/shell/       Sidebar, Topbar
  lib/
    supabase/             client, server, middleware
    rbac.ts  nav.ts  database.types.ts
  middleware.ts           session refresh + route gating
supabase/migrations/      0001_init.sql
scripts/seed.ts
```

## Next sprints (roadmap)
- **Sprint 1** — Trainer dashboard, pixel-matched (batches, schedule, attendance donut, performance bars, students-needing-attention, pending tasks) + Attendance module
- **Sprint 2** — BD dashboard + Leads/CRM (funnel, lead table, follow-ups, Kanban statuses)
- **Sprint 3** — Admin dashboard + User Management + Finance/Invoicing
- **Sprint 4+** — Aptitude, Internship/Placement, Reports/Analytics, Documents, Chat/notifications
