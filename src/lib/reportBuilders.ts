import type { DbClient } from '@/lib/trainer'
import { dash, esc, pair, reportHeader, section, today, TABLE_CSS } from '@/lib/reportHtml'
import { pctLabel } from '@/lib/format'

/**
 * The five trainer reports.
 *
 * Each builder is one function that queries and renders, so generating a
 * report and downloading it later run exactly the same code — the history
 * stores only parameters, and the document is rebuilt from live data.
 *
 * None of these read the tables the BD and admin exports use.
 */

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export type ReportType = 'attendance' | 'assessment' | 'performance' | 'progress' | 'material'

export type ReportParams = {
  batchId: string | null
  batchName: string | null
  from: string | null
  to: string | null
}

export const REPORT_META: Record<ReportType, { label: string; blurb: string; tone: string }> = {
  attendance: {
    label: 'Attendance Report',
    blurb: 'View and download attendance summary for students or batches.',
    tone: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  assessment: {
    label: 'Assessment Report',
    blurb: 'Get detailed analysis of assessment scores and performance.',
    tone: 'border-purple-200 bg-purple-50 text-purple-700',
  },
  performance: {
    label: 'Student Performance Report',
    blurb: 'Track overall performance, attendance and assessment scores.',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  progress: {
    label: 'Batch Progress Report',
    blurb: 'Check topics completed and overall progress of a batch.',
    tone: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  material: {
    label: 'Material Usage Report',
    blurb: 'See how students are engaging with shared materials.',
    tone: 'border-rose-200 bg-rose-50 text-rose-700',
  },
}

/** Ids in scope: the chosen batch, or every batch the trainer runs. */
const scopeIds = (p: ReportParams, mine: string[]) => (p.batchId ? [p.batchId] : mine)

const applyRange = (q: any, col: string, p: ReportParams) => {
  if (p.from) q = q.gte(col, p.from)
  if (p.to) q = q.lte(col, p.to)
  return q
}

/** The line under every report title. */
function subtitle(p: ReportParams) {
  const where = p.batchName ? esc(p.batchName) : 'All my batches'
  const when =
    p.from || p.to
      ? `${p.from ? esc(p.from) : 'start'} to ${p.to ? esc(p.to) : 'today'}`
      : 'All time'
  return `${where} &nbsp;•&nbsp; ${when}`
}

const header = (title: string, p: ReportParams) =>
  reportHeader(title, subtitle(p), `Generated ${today()}`)

// ---------------------------------------------------------------------

async function rosterFor(supabase: DbClient, batchIds: string[]) {
  if (!batchIds.length) return []
  const { data = [] } = await supabase
    .from('enrollments')
    .select('student_id, batch_id, progress, batches(name), students(id, full_name)')
    .in('batch_id', batchIds)
    .is('deleted_at', null)
  return (data ?? [])
    .map((e: any) => {
      const s = one(e.students)
      if (!s?.id) return null
      return {
        id: s.id,
        name: s.full_name,
        batchId: e.batch_id,
        batch: one(e.batches)?.name ?? '—',
        progress: Number(e.progress ?? 0),
      }
    })
    .filter(Boolean) as { id: string; name: string; batchId: string; batch: string; progress: number }[]
}

async function attendanceReport(supabase: DbClient, p: ReportParams, mine: string[]) {
  const batchIds = scopeIds(p, mine)
  const roster = await rosterFor(supabase, batchIds)

  let q = supabase
    .from('attendance')
    .select('student_id, status, date')
    .in('batch_id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000'])
    .is('deleted_at', null)
  const { data: rows = [] } = await applyRange(q, 'date', p)

  const tally: Record<string, { present: number; absent: number; late: number }> = {}
  for (const r of rows ?? []) {
    const a = r as any
    if (a.status === 'not_marked') continue
    const t = (tally[a.student_id] ??= { present: 0, absent: 0, late: 0 })
    if (a.status in t) (t as any)[a.status] += 1
  }

  const body = roster.map((s) => {
    const t = tally[s.id] ?? { present: 0, absent: 0, late: 0 }
    const held = t.present + t.absent + t.late
    const here = t.present + t.late
    return [s.name, s.batch, held, t.present, t.absent, t.late, held ? pctLabel(here, held) : '—']
  })

  const held = (rows ?? []).filter((r: any) => r.status !== 'not_marked').length
  const here = (rows ?? []).filter((r: any) => r.status === 'present' || r.status === 'late').length

  return `
  ${header('Attendance Report', p)}
  <h2 style="margin:22px 0 0;font-size:14px;color:#0f172a">Summary</h2>
  <table style="${TABLE_CSS}"><tbody>
    ${pair('Students', roster.length)}
    ${pair('Marks recorded', held)}
    ${pair('Overall attendance', held ? pctLabel(here, held) : 'Nothing marked')}
  </tbody></table>
  ${section(
    'By student',
    ['Student', 'Batch', 'Classes', 'Present', 'Absent', 'Late', 'Attendance'],
    body,
    'No students enrolled.',
  )}`
}

async function assessmentReport(supabase: DbClient, p: ReportParams, mine: string[]) {
  const batchIds = scopeIds(p, mine)

  let q = supabase
    .from('assessments')
    .select('id, title, topic, total_marks, passing_marks, scheduled_at, batch_id, batches(name)')
    .in('batch_id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000'])
    .is('deleted_at', null)
  const { data: papers = [] } = await applyRange(q, 'scheduled_at', p)

  const ids = (papers ?? []).map((a: any) => a.id)
  const { data: results = [] } = ids.length
    ? await supabase
        .from('assessment_results')
        .select('assessment_id, student_id, score')
        .in('assessment_id', ids)
        .is('deleted_at', null)
    : { data: [] }

  const marks: Record<string, number[]> = {}
  for (const r of results ?? []) {
    const row = r as any
    if (row.score === null || row.score === undefined) continue
    ;(marks[row.assessment_id] ??= []).push(Number(row.score))
  }

  const body = (papers ?? []).map((a: any) => {
    const scored = marks[a.id] ?? []
    const avg = scored.length ? scored.reduce((s, n) => s + n, 0) / scored.length : null
    const passing = a.passing_marks === null ? null : Number(a.passing_marks)
    return [
      a.title,
      one(a.batches)?.name ?? '—',
      a.topic,
      a.scheduled_at ? String(a.scheduled_at).slice(0, 10) : null,
      a.total_marks,
      passing,
      scored.length,
      avg === null ? null : Math.round(avg * 10) / 10,
      avg === null || passing === null ? null : avg >= passing ? 'Pass' : 'Fail',
    ]
  })

  return `
  ${header('Assessment Report', p)}
  <h2 style="margin:22px 0 0;font-size:14px;color:#0f172a">Summary</h2>
  <table style="${TABLE_CSS}"><tbody>
    ${pair('Assessments', (papers ?? []).length)}
    ${pair('Marks recorded', (results ?? []).length)}
  </tbody></table>
  ${section(
    'Papers',
    ['Assessment', 'Batch', 'Topic', 'Date', 'Total', 'Pass mark', 'Attempted', 'Average', 'Result'],
    body,
    'No assessments in this range.',
  )}`
}

async function performanceReport(supabase: DbClient, p: ReportParams, mine: string[]) {
  const batchIds = scopeIds(p, mine)
  const roster = await rosterFor(supabase, batchIds)
  const studentIds = roster.map((s) => s.id)

  let attQ = supabase
    .from('attendance')
    .select('student_id, status, date')
    .in('batch_id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000'])
    .is('deleted_at', null)

  const [{ data: attendance = [] }, { data: papers = [] }] = await Promise.all([
    applyRange(attQ, 'date', p),
    supabase
      .from('assessments')
      .select('id, total_marks')
      .in('batch_id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000'])
      .is('deleted_at', null),
  ])

  const ids = (papers ?? []).map((a: any) => a.id)
  const { data: results = [] } = ids.length && studentIds.length
    ? await supabase
        .from('assessment_results')
        .select('assessment_id, student_id, score')
        .in('assessment_id', ids)
        .in('student_id', studentIds)
        .is('deleted_at', null)
    : { data: [] }

  const outOf: Record<string, number> = {}
  for (const a of papers ?? []) outOf[(a as any).id] = Number((a as any).total_marks ?? 0)

  const att: Record<string, { held: number; here: number }> = {}
  for (const r of attendance ?? []) {
    const a = r as any
    if (a.status === 'not_marked') continue
    const t = (att[a.student_id] ??= { held: 0, here: 0 })
    t.held += 1
    if (a.status === 'present' || a.status === 'late') t.here += 1
  }

  const score: Record<string, number[]> = {}
  for (const r of results ?? []) {
    const row = r as any
    if (row.score === null || row.score === undefined) continue
    const total = outOf[row.assessment_id] ?? 0
    ;(score[row.student_id] ??= []).push(total > 0 ? (Number(row.score) / total) * 100 : Number(row.score))
  }

  const body = roster.map((s) => {
    const a = att[s.id]
    const sc = score[s.id] ?? []
    const avg = sc.length ? Math.round(sc.reduce((x, y) => x + y, 0) / sc.length) : null
    return [
      s.name,
      s.batch,
      a && a.held ? pctLabel(a.here, a.held) : '—',
      `${s.progress}%`,
      sc.length,
      avg === null ? null : `${avg}%`,
    ]
  })

  return `
  ${header('Student Performance Report', p)}
  ${section(
    'By student',
    ['Student', 'Batch', 'Attendance', 'Progress', 'Assessments', 'Average score'],
    body,
    'No students enrolled.',
  )}`
}

