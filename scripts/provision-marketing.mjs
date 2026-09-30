import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.MARKETING_USER_PASSWORD

if (!url || !key || !password) {
  throw new Error('Set NEXT_PUBLIC_API_URL, SERVICE_ROLE_KEY, and MARKETING_USER_PASSWORD before provisioning.')
}
if (password.length < 8) throw new Error('MARKETING_USER_PASSWORD must be at least 8 characters.')

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const email = 'saqib@electrobtech.in'
const { data: role, error: roleError } = await db.from('roles').select('key').eq('key', 'digital_marketing').single()
if (roleError || !role) throw new Error('Apply Backend/postgres/45_digital_marketing.sql first.')

const { data: existing, error: lookupError } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
if (lookupError) throw lookupError

let id = existing?.id
if (id) {
  const { data: changed, error } = await db.rpc('auth_set_password', { p_email: email, p_password: password })
  if (error || !changed) throw error ?? new Error('Could not set the existing account password.')
} else {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Saqib', role: 'student' },
  })
  if (error) throw error
  id = data.user?.id
}

if (!id) throw new Error('Could not identify the marketing account.')
const { error: profileError } = await db.from('profiles').update({
  full_name: 'Saqib',
  role: 'student',
  role_key: 'digital_marketing',
  department: 'Digital Marketing',
}).eq('id', id).select('id').single()
if (profileError) throw profileError

console.log(`Provisioned ${email} with the Digital Marketing role.`)
