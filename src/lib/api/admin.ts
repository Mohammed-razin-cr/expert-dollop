import { createClient } from '@supabase/supabase-js'
import { apiAdminEnv } from './env'

/**
 * SERVER-ONLY. Uses the service-role key (bypasses RLS).
 * Never import this from a client component — only from route handlers / server actions.
 */
export function createAdminClient() {
  const { url, serviceKey } = apiAdminEnv()
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
