import Link from 'next/link'
import { createClient } from '@/lib/api/server'
import { getViewer } from '@/lib/trainer'
import { loadTrainerStudents } from '@/lib/students'
import { TrainerStudentBoard } from '@/components/students/TrainerStudentBoard'
import { StudentRowActions } from '@/components/students/StudentRowActions'
import { LiveSearchInput } from '@/components/shared/LiveSearchInput'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const PAGE_SIZE = 50

/**
 * Students.
 *
 * Trainers get their own board — their students, with attendance, progress
 * and scores. Every other role falls through to the original list below,
 * byte for byte as it was, so BD, admin and super_admin are unaffected.
 */
export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; mine?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const viewer = await getViewer(supabase)

  if (viewer.role === 'trainer') {
    const data = await loadTrainerStudents(supabase, viewer.id)
    return (
      <TrainerStudentBoard
        rows={data.rows}
        stats={data.stats}
        courses={data.courses}
        batches={data.batches}
      />
    )
  }

  // ---------------------------------------------------------------------
  // Original list — unchanged. BD / admin / super_admin path.
  // ---------------------------------------------------------------------
  // Who may change a student. The `students_staff` RLS policy is the real
  // gate — `for all using (is_staff())`, which is admin and super_admin — so
  // a BD's update or delete is refused by the database. Showing a BD the
  // controls anyway would only produce a refusal they cannot act on.
  const canManage = viewer.role === 'admin' || viewer.role === 'super_admin'
  const mine = sp.mine === 'true'
  const q = (sp.q ?? '').trim()
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let query
  if (mine && user) {
    const { data: trainerBatches = [] } = await supabase
      .from('batches')
      .select('id')
      .eq('trainer_id', user.id)

    const batchIds = (trainerBatches ?? []).map((b: any) => b.id)
    const { data: enrollments = [] } = await supabase
      .from('enrollments')
      .select('student_id')
      .in(
        'batch_id',
        batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000'],
      )
    const studentIds = [...new Set((enrollments ?? []).map((e: any) => e.student_id))]
    query = supabase
      .from('students')
      .select('id, full_name, mobile, email, status, joined_at, source_lead, courses(name)', { count: 'exact' })
      // Removing a student stamps deleted_at rather than dropping the row.
      // Without this the row stayed on the list afterwards and the delete
      // looked like it had silently failed.
      .is('deleted_at', null)
      .in(
        'id',
        studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000'],
      )
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
  } else {
    query = supabase
      .from('students')
      .select('id, full_name, mobile, email, status, joined_at, source_lead, courses(name)', { count: 'exact' })
      // Removing a student stamps deleted_at rather than dropping the row.
      // Without this the row stayed on the list afterwards and the delete
      // looked like it had silently failed.
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
  }

  if (q) {
    const safe = q.replace(/[,%]/g, ' ')
    query = query.or(`full_name.ilike.%${safe}%,mobile.ilike.%${safe}%`)
  }

  const { data: students = [], count = 0 } = await query
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const link = (p: number) => `/students?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ''}`

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Students</h1>
        <p className="text-sm text-slate-500">{(count ?? 0).toLocaleString('en-IN')} students{q ? ` · matching “${q}”` : ''}</p>
      </div>

      {/* The list narrows as you type. The Search button that used to sit here
          applied nothing else, so with a live term it had no job left. */}
      <div className="flex gap-2">
        <LiveSearchInput
          value={q}
          placeholder="Search by name or mobile…"
          className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />
        {q && <Link href="/students" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Clear</Link>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              {canManage && <th className="px-4 py-3 font-medium text-center">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {(students ?? []).map((s: any) => (
              <tr key={s.id} className="border-t border-slate-100">
                {/* The edit screen already existed at /students/[id]; nothing on
                    this list reached it, so an admin had to know the URL. */}
                <td className="px-4 py-2.5 font-medium">
                  <Link href={`/students/${s.id}`} className="text-slate-800 hover:text-blue-600 hover:underline">{s.full_name}</Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{s.mobile ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">{s.email ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">{one(s.courses)?.name ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{s.joined_at ?? '—'}</td>
                {canManage && (
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <Link href={`/students/${s.id}`} className="rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200">Edit</Link>
                      <StudentRowActions id={s.id} sourceLead={s.source_lead ?? null} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!(students ?? []).length && (
              <tr><td colSpan={canManage ? 6 : 5} className="px-4 py-6 text-center text-slate-400">No students yet. Convert a lead from the Leads page.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={link(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600">Previous</Link>}
          {page < totalPages && <Link href={link(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600">Next</Link>}
        </div>
      </div>
    </div>
  )
}
