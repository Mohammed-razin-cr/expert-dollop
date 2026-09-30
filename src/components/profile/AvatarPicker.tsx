'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Eye, ImagePlus, Trash2, X } from 'lucide-react'
import { Avatar } from '@/components/shell/Avatar'
import { AVATAR_SIZE } from '@/lib/avatars'

/**
 * The avatar itself, as the control for changing it — tap the picture, pick
 * from the menu, the way a phone does it. Purely presentational: choosing a
 * file is reported upwards, and the owner decides what happens next.
 */
export function AvatarPicker({
  src,
  name,
  busy,
  onPick,
  onRemove,
}: {
  src: string | null
  name: string
  busy: boolean
  onPick: (file: File) => void
  onRemove: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState(false)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Escape closes the viewer, as it does everywhere else a picture opens
  // over the page.
  useEffect(() => {
    if (!viewing) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setViewing(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [viewing])

  // A picture that has just been removed must not stay open behind the menu.
  useEffect(() => {
    if (!src) setViewing(false)
  }, [src])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        title={src ? 'Change profile photo' : 'Add a profile photo'}
        // Sized to the avatar exactly, so the badge below pins to the
        // circle's edge rather than to whatever box the button took.
        className="group relative h-24 w-24 rounded-full disabled:opacity-60"
      >
        <Avatar src={src} name={name} size={96} />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-slate-900/45 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="h-6 w-6 text-white" />
        </span>
        <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-blue-600 text-white shadow-sm">
          <Camera className="h-3.5 w-3.5" />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {src && (
            <button
              onClick={() => {
                setOpen(false)
                setViewing(true)
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-4 w-4 text-slate-400" />
              View photo
            </button>
          )}
          <button
            onClick={() => {
              setOpen(false)
              fileRef.current?.click()
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <ImagePlus className="h-4 w-4 text-slate-400" />
            {src ? 'Change photo' : 'Upload photo'}
          </button>
          {src && (
            <button
              onClick={() => {
                setOpen(false)
                onRemove()
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              Remove photo
            </button>
          )}
        </div>
      )}

      {viewing && src && (
        // Clicking anywhere but the picture closes it, so there is always a
        // way out even on a phone where the corner button is a small target.
        <div
          onClick={() => setViewing(false)}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/90 p-6"
        >
          <button
            onClick={() => setViewing(false)}
            aria-label="Close"
            className="absolute right-5 top-5 rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={name}
            onClick={(e) => e.stopPropagation()}
            // Never drawn larger than it was stored — blowing a 512px square
            // up to fill a desktop screen only shows you the compression —
            // and never taller than the window, so it stays whole on a phone
            // held sideways.
            style={{
              maxWidth: `min(${AVATAR_SIZE}px, 90vw)`,
              maxHeight: `min(${AVATAR_SIZE}px, 85vh)`,
            }}
            className="w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Cleared so picking the same file twice still fires onChange —
          // without this, a second attempt at the same photo looks like
          // nothing happened.
          e.target.value = ''
          if (file) onPick(file)
        }}
      />
    </div>
  )
}
