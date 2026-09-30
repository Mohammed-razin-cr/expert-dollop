/**
 * Profile pictures: where they live, and how big one is allowed to be.
 *
 * A picture goes into the same private `oms-files` bucket as every other
 * upload, so the stored value is a key rather than something a browser can
 * load — `signedAvatarUrl` in ./avatars.server turns a key into a URL.
 *
 * The client-safe half lives here on purpose: the signing half imports
 * node:crypto and must never be pulled into a client component.
 */

export const AVATAR_BUCKET = 'oms-files'

/**
 * Cap on the file a user may pick. Generous, because it is a limit on what
 * they choose rather than on what is stored: the cropper re-encodes to the
 * square below, and a 12 MP phone photo comes out around 60 KB.
 */
export const MAX_AVATAR_MB = 10
export const MAX_AVATAR_BYTES = MAX_AVATAR_MB * 1024 * 1024

/** Side of the stored square — ample for a 96px avatar on a retina screen. */
export const AVATAR_SIZE = 512

/**
 * A fresh key per upload rather than one per user.
 *
 * Avatars are read through a signed URL that is stable for a day (see
 * avatars.server), so overwriting one key in place would leave everyone
 * looking at the old picture until that URL rolled over. A new key means a
 * new URL, and the change shows up at once.
 */
export const avatarPath = (userId: string) => `avatars/${userId}_${Date.now()}.jpg`