async function progressReport(supabase: DbClient, p: ReportParams, mine: string[]) {
  const batchIds = scopeIds(p, mine)

  let topicsQ = supabase
    .from('topics')
    .select('id, topic, date, status, batch_id, batches(name)')
    .in('batch_id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000'])
    .is('deleted_at', null)

  const [{ data: topics = [] }, { data: batches = [] }, roster] = await Promise.all([
    applyRange(topicsQ, 'date', p),
    supabase.from('batches').select('id, name, progress, status').in('id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000']),
    rosterFor(supabase, batchIds),
  ])

  const perBatch = (batches ?? []).map((b: any) => {
    const mineTopics = (topics ?? []).filter((t: any) => t.batch_id === b.id)
    const doneCount = mineTopics.filter((t: any) => t.status === 'completed').length
    return [
      b.name,
      b.status,
      roster.filter((s) => s.batchId === b.id).length,
      mineTopics.length,
      doneCount,
      mineTopics.length - doneCount,
      `${b.progress ?? 0}%`,
    ]
  })

  const sessions = (topics ?? [])
    .slice()
    .sort((a: any, b: any) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
    .map((t: any) => [t.date, one(t.batches)?.name ?? '—', t.topic, t.status === 'completed' ? 'Completed' : 'Upcoming'])

  return `
  ${header('Batch Progress Report', p)}
  ${section(
    'By batch',
    ['Batch', 'Status', 'Students', 'Sessions', 'Completed', 'Upcoming', 'Progress'],
    perBatch,
    'No batches in scope.',
  )}
  ${section('Sessions', ['Date', 'Batch', 'Topic', 'Status'], sessions, 'No sessions logged in this range.')}`
}

