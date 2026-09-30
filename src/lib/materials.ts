import { trainerBatchIds, orNothing, type DbClient, type Viewer } from '@/lib/trainer'

/**
 * Study materials — the board and one file's detail.
 *
 * A trainer sees files they uploaded plus anything shared with a batch
 * they run: a colleague's upload against a shared batch is still relevant,
 * so scoping on uploader alone would hide it. Staff see everything.
 *
 * Sharing lives in material_batches. materials.batch_id is still written
 * as the primary batch, because several other screens read it directly.
 */

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export type Option = { id: string; name: string }

/** Broad kinds the badge and the preview switch on. */
export type Kind = 'pdf' | 'doc' | 'ppt' | 'sheet' | 'video' | 'image' | 'link' | 'zip' | 'file'

const BY_EXTENSION: Record<string, Kind> = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'doc',
  txt: 'doc',
  rtf: 'doc',
  ppt: 'ppt',
  pptx: 'ppt',
  xls: 'sheet',
  xlsx: 'sheet',
  csv: 'sheet',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mkv: 'video',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  zip: 'zip',
  rar: 'zip',
  '7z': 'zip',
  link: 'link',
  url: 'link',
}

/** Falls back to the title's extension when `type` was never set. */
export function kindOf(type: string | null, title: string): Kind {
  const fromType = BY_EXTENSION[(type ?? '').toLowerCase().replace(/^\./, '')]
  if (fromType) return fromType
  const ext = title.includes('.') ? title.split('.').pop()!.toLowerCase() : ''
  return BY_EXTENSION[ext] ?? 'file'
}

export type MaterialRow = {
  id: string
  title: string
  course: string | null
  courseId: string | null
  /** Every batch it is shared with, primary first. */
  batches: string[]
  batchIds: string[]
  type: string | null
  kind: Kind
  fileUrl: string | null
  fileSize: number | null
  uploadedAt: string
  views: number
  downloads: number
}

export type MaterialsStats = {
  total: number
}

export type MaterialsData = {
  rows: MaterialRow[]
  stats: MaterialsStats
  courses: Option[]
  batchOptions: Option[]
}

const EMPTY: MaterialsData = {
  rows: [],
  stats: { total: 0 },
  courses: [],
  batchOptions: [],
}

/**
 * The scoping filter for materials, as a PostgREST `.or()` string: mine,
 * or shared with one of my batches. Null when the viewer is unscoped.
 */
function materialScope(viewer: Viewer, batchIds: string[] | null, sharedIds: string[]) {
  if (!batchIds) return null
  const clauses = [`uploaded_by.eq.${viewer.id}`]
  if (batchIds.length) clauses.push(`batch_id.in.(${batchIds.join(',')})`)
  if (sharedIds.length) clauses.push(`id.in.(${sharedIds.join(',')})`)
  return clauses.join(',')
}

