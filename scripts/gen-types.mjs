/**
 * Generate src/lib/database.types.ts from the live Postgres schema.
 *
 *   npm run gen:types
 *
 * Replaces the old `supabase gen types` call, which still pointed at the
 * Supabase cloud project this app was migrated off. Reads the connection
 * string from DATABASE_URL (or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE),
 * looking in the environment first and then Frontend/.env.local.
 *
 * Point it at `electrobtechoms` — that is the database PostgREST serves.
 * The `railway` database on the same server is a stale copy.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENV_FILE = join(HERE, '..', '.env.local')
const OUT = join(HERE, '..', 'src', 'lib', 'database.types.ts')

// --- connection ------------------------------------------------------
function envFromFile() {
  if (!existsSync(ENV_FILE)) return {}
  const out = {}
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}
const env = { ...envFromFile(), ...process.env }

function clientConfig() {
  if (env.DATABASE_URL) {
    return { connectionString: env.DATABASE_URL, ssl: /proxy\.rlwy\.net|railway/.test(env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined }
  }
  if (!env.PGHOST) {
    console.error('No DATABASE_URL or PGHOST found. Set DATABASE_URL to the electrobtechoms database, e.g.\n' +
      '  DATABASE_URL=postgresql://user:pass@host:port/electrobtechoms npm run gen:types')
    process.exit(1)
  }
  return {
    host: env.PGHOST,
    port: Number(env.PGPORT ?? 5432),
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
    ssl: /proxy\.rlwy\.net/.test(env.PGHOST) ? { rejectUnauthorized: false } : undefined,
  }
}

// --- postgres type -> typescript type --------------------------------
const SCALARS = {
  bool: 'boolean',
  int2: 'number', int4: 'number', int8: 'number',
  float4: 'number', float8: 'number', numeric: 'number',
  json: 'Json', jsonb: 'Json',
  // dates and uuids cross the wire as strings
  date: 'string', time: 'string', timetz: 'string',
  timestamp: 'string', timestamptz: 'string',
  uuid: 'string', text: 'string', varchar: 'string', bpchar: 'string',
  citext: 'string', name: 'string', interval: 'string', bytea: 'string',
}

const tsName = (udt, enums) => {
  if (udt.startsWith('_')) {
    const inner = udt.slice(1)
    return `${tsName(inner, enums)}[]`
  }
  if (enums[udt]) return `Database['public']['Enums']['${udt}']`
  return SCALARS[udt] ?? 'unknown'
}

const main = async () => {
  const client = new pg.Client(clientConfig())
  await client.connect()
  const dbName = (await client.query('select current_database()')).rows[0].current_database
  console.log(`reading schema from "${dbName}"`)
  if (dbName !== 'electrobtechoms') {
    console.warn(`WARNING: expected "electrobtechoms" — "${dbName}" may be the stale copy.`)
  }

  const { rows: enumRows } = await client.query(`
    select t.typname, e.enumlabel
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    order by t.typname, e.enumsortorder
  `)
  const enums = {}
  for (const r of enumRows) (enums[r.typname] ??= []).push(r.enumlabel)

  // Functions callable through PostgREST's /rpc — argument names and types
  // come from pg_proc so .rpc() calls are checked like table access.
  const { rows: fnRows } = await client.query(`
    select p.proname,
           coalesce(array_to_json(p.proargnames)::text, '[]') as argnames,
           coalesce((
             select json_agg(t.typname order by ord)::text
             from unnest(p.proargtypes) with ordinality as a(oid, ord)
             join pg_type t on t.oid = a.oid
           ), '[]') as argtypes,
           rt.typname as rettype
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
    where n.nspname = 'public' and p.prokind = 'f'
    order by p.proname
  `)

  const { rows: cols } = await client.query(`
    select c.table_name, c.column_name, c.is_nullable, c.udt_name, c.column_default,
           c.is_generated, c.identity_generation
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
    order by c.table_name, c.ordinal_position
  `)
  await client.end()

  const tables = {}
  for (const c of cols) (tables[c.table_name] ??= []).push(c)

  const L = []
  L.push('// GENERATED FILE — do not edit by hand.')
  L.push('// Regenerate with: npm run gen:types  (see scripts/gen-types.mjs)')
  L.push(`// Source: public schema of "${dbName}".`)
  L.push('')
  L.push('export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]')
  L.push('')
  L.push('export type Database = {')
  L.push('  public: {')
  L.push('    Tables: {')

  for (const [table, columns] of Object.entries(tables).sort(([a], [b]) => a.localeCompare(b))) {
    L.push(`      ${table}: {`)
    L.push('        Row: {')
    for (const c of columns) {
      const t = tsName(c.udt_name, enums)
      L.push(`          ${c.column_name}: ${t}${c.is_nullable === 'YES' ? ' | null' : ''}`)
    }
    L.push('        }')
    // Insert: a column may be omitted when it is nullable or has a default.
    L.push('        Insert: {')
    for (const c of columns) {
      const t = tsName(c.udt_name, enums)
      const optional = c.is_nullable === 'YES' || c.column_default !== null || c.identity_generation !== null
      L.push(`          ${c.column_name}${optional ? '?' : ''}: ${t}${c.is_nullable === 'YES' ? ' | null' : ''}`)
    }
    L.push('        }')
    L.push('        Update: {')
    for (const c of columns) {
      const t = tsName(c.udt_name, enums)
      L.push(`          ${c.column_name}?: ${t}${c.is_nullable === 'YES' ? ' | null' : ''}`)
    }
    L.push('        }')
    L.push('        Relationships: []')
    L.push('      }')
  }

  L.push('    }')
  L.push('    Views: Record<string, never>')
  L.push('    Functions: {')
  const seenFn = new Set()
  for (const f of fnRows) {
    if (seenFn.has(f.proname)) continue // overloads: keep the first
    seenFn.add(f.proname)
    const names = JSON.parse(f.argnames)
    const types = JSON.parse(f.argtypes)
    const args = names.length && names.length === types.length
      ? names.map((n, i) => `${n}: ${tsName(types[i], enums)}`).join('; ')
      : ''
    L.push(`      ${f.proname}: {`)
    L.push(`        Args: ${args ? `{ ${args} }` : 'Record<string, never>'}`)
    L.push(`        Returns: ${tsName(f.rettype, enums)}`)
    L.push('      }')
  }
  L.push('    }')
  L.push('    Enums: {')
  for (const [name, labels] of Object.entries(enums).sort(([a], [b]) => a.localeCompare(b))) {
    L.push(`      ${name}: ${labels.map((l) => `'${l}'`).join(' | ')}`)
  }
  L.push('    }')
  L.push('    CompositeTypes: Record<string, never>')
  L.push('  }')
  L.push('}')
  L.push('')
  L.push('/** Row shape of a table, e.g. Row<\'projects\'>. */')
  L.push("export type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']")
  L.push("export type Insert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']")
  L.push("export type Update<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']")
  L.push("/** A database enum's allowed values, e.g. Enum<'lead_status'>. */")
  L.push("export type Enum<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]")
  L.push('')

  writeFileSync(OUT, L.join('\n'), 'utf8')
  console.log(`wrote ${OUT}`)
  console.log(`  ${Object.keys(tables).length} tables, ${Object.keys(enums).length} enums`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
