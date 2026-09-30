/**
 * Cap on a single study material.
 *
 * Materials stream into GridFS precisely so a lecture recording never has to
 * fit in the Node heap, so this is a policy limit rather than a technical
 * ceiling: big enough for a full recording, small enough that a stray
 * multi-gigabyte file cannot be uploaded by accident.
 *
 * Shared by the upload form and the storage route so the number the trainer
 * is shown is the number actually enforced.
 */
export const MAX_MATERIAL_MB = 200
export const MAX_MATERIAL_BYTES = MAX_MATERIAL_MB * 1024 * 1024
