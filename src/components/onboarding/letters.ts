// Pure HTML builders for onboarding documents. No browser APIs here.

export type OnboardDetails = {
  intern_name: string
  role?: string | null
  start_date?: string | null
  end_date?: string | null
  duration?: string | null
  stipend?: string | null
  reporting_manager?: string | null
  college?: string | null
  university_reg_no?: string | null
  branch?: string | null
  semester?: string | null
  acceptance_deadline?: string | null
}

export const COMPANY = {
  name: 'Electrobtech Innovations Pvt Ltd',
  tagline: 'Way For Creations',
  address: 'No 274, 2nd Floor, 5th Block, 3rd Phase, BSK 3rd Stage, Kataruguppe, Bengaluru – 560085',
  contact: '9902257743 / 9902257101',
  email: 'info@electrobtech.in',
  website: 'www.electrobtech.in',
  hrName: 'Megha',
  hrTitle: 'HR / Internship Coordinator',
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '____________')
const fmtLong = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '____________')
const v = (x?: string | null) => x || '________________'

export function letterhead(): string {
  return `
  <div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #2563eb;padding-bottom:14px;margin-bottom:18px">
    <img src="/electrobtech-logo.jpg" alt="logo" style="height:54px;width:54px;object-fit:contain"/>
    <div>
      <div style="font-size:19px;font-weight:800;color:#1e3a8a;letter-spacing:.3px">${COMPANY.name.toUpperCase()}</div>
      <div style="font-size:12px;color:#2563eb;font-style:italic">${COMPANY.tagline}</div>
    </div>
  </div>`
}

export function letterFooter(): string {
  return `
  <div style="margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px;text-align:center;font-size:11px;color:#64748b">
    ${COMPANY.address}<br/>Contact: ${COMPANY.contact} · Email: ${COMPANY.email} · ${COMPANY.website}
  </div>`
}

const p = (html: string) => `<p style="font-size:13.5px;line-height:1.7;color:#334155;margin:10px 0">${html}</p>`
const li = (items: string[]) => `<ul style="margin:6px 0 6px 18px;padding:0;font-size:13.5px;line-height:1.7;color:#334155">${items.map((i) => `<li style="margin:2px 0">${i}</li>`).join('')}</ul>`

export function offerLetterBody(d: OnboardDetails): string {
  const today = fmtLong(new Date().toISOString())
  const dept = d.role || 'Artificial Intelligence & Machine Learning'
  return `
  ${letterhead()}
  <div style="text-align:center;font-weight:700;font-size:16px;color:#1e293b;margin:6px 0">Internship Offer Letter</div>
  <div style="text-align:right;font-size:13px;color:#475569;margin-bottom:8px">${today}</div>

  ${p(`Dear <b>${d.intern_name}</b>,`)}
  ${p(`We are thrilled to offer you an internship in our <b>${dept}</b> department at <b>${COMPANY.name}</b>. We were highly impressed with your skills and experience during the selection process, and we are excited to welcome you to our team.`)}

  ${p('<b>Appointment Details:</b>')}
  <div style="font-size:13.5px;line-height:1.9;color:#334155;margin-left:6px">
    – Internship Title: ${v(d.role)} Intern<br/>
    – College Name: ${v(d.college)}<br/>
    – University Registration Number: ${v(d.university_reg_no)}<br/>
    – Branch: ${v(d.branch)}<br/>
    – Semester: ${v(d.semester)}<br/>
    – Start Date: ${fmt(d.start_date)}<br/>
    – End Date: ${fmt(d.end_date)}<br/>
    – Duration: ${v(d.duration)}
  </div>

  ${p('<b>Working Hours</b>')}
  <div style="font-size:13.5px;line-height:1.7;color:#334155;margin-left:6px">Working Days: Monday to Friday.<br/>Weekly Off: Saturday and Sunday.</div>

  ${p('<b>Roles &amp; Responsibilities</b><br/>You will be responsible for:')}
  ${li([
    'Assisting in day-to-day departmental activities',
    'Supporting ongoing projects and tasks',
    'Preparing reports, documentation, and presentations',
    'Completing assigned learning modules and assessments',
    'Collaborating with team members as required',
  ])}

  ${p('<b>Company Policies</b><br/>During your internship, you are expected to adhere to the company’s rules, regulations, and confidentiality policies. All data, documents, and materials provided during the internship must remain confidential.')}

  ${p(`You will be directly reporting to <b>${v(d.reporting_manager)}</b>, Team Lead, as a mentor, who will provide guidance and support throughout your internship.`)}

  ${p(`<b>Acceptance</b><br/>To accept this offer, please sign and return a scanned copy of this letter${d.acceptance_deadline ? ` on or before <b>${fmt(d.acceptance_deadline)}</b>` : ''}. For any queries or clarifications, feel free to contact our HR representative, Ms ${COMPANY.hrName}, at ${COMPANY.email}.`)}
  ${p('We look forward to your valuable participation and growth during your internship with us.')}

  <div style="font-size:13.5px;line-height:1.7;color:#334155;margin-top:16px">
    Best Regards,<br/><br/><b>${COMPANY.hrName}</b><br/>${COMPANY.hrTitle}<br/>${COMPANY.name}<br/>Contact: ${COMPANY.contact}
  </div>

  <div style="margin-top:22px;border-top:1px dashed #cbd5e1;padding-top:14px;font-size:13px;line-height:2;color:#334155">
    I accept the offer of an internship with the Company on the terms and conditions set out in this letter.<br/>
    Candidate Name: <b>${d.intern_name}</b><br/>
    Contact Number: ____________________ &nbsp;&nbsp; Alternate Number: ____________________<br/>
    Email: ____________________<br/>
    Date: ____________________<br/>
    Candidate Signature: ____________________
  </div>
  ${letterFooter()}`
}

