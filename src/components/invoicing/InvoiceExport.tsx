'use client'

import { Download } from 'lucide-react'

type Row = {
  invoice_no: string
  student: string | null
  amount: number
  status: string
  issued_date: string | null
  due_date: string | null
}

const csvCell = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"'

export function InvoiceExport({ rows, label }: { rows: Row[]; label: string }) {
  function download() {
    const header = ['Invoice No', 'Student', 'Amount', 'Status', 'Issued', 'Due']
    const lines = [header.map(csvCell).join(',')]
    for (const r of rows) {
      lines.push([
        r.invoice_no,
        r.student ?? '',
        Number(r.amount || 0),
        r.status,
        r.issued_date ?? '',
        r.due_date ?? '',
      ].map(csvCell).join(','))
    }
    const csv = '\uFEFF' + lines.join('\r\n')       // BOM so Excel reads ₹/UTF-8 correctly
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Invoices_${label}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={download}
      disabled={!rows.length}
      title="Export to Excel/CSV"
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      <Download className="h-4 w-4" /> Export
    </button>
  )
}
