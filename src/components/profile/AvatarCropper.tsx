'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageIcon, Loader2, Minus, Plus, X } from 'lucide-react'
import { AVATAR_SIZE } from '@/lib/avatars'

/**
 * The stage is bigger than the circle on purpose: what falls outside the
 * crop stays on screen, dimmed, so you can see what you are cutting off
 * instead of guessing at it.
 */
const STAGE = 340
const CIRCLE = 260
const PAD = (STAGE - CIRCLE) / 2

/** How far past "just covers the circle" the picture may be zoomed. */
const MAX_ZOOM = 5

/**
 * Frame a chosen picture before it is saved: drag to move, zoom to fit —
 * the step every phone puts between picking a photo and it becoming your
 * avatar.
 *
 * The crop is always the circle, so the only rule the maths has to keep is
 * that the picture covers the frame. `clamp` is what stops a strip of empty
 * space being dragged into view, and the zoom floor is the scale at which
 * the picture exactly covers it.
 */
export function AvatarCropper({
  file,
  busy,
  error,
  onCancel,
  onDone,
}: {
  file: File
  busy: boolean
  /** Shown here rather than on the page behind, which is covered over. */
  error?: string | null
  onCancel: () => void
  onDone: (blob: Blob) => void
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [broken, setBroken] = useState(false)
  const [minScale, setMinScale] = useState(1)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  /** Keep the picture covering the circle, whatever the drag or zoom asked for. */
  const clamp = useCallback(
    (next: { x: number; y: number }, s: number, el: HTMLImageElement) => ({
      x: Math.min(PAD, Math.max(PAD + CIRCLE - el.naturalWidth * s, next.x)),
      y: Math.min(PAD, Math.max(PAD + CIRCLE - el.naturalHeight * s, next.y)),
    }),
    [],
  )

  // Decode the picked file so we know its real dimensions, then start it
  // centred at the scale that just covers the frame.
  //
  // `cancelled` is not a nicety. In development this effect runs twice, and
  // the cleanup revokes the URL the first <img> is still loading from — so
  // that one reliably fails. Without the guard its error lands on the
  // second, successful attempt, and every photo looks unreadable.
  useEffect(() => {
    let cancelled = false
    setImg(null)
    setBroken(false)

    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => {
      if (cancelled) return
      const cover = Math.max(CIRCLE / el.naturalWidth, CIRCLE / el.naturalHeight)
      setImg(el)
      setMinScale(cover)
      setScale(cover)
      setOffset({
        x: (STAGE - el.naturalWidth * cover) / 2,
        y: (STAGE - el.naturalHeight * cover) / 2,
      })
    }
    el.onerror = () => {
      if (!cancelled) setBroken(true)
    }
    el.src = url

    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [file])

  /** Zoom about the middle of the circle, so the face stays where it was. */
  function zoomTo(next: number) {
    if (!img) return
    const s = Math.max(minScale, Math.min(minScale * MAX_ZOOM, next))
    const cx = (STAGE / 2 - offset.x) / scale
    const cy = (STAGE / 2 - offset.y) / scale
    setOffset(clamp({ x: STAGE / 2 - cx * s, y: STAGE / 2 - cy * s }, s, img))
    setScale(s)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!img) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d || !img) return
    setOffset(clamp({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }, scale, img))
  }

  function onPointerUp(e: React.PointerEvent) {
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  /** Redraw the framed part at the stored size and hand back the JPEG. */
  function done() {
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // JPEG has no transparency, so a PNG with a see-through background
    // would otherwise come out on black.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
    // The circle's bounding box, expressed in the picture's own pixels.
    const side = CIRCLE / scale
    ctx.drawImage(
      img,
      (PAD - offset.x) / scale,
      (PAD - offset.y) / scale,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    )
    canvas.toBlob((b) => b && onDone(b), 'image/jpeg', 0.9)
  }

  const zoomStep = (dir: 1 | -1) => zoomTo(scale + dir * minScale * 0.35)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div>
            <h3 className="font-semibold text-slate-900">Crop your photo</h3>
            <p className="text-xs text-slate-500">Drag to reposition · zoom to fit</p>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* The stage is dark so the circle reads as the part being kept. */}
        <div className="grid place-items-center bg-slate-900 px-6 py-7">
          {broken ? (
            <div className="grid place-items-center gap-3 py-12 text-center">
              <ImageIcon className="h-9 w-9 text-slate-600" />
              <p className="text-sm text-slate-300">
                That file could not be opened as an image.
              </p>
              <button
                onClick={onCancel}
                className="rounded-lg bg-white/10 px-3.5 py-1.5 text-sm text-white hover:bg-white/20"
              >
                Choose another photo
              </button>
            </div>
          ) : (
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{ height: STAGE, width: STAGE, touchAction: 'none' }}
              className="relative cursor-grab overflow-hidden rounded-xl active:cursor-grabbing"
            >
              {img ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt="Selected"
                    draggable={false}
                    className="pointer-events-none absolute max-w-none select-none"
                    style={{
                      left: offset.x,
                      top: offset.y,
                      width: img.naturalWidth * scale,
                      height: img.naturalHeight * scale,
                    }}
                  />
                  {/* One element does both jobs: the ring marks what is kept,
                      and its enormous spread dims everything outside it. The
                      stage clips that spread, so the picture stays visible
                      around the circle rather than going black. */}
                  <div
                    className="pointer-events-none absolute rounded-full ring-2 ring-white/90"
                    style={{ inset: PAD, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.6)' }}
                  />
                </>
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                </div>
              )}
            </div>
          )}
        </div>

        {!broken && (
          <div className="flex items-center gap-3 px-6 py-4">
            <button
              onClick={() => zoomStep(-1)}
              disabled={!img || scale <= minScale}
              aria-label="Zoom out"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={minScale}
              max={minScale * MAX_ZOOM}
              step={minScale / 100}
              value={scale}
              disabled={!img}
              onChange={(e) => zoomTo(Number(e.target.value))}
              className="w-full accent-blue-600"
              aria-label="Zoom"
            />
            <button
              onClick={() => zoomStep(1)}
              disabled={!img || scale >= minScale * MAX_ZOOM}
              aria-label="Zoom in"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <p className="mx-6 mb-1 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={done}
            disabled={!img || busy}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Saving...' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
