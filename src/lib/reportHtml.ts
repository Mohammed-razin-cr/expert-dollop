/**
 * Building blocks for the printable reports.
 *
 * Reports are plain HTML strings handed to printDoc, which opens them in a
 * print window — the browser's own "Save as PDF" does the rest, so no PDF
 * library is needed. Styles are inline because a print window has no
 * stylesheet of its own.
 *
 * Shared so the student report and the attendance report cannot drift into
 * looking like two different products.
 */

/** Names, topics and notes are user text going into an HTML string. */
export const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Escapes, and renders empty values as an em dash rather than a blank cell. */
export const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : esc(v))

export const TABLE_CSS = 'width:100%;border-collapse:collapse;margin-top:8px;font-size:12px'
export const TH = 'text-align:left;padding:6px 8px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600'
export const TD = 'padding:6px 8px;border:1px solid #e2e8f0'

/** A titled table, or the empty message when there are no rows. */
export function section(title: string, headers: string[], rows: unknown[][], emptyMsg: string) {
  const head = headers.map((h) => `<th style="${TH}">${esc(h)}</th>`).join('')
  const body = rows.length
    ? rows.map((r) => `<tr>${r.map((c) => `<td style="${TD}">${dash(c)}</td>`).join('')}</tr>`).join('')
    : `<tr><td style="${TD}" colspan="${headers.length}">${esc(emptyMsg)}</td></tr>`
  return `
    <h2 style="margin:22px 0 0;font-size:14px;color:#0f172a">${esc(title)}</h2>
    <table style="${TABLE_CSS}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

/** A label / value row for the two-column summary tables. */
export const pair = (label: string, value: unknown) =>
  `<tr><td style="${TD};width:170px;color:#64748b">${esc(label)}</td><td style="${TD};font-weight:600">${dash(value)}</td></tr>`

/**
 * The ruled masthead every report opens with.
 *
 * `subtitle` is inserted as HTML so callers can separate parts with
 * `&nbsp;•&nbsp;` — pass any user text through esc() first.
 */
export function reportHeader(title: string, subtitle: string, caption: string) {
  return `
  <div style="border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:4px">
    <h1 style="margin:0;font-size:22px">${esc(title)}</h1>
    <p style="margin:4px 0 0;color:#64748b;font-size:13px">${subtitle}</p>
    <p style="margin:2px 0 0;color:#94a3b8;font-size:11px">${esc(caption)}</p>
  </div>`
}

/** "22 August 2026" — the stamp reports are generated with. */
export const today = () =>
  new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
