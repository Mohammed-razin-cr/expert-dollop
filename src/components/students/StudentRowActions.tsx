'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Undo2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/api/client'

export function StudentRowActions({ id, sourceLead }: { id: string; sourceLead: string | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState(false)

  async function remove(revert: boolean) {
    const msg = revert
      ? 'Revert this student back to a lead? They will be removed from Students and the original lead restored.'
      : 'Remove this student? They move to the recycle bin.'
    if (!confirm(msg)) return
    setBusy(true)
    if (revert && sourceLead) await supabase.from('leads').update({ status: 'contacted' }).eq('id', sourceLead)
    await supabase.from('students').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setBusy(false); router.refresh()
  }

  return (
    <div className="flex items-center gap-1">
      {sourceLead && <button disabled={busy} onClick={() => remove(true)} title="Revert to lead" className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-100"><Undo2 className="h-3.5 w-3.5" /> Revert</button>}
      <button disabled={busy} onClick={() => remove(false)} title="Remove" className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  )
}
