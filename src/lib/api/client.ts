import { createBrowserClient } from '@supabase/ssr'
import { apiEnv } from './env'
import type { Database } from '@/lib/database.types'

export function createClient() {
  const { url, anonKey } = apiEnv()
  return createBrowserClient<Database>(url, anonKey)
}
