import { signJwt } from '@/lib/auth/jwt'
import { AVATAR_BUCKET } from '@/lib/avatars'

/**
 * A loadable URL for a stored avatar, or null when the user has no picture.
 *
 * SERVER ONLY — signJwt reads the PostgREST secret.
 *
 * This mints the same token `POST /storage/v1/object/sign` would, without
 * the round trip: the topbar is server-rendered on every dashboard page, so
 * an HTTP call back into ourselves would sit in front of every navigation.
 *
 * The expiry is rounded to a day boundary rather than set to "now + a
 * week". The token is part of the URL, so an expiry that moved every render
 * would produce a new URL every render, and the browser would re-download a
 * picture it already had on every page it drew.
 */
export function signedAvatarUrl(path?: string | null): string | null {
  if (!path) return null
  const days = Math.floor(Date.now() / 86_400_000)
  const token = signJwt({ url: `${AVATAR_BUCKET}/${path}`, exp: (days + 7) * 86_400 })
  return `/storage/v1/object/sign/${AVATAR_BUCKET}/${path}?token=${token}`
}
