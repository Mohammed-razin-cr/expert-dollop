export function printDoc(title: string, bodyHTML: string) {
  const w = window.open('', '_blank', 'width=820,height=900')

  if (!w) return

  w.document.write(`
  <!doctype html>
  <html>
  <head>
    <title>${title}</title>

    <style>
    *{
      font-family:Arial,Helvetica,sans-serif;
      box-sizing:border-box
    }

    body{
      margin:0;
      padding:36px;
      color:#1e293b;
    }

    @media print{
      .noprint{
        display:none
      }
    }

    </style>

  </head>

  <body>

  ${bodyHTML}

  <div 
  class="noprint"
  style="
  margin-top:24px;
  text-align:center">

  <button 
  onclick="window.print()"
  style="
  background:#2563eb;
  color:#fff;
  border:0;
  padding:10px 20px;
  border-radius:8px;
  cursor:pointer;
  font-size:14px">

  Print / Save as PDF

  </button>

  </div>

  </body>
  </html>
  `)

  w.document.close()
}