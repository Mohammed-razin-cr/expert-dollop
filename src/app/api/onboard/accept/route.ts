import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/api/admin'

export async function POST(req: Request) {
  const { token, name } = await req.json().catch(() => ({}))
  if (!token || !name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Missing token or name.' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data: rec } = await admin.from('onboarding').select('id, status').eq('token', token).is('deleted_at', null).single()
  if (!rec) return NextResponse.json({ error: 'Invalid link.' }, { status: 404 })

  const { error } = await admin.from('onboarding').update({
    status: 'accepted', accepted_name: name.trim(), accepted_at: new Date().toISOString(),
  }).eq('token', token)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
