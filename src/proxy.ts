import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/api/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Run on everything except static assets and image optimisation.
    //
    // rest/v1, auth/v1 and storage/v1 are the self-hosted backend surface,
    // not pages. They must be excluded: this middleware redirects
    // unauthenticated requests to /login, which would turn every API call
    // into an HTML login page — including the very sign-in request that is
    // meant to create the session.
    '/((?!_next/static|_next/image|favicon.ico|rest/v1|auth/v1|storage/v1|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
