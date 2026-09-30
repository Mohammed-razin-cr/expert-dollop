'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import type { Database } from '@/lib/database.types'

/** Any table carrying a deleted_at column, i.e. one that soft-deletes. */
type SoftDeletable = {
  [K in keyof Database['public']['Tables']]:
    'deleted_at' extends keyof Database['public']['Tables'][K]['Row'] ? K : never
}[keyof Database['public']['Tables']]

export function SoftDeleteButton({ table, id, label = 'Delete', confirmText }: { table: SoftDeletable; id: string; label?: string; confirmText?: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  // async function go() {
  //   if (!confirm(confirmText ?? 'Delete this item? It can be restored from Data Safety.')) return
  //   setBusy(true)
  //   await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id)
  //   setBusy(false)
  //   router.refresh()
  // }
  async function go() {
  if (!confirm(confirmText ?? 'Delete this item?')) return

  setBusy(true)

  const { data, error } = await supabase
        .from(table)
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()

      console.log("DATA:", data)
      console.log("ERROR:", error)

      setBusy(false)

      if (error) {
        alert(error.message)
        return
      }

      router.refresh()
    }

  return (
    <button onClick={go} disabled={busy} title={label} className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100 disabled:opacity-50">
      <Trash2 className="h-3.5 w-3.5" /> {label}
    </button>
  )
}