export function ndaBody(d: OnboardDetails): string {
  const today = fmtLong(new Date().toISOString())
  const A = (h: string, b: string) => `<h3 style="font-size:14px;color:#1e3a8a;margin:14px 0 4px">${h}</h3><p style="font-size:12.5px;line-height:1.6;color:#334155;margin:0">${b}</p>`
  return `
  ${letterhead()}
  <h2 style="font-size:16px;color:#1e293b;text-align:center;margin:6px 0 14px">INTERN NON-DISCLOSURE AGREEMENT</h2>
  <p style="font-size:12.5px;line-height:1.6;color:#334155">
    This Non-Disclosure Agreement (the "Agreement") is entered into between <b>${d.intern_name}</b> ("Intern") and
    <b>${COMPANY.name}</b> ("Company"), collectively the "Parties", as of <b>${today}</b>.
  </p>
  ${A('Article I — Scope', 'This Agreement acknowledges that certain confidential information, trade secrets and proprietary data of the Company may be disclosed to the Intern during the internship, and defines the circumstances in which the Intern can and cannot disclose such Confidential Information, including remedies and lawful action the Company may take.')}
  ${A('Article II — Confidential Information', 'Confidential Information is any material, knowledge or data (verbal, electronic or written) concerning the Company not generally known to the public, including inventions, designs, source code, software, hardware, business and marketing plans, pricing data, and information concerning investors, customers, suppliers and employees. Exclusions apply for information that is publicly known, lawfully received from a third party, or released with the Company\'s written authorisation. The Intern shall not use or disclose Confidential Information for personal benefit during the internship or any time thereafter, shall limit access on a need-to-know basis, and all such information remains the property of the Company.')}
  ${A('Article III — Inventions', 'Inventions created by the Intern prior to the internship are excluded. Inventions constructed during the internship are the sole property of the Company, except inventions developed on the Intern\'s own time without Company property, materials or information.')}
  ${A('Article IV — Entire Agreement', 'This Agreement constitutes the entire agreement and nullifies prior agreements between the Parties. No modifications are valid unless in writing and signed by authorised representatives. The Agreement is binding upon successors and assigns.')}
  ${A('Article V — Nature of Relationship', 'This Agreement does not constitute a contract of employment, nor guarantee any employment, nor create a partnership or joint venture. It governs only the confidentiality obligations of the internship.')}
  ${A('Article VI — Severability', 'Any provision deemed invalid or unlawful shall be severed and the remainder shall continue to be enforceable.')}
  ${A('Article VII — Governing Law', 'This Agreement shall be governed in accordance with the laws of the State of Karnataka.')}
  ${A('Article VIII — Immunity', 'Disclosing Confidential Information to an attorney, government representative or court official in confidence while assisting a case involving a suspected violation of law is not a breach. If required to disclose by law, the Intern shall provide prompt notice.')}
  ${A('Article IX — Breach', 'Use or disclosure of Confidential Information may be cause for action at law, and the Company shall be entitled to an injunction. The Intern shall indemnify the Company for any damage, loss, cost or expense caused by such use or disclosure.')}
  ${A('Article X — Prevailing Party', 'In any dispute arising out of this Agreement, the prevailing party shall have the right to collect reasonable attorney fees, costs and necessary expenditures from the other party.')}
  <div style="margin-top:24px;font-size:13px;color:#334155">
    Accepted and agreed by:<br/><br/>
    <b>${d.intern_name}</b> (Intern)<br/>Date: ${today}
  </div>
  ${letterFooter()}`
}
