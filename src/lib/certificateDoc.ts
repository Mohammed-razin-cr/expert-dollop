import { esc } from '@/lib/reportHtml'

/**
 * The certificate itself.
 *
 * One template used for both the on-screen preview and the printed copy,
 * so what a trainer approves is what the student receives. Rendered as
 * self-contained HTML with inline styles — the print window has no
 * stylesheet, and the preview is dropped into an iframe.
 */

export type CertificateFields = {
  student: string
  course: string | null
  batch: string | null
  completedOn: string
  certificateId: string | null
  from?: string | null
}

const fmt = (d: string | null | undefined) =>
  d
    ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ''

export function certificateHTML(f: CertificateFields): string {
  const conducted =
    f.from && f.completedOn
      ? `conducted from ${esc(fmt(f.from))} to ${esc(fmt(f.completedOn))}.`
      : ''

  return `
  <div style="position:relative;box-sizing:border-box;width:900px;max-width:100%;margin:0 auto;
              background:#fff;border:1px solid #e2e8f0;
              font-family:Georgia,'Times New Roman',serif;color:#0f172a">

    <!-- corner flourishes -->
    <div style="position:absolute;top:0;left:0;width:190px;height:190px;
                background:linear-gradient(135deg,#1e3a5f 0%,#1e3a5f 46%,#c9a227 46%,#c9a227 58%,transparent 58%)"></div>
    <div style="position:absolute;bottom:0;right:0;width:190px;height:190px;
                background:linear-gradient(315deg,#1e3a5f 0%,#1e3a5f 46%,#c9a227 46%,#c9a227 58%,transparent 58%)"></div>

    <div style="position:absolute;inset:26px;border:2px solid #c9a227"></div>
    <div style="position:absolute;inset:32px;border:1px solid #dfe6ef"></div>

    <div style="position:relative;padding:52px 62px;text-align:center">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:2px;
                font-weight:700;color:#1e3a5f">ELECTROBTECH</p>
      <p style="margin:2px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:8px;
                letter-spacing:3px;color:#94a3b8">INNOVATIONS PVT. LTD.</p>

      <h1 style="margin:26px 0 0;font-size:38px;letter-spacing:6px;color:#0f172a">CERTIFICATE</h1>
      <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;
                letter-spacing:5px;color:#64748b">OF COMPLETION</p>

      <p style="margin:26px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#475569">
        This is to certify that
      </p>

      <p style="margin:10px auto 0;display:inline-block;padding:0 34px 6px;
                border-bottom:1.5px solid #c9a227;font-size:32px;font-style:italic;color:#1e3a5f">
        ${esc(f.student)}
      </p>

      <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#475569">
        has successfully completed the course
      </p>
      <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700">
        ${esc(f.course ?? f.batch ?? 'Course')}
      </p>
      ${
        conducted
          ? `<p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#64748b">${conducted}</p>`
          : ''
      }

      <table style="width:100%;margin-top:44px;border-collapse:collapse;
                    font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#64748b">
        <tr>
          <td style="text-align:center;width:38%">
            <div style="border-top:1px solid #94a3b8;padding-top:5px">
              <span style="font-size:11px;color:#0f172a">${esc(fmt(f.completedOn))}</span><br/>Date
            </div>
          </td>
          <td style="text-align:center;width:24%">
            <div style="width:52px;height:52px;margin:0 auto;border-radius:50%;
                        background:radial-gradient(circle at 35% 30%,#e6c65c,#c9a227 62%,#a2801b);
                        border:2px solid #b8941f"></div>
          </td>
          <td style="text-align:center;width:38%">
            <div style="border-top:1px solid #94a3b8;padding-top:5px">
              <span style="font-size:11px;font-style:italic;color:#0f172a">Electrobtech</span><br/>
              Authorized Signatory
            </div>
          </td>
        </tr>
      </table>

      ${
        f.certificateId
          ? `<p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9px;
                       letter-spacing:1px;color:#94a3b8">${esc(f.certificateId)}</p>`
          : ''
      }
    </div>
  </div>`
}
