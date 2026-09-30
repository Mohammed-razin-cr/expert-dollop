import Link from 'next/link'
import { AddProjectForm } from '@/components/projects/AddProjectForm'

export default function AddProjectPage() {
  return (
    <div className="space-y-6">
      <Link href="/projects" className="text-blue-600 hover:underline">← Back to Projects</Link>
      <div>
        <h1 className="text-2xl font-bold">Add New Project</h1>
        <p className="text-slate-500">Enter project details below.</p>
      </div>
      <AddProjectForm />
    </div>
  )
}
