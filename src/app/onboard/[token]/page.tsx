import { createAdminClient } from '@/lib/api/admin'
import { AcceptPortal } from '@/components/onboarding/AcceptPortal'

export const metadata = { title: 'Onboarding · Electrobtech' }

export default async function OnboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()
  const { data: rec } = await admin.from('onboarding').select('*').eq('token', token).is('deleted_at', null).single()

  if (!rec) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4 text-center">
        <div><h1 className="text-lg font-semibold text-slate-900">Link not found</h1><p className="mt-1 text-sm text-slate-500">This onboarding link is invalid or has expired. Please contact your coordinator.</p></div>
      </div>
    )
  }

  const details = {
    intern_name: rec.intern_name, role: rec.role, start_date: rec.start_date, end_date: rec.end_date,
    stipend: rec.stipend, reporting_manager: rec.reporting_manager, college: rec.college,
    duration: rec.duration, university_reg_no: rec.university_reg_no, branch: rec.branch,
    semester: rec.semester, acceptance_deadline: rec.acceptance_deadline,
  }
  return <AcceptPortal token={token} details={details} alreadyAccepted={rec.status === 'accepted'} acceptedName={rec.accepted_name} />
}
