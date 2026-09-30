'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export type SearchOption = { value: string; label: string }

/**
 * A dropdown you can type into.
 *
 * A plain <select> is fine for a handful of options, but a student list that
 * runs to hundreds of names makes scrolling to the right one the whole problem.
 * This keeps the shape of the selects beside it and filters as you type.
 *
 * `emptyLabel` restores the blank `<option value="">` where that was a real
 * choice rather than a prompt — it clears the field. It is hidden while a
 * search is running, since "no student" is never what you are searching for.
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Select',
  emptyLabel,
  className = '',
  wrapperClassName = '',
}: {
  options: SearchOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string
  /** Styles the bordered box, to match the plain selects around it. */
  className?: string
  /** Styles the positioning wrapper — width lives here, not on the box. */
  wrapperClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value) ?? null
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (needle) return options.filter((o) => o.label.toLowerCase().includes(needle))
    return emptyLabel ? [{ value: '', label: emptyLabel }, ...options] : options
  }, [options, q, emptyLabel])
  useEffect(() => setActive(0), [q])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setQ('') }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function pick(o: SearchOption) {
    onChange(o.value)
    setQ('')
    setOpen(false)
  }

  return (
    <div ref={box} className={`relative ${wrapperClassName}`}>
      {/* The caller's focus:border-* is written for an <input>; the real input
          is a child here, so the box needs focus-within to light up. */}
      <div className={`flex items-center gap-1 focus-within:border-blue-300 ${className}`}>
        <input
          className="w-full min-w-0 bg-transparent outline-none"
          role="combobox"
          aria-expanded={open}
          // Open with the selection still legible, rather than an empty box
          // that reads as though the choice were lost.
          placeholder={open && selected ? selected.label : placeholder}
          value={open ? q : (selected?.label ?? '')}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, rows.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter' && open && rows[active]) { e.preventDefault(); pick(rows[active]) }
            else if (e.key === 'Escape') { setOpen(false); setQ('') }
          }}
        />
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {!rows.length && <li className="px-3 py-1.5 text-xs text-slate-400">No matches</li>}
          {rows.map((o, i) => (
            <li key={o.value || '__empty__'}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(o)}
                className={`block w-full truncate px-3 py-1.5 text-left ${i === active ? 'bg-blue-50 text-blue-700' : 'text-slate-700'} ${o.value ? '' : 'text-slate-400'}`}>
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
