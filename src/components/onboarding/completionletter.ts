// import { COMPANY } from './letters'

// export type CompletionLetterData = {
//   internship_id: string
//   date: string
//   intern_name: string
//   department: string
//   college: string
//   degree: string
//   domain: string
//   start_date: string
//   end_date: string
//   project_name: string
//   remarks?: string
//   authorized_person: string
//   designation: string
// }

// const fmt = (d?: string | null) =>
//   d
//     ? new Date(d).toLocaleDateString('en-GB', {
//         day: '2-digit',
//         month: '2-digit',
//         year: 'numeric',
//       })
//     : '____________'


// const v = (x?: string | null) => x || '________________'


// function completionHeader() {
//   return `
//   <div style="
// position:relative;
// height:120px;
// margin-bottom:10px;
// font-family:Arial, sans-serif;
// ">

//     <div style="
//       position:absolute;
//       top:-30px;
//       left:-30px;
//       width:120px;
//       height:80px;
//       background:#1d4ed8;
//       clip-path:polygon(0 0,100% 0,0 100%);">
//     </div>

//     <div style="
//       display:flex;
//       justify-content:space-between;
//       align-items:flex-start;
//       padding-top:5px">

//       <div style="
// width:65%;
// font-size:10px;
// line-height:1.45;
// color:#111827;
// ">


// <div style="
// font-size:20px;
// font-weight:700;
// color:#1e40af;
// letter-spacing:.2px;
// ">

//         ${COMPANY.name}

//         </div>

//         <div style="
//         font-size:12px;
//         color:#2563eb;
//         font-style:italic;
//         margin-bottom:10px">

//         ${COMPANY.tagline}

//         </div>


//         Reg Office - No 274, 2nd FLOOR, 5th BLOCK, 3rd PHASE,<br/>
//         BSK 3rd STAGE, KATIRGUPPE, BANGALORE - 560085<br/>

//         CONTACT NO: 9902257753 / 9902257101 / 63637 57435<br/>

//         Email - info@electrobtech.in

//       </div>


//       <div style="
//       text-align:right;
//       font-size:12px;
//       color:#334155">

//         <img 
//         src="/electrobtech-logo.jpg"
//         style="
//         width:70px;
//         height:70px;
//         object-fit:contain;
//         margin-bottom:8px"
//         />

//         <br/>

//         Website - www.electrobtech.in

//       </div>

//     </div>


//     <div style="
//     margin-top:15px;
//     border-bottom:1px solid #cbd5e1">
//     </div>

//   </div>
//   `
// }


// export function completionLetterBody(
//   d: CompletionLetterData
// ): string {

// return `

// ${completionHeader()}


// <div style="
// text-align:center;
// font-size:18px;
// font-weight:700;
// color:#1e293b;
// text-decoration:underline;
// margin:15px 0">

// Internship Completion Letter

// </div>



// <div style="
// display:flex;
// justify-content:space-between;
// font-size:13px;
// color:#334155;
// margin-bottom:20px">

// <div>
// Internship ID – <b>${v(d.internship_id)}</b>
// </div>

// <div>
// Date: <b>${fmt(d.date)}</b>
// </div>

// </div>



// <div style="
// text-align:center;
// font-size:14px;
// font-weight:700;
// margin-bottom:18px">

// TO WHOMSOEVER IT MAY CONCERN

// </div>



// <p style="
// font-size:13.5px;
// line-height:1.8;
// color:#334155">

// This is to certify that Mr/Ms <b>${v(d.intern_name)}</b>,
// from the Department of <b>${v(d.department)}</b>,
// studying <b>${v(d.degree)}</b> at
// <b>${v(d.college)}</b>, has successfully completed an
// internship in <b>${v(d.domain)}</b> at
// <b>${COMPANY.name}</b> from
// <b>${fmt(d.start_date)}</b> to
// <b>${fmt(d.end_date)}</b>.

// </p>



// <p style="
// font-size:13.5px;
// line-height:1.8;
// color:#334155">

// During the internship period,
// <b>${v(d.intern_name)}</b> demonstrated strong involvement
// and actively contributed to <b>${v(d.project_name)}</b>.
// Their dedication and ability to understand, apply and execute
// new concepts with efficiency were appreciated.

// </p>



// <p style="
// font-size:13.5px;
// line-height:1.8;
// color:#334155">

// On behalf of Electrobtech Innovations, we extend our best wishes
// to <b>${v(d.intern_name)}</b> for a successful career and all
// future endeavours.

// </p>



// <div style="
// height:100px;
// margin-top:35px">

// </div>



// <div style="
// text-align:right;
// font-size:13px;
// line-height:1.8;
// color:#334155">

// <b>${v(d.authorized_person)}</b><br/>

// ${v(d.designation)}<br/>

// ${COMPANY.name}

// </div>



// <div style="
// position:absolute;
// bottom:-20px;
// right:-20px;
// width:100px;
// height:100px;
// background:#2563eb;
// border-radius:100px 0 0 0;
// opacity:.9">

// </div>


// `
// }

import { COMPANY } from './letters'

export type CompletionLetterData = {
  internship_id: string
  date: string
  intern_name: string
  department: string
  college: string
  degree: string
  domain: string
  start_date: string
  end_date: string
  project_name: string
  remarks?: string
  authorized_person: string
  designation: string
}

