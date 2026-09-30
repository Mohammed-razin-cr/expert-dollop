import { createClient } from '@/lib/api/server'
import { CertManager } from '@/components/certificates/CertManager'
import { CertificatesBoard } from '@/components/certificates/CertificatesBoard'
import { getViewer, trainerStudentIds, orNothing } from '@/lib/trainer'
import { loadCertificates } from '@/lib/certificates'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

/**
 * Certificate requests.
 *
 * Trainers get the review board — completion, score and eligibility for
 * their own students, with approve and reject. Admin and super_admin get
 * the same board (they see every batch, not just one trainer's), plus
 * Edit/Delete on each request — the `cert_requests_staff` RLS policy
 * already grants them that, so the UI just needed to catch up. BD is the
 * only role left on the simpler screen below.
 */
export default async function CertificatesPage() {
  const supabase = await createClient()
  const viewer = await getViewer(supabase)

  if (viewer.role === 'trainer' || viewer.role === 'admin' || viewer.role === 'super_admin') {
    const data = await loadCertificates(supabase, viewer)

    // Certificate numbers continue from however many have been issued, so
    // two approvals never land on the same one.
    const { count } = await supabase
      .from('cert_requests')
      .select('*', { count: 'exact', head: true })
      .not('certificate_id', 'is', null)

    const canManage = viewer.role === 'admin' || viewer.role === 'super_admin'

    return <CertificatesBoard {...data} userId={viewer.id} nextSeq={(count ?? 0) + 1} canManage={canManage} />
  }

  // ---------------------------------------------------------------------
  // Original screen — unchanged. BD path.
  // ---------------------------------------------------------------------
  const myStudentIds = viewer.scoped ? await trainerStudentIds(supabase, viewer.id) : null

  let rowsQ = supabase
    .from('cert_requests')
    .select('id, type, request_date, status, sent_date, certificate_id, students(full_name)')
    .is('deleted_at', null)
    .order('request_date', { ascending: false })
    .limit(500)

  let studentsQ = supabase
    .from('students')
    .select('id, full_name')
    .is('deleted_at', null)
    .order('full_name')
    .limit(500)

  if (myStudentIds) {
    rowsQ = rowsQ.in('student_id', orNothing(myStudentIds))
    studentsQ = studentsQ.in('id', orNothing(myStudentIds))
  }

  const [{ data: rows = [] }, { data: students = [] }] = await Promise.all([rowsQ, studentsQ])

  const out = (rows ?? []).map((r: any) => ({
    id: r.id,
    type: r.type,
    request_date: r.request_date,
    status: r.status,
    sent_date: r.sent_date,
    certificate_id: r.certificate_id,
    student: one(r.students)?.full_name ?? null,
  }))

  return <CertManager rows={out as any} students={(students ?? []) as any} />
}
