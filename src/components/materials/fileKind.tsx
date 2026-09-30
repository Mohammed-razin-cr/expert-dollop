import {
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Link2,
  Presentation,
} from 'lucide-react'
import type { Kind } from '@/lib/materials'

/**
 * How each kind of file is shown — one badge and one icon, so a PDF looks
 * the same on the board as it does on its own page.
 */

export const KIND_STYLE: Record<
  Kind,
  { label: string; badge: string; icon: string; Icon: typeof File }
> = {
  pdf: { label: 'PDF', badge: 'border-rose-200 bg-rose-50 text-rose-600', icon: 'bg-rose-50 text-rose-500', Icon: FileText },
  doc: { label: 'DOC', badge: 'border-blue-200 bg-blue-50 text-blue-600', icon: 'bg-blue-50 text-blue-500', Icon: FileText },
  ppt: { label: 'PPT', badge: 'border-orange-200 bg-orange-50 text-orange-600', icon: 'bg-orange-50 text-orange-500', Icon: Presentation },
  sheet: { label: 'SHEET', badge: 'border-emerald-200 bg-emerald-50 text-emerald-600', icon: 'bg-emerald-50 text-emerald-500', Icon: FileSpreadsheet },
  video: { label: 'VIDEO', badge: 'border-purple-200 bg-purple-50 text-purple-600', icon: 'bg-purple-50 text-purple-500', Icon: FileVideo },
  image: { label: 'IMAGE', badge: 'border-pink-200 bg-pink-50 text-pink-600', icon: 'bg-pink-50 text-pink-500', Icon: FileImage },
  link: { label: 'LINK', badge: 'border-cyan-200 bg-cyan-50 text-cyan-600', icon: 'bg-cyan-50 text-cyan-500', Icon: Link2 },
  zip: { label: 'ZIP', badge: 'border-amber-200 bg-amber-50 text-amber-600', icon: 'bg-amber-50 text-amber-500', Icon: FileArchive },
  file: { label: 'FILE', badge: 'border-slate-200 bg-slate-50 text-slate-600', icon: 'bg-slate-100 text-slate-500', Icon: File },
}

/** "1.24 MB" — sizes as the upload reported them. */
export function fmtSize(bytes: number | null) {
  if (bytes === null || bytes <= 0) return null
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${i === 0 ? v : v.toFixed(2).replace(/\.?0+$/, '')} ${units[i]}`
}

export function FileIcon({ kind, className = 'h-5 w-5' }: { kind: Kind; className?: string }) {
  const { Icon } = KIND_STYLE[kind]
  return <Icon className={className} />
}

export function TypeBadge({ kind }: { kind: Kind }) {
  const s = KIND_STYLE[kind]
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${s.badge}`}>
      {s.label}
    </span>
  )
}
