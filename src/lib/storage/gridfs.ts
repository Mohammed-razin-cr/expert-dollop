import { GridFSBucket, MongoClient, type GridFSFile } from 'mongodb'
import { Readable } from 'node:stream'
import { contentTypeFor } from './mime'

/**
 * Study material files, kept in MongoDB GridFS.
 *
 * GridFS rather than a plain document because a BSON document caps at
 * 16 MB and these are lecture videos — GridFS splits a file into 255 KB
 * chunks and streams them back, so size is bounded by disk rather than by
 * the document limit.
 *
 * Only material lives here. Everything else the app stores — BD and admin
 * documents — stays on the local disk it always used; see the storage
 * route for where that split is made.
 *
 * Metadata deliberately stays in Postgres. materials.file_url holds the
 * same key used here, so the row remains the source of truth for which
 * course, batch and topic a file belongs to, and RLS still governs it.
 */

const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017'
const DB = process.env.MONGODB_DB ?? 'electrobtech_files'
const BUCKET_NAME = 'materials'

/**
 * One client per process. Cached on globalThis because the dev server
 * re-evaluates modules on hot reload, and a fresh pool per reload would
 * leak connections until Mongo refused them.
 */
const g = globalThis as typeof globalThis & { __omsMongo?: Promise<MongoClient> }

function client(): Promise<MongoClient> {
  g.__omsMongo ??= new MongoClient(URI, {
    serverSelectionTimeoutMS: 5000,
  }).connect()
  return g.__omsMongo
}

async function bucket(): Promise<GridFSBucket> {
  const c = await client()
  return new GridFSBucket(c.db(DB), { bucketName: BUCKET_NAME })
}

/** The stored file for a key, or null. Newest wins if a key was reused. */
async function findFile(key: string): Promise<GridFSFile | null> {
  const b = await bucket()
  const [file] = await b.find({ filename: key }).sort({ uploadDate: -1 }).limit(1).toArray()
  return file ?? null
}

/**
 * Store an object, replacing anything already under that key.
 *
 * Accepts a stream so a large upload is written chunk by chunk instead of
 * being held in memory — the previous disk implementation buffered the
 * whole file, which a 500 MB video would have to fit inside the Node heap.
 */
export async function putObject(
  key: string,
  body: Readable | Buffer,
  contentType?: string,
): Promise<void> {
  const b = await bucket()

  // Upsert semantics: the app never reuses a key (names carry Date.now()),
  // but a retried upload must not leave two files answering to one name.
  await deleteObject(key)

  const source = Buffer.isBuffer(body) ? Readable.from(body) : body

  await new Promise<void>((resolve, reject) => {
    // The driver dropped the top-level contentType option in v6; it lives
    // in metadata now, and is read back the same way.
    const upload = b.openUploadStream(key, {
      metadata: { contentType: contentType ?? contentTypeFor(key) },
    })
    source.on('error', reject)
    upload.on('error', reject)
    upload.on('finish', () => resolve())
    source.pipe(upload)
  })
}

export type StoredObject = {
  stream: Readable
  length: number
  contentType: string
}

/** Open an object for reading, or null when it is not there. */
export async function getObject(key: string): Promise<StoredObject | null> {
  const file = await findFile(key)
  if (!file) return null
  const b = await bucket()
  return {
    stream: b.openDownloadStream(file._id),
    length: file.length,
    contentType: (file.metadata?.contentType as string | undefined) ?? contentTypeFor(key),
  }
}

/** Remove every file stored under a key. Idempotent. */
export async function deleteObject(key: string): Promise<void> {
  const b = await bucket()
  const files = await b.find({ filename: key }).toArray()
  for (const f of files) {
    // Already gone is not an error — deletes are retried on failure.
    await b.delete(f._id).catch(() => {})
  }
}

export async function objectExists(key: string): Promise<boolean> {
  return (await findFile(key)) !== null
}