async function materialReport(supabase: DbClient, p: ReportParams, mine: string[]) {
  const batchIds = scopeIds(p, mine)

  const { data: shares = [] } = batchIds.length
    ? await supabase.from('material_batches').select('material_id, batch_id').in('batch_id', batchIds)
    : { data: [] }

  const sharedIds = [...new Set((shares ?? []).map((s: any) => s.material_id))] as string[]

  let q = supabase
    .from('materials')
    .select('id, title, type, file_size, created_at, batch_id, courses(name)')
    .is('deleted_at', null)
  if (sharedIds.length) {
    q = q.or(
      `batch_id.in.(${batchIds.join(',')}),id.in.(${sharedIds.join(',')})`,
    )
  } else if (batchIds.length) {
    q = q.in('batch_id', batchIds)
  }
  const { data: mats = [] } = await applyRange(q, 'created_at', p)

  const ids = (mats ?? []).map((m: any) => m.id)
  const { data: views = [] } = ids.length
    ? await supabase.from('material_views').select('material_id, views, downloads').in('material_id', ids)
    : { data: [] }

  const eng: Record<string, { views: number; downloads: number; people: number }> = {}
  for (const v of views ?? []) {
    const r = v as any
    const g = (eng[r.material_id] ??= { views: 0, downloads: 0, people: 0 })
    g.views += Number(r.views ?? 0)
    g.downloads += Number(r.downloads ?? 0)
    g.people += 1
  }

  const body = (mats ?? []).map((m: any) => {
    const g = eng[m.id] ?? { views: 0, downloads: 0, people: 0 }
    return [
      m.title,
      one(m.courses)?.name ?? '—',
      (m.type ?? '').toUpperCase() || '—',
      String(m.created_at).slice(0, 10),
      g.views,
      g.downloads,
      g.people,
    ]
  })

  const totalViews = Object.values(eng).reduce((s, g) => s + g.views, 0)
  const totalDownloads = Object.values(eng).reduce((s, g) => s + g.downloads, 0)

  return `
  ${header('Material Usage Report', p)}
  <h2 style="margin:22px 0 0;font-size:14px;color:#0f172a">Summary</h2>
  <table style="${TABLE_CSS}"><tbody>
    ${pair('Materials', (mats ?? []).length)}
    ${pair('Total views', totalViews)}
    ${pair('Total downloads', totalDownloads)}
  </tbody></table>
  ${section(
    'By material',
    ['Material', 'Course', 'Type', 'Uploaded', 'Views', 'Downloads', 'People'],
    body,
    'No materials in this range.',
  )}
  <p style="margin-top:14px;color:#94a3b8;font-size:11px">
    ${esc('Views count anyone signed in who opened the file. Students are not counted separately until they have logins.')}
  </p>`
}

const BUILDERS: Record<
  ReportType,
  (supabase: DbClient, p: ReportParams, mine: string[]) => Promise<string>
> = {
  attendance: attendanceReport,
  assessment: assessmentReport,
  performance: performanceReport,
  progress: progressReport,
  material: materialReport,
}

/** Renders one report to printable HTML, querying live data. */
export function buildReport(
  type: ReportType,
  supabase: DbClient,
  params: ReportParams,
  myBatchIds: string[],
): Promise<string> {
  return BUILDERS[type](supabase, params, myBatchIds)
}

/** "Attendance Report — AIML - Batch 01" — the name stored in the history. */
export function reportName(type: ReportType, params: ReportParams) {
  const base = REPORT_META[type].label
  return params.batchName ? `${base} — ${params.batchName}` : base
}

export { dash }
