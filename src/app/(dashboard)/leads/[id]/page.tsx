import { notFound } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { LeadDetail } from '@/components/leads/LeadDetail'

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ back?: string | string[] }>
}) {
  const { id } = await params
  const { back } = await searchParams
  // The filtered list this lead was opened from, carried in on `back` as that
  // list's own query string, so Close / X / Delete land back on it instead of
  // a reset /leads.
  //
  // Re-serialised through URLSearchParams and always hung off /leads: whatever
  // the param holds can only ever come out as leads-list params, so it can't
  // be turned into a redirect somewhere else. Missing or empty — a lead opened
  // from Follow-ups, Pipeline, a bookmark — falls back to plain /leads, which
  // is exactly what those entry points did before.
  const backQs = new URLSearchParams(
    Array.isArray(back) ? back[0] ?? '' : back ?? ''
  ).toString()
  const backHref = backQs ? `/leads?${backQs}` : '/leads'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const [{ data: lead },{ data: courses = [] },{ data: followups = [] },{ data: bds = [] },{ data: allProfiles = [] },{ data: history = [] },] = await Promise.all([
  supabase.from('leads')
  .select(`
  id,
  name,
  assigned_bd,
  mobile,
  email,
  college,
  status,
  temperature,
  source_detail,
  source,
  category,
  enquiry_date,
  course_interest,
  plan,
  pathway,
  pathway_details,
  fu_count,

  place_city,
  branch,
  degree,
  cgpa,
  year_of_passing,
  dob,
  current_location,
  graduation_status,
  remarks,
  next_followup_at,
  updated_by,
  updated_by_name,
  updated_at,
  created_at
`)
      .eq('id', id).single(),
    supabase.from('courses').select('id, name').order('name'),
    supabase.from('followups').select('id, type, outcome, notes, scheduled_at, created_at').eq('lead_id', id).order('created_at', { ascending: false }),
    // Counsellor is BD-equivalent, so it's assignable as a lead owner too.
    supabase.from('profiles').select('id, full_name').in('role', ['bd', 'counsellor']).order('full_name'),
    supabase.from('profiles').select('id, full_name'),
    // Table + trigger from migration 023 - may not exist yet on every
    // environment, so a missing-table error is swallowed to an empty
    // list rather than failing the whole page.
    supabase.from('lead_assignment_history').select('id, from_bd, to_bd, changed_by, changed_at').eq('lead_id', id).order('changed_at', { ascending: false }).then((r) => (r.error ? { data: [] } : r)),
  ])
  if (!lead) notFound()

  return (<LeadDetail lead={lead as any} followups={(followups ?? []) as any} courses={(courses ?? []) as any} bds={(bds ?? []) as any} allProfiles={(allProfiles ?? []) as any} history={(history ?? []) as any} currentUserId={user!.id} role={(profile as any)?.role} backHref={backHref}/>
)
}
