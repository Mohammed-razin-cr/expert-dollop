import { Calendar, Clock, MapPin, Video, Phone, IndianRupee } from 'lucide-react'

export const metadata = { title: 'Aptitude Test Invitation · Electrobtech' }

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><Icon className="h-4 w-4" /></div>
      <div><p className="text-xs text-slate-400">{label}</p><p className="text-sm font-medium text-slate-800">{value}</p></div>
    </div>
  )
}

export default async function AptitudeFormPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const name = sp.name ?? 'Candidate'
  const mode = sp.mode ?? ''
  const round = sp.round ?? ''
  const date = sp.date ?? ''
  const time = sp.time ?? ''
  const venue = sp.venue ?? ''
  const bd = sp.bd ?? ''
  const isOnline = /online/i.test(mode)
  const isMeetLink = /^https?:\/\//i.test(venue)

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-6 text-center text-white">
          <img src="/electrobtech-logo.jpg" alt="Electrobtech" className="mx-auto mb-2 h-12 w-12 rounded-lg bg-white/90 object-contain p-1" />
          <h1 className="text-lg font-semibold">Aptitude Test Invitation</h1>
          <p className="text-sm text-blue-100">Electrobtech Innovations Pvt Ltd</p>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-slate-500">Hello,</p>
          <p className="mb-4 text-xl font-semibold text-slate-900">{name}</p>
          <p className="mb-2 text-sm text-slate-600">You have been invited to take the Electrobtech aptitude assessment. Here are your details:</p>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 px-3">
            <Row icon={Calendar} label="Round" value={round} />
            <Row icon={Video} label="Mode" value={mode} />
            <Row icon={Calendar} label="Date" value={date} />
            <Row icon={Clock} label="Time" value={time} />
            {!isMeetLink && <Row icon={MapPin} label="Venue" value={venue} />}
            <Row icon={Phone} label="Coordinator" value={bd} />
          </div>

          {isOnline && isMeetLink && (
            <a href={venue} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
              <Video className="h-4 w-4" /> Join Online Test
            </a>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-700">
            <IndianRupee className="mt-0.5 h-4 w-4 shrink-0" />
            <span>A test fee of <b>₹99</b> applies. Your coordinator will share the payment details and confirm your slot.</span>
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">Please arrive / log in 10 minutes early. For any queries, contact your coordinator{bd ? ` (${bd})` : ''}.</p>
        </div>
      </div>
    </div>
  )
}
