'use client'

import { Download } from 'lucide-react'
import { rupeesInWords } from '@/lib/num2words'

const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// export function InvoicePrint(invoice: {invoice_no: string,amount: number,student: string | null,mobile?: string | null,email?: string | null,course?: string | null,place_city?: string | null,current_location?: string | null,branch?: string | null,degree?: string | null,cgpa?: string | number | null,year_of_passing?: string | number | null,graduation_status?: string | null,dob?: string | null,status?: string | null,due_date?: string | null,issued_date?: string | null}){
export function InvoicePrint({
  invoice,
}: {
  invoice: {
    invoice_no: string
    amount: number
    student: string | null
    // 'project' when this invoice bills a project rather than a student —
    // same GST math either way, only the Bill To block and line-item
    // description differ.
    kind?: 'student' | 'project'
    // Project bill-to detail: student's name row becomes the contact
    // person, with the project's own title shown alongside it.
    personName?: string | null
    projectTitle?: string | null
    college?: string | null
    department?: string | null
    // Paid out to whoever referred the project — not part of what was
    // charged to the client, so it never touches the GST math below; it is
    // only printed as a reference line after the grand total.
    referralDeduction?: number | null

    mobile?: string | null
    email?: string | null
    course?: string | null
    place_city?: string | null
    current_location?: string | null
    branch?: string | null
    degree?: string | null
    cgpa?: string | number | null
    year_of_passing?: string | number | null
    graduation_status?: string | null
    dob?: string | null

    status?: string | null
    due_date?: string | null
    issued_date?: string | null
  }
}) {
  function open() {
    const total = Number(invoice.amount || 0)
    const base = total / 1.18
    const cgst = base * 0.09
    const sgst = base * 0.09
    const isProject = invoice.kind === 'project'
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const w = window.open('', '_blank', 'width=820,height=900')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>${invoice.invoice_no}</title>
<style>
  *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
  body{margin:0;padding:32px;color:#1e293b}
  
  .brand{font-size:22px;font-weight:800;color:#1e3a8a}
  .brandrow{display:flex;align-items:center;gap:12px}
  .brandrow img{height:50px;width:50px;object-fit:contain}
  .sub{font-size:12px;color:#64748b}
  .meta{text-align:right;font-size:13px}
  h2{
  font-size:15px;
  margin:18px 0 6px;
  color:#334155;
}
  .head{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    border-bottom:1px solid #e2e8f0;
    padding-bottom:16px;
    margin-bottom:24px;
  }
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
  th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left}
  th{background:#f1f5f9;color:#475569}
  .r{text-align:right}
  .tot{font-weight:700;background:#eff6ff}
  .foot{margin-top:28px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
  @media print{.noprint{display:none}}
</style></head><body>
<div class="head">
  <div class="brandrow">
    <img src="${origin}/electrobtech-logo.jpg" alt="logo"/>
    <div>
      <div class="brand">Electrobtech Innovations Pvt Ltd</div>
      <div class="sub">2nd Floor, 274/2, 100 Ft Road</div>
      <div class="sub">5th Block, 3rd Phase, BSK 3rd Stage</div>
      <div class="sub">Kathriguppe, Bengaluru Urban</div>
      <div class="sub">Karnataka - 560085</div>
      <div class="sub"><b>GSTIN:</b> 29AAICE9526C1ZH</div>
      <div class="sub"><b>PAN:</b> AAICE9526C</div>
      <div class="sub">www.electrobtech.in</div>
    </div>
  </div>
  <div class="meta">
  <div style="font-size:18px;font-weight:700;color:#2563eb">TAX INVOICE</div>

  <div><b>Invoice No:</b> ${invoice.invoice_no}</div>
  <div><b>Invoice Date:</b> ${invoice.issued_date ?? '-'}</div>
  <div><b>Place of Supply:</b> Karnataka</div>
  ${isProject ? '<div><b>Billed For:</b> Project</div>' : ''}
</div>
</div>


<h2>BILL TO</h2>

<table style="margin-bottom:20px">
<tbody>
<tr>
<td><b>Name</b></td>
<td>${(isProject ? invoice.personName ?? invoice.student : invoice.student) ?? '-'}</td>
</tr>

${isProject ? `
<tr>
<td><b>Project</b></td>
<td>${invoice.projectTitle ?? '-'}</td>
</tr>

<tr>
<td><b>College</b></td>
<td>${invoice.college ?? '-'}</td>
</tr>

<tr>
<td><b>Department</b></td>
<td>${invoice.department ?? '-'}</td>
</tr>
` : `
<tr>
<td><b>Email</b></td>
<td>${invoice.email ?? '-'}</td>
</tr>
`}

<tr>
<td><b>Mobile</b></td>
<td>${invoice.mobile ?? '-'}</td>
</tr>

<tr>
<td><b>State</b></td>
<td>Karnataka</td>
</tr>
</tbody>
</table>
<table>
<thead>
<tr>
<th>Description</th>
<th>SAC</th>
<th class="r">Qty</th>
<th class="r">Rate</th>
<th class="r">Amount</th>
</tr>
</thead>

<tbody>
<tr>
<td>${isProject ? 'Project Service' : 'Training / Aptitude Service'}</td>
<td>${isProject ? '-' : '998313'}</td>
<td class="r">1</td>
<td class="r">${inr(base)}</td>
<td class="r">${inr(total)}</td>
</tr>
</tbody>
</table>

<div style="margin-top:15px;text-align:right;font-size:13px">
  <div>Taxable Amount: ${inr(base)}</div>
  <div>CGST (9%): ${inr(cgst)}</div>
  <div>SGST (9%): ${inr(sgst)}</div>

  <div style="margin-top:5px;font-weight:bold;font-size:14px">
    Grand Total: ${inr(total)}
  </div>

  ${isProject && invoice.referralDeduction ? `
  <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #e2e8f0;color:#64748b">
    Less: Referral Deduction: ${inr(invoice.referralDeduction)}
  </div>
  <div style="font-weight:bold">
    Net Amount after Deduction: ${inr(total - invoice.referralDeduction)}
  </div>
  ` : ''}
</div>

<p style="font-size:13px;margin-top:14px">
  <b>Amount in words:</b> Rupees ${rupeesInWords(total)} Only
</p>

<div style="margin-top:25px;border-top:1px solid #e2e8f0;padding-top:12px">
  <div style="font-size:13px;font-weight:bold;margin-bottom:8px">
    DECLARATION
  </div>

  <p style="font-size:12px;line-height:1.6;margin:0;max-width:70%">
    We declare that this invoice shows the actual price of the
    services described and that all particulars are true and correct.
  </p>

  <div style="margin-top:40px;text-align:right">
    <div style="font-size:12px;font-weight:bold">
      For ELECTROBTECH INNOVATIONS PRIVATE LIMITED
    </div>

    <div style="height:60px"></div>

    <div style="font-size:12px">
      Authorised Signatory
    </div>
  </div>
</div>

<div class="foot">
  Computer-generated tax invoice · Payment status: PAID · CGST 9% + SGST 9% = 18% GST${isProject ? '' : ' · SAC 998313'}
</div>

<div class="noprint" style="margin-top:20px">
  <button
    onclick="window.print()"
    style="background:#2563eb;color:#fff;border:0;padding:10px 18px;border-radius:8px;cursor:pointer"
  >
    Print / Save as PDF
  </button>
</div>
</body></html>`)
    w.document.close()
  }

  return <button onClick={open} title="Download / Print" className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"><Download className="h-3.5 w-3.5" /> PDF</button>
}
