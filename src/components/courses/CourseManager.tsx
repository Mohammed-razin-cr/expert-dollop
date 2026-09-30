'use client'

import { useEffect, useMemo, useState } from 'react'
// import { useRouter } from 'next/navigation'
import { Plus, BookOpen, Layers, Search, X } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { isBD, isStaff, type Role } from '@/lib/rbac'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import type { Update } from '@/lib/database.types'

type Course = { id: string; name: string; code: string | null; domain: string | null; fee: number; duration_weeks: number | null; status: string; batch_count: number }
type Batch = { id: string; name: string; course: string | null; trainer: string | null; start_date: string | null; end_date: string | null; capacity: number | null; progress: number | null; status: string }
type Trainer = { id: string; full_name: string }
type StudentOpt = { id: string; full_name: string; email: string | null; mobile: string | null }

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
const BATCH_ST = ['planned', 'active', 'completed', 'cancelled']

/**
 * A row-level-security refusal on UPDATE is not an error.
 *
 * An INSERT the policies reject comes back as 42501 and shows itself. An
 * UPDATE they reject simply matches no row: the statement ran, changed
 * nothing, and PostgREST answers 200 — and the form closes as though it
 * saved. So the course writes below ask for the changed rows back and
 * report an empty answer as the refusal it is.
 *
 * Batch writes do not need this: they go through /api/batches, which
 * answers with a status.
 */
const refused = (what: 'courses') =>
  `Not saved — the database refused the change. Your account may not have permission to edit ${what}.`

/**
 * POST or PATCH /api/batches. Returns an error message, or null on success.
 *
 * Batches and their enrolments are written server side because a BD is not
 * `is_staff()` and so cannot write either table directly; the route checks
 * the caller's role from their session before using the service key.
 */
