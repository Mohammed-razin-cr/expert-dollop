/**
 * `npm run dev` — starts the whole backend, not just Next.js.
 *
 * The app needs three things running: PostgreSQL (a Windows service, always
 * up), PostgREST (translates the frontend's HTTP calls into SQL), and Next
 * itself. This starts the middle one automatically so there is only ever
 * one command to remember.
 *
 * If PostgREST is already listening on its port, it is left alone and only
 * Next starts — so running this twice, or alongside a manually started
 * PostgREST, does not spawn a duplicate.
 *
 * Ctrl+C stops everything this script started.
 */
import { spawn, execSync } from 'node:child_process'
import { openSync, existsSync, readFileSync, mkdirSync } from 'node:fs'
import { connect } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const FRONTEND = join(HERE, '..')
const PGRST_DIR = join(FRONTEND, '..', 'Backend', 'postgrest')
const PGRST_EXE = join(PGRST_DIR, 'bin', 'postgrest.exe')
const PGRST_ENV = join(PGRST_DIR, '.env')
const PG_BIN = process.env.PG_BIN ?? 'C:\\Program Files\\PostgreSQL\\17\\bin'

// PostgREST deliberately sits on 3010, not 3001. When port 3000 is busy,
// `next dev` silently falls back to 3001 — which would land on top of
// PostgREST and take the data layer down. Keeping a gap makes that
// collision impossible.
const PORT = Number(process.env.PGRST_PORT ?? 3010)
const NEXT_PORT = Number(process.env.PORT ?? 3000)

const c = { dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', off: '\x1b[0m' }
const log = (msg) => console.log(`${c.dim}[dev]${c.off} ${msg}`)

/** Resolve true if something is already listening on the port. */
const portInUse = (port) =>
  new Promise((resolve) => {
    const sock = connect({ host: '127.0.0.1', port })
    const done = (result) => {
      sock.destroy()
      resolve(result)
    }
    sock.setTimeout(1000)
    sock.once('connect', () => done(true))
    sock.once('timeout', () => done(false))
    sock.once('error', () => done(false))
  })

function readEnvFile(path) {
  const out = {}
  if (!existsSync(path)) return out
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

const children = []

/** On Windows, child.kill() leaves grandchildren behind — kill the tree. */
function killTree(pid) {
  if (!pid) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', shell: false })
    } else {
      process.kill(pid, 'SIGTERM')
    }
  } catch {
    /* already gone */
  }
}

function startPostgrest() {
  if (!existsSync(PGRST_EXE)) {
    console.error(`${c.red}[dev]${c.off} PostgREST not found at ${PGRST_EXE}`)
    console.error(`      See Backend/postgrest/README.md for how to install it.`)
    process.exit(1)
  }
  const cfg = readEnvFile(PGRST_ENV)
  for (const key of ['SERVICE_DB_PASSWORD', 'JWT_SECRET', 'POSTGRES_DB']) {
    if (!cfg[key]) {
      console.error(`${c.red}[dev]${c.off} ${key} missing from ${PGRST_ENV}`)
      console.error(`      Run: node Backend/postgrest/generate-secrets.mjs`)
      process.exit(1)
    }
  }

  mkdirSync(join(PGRST_DIR, 'logs'), { recursive: true })
  const logPath = join(PGRST_DIR, 'logs', 'postgrest.log')
  // Write to a file rather than inheriting a console: on Windows PostgREST
  // blocks mid-request when its console output is not being drained, which
  // makes the API answer once and then hang with the process still alive.
  //
  // A raw fd, not a WriteStream — spawn needs the descriptor to exist at
  // call time, and a stream's fd is still null until it opens asynchronously.
  const out = openSync(logPath, 'a')

  // postgrest.exe links against libpq and the OpenSSL DLLs shipped with
  // PostgreSQL; without them it exits instantly with 0xC0000135
  // (STATUS_DLL_NOT_FOUND) and logs nothing.
  //
  // Windows env vars are case-insensitive but a JS object's keys are not:
  // adding a 'Path' key alongside an inherited 'PATH' leaves the original
  // in force. Extend whichever key actually exists.
  const env = { ...process.env }
  const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH'
  env[pathKey] = `${PG_BIN};${env[pathKey] ?? ''}`

  Object.assign(env, {
    PGRST_DB_URI: `postgres://authenticator:${cfg.SERVICE_DB_PASSWORD}@127.0.0.1:5432/${cfg.POSTGRES_DB}`,
    PGRST_DB_SCHEMAS: 'public',
    PGRST_DB_ANON_ROLE: 'anon',
    PGRST_JWT_SECRET: cfg.JWT_SECRET,
    PGRST_SERVER_PORT: String(PORT),
    PGRST_SERVER_HOST: '127.0.0.1',
    PGRST_LOG_LEVEL: 'error',
    PGRST_DB_CHANNEL_ENABLED: 'true',
  })

  const child = spawn(PGRST_EXE, [], { env, stdio: ['ignore', out, out] })

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${c.red}[dev]${c.off} PostgREST exited with code ${code} — see ${logPath}`)
    }
  })

  children.push(child)
  return { child, logPath }
}

/** Poll the port until PostgREST is actually accepting connections. */
async function waitForPort(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await portInUse(port)) return true
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

/** Identify what is holding a port, so the error can name it. */
function whoHasPort(port) {
  if (process.platform !== 'win32') return null
  try {
    const out = execSync(`netstat -ano -p tcp`, { encoding: 'utf8' })
    const line = out.split(/\r?\n/).find((l) => new RegExp(`:${port}\\s`).test(l) && /LISTENING/.test(l))
    return line ? line.trim().split(/\s+/).pop() : null
  } catch {
    return null
  }
}

async function main() {
  // Check this before starting anything: NEXT_PORT being occupied usually
  // means a previous `npm run dev` is still alive, and letting Next pick
  // its own fallback port is what caused it to collide with PostgREST.
  if (await portInUse(NEXT_PORT)) {
    const pid = whoHasPort(NEXT_PORT)
    console.error(`${c.red}[dev]${c.off} Port ${NEXT_PORT} is already in use${pid ? ` by PID ${pid}` : ''}.`)
    console.error(`      A dev server is probably already running — open http://localhost:${NEXT_PORT}`)
    if (pid) console.error(`      To stop it:  taskkill /PID ${pid} /F`)
    process.exit(1)
  }

  if (await portInUse(PORT)) {
    log(`PostgREST already running on :${PORT} ${c.dim}(leaving it alone)${c.off}`)
  } else {
    const { logPath } = startPostgrest()
    if (await waitForPort(PORT)) {
      log(`${c.green}PostgREST${c.off} up on :${PORT} ${c.dim}logs -> ${logPath}${c.off}`)
    } else {
      console.error(`${c.red}[dev]${c.off} PostgREST did not start — see ${logPath}`)
      shutdown(1)
      return
    }
  }

  log(`starting Next.js…`)
  const next = spawn('npm', ['run', 'dev:next'], {
    cwd: FRONTEND,
    stdio: 'inherit',
    shell: true,
  })
  children.push(next)
  next.on('exit', (code) => shutdown(code ?? 0))
}

let shuttingDown = false
function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) killTree(child.pid)
  // Give taskkill a moment to land before the process image goes away.
  setTimeout(() => process.exit(code), 400)
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    console.log('')
    log('shutting down…')
    shutdown(0)
  })
}

main().catch((e) => {
  console.error(`${c.red}[dev]${c.off}`, e)
  shutdown(1)
})
