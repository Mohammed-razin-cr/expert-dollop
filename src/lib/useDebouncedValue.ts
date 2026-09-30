'use client'

import { useEffect, useState } from 'react'

/** How long typing has to pause before a search term counts as settled. */
export const SEARCH_DEBOUNCE_MS = 400

/**
 * The value as it stood once it stopped changing for `delay` ms.
 *
 * Every search box in the app filters as you type, so without this the work
 * behind it — a table re-filter on the client boards, a fresh query on the
 * server-rendered lists — would run once per keystroke: seven passes to type
 * "preethi", six of which nobody reads. Holding the term back until typing
 * pauses collapses that to one.
 *
 * The input itself is never debounced: it is driven by its own state, so the
 * characters appear instantly and only the filtering waits.
 */
export function useDebouncedValue<T>(value: T, delay: number = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}
