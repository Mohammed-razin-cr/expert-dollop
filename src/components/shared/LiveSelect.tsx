'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * A filter dropdown that applies itself.
 *
 * These sit on server-rendered lists, so a filter is a search param: picking
 * one rewrites its param on the current URL and the page re-runs its query.
 * Every other param comes through untouched, which is what the hidden fields
 * and Apply buttons around these selects used to be for — and unlike a form
 * submit, params the form had no field for (a date range, a tab) survive it.
 *
 * `router.push`, not `replace`, so Back undoes a filter the way it undoes the
 * tab links beside it. The debounced search box replaces instead, since it
 * would otherwise leave one history entry per pause in typing.
 */
export function LiveSelect({
  name,
  value,
  className,
  children,
}: {
  name: string
  /** The value the server rendered this page with. */
  value: string
  className?: string
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  // Held locally so the dropdown shows the new choice on the spot rather than
  // snapping back to the old one until the server answers.
  const [selected, setSelected] = useState(value)
  useEffect(() => setSelected(value), [value])

  function apply(next: string) {
    setSelected(next)

    const sp = new URLSearchParams(params.toString())
    if (next) sp.set(name, next)
    else sp.delete(name)
    // A narrower filter has fewer pages, so keeping the old page number would
    // land on an empty table.
    sp.delete('page')

    const qs = sp.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <select
      name={name}
      value={selected}
      onChange={(e) => apply(e.target.value)}
      className={className}
    >
      {children}
    </select>
  )
}
