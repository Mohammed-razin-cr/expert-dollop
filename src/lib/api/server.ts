import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { apiEnv } from './env'

// Add the <Database> generic back after running `npm run gen:types`.
export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = apiEnv()

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Called from a Server Component — safe to ignore; middleware refreshes the session.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            /* no-op in RSC render */
          }
        },
      },
    },
  )
}