export async function loadMaterials(supabase: DbClient, viewer: Viewer): Promise<MaterialsData> {
  const batchIds = viewer.scoped ? await trainerBatchIds(supabase, viewer.id) : null

  // Files shared with my batches through the join table, which may not
  // name my batch on the material row itself.
  let sharedIds: string[] = []
  if (batchIds?.length) {
    const { data = [] } = await supabase
      .from('material_batches')
      .select('material_id')
      .in('batch_id', orNothing(batchIds))
    sharedIds = [...new Set((data ?? []).map((r: any) => r.material_id))] as string[]
  }

  let matsQ = supabase
    .from('materials')
    // The embed must name the foreign key: material_batches gives
    // materials a second route to batches, so a bare `batches(name)` is
    // ambiguous and PostgREST answers 300, which arrives here as no data.
    .select(
      'id, title, type, file_url, file_size, created_at, course_id, batch_id, courses(name), batches!materials_batch_id_fkey(name)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)

  const scope = materialScope(viewer, batchIds, sharedIds)
  if (scope) matsQ = matsQ.or(scope)

  let batchesQ = supabase.from('batches').select('id, name').is('deleted_at', null).order('name')
  if (batchIds) batchesQ = batchesQ.in('id', orNothing(batchIds))

  const [{ data: mats = [] }, { data: batchRows = [] }] = await Promise.all([matsQ, batchesQ])
  if (!(mats ?? []).length) {
    return {
      ...EMPTY,
      batchOptions: (batchRows ?? []).map((b: any) => ({ id: b.id, name: b.name })),
      courses: [],
    }
  }

  const ids = (mats ?? []).map((m: any) => m.id)

  const [{ data: shares = [] }, { data: views = [] }] = await Promise.all([
    supabase.from('material_batches').select('material_id, batch_id, batches(name)').in('material_id', ids),
    supabase.from('material_views').select('material_id, views, downloads').in('material_id', ids),
  ])

  const sharedWith: Record<string, { id: string; name: string }[]> = {}
  for (const s of shares ?? []) {
    const r = s as any
    ;(sharedWith[r.material_id] ??= []).push({ id: r.batch_id, name: one(r.batches)?.name ?? '—' })
  }

  const engagement: Record<string, { views: number; downloads: number }> = {}
  for (const v of views ?? []) {
    const r = v as any
    const g = (engagement[r.material_id] ??= { views: 0, downloads: 0 })
    g.views += Number(r.views ?? 0)
    g.downloads += Number(r.downloads ?? 0)
  }

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const rows: MaterialRow[] = (mats ?? []).map((m: any) => {
    const primary = one(m.batches)
    const extra = (sharedWith[m.id] ?? []).filter((b) => b.id !== m.batch_id)
    const all = [
      ...(primary ? [{ id: m.batch_id, name: primary.name }] : []),
      ...extra,
    ]
    const e = engagement[m.id] ?? { views: 0, downloads: 0 }

    return {
      id: m.id,
      title: m.title,
      course: one(m.courses)?.name ?? null,
      courseId: m.course_id,
      batches: all.map((b) => b.name),
      batchIds: all.map((b) => b.id),
      type: m.type,
      kind: kindOf(m.type, m.title),
      fileUrl: m.file_url,
      fileSize: m.file_size === null || m.file_size === undefined ? null : Number(m.file_size),
      uploadedAt: m.created_at,
      views: e.views,
      downloads: e.downloads,
    }
  })

  // Course options come from what is actually filed, so the filter never
  // offers a course with nothing behind it.
  const courseById: Record<string, string> = {}
  for (const m of mats ?? []) {
    const r = m as any
    if (r.course_id && one(r.courses)?.name) courseById[r.course_id] = one(r.courses).name
  }

  return {
    rows,
    stats: {
      total: rows.length,
    },
    courses: Object.entries(courseById)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    batchOptions: (batchRows ?? []).map((b: any) => ({ id: b.id, name: b.name })),
  }
}

// ---------------------------------------------------------------------
// One material
// ---------------------------------------------------------------------

export type MaterialDetailData = {
  material: {
    id: string
    title: string
    description: string | null
    course: string | null
    courseId: string | null
    type: string | null
    kind: Kind
    fileUrl: string | null
    fileSize: number | null
    uploadedAt: string
    uploadedBy: string | null
  }
  /** Every batch it is shared with, each with its roster size. */
  batches: { id: string; name: string; students: number }[]
  stats: {
    views: number
    downloads: number
    /** Distinct people who have opened it. */
    viewers: number
    /** Students who have opened it, against the combined roster. */
    studentViewers: number
    studentTotal: number
  }
}

/**
 * Returns null when the material does not exist, or is neither the
 * viewer's own upload nor shared with a batch they run. The caller turns
 * that into a 404.
 */
export async function loadMaterialDetail(
  supabase: DbClient,
  viewer: Viewer,
  materialId: string,
): Promise<MaterialDetailData | null> {
  const { data: m } = await supabase
    .from('materials')
    .select(
      'id, title, description, type, file_url, file_size, created_at, course_id, batch_id, uploaded_by, courses(name), profiles(full_name)',
    )
    .eq('id', materialId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!m) return null
  const row = m as any

  const [{ data: shares = [] }, { data: views = [] }] = await Promise.all([
    supabase.from('material_batches').select('batch_id, batches(name)').eq('material_id', materialId),
    supabase.from('material_views').select('profile_id, views, downloads').eq('material_id', materialId),
  ])

  const batchIdSet = new Set<string>()
  const named: { id: string; name: string }[] = []
  if (row.batch_id) {
    batchIdSet.add(row.batch_id)
    named.push({ id: row.batch_id, name: '—' })
  }
  for (const s of shares ?? []) {
    const r = s as any
    if (batchIdSet.has(r.batch_id)) {
      const existing = named.find((b) => b.id === r.batch_id)
      if (existing) existing.name = one(r.batches)?.name ?? existing.name
      continue
    }
    batchIdSet.add(r.batch_id)
    named.push({ id: r.batch_id, name: one(r.batches)?.name ?? '—' })
  }

  // A trainer may only open their own upload, or something shared with one
  // of their batches.
  if (viewer.scoped) {
    const mine = await trainerBatchIds(supabase, viewer.id)
    const allowed =
      row.uploaded_by === viewer.id || named.some((b) => mine.includes(b.id))
    if (!allowed) return null
  }

  const batchIds = named.map((b) => b.id)

  const [{ data: batchRows = [] }, { data: enrolments = [] }] = await Promise.all([
    batchIds.length
      ? supabase.from('batches').select('id, name').in('id', batchIds)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? supabase
          .from('enrollments')
          .select('student_id, batch_id, students(profile_id)')
          .in('batch_id', batchIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),
  ])

  const nameById: Record<string, string> = {}
  for (const b of batchRows ?? []) nameById[(b as any).id] = (b as any).name

  const rosterOf: Record<string, number> = {}
  const studentProfiles = new Set<string>()
  for (const e of enrolments ?? []) {
    const r = e as any
    rosterOf[r.batch_id] = (rosterOf[r.batch_id] ?? 0) + 1
    const pid = one(r.students)?.profile_id
    if (pid) studentProfiles.add(pid)
  }

  let totalViews = 0
  let totalDownloads = 0
  let studentViewers = 0
  for (const v of views ?? []) {
    const r = v as any
    totalViews += Number(r.views ?? 0)
    totalDownloads += Number(r.downloads ?? 0)
    if (studentProfiles.has(r.profile_id)) studentViewers += 1
  }

  return {
    material: {
      id: row.id,
      title: row.title,
      description: row.description,
      course: one(row.courses)?.name ?? null,
      courseId: row.course_id,
      type: row.type,
      kind: kindOf(row.type, row.title),
      fileUrl: row.file_url,
      fileSize: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
      uploadedAt: row.created_at,
      uploadedBy: one(row.profiles)?.full_name ?? null,
    },
    batches: named.map((b) => ({
      id: b.id,
      name: nameById[b.id] ?? b.name,
      students: rosterOf[b.id] ?? 0,
    })),
    stats: {
      views: totalViews,
      downloads: totalDownloads,
      viewers: (views ?? []).length,
      studentViewers,
      // Distinct students across every batch it is shared with.
      studentTotal: new Set(
        (enrolments ?? []).map((e: any) => e.student_id).filter(Boolean),
      ).size,
    },
  }
}
