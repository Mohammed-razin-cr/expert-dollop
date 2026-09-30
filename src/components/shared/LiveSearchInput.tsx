'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

/**
 * The search box on the lists that filter in the database — Students, Leads,
 * Projects, Revenue, Follow-ups.
 *
 * Those pages are server components that read the term off the `q` search
 * param, so searching means rewriting the URL. Typing does that once typing
 * pauses, and `router.replace` re-runs the page's query without stacking a
 * history entry per keystroke.
 *
 * Two things are deliberate:
 *
 * - The input holds its own state, so it never loses a character while a
 *   request is in flight, and never flickers back to the term the server last
 *   rendered with.
 * - `name` stays on the element, so the surrounding <form> — where one exists
 *   for the stage / owner selects — still submits the term alongside its own
 *   fields when those are applied.
 */
export function LiveSearchInput({
  value,
  name = 'q',
  placeholder,
  className,
}: {
  /** The term the server rendered this page with. */
  value: string
  name?: string
  placeholder?: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [term, setTerm] = useState(value)
  const settled = useDebouncedValue(term)
  // What the URL holds, as far as this input is concerned. Both effects below
  // compare against it: one so a keystroke is pushed out once, the other so a
  // change arriving from elsewhere is taken in without being pushed straight
  // back.
  const inUrl = useRef(value)

  // A Clear link, a tab, the browser's Back button — anything that changes `q`
  // from outside puts the box back in step with the page it sits on.
  useEffect(() => {
    if (value === inUrl.current) return
    inUrl.current = value
    setTerm(value)
  }, [value])

  useEffect(() => {
    // Only push a term that is still the one in the box. Clearing within the
    // debounce window used to leave the previous keystroke's timer to fire
    // afterwards and put the term straight back in the URL.
    if (settled !== term) return

    const next = settled.trim()
    if (next === inUrl.current) return
    inUrl.current = next

    const sp = new URLSearchParams(params.toString())
    if (next) sp.set(name, next)
    else sp.delete(name)
    // A narrower search has fewer pages, so keeping the old page number would
    // land on an empty table. Every other filter on the page is left alone.
    sp.delete('page')

    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [settled, term, name, params, pathname, router])

  return (
    <input
      name={name}
      value={term}
      onChange={(e) => setTerm(e.target.value)}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  )
}
