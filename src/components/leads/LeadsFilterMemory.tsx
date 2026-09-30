'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Remembers the filters the leads list was last showing, and puts them back
 * when you return to /leads without any.
 *
 * The URL stays the source of truth — this never overrides params that are
 * actually present, so a refresh, Back/Forward, a shared link and every
 * dashboard click-through still mean exactly what they say. It only fills in
 * the one case the URL can't answer: arriving at a bare /leads, from the
 * sidebar or by typing it, where the honest answer to "which leads?" is the
 * ones you were just working.
 *
 * Why this exists: opening a lead, saving it and coming back via the sidebar
 * dropped the whole filter set, so a BD working a filtered queue had to
 * reapply it after every single edit.
 *
 * Only a genuinely filtered list is remembered. Clearing the filters writes
 * the cleared state back, so Clear Filters stays the one way to forget them
 * rather than leaving a stale set to spring back later.
 *
 * sessionStorage, not localStorage: filters should survive moving around the
 * app and reloading, but a new tab or tomorrow's session should start from
 * the plain list rather than inheriting a filter somebody forgot about.
 */

const KEY = 'leads:last-query'

export function LeadsFilterMemory({
  /** The list's current query string — filters, tab, search, drill-down, page. */
  qs,
  /** True when /leads was opened with no search params at all. */
  isBare,
  /** True when anything is actually narrowing the list (the tab counts). */
  hasFilters,
}: {
  qs: string
  isBare: boolean
  hasFilters: boolean
}) {
  const router = useRouter()

  useEffect(() => {
    // Storage throws in some privacy modes; a filter memory is never worth
    // taking the page down over.
    let stored: string | null = null
    try {
      stored = sessionStorage.getItem(KEY)
    } catch {}

    if (isBare) {
      // replace, not push, so Back still leaves /leads rather than bouncing
      // off the restore and landing straight back here.
      if (stored) router.replace(`/leads?${stored}`, { scroll: false })
      return
    }

    try {
      if (hasFilters) sessionStorage.setItem(KEY, qs)
      else sessionStorage.removeItem(KEY)
    } catch {}
  }, [qs, isBare, hasFilters, router])

  return null
}
