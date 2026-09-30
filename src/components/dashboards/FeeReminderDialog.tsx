'use client'

import { useState } from 'react'
import { Bell, Check, Copy, MessageCircle, X } from 'lucide-react'

/**
 * "Send Reminder" on the Pending Fees card.
 *
 * There is no mail or SMS gateway wired into this deployment, so nothing
 * here sends anything on its own — it drafts the message and hands it to
 * the person at the keyboard, either through a WhatsApp deep link they
 * click or on the clipboard. That is the same route the Daily Report card
 * already takes, and it keeps the card honest: the button never claims a
 * reminder went out when no message left the machine.
 */

export type PendingInvoice = {
  invoice_no: string | null
  name: string | null
  phone: string | null
  amount: number
  due_date: string | null
}

const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')

const prettyDate = (d: string | null) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

/**
 * Digits only, with India's country code when it is missing.
 *
 * Numbers arrive from a spreadsheet import in every shape people type
 * them — "98765 43210", "+91-98765-43210", "098765 43210" — and wa.me
 * accepts exactly one: digits with a country code and no plus.
 */
function waNumber(raw: string | null): string | null {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length === 10) return `91${d}`
  if (d.length === 11 && d.startsWith('0')) return `91${d.slice(1)}`
  if (d.length >= 11 && d.length <= 15) return d
  return null
}

function message(i: PendingInvoice) {
  const due = prettyDate(i.due_date)
  return [
    `Hi ${i.name?.trim() || 'there'},`,
    '',
    `This is a gentle reminder from Electrobtech about your pending fee of ${inr(i.amount)}${
      i.invoice_no ? ` (invoice ${i.invoice_no})` : ''
    }${due ? `, due on ${due}` : ''}.`,
    '',
    'Please ignore this message if you have already paid. Do reach out if you would like to discuss a payment plan.',
    '',
    'Thank you,',
    'Team Electrobtech',
  ].join('\n')
}

export function FeeReminderDialog({ invoices }: { invoices: PendingInvoice[] }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000)
    } catch {
      alert('Unable to copy — your browser blocked clipboard access.')
    }
  }

  // Nothing outstanding means nobody to remind, and the button opened an empty
  // dialog. Hidden rather than disabled — which also lets the Pending Fees
  // card sit at the same height as its five neighbours.
  if (!invoices.length) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
      >
        <Bell className="h-3 w-3" /> Send Reminder
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Fee reminders</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {invoices.length
                    ? `${invoices.length} pending invoice${invoices.length === 1 ? '' : 's'} in this period. Nothing is sent until you open WhatsApp and press send.`
                    : 'No pending invoices in the selected period.'}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {invoices.map((i, n) => {
                const key = i.invoice_no ?? `row-${n}`
                const wa = waNumber(i.phone)
                const text = message(i)
                return (
                  <li key={key} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {i.name?.trim() || 'Unnamed'}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {[i.invoice_no, i.phone, prettyDate(i.due_date) && `due ${prettyDate(i.due_date)}`]
                          .filter(Boolean)
                          .join(' · ') || 'No contact details on the invoice'}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-rose-600">{inr(i.amount)}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {wa ? (
                        <a
                          href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                      ) : (
                        <span className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-400">No number</span>
                      )}
                      <button
                        onClick={() => copy(key, text)}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        {copied === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === key ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </li>
                )
              })}
              {!invoices.length && (
                <li className="px-5 py-10 text-center text-sm text-slate-400">
                  Nothing to chase up here.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
