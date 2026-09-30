'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, FlagTriangleRight, Check, X, Undo2 } from 'lucide-react'
import { createClient } from '@/lib/api/client'

export function ProjectRowActions({
  projectId,
  role,
  myName,
  canEdit,
  deleteRequested,
}: {
  projectId: string
  role: string
  myName: string
  /** Admin, or the project's own owner — mirrors the edit lock in ProjectRows. */
  canEdit: boolean
  deleteRequested: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [done, setDone] = useState(deleteRequested)
  const isAdmin = role === 'admin' || role === 'super_admin'

  async function reqDel() {
    if (done) return
    // .select() so an RLS refusal comes back as zero rows rather than a
    // silent success — otherwise the button would flip to "Requested"
    // without anything having been written.
    const { data, error } = await supabase
      .from('projects')
      .update({ delete_requested: true, delete_requested_by: myName, delete_requested_at: new Date().toISOString() })
      .eq('id', projectId)
      .select('id')
    if (error) return alert(error.message)
    if (!data?.length) return alert('Could not request deletion — you may not have permission on this project.')
    setDone(true)
    router.refresh()
  }

  // Takes the request back before an admin acts on it — the same fields
  // the admin's Reject clears, under the same ownership check as reqDel.
  async function undoReqDel() {
    const { data, error } = await supabase
      .from('projects')
      .update({ delete_requested: false, delete_requested_by: null, delete_requested_at: null })
      .eq('id', projectId)
      .select('id')
    if (error) return alert(error.message)
    if (!data?.length) return alert('Could not undo the request — you may not have permission on this project.')
    setDone(false)
    router.refresh()
  }

  async function adminDelete() {
    if (!confirm('Delete this project? It moves to the recycle bin.')) return
    const { error } = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', projectId)
    if (error) return alert(error.message)
    router.refresh()
  }

  if (isAdmin) return <button onClick={adminDelete} title="Delete" className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button>
  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs text-amber-600">Requested</span>
        {canEdit && <button onClick={undoReqDel} title="Undo delete request" className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"><Undo2 className="h-3 w-3" /> Undo</button>}
      </span>
    )
  }
  // Requesting deletion writes to the row like any other edit, so it needs
  // the same ownership the RLS policy now requires — take over first.
  if (!canEdit) return null
  return <button onClick={reqDel} title="Request deletion" className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"><FlagTriangleRight className="h-3 w-3" /> Req Del</button>
}

type Req = { id: string; name: string; mobile: string | null; project_name: string | null; delete_requested_by: string | null }

export function ProjectDeleteRequestsPanel() {
  const router = useRouter()
  const supabase = createClient()
  const [list, setList] = useState<Req[]>([])
  const [open, setOpen] = useState(false)

  const load = async () => {
    const { data = [] } = await supabase
      .from('projects')
      .select('id, name, mobile, project_name, delete_requested_by')
      .eq('delete_requested', true)
      .is('deleted_at', null)
      .limit(200)
    setList((data ?? []) as Req[])
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  async function approve(id: string) {
    const { error } = await supabase.from('projects').update({ deleted_at: new Date().toISOString(), delete_requested: false }).eq('id', id)
    if (error) return alert(error.message)
    load(); router.refresh()
  }
  async function reject(id: string) {
    const { error } = await supabase.from('projects').update({ delete_requested: false, delete_requested_by: null, delete_requested_at: null }).eq('id', id)
    if (error) return alert(error.message)
    load(); router.refresh()
  }
  async function approveAll() {
    if (!confirm(`Approve and delete ${list.length} project${list.length === 1 ? '' : 's'}?`)) return
    await Promise.all(list.map((r) => supabase.from('projects').update({ deleted_at: new Date().toISOString(), delete_requested: false }).eq('id', r.id)))
    load(); router.refresh()
  }

  if (!list.length) return null
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-100">
        <Trash2 className="h-4 w-4" /> Delete Requests ({list.length})
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex justify-end"><button onClick={approveAll} className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white">Approve All</button></div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="px-2 py-1.5 font-medium">Name</th><th className="px-2 py-1.5 font-medium">Mobile</th><th className="px-2 py-1.5 font-medium">Project</th><th className="px-2 py-1.5 font-medium">By</th><th className="px-2 py-1.5 font-medium"></th></tr></thead>
            <tbody>{list.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-2 py-1.5 font-medium text-slate-800">{r.name}</td>
                <td className="px-2 py-1.5 text-slate-600">{r.mobile ?? '—'}</td>
                <td className="px-2 py-1.5 text-slate-600">{r.project_name ?? '—'}</td>
                <td className="px-2 py-1.5 text-slate-500">{r.delete_requested_by ?? '—'}</td>
                <td className="px-2 py-1.5"><div className="flex gap-1">
                  <button onClick={() => approve(r.id)} title="Approve" className="rounded bg-emerald-50 p-1 text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
                  <button onClick={() => reject(r.id)} title="Reject" className="rounded bg-slate-100 p-1 text-slate-500"><X className="h-3.5 w-3.5" /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
