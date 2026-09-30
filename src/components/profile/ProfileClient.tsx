

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { AvatarCropper } from '@/components/profile/AvatarCropper'
import { AvatarPicker } from '@/components/profile/AvatarPicker'
import { AVATAR_BUCKET, MAX_AVATAR_BYTES, MAX_AVATAR_MB, avatarPath } from '@/lib/avatars'

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300'

export function ProfileClient({
  id,
  profile,
  avatarKey,
  avatarUrl,
}: {
  id: string
  /** The stored object key, needed to clean up the old file on replace. */
  avatarKey: string | null
  /** A signed URL for that key, or null when there is no picture. */
  avatarUrl: string | null
  profile: {
  full_name: string
  email: string
  role: string
  department: string | null
  employee_id: string
  phone: string
  place: string
  bio: string
}
}) {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [department, setDepartment] = useState(profile.department ?? '')
const [employeeId, setEmployeeId] = useState(profile.employee_id ?? '')
const [phone, setPhone] = useState(profile.phone ?? '')
const [place, setPlace] = useState(profile.place ?? '')
const [bio, setBio] = useState(profile.bio ?? '')

  const [editMode, setEditMode] = useState(false)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // --- profile picture -------------------------------------------------
  const blobRef = useRef<string | null>(null)
  const [picked, setPicked] = useState<File | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoErr, setPhotoErr] = useState<string | null>(null)
  /**
   * What to show instead of the server's URL once the picture has been
   * changed here. `undefined` means "nothing has happened, use the prop";
   * null means it was removed. router.refresh() catches the rest of the
   * app up, but this keeps *this* page instant rather than waiting on it.
   */
  const [override, setOverride] = useState<string | null | undefined>(undefined)
  /** The key the picture currently lives under, tracked across replacements. */
  const [key, setKey] = useState(avatarKey)

  const shownAvatar = override === undefined ? avatarUrl : override

  // The preview is an object URL; drop it when the page goes away.
  useEffect(() => () => {
    if (blobRef.current) URL.revokeObjectURL(blobRef.current)
  }, [])

  function pick(file: File) {
    setPhotoErr(null)
    if (!file.type.startsWith('image/')) {
      return setPhotoErr('Please choose an image file.')
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return setPhotoErr(`That image is too large. Please choose one under ${MAX_AVATAR_MB} MB.`)
    }
    setPicked(file)
  }

  /** Upload the cropped square, point the profile at it, drop the old one. */
  async function savePhoto(blob: Blob) {
    setPhotoBusy(true)
    setPhotoErr(null)

    const path = avatarPath(id)
    const { error: upErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg' })
    if (upErr) {
      setPhotoBusy(false)
      return setPhotoErr(upErr.message)
    }

    const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', id)
    if (error) {
      // The row still points at the old picture, so the orphan we just
      // uploaded is the one to clear up.
      await supabase.storage.from(AVATAR_BUCKET).remove([path])
      setPhotoBusy(false)
      return setPhotoErr(error.message)
    }

    // Only once the profile points elsewhere is the previous file safe to
    // delete. A failure here leaves a stray object, never a broken avatar.
    if (key) await supabase.storage.from(AVATAR_BUCKET).remove([key])

    if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    blobRef.current = URL.createObjectURL(blob)
    setOverride(blobRef.current)
    setKey(path)
    setPicked(null)
    setPhotoBusy(false)
    router.refresh()
  }

  async function removePhoto() {
    if (!confirm('Remove your profile photo?')) return
    setPhotoBusy(true)
    setPhotoErr(null)

    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', id)
    if (error) {
      setPhotoBusy(false)
      return setPhotoErr(error.message)
    }
    if (key) await supabase.storage.from(AVATAR_BUCKET).remove([key])

    if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    blobRef.current = null
    setOverride(null)
    setKey(null)
    setPhotoBusy(false)
    router.refresh()
  }

  async function save() {
  setBusy(true)

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      department: department || null,
      employee_id: employeeId || null,
      phone: phone || null,
      place: place || null,
      bio: bio || null,
    })
    .eq('id', id)
    setBusy(false)
    setSaved(true)
    setEditMode(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          My Profile
        </h1>
        <p className="text-sm text-slate-500">
          Manage your account information
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-5">
          <AvatarPicker
            src={shownAvatar}
            name={fullName || profile.email}
            busy={photoBusy}
            onPick={pick}
            onRemove={removePhoto}
          />

          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {fullName || 'Your Name'}
            </h2>
            <p className="text-sm text-slate-500">
              {profile.email}
            </p>
            <span className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
              {profile.role?.replace('_', ' ')}
            </span>
            <p className="mt-2 text-xs text-slate-400">
              Tap the photo to change it · JPG or PNG, up to {MAX_AVATAR_MB} MB
            </p>
          </div>
        </div>

        {photoErr && <p className="mt-4 text-sm text-rose-600">{photoErr}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex justify-between">
          <h3 className="font-semibold text-slate-800">
            Personal Information
          </h3>

          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="text-sm text-blue-600"
            >
              Edit Profile
            </button>
          )}
        </div>

        <input
          className={inp}
          value={fullName}
          disabled={!editMode}
          placeholder="Full Name"
          onChange={(e) => setFullName(e.target.value)}
        />

        <input
          className={inp}
          value={employeeId}
          disabled={!editMode}
          placeholder="Employee ID"
          onChange={(e) => setEmployeeId(e.target.value)}
        />

        <input
          className={inp}
          value={phone}
          disabled={!editMode}
          placeholder="Contact Number"
          onChange={(e) => setPhone(e.target.value)}
        />

        <input
          className={inp}
          value={place}
          disabled={!editMode}
          placeholder="Place"
          onChange={(e) => setPlace(e.target.value)}
        />

        <input
          className={inp}
          value={department}
          disabled={!editMode}
          placeholder="Department"
          onChange={(e) => setDepartment(e.target.value)}
        />

        <textarea
          className={inp}
          value={bio}
          disabled={!editMode}
          placeholder="About / Bio"
          onChange={(e) => setBio(e.target.value)}
        />

        {editMode && (
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            >
              <Save className="h-4 w-4" />
              {busy ? 'Saving...' : 'Save'}
            </button>

            <button
              onClick={() => setEditMode(false)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {saved && (
          <p className="text-sm text-emerald-600">
            Profile updated successfully ✓
          </p>
        )}
      </div>

      {picked && (
        <AvatarCropper
          file={picked}
          busy={photoBusy}
          error={photoErr}
          onCancel={() => {
            setPicked(null)
            setPhotoErr(null)
          }}
          onDone={savePhoto}
        />
      )}
    </div>
  )
}