const fmt = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '____________'

const v = (x?: string | null) => x || '________________'

function completionHeader() {
  return `
    <div style="position: relative; width: 100%; height: 160px; font-family: 'Calibri', Arial, sans-serif;">
      
      <!-- Top Left Corner Shapes -->
      <svg style="position: absolute; top: -40px; left: -55px; width: 400px; height: 150px; z-index: -1;" viewBox="0 0 400 150" preserveAspectRatio="none">
        <path d="M0,0 L400,0 Q200,60 0,150 Z" fill="#0000a0" />
        <path d="M0,0 L280,0 Q140,50 0,110 Z" fill="#143dfa" />
      </svg>

      <!-- Top Right Logo -->
      <div style="position: absolute; top: 0px; right: 0px;">
        <img 
          src="/electrobtech-logo.jpg" 
          style="height: 75px; object-fit: contain;" 
          alt="Electrobtech Logo" 
        />
      </div>

      <!-- Address and Contact Info -->
      <div style="position: absolute; top: 100px; left: 0; width: 100%; font-size: 10px; line-height: 1.5; color: #000; padding-bottom: 8px; border-bottom: 1px solid #000;">
        <b>Reg Office</b> - NO 274, 2<sup>nd</sup> FLOOR, 5<sup>th</sup> BLOCK, 3<sup>rd</sup> PHASE, BSK 3<sup>rd</sup> STAGE, KATARIGUPPE, BANGALORE – 560085
        <br/>
        <b>CONTACT NO:</b> 9902257743 / 9902257101 / 63637 57345
        <br/>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span><b>Email</b> – info@electrobtech.in</span>
          <span><b>Website</b> - <a href="http://www.electrobtech.in" style="color: #0563c1; text-decoration: underline;">www.electrobtech.in</a></span>
        </div>
      </div>
    </div>
  `
}

export function completionLetterBody(d: CompletionLetterData): string {
  return `
    <div style="
      position: relative;
      width: 794px;
      height: 1123px;
      padding: 40px 55px;
      box-sizing: border-box;
      font-family: 'Calibri', Arial, sans-serif;
      overflow: hidden;
      color: #000;
      background-color: #fff;
    ">
      
      ${completionHeader()}

      <!-- Title -->
      <div style="
        text-align: center;
        font-size: 18px;
        font-weight: 700;
        text-decoration: underline;
        margin-top: 35px;
        margin-bottom: 35px;
      ">
        Internship Completion Letter
      </div>

      <!-- ID and Date -->
      <div style="
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 45px;
      ">
        <div>Internship ID – ${v(d.internship_id)}</div>
        <div>Date: ${fmt(d.date)}</div>
      </div>

      <!-- Salutation -->
      <div style="
        text-align: center;
        font-size: 13px;
        margin-bottom: 35px;
      ">
        TO WHOMSOEVER IT MAY CONCERN
      </div>

      <!-- Paragraph 1 -->
      <p style="
        font-size: 13px;
        line-height: 1.6;
        text-align: left;
        margin-bottom: 15px;
      ">
        This is to certify that <b>Mr/Ms ${v(d.intern_name)}</b>, from the <b>Department of ${v(d.department)}</b>, studying at <b>${v(d.college)}</b>, has successfully completed an internship on <b>${v(d.domain)}</b> at <b>${COMPANY.name}</b> from <b>${fmt(d.start_date)} to ${fmt(d.end_date)}</b>.
      </p>

      <!-- Paragraph 2 -->
      <p style="
        font-size: 13px;
        line-height: 1.6;
        text-align: left;
        margin-bottom: 15px;
      ">
        During the internship period, <b>Mr/Ms ${v(d.intern_name)}</b> demonstrated strong involvement and actively contributed to the project titled <b>“${v(d.project_name)}”</b>. Throughout their tenure, they demonstrated consistent punctuality, strong dedication, and an excellent ability to understand, apply and execute new concepts with efficiency.
      </p>

      <!-- Paragraph 3 -->
      <p style="
        font-size: 13px;
        line-height: 1.6;
        text-align: left;
        margin-bottom: 30px;
      ">
        On behalf of <b>${COMPANY.name}</b>, we extend our best wishes to <b>${v(d.intern_name).split(' ')[0]}</b> for a successful career and all future endeavours.
      </p>

      <!-- Empty space for Signature & Seal -->
      <div style="height: 120px; margin-top: 40px;">
        <!-- Left blank intentionally as requested -->
      </div>

      <!-- Signature Text Block -->
      <div style="
        font-size: 13px;
        line-height: 1.6;
      ">
        <b>${v(d.authorized_person)}</b>
        <br/>
        <b>${v(d.designation)}</b>
        <br/>
        <b>${COMPANY.name} Pvt Ltd</b>
      </div>

      <!-- Bottom Right Corner Shapes -->
      <svg style="position: absolute; bottom: -40px; right: -55px; width: 100%; height: 220px; z-index: -1;" viewBox="0 0 794 220" preserveAspectRatio="none">
        <path d="M150,220 L794,220 L794,0 Q500,190 150,220 Z" fill="#143dfa" opacity="0.8" />
        <path d="M350,220 L794,220 L794,80 Q600,200 350,220 Z" fill="#0000a0" opacity="0.95" />
      </svg>

    </div>
  `
}