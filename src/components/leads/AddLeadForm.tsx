'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/api/client'
import type { Enum } from '@/lib/database.types'

type Course = {
  id: string
  name: string
}

// The local calendar date, not the UTC one. toISOString() would hand back
// yesterday for anyone east of UTC during the evening — and the enquiry
// date decides where a lead lands in the list, so a day out is visible.
const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const SOURCES: Enum<'lead_source'>[] = [
  'just_dial',
  'website',
  'college',
  'referral',
  'social_media',
  'walk_in',
  'skillfinity',
]

type LeadForm = {
  name: string
  mobile: string
  email: string
  source: Enum<'lead_source'>
  course_interest: string
  enquiry_date: string

  place_city: string
  branch: string
  degree: string
  cgpa: string
  year_of_passing: string
  dob: string
  current_location: string
  graduation_status: string
  remarks: string
  next_followup_at: string
}

export function AddLeadForm({ courses }: { courses: Course[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
 
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [f, setF] = useState<LeadForm>({
    name: '',
    mobile: '',
    email: '',
    source: 'website',
    course_interest: '',
    enquiry_date: todayLocal(),

    place_city: '',
    branch: '',
    degree: '',
    cgpa: '',
    year_of_passing: '',
    dob: '',
    current_location: '',
    graduation_status: '',
    remarks: '',
    next_followup_at: '',
  })

  const set = (key: keyof LeadForm, value: string) => {
    setF((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  async function save() {
    if (!f.name.trim()) {
      setError('Name is required')
      return
    }
    if (f.mobile && f.mobile.length !== 10) {
      setError('Mobile number must be exactly 10 digits')
      return
    }
    setSaving(true)
    setError(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.from('leads').insert({
      name: f.name.trim(),
      mobile: f.mobile || null,
      email: f.email || null,
      source: f.source,
      course_interest: f.course_interest || null,
      // Without this the row sorts below every lead that has one, so a
      // freshly added lead landed on the last page of the list.
      enquiry_date: f.enquiry_date ? new Date(f.enquiry_date).toISOString() : null,

      // New fields
      place_city: f.place_city || null,
      branch: f.branch || null,
      degree: f.degree || null,
      cgpa: f.cgpa ? Number(f.cgpa) : null,
      year_of_passing: f.year_of_passing
        ? Number(f.year_of_passing)
        : null,
      dob: f.dob || null,
      current_location: f.current_location || null,
      graduation_status: f.graduation_status || null,
      remarks: f.remarks || null,
      next_followup_at: f.next_followup_at || null,
      status: 'new',
      assigned_bd: user?.id ?? null,
    })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setF({
      name: '',
      mobile: '',
      email: '',
      source: 'website',
      course_interest: '',
      enquiry_date: todayLocal(),

      place_city: '',
      branch: '',
      degree: '',
      cgpa: '',
      year_of_passing: '',
      dob: '',
      current_location: '',
      graduation_status: '',
      remarks: '', 
      next_followup_at: '',
    })

    setOpen(false)
    router.refresh()
  }

useEffect(() => {
  setOpen(true)
}, [])
  const input =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

        {/* Existing Fields */}

        <input
          className={input}
          placeholder="Full Name *"
          value={f.name}
          onChange={(e) => set('name', e.target.value)}
        />

        <input
          className={input}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          placeholder="Mobile Number"
          value={f.mobile}
          onChange={(e) =>
            set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))
          }
        />
        <input
          className={input}
          placeholder="Email"
          value={f.email}
          onChange={(e) => set('email', e.target.value)}
        />

        <select
          className={input}
          value={f.source}
          onChange={(e) => set('source', e.target.value)}
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>

        <select
          className={input}
          value={f.course_interest}
          onChange={(e) => set('course_interest', e.target.value)}
        >
          <option value="">Course Interested</option>

          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Enquiry Date
          </label>

          <input
            className={input}
            type="date"
            value={f.enquiry_date}
            onChange={(e) => set('enquiry_date', e.target.value)}
          />
        </div>

        {/* ---------- New CRM Fields ---------- */}

        <input
          className={input}
          placeholder="Place / City"
          value={f.place_city}
          onChange={(e) => set('place_city', e.target.value)}
        />

        <input
          className={input}
          placeholder="Current Location"
          value={f.current_location}
          onChange={(e) => set('current_location', e.target.value)}
        />

        <input
          className={input}
          placeholder="Branch"
          value={f.branch}
          onChange={(e) => set('branch', e.target.value)}
        />

        <select
          className={input}
          value={f.degree}
          onChange={(e) => set('degree', e.target.value)}
        >
          <option value="">Select Degree</option>
          <option>B.E</option>
          <option>B.Tech</option>
          <option>BCA</option>
          <option>B.Sc</option>
          <option>B.Com</option>
          <option>MCA</option>
          <option>M.Tech</option>
          <option>MBA</option>
          <option>Other</option>
        </select>

        <input
          className={input}
          type="number"
          step="0.01"
          placeholder="CGPA"
          value={f.cgpa}
          onChange={(e) => set('cgpa', e.target.value)}
        />

        <input
          className={input}
          type="number"
          placeholder="Year of Passing"
          value={f.year_of_passing}
          onChange={(e) => set('year_of_passing', e.target.value)}
        />

        <input
          className={input}
          type="date"
          value={f.dob}
          onChange={(e) => set('dob', e.target.value)}
        />

        <select
          className={input}
          value={f.graduation_status}
          onChange={(e) => set('graduation_status', e.target.value)}
        >
          <option value="">Graduation Status</option>
          <option>Pursuing</option>
          <option>Graduated</option>
          <option>Awaiting Results</option>
          <option>Dropped</option>
        </select>
        
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Remarks / Review
          </label>

          <textarea
            className={input}
            rows={3}
            placeholder="Enter remarks..."
            value={f.remarks}
            onChange={(e) => set('remarks', e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Next Follow-up Date
          </label>

          <input
            className={input}
            type="date"
            value={f.next_followup_at}
            onChange={(e) => set('next_followup_at', e.target.value)}
          />
        </div>

      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-3">

        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Lead'}
        </button>

        <button
  onClick={() => {
    // view=all, not a bare /leads: the filter memory would otherwise restore
    // the last filter set and hide the lead just created behind it.
    router.push('/leads?view=all')
  }}
  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
>
  Cancel
</button>

      </div>
    </div>
  )
}
