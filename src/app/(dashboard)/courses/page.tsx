import { createClient } from '@/lib/api/server'
import { CourseManager } from '@/components/courses/CourseManager'
import { TrainerCourseBoard } from '@/components/courses/TrainerCourseBoard'
import { getViewer } from '@/lib/trainer'
import { loadCoursesAndBatches, loadTrainerStats, loadBatchStats, loadBatchEnrolments } from '@/lib/courses'

/**
 * Courses.
 *
 * Two distinct screens behind one route:
 *
 *   trainer -> TrainerCourseBoard: their courses and batches, with the
 *              headline numbers for what they teach. Read-mostly.
 *   staff   -> CourseManager: the course-administration screen, rendered
 *              exactly as before so admin behaviour is untouched.
 *
 * Splitting on component rather than props is deliberate — it means no
 * change here can alter what super_admin or admin see.
 */
export default async function CoursesPage() {
  const supabase = await createClient()
  const viewer = await getViewer(supabase)
  const data = await loadCoursesAndBatches(supabase, viewer)

  if (viewer.role === 'trainer') {
    const [stats, batchStats] = await Promise.all([
      loadTrainerStats(supabase, viewer.id),
      loadBatchStats(supabase, data.batches.map((b: any) => b.id)),
    ])
    return (
      <TrainerCourseBoard
        courses={data.courses as any}
        batches={data.batches as any}
        stats={stats}
        batchStats={batchStats}
      />
    )
  }

  const enrolledByBatch = await loadBatchEnrolments(
    supabase,
    data.batches.map((b: any) => b.id),
  )

  return (
    <CourseManager
      courses={data.courses as any}
      batches={data.batches as any}
      trainers={data.trainers as any}
      courseOpts={data.courseOpts}
      role={viewer.role}
      enrolledByBatch={enrolledByBatch}
    />
  )
}