async function saveBatch(method: 'POST' | 'PATCH', payload: Record<string, unknown>) {
  let res: Response
  try {
    res = await fetch('/api/batches', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    return 'Could not reach the server. Check your connection and try again.'
  }
  const out = await res.json().catch(() => null)
  if (!res.ok) return (out as any)?.error ?? `Could not save the batch (${res.status}).`
  return null
}

export function CourseManager({ courses, batches, trainers, courseOpts, role, defaultTab, showTabs = true, heading, enrolledByBatch = {} }: {
    courses: Course[]
  batches: Batch[]
  trainers: Trainer[]
  courseOpts: { id: string; name: string }[]
  role: string
  /** Which tab opens first. `?tab=` still wins when present. */
  defaultTab?: 'courses' | 'batches'
  /** Hidden on the dedicated /batches route, and for trainers, who reach
   *  Courses and Batches from separate sidebar entries. */
  showTabs?: boolean
  heading?: string
  /** Who is already enrolled in each batch, keyed by batch id. Optional so
   *  callers that never open the batch form need not load it. */
  enrolledByBatch?: Record<string, { id: string; full_name: string }[]>
  })
  {
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const batchFilter = searchParams.get('status')
  const filteredBatches =batchFilter === 'active'? batches.filter((batch) => batch.status === 'active'): batches
  const [tab, setTab] = useState<'courses' | 'batches'>(
    searchParams.get('tab') === 'batches' ? 'batches' : (defaultTab ?? 'courses'),
  )
  // const [tab, setTab] = useState<'courses' | 'batches'>('courses')
  const [cOpen, setCOpen] = useState(false)
  const [bOpen, setBOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [c, setC] = useState({ name: '', code: '', domain: '', fee: '', duration_weeks: '' })
  const [editingCourse, setEditingCourse] = useState<string | null>(null)
  const [b, setB] = useState({ course_id: '', name: '', trainer_id: '', start_date: '', end_date: '', capacity: '30' })
  const [editingBatch, setEditingBatch] = useState<string | null>(null)

  // ---- the batch roll -------------------------------------------------
  // Students picked in the open batch form. Saving sends the whole list and
  // the server applies the difference against the batch's own roll, so two
  // people editing one batch cannot talk each other into dropping somebody.
  const [picked, setPicked] = useState<string[]>([])
  const [pool, setPool] = useState<StudentOpt[] | null>(null)
  const [poolErr, setPoolErr] = useState<string | null>(null)
  // Typed instantly, filtered a beat later — the house pattern for every
  // search box in the app.
  const [qInput, setQInput] = useState('')
  const q = useDebouncedValue(qInput)
  const [busy, setBusy] = useState(false)

  // BD reads the courses catalogue, it does not run it. The
  // `courses_staff` policy is `for all using (is_staff())`, so a BD's
  // insert is refused outright and their update matches no row and reports
  // success having changed nothing. Offering the controls would only
  // produce a refusal, or worse, a silent one.
  // Counsellor is BD-equivalent — no course write, same as a BD.
  const canWrite = !isBD(role as Role)
  // Batches are the exception: a BD runs the intake, so they create a batch
  // and fill it. `batches_bd` / `enrollments_bd`
  // (37_batch_enrolment_for_bd.sql) are what make that stick in the
  // database; deleting a batch stays with admins, as below.
  const canWriteBatches = isStaff(role as Role) || isBD(role as Role)

  // The student list is only needed once a batch form is open, so it is
  // fetched then rather than on every page load of Courses and Batches.
  useEffect(() => {
    if (!bOpen || pool !== null) return
    let live = true
    ;(async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, email, mobile')
        .is('deleted_at', null)
        .order('full_name')
      if (!live) return
      if (error) return setPoolErr(error.message)
      setPool((data ?? []) as StudentOpt[])
    })()
    return () => {
      live = false
    }
  }, [bOpen, pool, supabase])

  const pickedSet = useMemo(() => new Set(picked), [picked])
  const nameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of pool ?? []) m[s.id] = s.full_name
    for (const list of Object.values(enrolledByBatch)) for (const s of list) m[s.id] ??= s.full_name
    return m
  }, [pool, enrolledByBatch])

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const all = pool ?? []
    if (!needle) return all
    return all.filter((s) =>
      [s.full_name, s.email, s.mobile].some((v) => (v ?? '').toLowerCase().includes(needle)),
    )
  }, [pool, q])

  const toggleStudent = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  /** Everything the batch form owns, back to empty. */
  function resetBatchForm() {
    setB({ course_id: '', name: '', trainer_id: '', start_date: '', end_date: '', capacity: '30' })
    setEditingBatch(null)
    setPicked([])
    setQInput('')
    setBOpen(false)
  }

  async function addCourse() {
    if (!c.name) return setErr('Course name required')
    setErr(null)
    const { error } = await supabase.from('courses').insert({
      name: c.name, code: c.code || null, domain: c.domain || null,
      fee: Number(c.fee || 0), duration_weeks: c.duration_weeks ? Number(c.duration_weeks) : null, status: 'active',
    })
    if (error) return setErr(error.message)
    setC({ name: '', code: '', domain: '', fee: '', duration_weeks: '' }); setCOpen(false); router.refresh()
  }
  function editCourse(course: Course) {
  setEditingCourse(course.id)

  setC({
      name: course.name,
      code: course.code ?? '',
      domain: course.domain ?? '',
      fee: String(course.fee),
      duration_weeks: course.duration_weeks
        ? String(course.duration_weeks)
        : '',
    })

    setCOpen(true)
  }

  async function updateCourse() {
      if (!editingCourse) return
      if (!c.name) return setErr('Course name required')

      setErr(null)

      const { error } = await supabase
        .from('courses')
        .update({
          name: c.name,
          code: c.code || null,
          domain: c.domain || null,
          fee: Number(c.fee || 0),
          duration_weeks: c.duration_weeks
            ? Number(c.duration_weeks)
            : null,
        })
        .eq('id', editingCourse)

      if (error) return setErr(error.message)

      setC({
        name: '',
        code: '',
        domain: '',
        fee: '',
        duration_weeks: '',
      })

      setEditingCourse(null)
      setCOpen(false)
      router.refresh()
  }
  async function deleteCourse(id: string) {
  const ok = window.confirm(
    'Are you sure you want to delete this course?'
  )

  if (!ok) return

  const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)

    if (error) {
      if (error.message.includes('batches_course_id_fkey')) {
        setErr(
          'Cannot delete this course because it has one or more batches assigned.'
        )
      } else {
        setErr(error.message)
      }
      return
    }

    router.refresh()
  }
  function editBatch(batch: Batch) {
    setEditingBatch(batch.id)

    setB({
      course_id: courseOpts.find((c) => c.name === batch.course)?.id ?? '',
      name: batch.name,
      trainer_id:
        trainers.find((t) => t.full_name === batch.trainer)?.id ?? '',
      start_date: batch.start_date ?? '',
      end_date: batch.end_date ?? '',
      capacity: batch.capacity ? String(batch.capacity) : '30',
    })

    // Open with the batch's own roll ticked, so the form edits it rather
    // than replacing it.
    setPicked((enrolledByBatch[batch.id] ?? []).map((s) => s.id))
    setQInput('')
    setErr(null)
    setBOpen(true)
  }
  async function updateBatch() {
    if (!editingBatch) return
    if (!b.course_id || !b.name)
      return setErr('Course and batch name required')
    const over = capacityOverflow()
    if (over) return setErr(over)

    setErr(null)
    setBusy(true)
    const err = await saveBatch('PATCH', { id: editingBatch, ...batchPayload() })
    setBusy(false)
    if (err) return setErr(err)

    resetBatchForm()
    router.refresh()
  }

  async function deleteBatch(id: string) {
  const ok = window.confirm(
    'Are you sure you want to delete this batch?'
  )

  if (!ok) return

  const { error } = await supabase
    .from('batches')
    .delete()
    .eq('id', id)

  if (error) {
    setErr(error.message)
    return
  }

  router.refresh()
}
  /** Refuse a roll larger than the batch holds, rather than let the count
   *  read 35 / 30 afterwards. */
  function capacityOverflow() {
    const cap = Number(b.capacity || 0)
    if (!cap || picked.length <= cap) return null
    return `${picked.length} students selected but capacity is ${cap}.`
  }

  /** The batch's own columns, as the route names them. */
  const batchPayload = () => ({
    course_id: b.course_id,
    name: b.name,
    trainer_id: b.trainer_id || null,
    start_date: b.start_date || null,
    end_date: b.end_date || null,
    capacity: Number(b.capacity || 30),
    students: picked,
  })

  async function addBatch() {
    if (!b.course_id || !b.name) return setErr('Course and batch name required')
    const over = capacityOverflow()
    if (over) return setErr(over)

    setErr(null)
    setBusy(true)
    const err = await saveBatch('POST', batchPayload())
    setBusy(false)
    if (err) return setErr(err)

    resetBatchForm()
    router.refresh()
  }
  
  // Courses are staff-only and the `courses_staff` policy grants exactly
  // that, so the inline edits keep writing straight to PostgREST.
  const updCourse = (id: string, fields: Update<'courses'>) =>
    supabase
      .from('courses')
      .update(fields)
      .eq('id', id)
      .select('id')
      .then(({ data, error }) => {
        if (error) return setErr(error.message)
        if (!data?.length) return setErr(refused('courses'))
        setErr(null)
        router.refresh()
      })

  // Batches go through the route, which is where a BD is allowed to write
  // them.
  const updBatch = async (id: string, fields: Record<string, unknown>) => {
    const err = await saveBatch('PATCH', { id, ...fields })
    if (err) return setErr(err)
    setErr(null)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{heading ?? 'Courses & Batches'}</h1>
        <p className="text-sm text-slate-500">
          {showTabs
            ? `${courses.length} courses · ${batches.length} batches`
            : tab === 'batches'
              ? `${batches.length} ${batches.length === 1 ? 'batch' : 'batches'}`
              : `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}`}
        </p>
      </div>

      {showTabs && (
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm w-fit">
          <button onClick={() => setTab('courses')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${tab === 'courses' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}><BookOpen className="h-4 w-4" /> Courses</button>
          <button onClick={() => setTab('batches')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${tab === 'batches' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}><Layers className="h-4 w-4" /> Batches</button>
        </div>
      )}

      {err && <p className="text-sm text-rose-600">{err}</p>}

      {tab === 'courses' && (
        <div className="space-y-3">
          {!cOpen ? (
            canWrite && <button onClick={() => setCOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Add Course</button>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <input className={inp} placeholder="Course name *" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
                <input className={inp} placeholder="Code (e.g. AIML)" value={c.code} onChange={(e) => setC({ ...c, code: e.target.value })} />
                <input className={inp} placeholder="Domain (AI & ML…)" value={c.domain} onChange={(e) => setC({ ...c, domain: e.target.value })} />
                <input className={inp} type="number" placeholder="Fee (₹)" value={c.fee} onChange={(e) => setC({ ...c, fee: e.target.value })} />
                <input className={inp} type="number" placeholder="Duration (weeks)" value={c.duration_weeks} onChange={(e) => setC({ ...c, duration_weeks: e.target.value })} />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={editingCourse ? updateCourse : addCourse}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
                  {editingCourse ? 'Update Course' : 'Save Course'}
                </button>
                <button onClick={() => {setCOpen(false)
                    setEditingCourse(null)
                    setErr(null)
                    setC({
                    name: '',
                    code: '',
                    domain: '',
                    fee: '',
                    duration_weeks: '',
                  })
                  }}className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Weeks</th>
                <th className="px-4 py-3 font-medium">Batches</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canWrite && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr></thead>
              <tbody>
                {courses.map((x) => (
                  <tr key={x.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{x.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{x.code ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{x.domain ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700">₹{Number(x.fee).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-slate-600">{x.duration_weeks ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{x.batch_count}</td>
                    <td className="px-4 py-2.5">
                      {canWrite ? (
                      <select defaultValue={x.status} onChange={(e) => updCourse(x.id, { status: e.target.value })} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">
                        <option value="active">active</option><option value="inactive">inactive</option>
                      </select>
                      ) : (
                        <span className="text-xs text-slate-600">{x.status}</span>
                      )}
                    </td>
                    {canWrite && (
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => editCourse(x)}
                          className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        {role === 'admin' && (
                          <button
                            onClick={() => deleteCourse(x.id)}
                            className="rounded-md bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                    )}
                  </tr>
                ))}
                {!courses.length && <tr><td colSpan={canWrite ? 8 : 7} className="px-4 py-6 text-center text-slate-400">No courses yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'batches' && (
        <div className="space-y-3">
          {!bOpen ? (
            canWriteBatches && <button onClick={() => { setErr(null); setBOpen(true) }} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Add Batch</button>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <select className={inp} value={b.course_id} onChange={(e) => setB({ ...b, course_id: e.target.value })}>
                  <option value="">Course *…</option>{courseOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <input className={inp} placeholder="Batch name * (AIML - Batch 01)" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} />
                <select className={inp} value={b.trainer_id} onChange={(e) => setB({ ...b, trainer_id: e.target.value })}>
                  <option value="">Trainer…</option>{trainers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
                <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Start</label><input className={inp} type="date" value={b.start_date} onChange={(e) => setB({ ...b, start_date: e.target.value })} /></div>
                <div><label className="mb-1 block text-[11px] uppercase text-slate-400">End</label><input className={inp} type="date" value={b.end_date} onChange={(e) => setB({ ...b, end_date: e.target.value })} /></div>
                <input className={inp} type="number" placeholder="Capacity" value={b.capacity} onChange={(e) => setB({ ...b, capacity: e.target.value })} />
              </div>

              {/* The roll. Ticking here is what puts a student in the batch —
                  the same control whether the batch is being created or
                  edited, so there is one way to do it. */}
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-medium text-slate-800">
                    Students in this batch
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {picked.length} selected{b.capacity ? ` · capacity ${b.capacity}` : ''}
                    </span>
                  </label>
                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      className={`${inp} pl-8`}
                      placeholder="Search name, email or mobile"
                      value={qInput}
                      onChange={(e) => setQInput(e.target.value)}
                    />
                  </div>
                </div>

                {picked.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {picked.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-2.5 pr-1 text-xs text-blue-700">
                        {nameById[id] ?? 'Student'}
                        <button
                          onClick={() => toggleStudent(id)}
                          aria-label={`Remove ${nameById[id] ?? 'student'}`}
                          className="rounded-full p-0.5 hover:bg-blue-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {poolErr ? (
                  <p className="text-sm text-rose-600">Could not load students: {poolErr}</p>
                ) : pool === null ? (
                  <p className="text-sm text-slate-400">Loading students…</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                    {matches.map((s) => (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-3 border-b border-slate-50 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={pickedSet.has(s.id)}
                          onChange={() => toggleStudent(s.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="font-medium text-slate-800">{s.full_name}</span>
                        <span className="truncate text-xs text-slate-500">{s.email ?? s.mobile ?? ''}</span>
                      </label>
                    ))}
                    {!matches.length && (
                      <p className="px-3 py-6 text-center text-sm text-slate-400">
                        {pool.length ? 'No student matches that search.' : 'No students on record yet.'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={editingBatch ? updateBatch : addBatch}
                  disabled={busy}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                  {busy ? 'Saving…' : editingBatch ? 'Update Batch' : 'Save Batch'}
                </button>
                <button onClick={() => { setErr(null); resetBatchForm() }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Trainer</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Students</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canWriteBatches && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr></thead>
              <tbody>
                {/* {batches.map((x) => ( */}
                {filteredBatches.map((x) => {
                  const roll = enrolledByBatch[x.id] ?? []
                  const count = `${roll.length} / ${x.capacity ?? '—'}`
                  return (
                  <tr key={x.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{x.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{x.course ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{x.trainer ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{(x.start_date ?? '—')}{x.end_date ? ` → ${x.end_date}` : ''}</td>
                    {/* The count doubles as the way in: clicking it opens the
                        batch with its roll, which is where students are added
                        and removed. */}
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                      {canWriteBatches ? (
                        <button
                          onClick={() => editBatch(x)}
                          title={roll.length ? roll.map((s) => s.full_name).join(', ') : 'Nobody enrolled yet'}
                          className="rounded-md px-1.5 py-0.5 text-slate-700 underline decoration-dotted underline-offset-2 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {count}
                        </button>
                      ) : (
                        count
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {canWriteBatches ? (
                        <>
                      <input type="number" min={0} max={100} defaultValue={x.progress ?? 0} onBlur={(e) => updBatch(x.id, { progress: Number(e.target.value) })} className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs" />%
                        </>
                      ) : (
                        <span className="text-xs text-slate-600">{x.progress ?? 0}%</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {canWriteBatches ? (
                      <select defaultValue={x.status} onChange={(e) => updBatch(x.id, { status: e.target.value })} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">
                      {BATCH_ST.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      ) : (
                        <span className="text-xs text-slate-600">{x.status}</span>
                      )}
                    </td>
                    {canWriteBatches && (
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => editBatch(x)}
                          className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                        >
                          Edit
                        </button>

                      {role === 'admin' && (
                        <button
                          onClick={() => deleteBatch(x.id)}
                          className="..."
                        >
                          Delete
                        </button>
                      )}
                      </div>
                    </td>
                    )}
                  </tr>
                  )
                })}
                {!batches.length && <tr><td colSpan={canWriteBatches ? 8 : 7} className="px-4 py-6 text-center text-slate-400">No batches yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
