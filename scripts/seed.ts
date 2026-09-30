/**
 * Seed the Electrobtech OMS with demo users + rich data for the dashboards.
 * Safe to re-run: users are reused, all demo DATA tables are wiped and rebuilt.
 *
 *   npm run seed
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!url || !serviceKey) throw new Error('Missing SUPABASE env vars in .env.local')

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_PASSWORD = 'Password@123'
const ALL = '00000000-0000-0000-0000-000000000000' // sentinel for "delete all rows"

const USERS = [
  { email: 'admin@electrobtech.in', full_name: 'Admin User', role: 'super_admin', department: 'Management' },
  { email: 'megha@electrobtech.in', full_name: 'Megha', role: 'admin', department: 'Operations' },
  { email: 'sangee@electrobtech.in', full_name: 'Sangeetha', role: 'bd', department: 'Business Development' },
  { email: 'sujal@electrobtech.in', full_name: 'Sujal', role: 'bd', department: 'Business Development' },
  { email: 'harish@electrobtech.in', full_name: 'Harish', role: 'trainer', department: 'AI & ML' },
  { email: 'amulya@electrobtech.in', full_name: 'Amulya', role: 'trainer', department: 'Data Analytics' },
] as const

async function ensureUser(u: (typeof USERS)[number]): Promise<string> {
  const { data: created } = await db.auth.admin.createUser({
    email: u.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.full_name, role: u.role },
  })
  let id = created?.user?.id
  if (!id) {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((x) => x.email === u.email)?.id
  }
  if (!id) throw new Error(`Could not create/find ${u.email}`)
  await db.from('profiles').update({ role: u.role, department: u.department, full_name: u.full_name }).eq('id', id)
  return id
}

async function wipe() {
  const order = [
    'attendance', 'assignment_submissions', 'assessment_results', 'enrollments',
    'assignments', 'assessments', 'materials', 'aptitude_shares', 'trainer_assignments',
    'internships', 'placements', 'tasks', 'invoices', 'followups', 'leads', 'students', 'batches',
  ]
  for (const t of order) await db.from(t).delete().neq('id', ALL)
}

function weekdaysThisMonth(): string[] {
  const out: string[] = []
  const now = new Date()
  for (let d = 1; d <= now.getDate(); d++) {
    const dt = new Date(now.getFullYear(), now.getMonth(), d)
    const day = dt.getDay()
    if (day !== 0 && day !== 6) out.push(dt.toISOString().slice(0, 10))
  }
  return out
}

const rint = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a

async function main() {
  console.log('-> users'); const id: Record<string, string> = {}
  for (const u of USERS) id[u.email] = await ensureUser(u)
  const harish = id['harish@electrobtech.in']
  const amulya = id['amulya@electrobtech.in']
  const sangee = id['sangee@electrobtech.in']

  console.log('-> reset demo data'); await wipe()

  console.log('-> courses')
  const { data: courseRows } = await db.from('courses').upsert(
    [
      { name: 'AI & ML', code: 'AIML', domain: 'AI & ML', fee: 75000, duration_weeks: 16 },
      { name: 'Data Analytics', code: 'DA', domain: 'Data Analytics', fee: 60000, duration_weeks: 12 },
      { name: 'Full Stack Dev', code: 'FSD', domain: 'Full Stack', fee: 65000, duration_weeks: 20 },
      { name: 'Python Programming', code: 'PY', domain: 'Python', fee: 35000, duration_weeks: 8 },
      { name: 'UI/UX Design', code: 'UIUX', domain: 'Design', fee: 40000, duration_weeks: 10 },
    ],
    { onConflict: 'code' },
  ).select()
  const C = Object.fromEntries((courseRows ?? []).map((c) => [c.code, c.id]))

  console.log('-> batches')
  const { data: batchRows } = await db.from('batches').insert([
    { course_id: C.AIML, name: 'AIML - Batch 01', trainer_id: harish, progress: 75 },
    { course_id: C.PY, name: 'Python - Batch 02', trainer_id: harish, progress: 80 },
    { course_id: C.DA, name: 'Data Analytics - Batch 01', trainer_id: amulya, progress: 68 },
    { course_id: C.FSD, name: 'Full Stack - Batch 01', trainer_id: amulya, progress: 70 },
  ]).select()
  const B = Object.fromEntries((batchRows ?? []).map((b) => [b.name, b.id]))

  console.log('-> students')
  const studentDefs = [
    { full_name: 'Rahul Sharma', mobile: '9876543210', course: 'AIML', batch: 'AIML - Batch 01', att: 0.56, score: [44, 52] },
    { full_name: 'Anurag Singh', mobile: '9871122334', course: 'AIML', batch: 'AIML - Batch 01', att: 0.60, score: [48, 56] },
    { full_name: 'Pooja N', mobile: '9988776655', course: 'AIML', batch: 'AIML - Batch 01', att: 0.65, score: [50, 60] },
    { full_name: 'Kiran M', mobile: '9911223344', course: 'AIML', batch: 'AIML - Batch 01', att: 0.58, score: [46, 54] },
    { full_name: 'Neha Singh', mobile: '9911334455', course: 'PY', batch: 'Python - Batch 02', att: 0.90, score: [78, 92] },
    { full_name: 'Arjun M', mobile: '9810011223', course: 'PY', batch: 'Python - Batch 02', att: 0.88, score: [72, 88] },
    { full_name: 'Divya R', mobile: '9820022334', course: 'PY', batch: 'Python - Batch 02', att: 0.92, score: [80, 95] },
    { full_name: 'Sneha P', mobile: '9830033445', course: 'DA', batch: 'Data Analytics - Batch 01', att: 0.86, score: [70, 85] },
    { full_name: 'Vikram R', mobile: '9133557799', course: 'DA', batch: 'Data Analytics - Batch 01', att: 0.84, score: [68, 82] },
    { full_name: 'Karthik S', mobile: '9840044556', course: 'FSD', batch: 'Full Stack - Batch 01', att: 0.89, score: [75, 90] },
  ]
  const { data: studentRows } = await db.from('students').insert(
    studentDefs.map((s) => ({ full_name: s.full_name, mobile: s.mobile, primary_course: C[s.course] })),
  ).select()
  const SID = Object.fromEntries((studentRows ?? []).map((s) => [s.full_name, s.id]))
  studentDefs.forEach((s) => ((s as any).id = SID[s.full_name]))

  console.log('-> enrollments')
  await db.from('enrollments').insert(
    studentDefs.map((s) => ({ student_id: (s as any).id, batch_id: B[s.batch], progress: rint(40, 85) })),
  )

  console.log('-> attendance (this month)')
  const days = weekdaysThisMonth()
  const attRows: any[] = []
  for (const s of studentDefs) {
    for (const d of days) {
      const r = Math.random()
      let status: string
      if (r < s.att) status = 'present'
      else if (r < s.att + 0.1) status = 'late'
      else status = 'absent'
      attRows.push({ batch_id: B[s.batch], student_id: (s as any).id, date: d, status, marked_by: harish })
    }
  }
  for (let i = 0; i < attRows.length; i += 500) await db.from('attendance').insert(attRows.slice(i, i + 500))

  console.log('-> assessments + results')
  const { data: assessRows } = await db.from('assessments').insert([
    { batch_id: B['AIML - Batch 01'], title: 'ML Fundamentals Quiz', type: 'quiz', total_marks: 100, created_by: harish },
    { batch_id: B['Python - Batch 02'], title: 'Python Basics Quiz', type: 'quiz', total_marks: 100, created_by: harish },
    { batch_id: B['Data Analytics - Batch 01'], title: 'Statistics Quiz', type: 'quiz', total_marks: 100, created_by: amulya },
  ]).select()
  const resultRows: any[] = []
  for (const a of assessRows ?? []) {
    const inBatch = studentDefs.filter((s) => B[s.batch] === a.batch_id)
    for (const s of inBatch) {
      resultRows.push({ assessment_id: a.id, student_id: (s as any).id, score: rint(s.score[0], s.score[1]), status: 'graded' })
    }
  }
  if (resultRows.length) await db.from('assessment_results').insert(resultRows)

  console.log('-> assignments + submissions')
  const { data: asgRows } = await db.from('assignments').insert([
    { batch_id: B['AIML - Batch 01'], title: 'Linear Regression', created_by: harish, due_date: new Date(Date.now() + 2 * 864e5).toISOString() },
    { batch_id: B['Python - Batch 02'], title: 'Functions & Modules', created_by: harish, due_date: new Date(Date.now() + 3 * 864e5).toISOString() },
  ]).select()
  const subRows: any[] = []
  for (const a of asgRows ?? []) {
    const inBatch = studentDefs.filter((s) => B[s.batch] === a.batch_id)
    inBatch.forEach((s, i) => {
      const graded = i % 2 === 0
      subRows.push({
        assignment_id: a.id, student_id: (s as any).id,
        status: graded ? 'graded' : 'submitted',
        score: graded ? rint(s.score[0], s.score[1]) : null,
        submitted_at: new Date().toISOString(),
      })
    })
  }
  if (subRows.length) await db.from('assignment_submissions').insert(subRows)

  console.log('-> tasks')
  await db.from('tasks').insert([
    { title: 'Grade Quiz - Python', assigned_to: harish, status: 'pending', batch_id: B['Python - Batch 02'], due_date: '2026-06-18' },
    { title: 'Review Assignment - AI & ML', assigned_to: harish, status: 'pending', batch_id: B['AIML - Batch 01'], due_date: '2026-06-19' },
    { title: 'Upload Study Material', assigned_to: harish, status: 'pending', batch_id: B['AIML - Batch 01'], due_date: '2026-06-21' },
    { title: 'Conduct Mock Test', assigned_to: harish, status: 'pending', batch_id: B['AIML - Batch 01'], due_date: '2026-06-22' },
    { title: 'Send Aptitude Link - Vikram R', assigned_to: sangee, status: 'pending', due_date: '2026-06-18' },
    { title: 'Follow-up Call - Priya N', assigned_to: sangee, status: 'pending', due_date: '2026-06-18' },
    { title: 'Demo Confirmation - Sai Kumar', assigned_to: sangee, status: 'pending', due_date: '2026-06-19' },
    { title: 'Fee Discussion - Rahul Sharma', assigned_to: sangee, status: 'pending', due_date: '2026-06-19' },
    { title: 'Admission Follow-up - Anurag Singh', assigned_to: sangee, status: 'pending', due_date: '2026-06-20' },
  ])

  console.log('-> leads (BD pipeline)')
  const leadDefs = [
    ['Anurag Singh', '9871122334', 'website', 'AIML', 'interested'],
    ['Priya N', '9900223344', 'college', 'DA', 'demo_scheduled'],
    ['Vikram R', '9133557799', 'referral', 'FSD', 'aptitude_shared'],
    ['Sai Kumar', '9845678901', 'social_media', 'PY', 'new'],
    ['Megha K', '9988776655', 'website', 'UIUX', 'contacted'],
    ['Rohit Kumar', '9900112233', 'website', 'AIML', 'interested'],
    ['Sneha Rao', '9876012345', 'college', 'DA', 'new'],
    ['Arjun Reddy', '9845123456', 'referral', 'FSD', 'contacted'],
    ['Deepa S', '9812345678', 'social_media', 'PY', 'demo_scheduled'],
    ['Karthik V', '9823456789', 'website', 'AIML', 'aptitude_shared'],
    ['Nisha M', '9834567890', 'walk_in', 'UIUX', 'passed'],
    ['Suresh B', '9845678123', 'college', 'DA', 'enrolled'],
    ['Lakshmi N', '9856789012', 'referral', 'AIML', 'enrolled'],
    ['Manoj P', '9867890123', 'website', 'PY', 'new'],
    ['Pooja Hegde', '9878901234', 'social_media', 'FSD', 'contacted'],
    ['Ravi Teja', '9889012345', 'website', 'AIML', 'interested'],
    ['Anjali K', '9890123456', 'college', 'UIUX', 'new'],
    ['Vinay R', '9801234567', 'referral', 'DA', 'lost'],
  ]
  const { data: leadRows } = await db.from('leads').insert(
    leadDefs.map(([name, mobile, source, course, status]) => ({
      name, mobile, source, status, course_interest: C[course], assigned_bd: sangee,
    })),
  ).select()
  const LID = Object.fromEntries((leadRows ?? []).map((l) => [l.name, l.id]))

  console.log('-> follow-ups (some today)')
  const t = new Date()
  const at = (h: number, m: number) => new Date(t.getFullYear(), t.getMonth(), t.getDate(), h, m).toISOString()
  await db.from('followups').insert([
    { lead_id: LID['Anurag Singh'], bd_id: sangee, scheduled_at: at(10, 0), status: 'pending' },
    { lead_id: LID['Rohit Kumar'], bd_id: sangee, scheduled_at: at(11, 30), status: 'pending' },
    { lead_id: LID['Priya N'], bd_id: sangee, scheduled_at: at(14, 0), status: 'pending' },
    { lead_id: LID['Deepa S'], bd_id: sangee, scheduled_at: at(16, 0), status: 'pending' },
    { lead_id: LID['Megha K'], bd_id: sangee, scheduled_at: at(17, 0), status: 'pending' },
    { lead_id: LID['Suresh B'], bd_id: sangee, scheduled_at: new Date(Date.now() - 864e5).toISOString(), status: 'done' },
  ])

  console.log('-> trainer assignments')
  await db.from('trainer_assignments').insert([
    { student_id: SID['Anurag Singh'], course_id: C.AIML, trainer_id: harish, assigned_by: sangee },
    { student_id: SID['Rahul Sharma'], course_id: C.DA, trainer_id: amulya, assigned_by: sangee },
    { student_id: SID['Pooja N'], course_id: C.PY, trainer_id: harish, assigned_by: sangee },
    { student_id: SID['Kiran M'], course_id: C.FSD, trainer_id: amulya, assigned_by: sangee },
    { student_id: SID['Neha Singh'], course_id: C.UIUX, trainer_id: amulya, assigned_by: sangee },
  ])

  console.log('-> invoices')
  await db.from('invoices').insert([
    { invoice_no: 'ET20250041', student_id: SID['Neha Singh'], amount: 55000, status: 'pending' },
    { invoice_no: 'ET20250042', student_id: SID['Kiran M'], amount: 20000, status: 'paid' },
    { invoice_no: 'ET20250043', student_id: SID['Pooja N'], amount: 45000, status: 'pending' },
    { invoice_no: 'ET20250044', student_id: SID['Anurag Singh'], amount: 60000, status: 'paid' },
    { invoice_no: 'ET20250045', student_id: SID['Rahul Sharma'], amount: 50000, status: 'paid' },
    { invoice_no: 'ET20250046', student_id: SID['Divya R'], amount: 35000, status: 'paid' },
    { invoice_no: 'ET20250047', student_id: SID['Sneha P'], amount: 60000, status: 'pending' },
  ])

  console.log('\n[done] Seed complete. Login / password: ' + DEMO_PASSWORD)
  USERS.forEach((u) => console.log('    ' + u.role.padEnd(12) + ' ' + u.email))
}

main().catch((e) => { console.error(e); process.exit(1) })
