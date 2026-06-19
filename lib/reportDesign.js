export const REPORT_LOGO_SRC = '/qudartinew.png'
export const REPORT_COMPANY_NAME = 'Qudarti Food Processors'
export const REPORT_COMPANY_SUFFIX = '(SMC-PVT) LTD.'

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatReportValue(value) {
  return value || value === 0 ? String(value) : '-'
}

export function buildReportHtml({
  title,
  subtitle = '',
  filters = [],
  columns = [],
  rows = [],
  generatedAt = new Date(),
}) {
  const safeTitle = escapeHtml(title)
  const safeSubtitle = escapeHtml(subtitle)
  const filterText = filters.filter(Boolean).join(' | ')
  const tableHead = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('')
  const tableBody = rows.length
    ? rows.map((row) => {
        const cells = columns.map((col) => {
          const raw = typeof col.render === 'function' ? col.render(row) : row[col.key]
          return `<td>${escapeHtml(formatReportValue(raw))}</td>`
        }).join('')
        return `<tr>${cells}</tr>`
      }).join('')
    : `<tr><td colspan="${columns.length}" class="empty">No records found</td></tr>`

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #f3f6f3; color: #17231a; font-family: Arial, sans-serif; font-size: 12px; }
      .page { width: min(1120px, calc(100% - 32px)); margin: 18px auto; background: #fff; border: 1px solid #dfe8df; padding: 24px; }
      .header { display: flex; align-items: center; justify-content: space-between; gap: 18px; border-bottom: 3px solid #1b5e20; padding-bottom: 14px; }
      .brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
      .logo { width: 76px; height: 76px; object-fit: contain; flex: 0 0 auto; }
      .company { margin: 0; font-size: 21px; line-height: 1.15; color: #123416; font-weight: 800; }
      .suffix { margin: 3px 0 0; font-size: 11px; color: #536653; font-weight: 700; letter-spacing: .8px; }
      .report-name { text-align: right; min-width: 220px; }
      h1 { margin: 0; font-size: 20px; color: #1b5e20; }
      .subtitle { margin: 6px 0 0; color: #667566; font-size: 12px; }
      .meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 16px 0; }
      .meta-box { border: 1px solid #e2e8e2; background: #f8faf8; padding: 9px 10px; }
      .meta-label { display: block; color: #6b7a6b; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; }
      .meta-value { display: block; margin-top: 3px; color: #1e2d20; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th { background: #e8f0e8; color: #173c1b; text-align: left; font-size: 11px; border: 1px solid #cfdccf; padding: 8px; text-transform: uppercase; letter-spacing: .35px; }
      td { border: 1px solid #e1e7e1; padding: 7px 8px; vertical-align: top; color: #273529; }
      tr:nth-child(even) td { background: #fafcfa; }
      .empty { text-align: center; color: #64748b; padding: 22px; }
      .footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #e2e8e2; color: #728172; font-size: 11px; display: flex; justify-content: space-between; gap: 12px; }
      @media print {
        body { background: #fff; }
        .page { width: 100%; margin: 0; border: none; padding: 10mm; }
        .no-print { display: none; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="header">
        <div class="brand">
          <img class="logo" src="${REPORT_LOGO_SRC}" alt="${escapeHtml(REPORT_COMPANY_NAME)}" />
          <div>
            <p class="company">${escapeHtml(REPORT_COMPANY_NAME)}</p>
            <p class="suffix">${escapeHtml(REPORT_COMPANY_SUFFIX)}</p>
          </div>
        </div>
        <div class="report-name">
          <h1>${safeTitle}</h1>
          ${safeSubtitle ? `<p class="subtitle">${safeSubtitle}</p>` : ''}
        </div>
      </section>
      <section class="meta">
        <div class="meta-box"><span class="meta-label">Generated</span><span class="meta-value">${escapeHtml(generatedAt.toLocaleString())}</span></div>
        <div class="meta-box"><span class="meta-label">Records</span><span class="meta-value">${rows.length}</span></div>
        <div class="meta-box"><span class="meta-label">Filters</span><span class="meta-value">${escapeHtml(filterText || 'None')}</span></div>
      </section>
      <table>
        <thead><tr>${tableHead}</tr></thead>
        <tbody>${tableBody}</tbody>
      </table>
      <section class="footer">
        <span>${escapeHtml(REPORT_COMPANY_NAME)}</span>
        <span>System generated report</span>
      </section>
    </main>
    <script>
      window.onload = function () {
        window.focus();
        window.print();
      };
    </script>
  </body>
</html>`
}

export function openReportWindow(config) {
  const reportWindow = window.open('', '_blank', 'width=1200,height=800')
  if (!reportWindow) return false
  reportWindow.document.open()
  reportWindow.document.write(buildReportHtml(config))
  reportWindow.document.close()
  return true
}

export function loadImageDataUrl(src = REPORT_LOGO_SRC) {
  if (typeof window === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(image, 0, 0)
        resolve({ dataUrl: canvas.toDataURL('image/png'), width: image.naturalWidth, height: image.naturalHeight })
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = src
  })
}

export function addPdfReportHeader(doc, { title, subtitle = '', filters = [], logoImage = null }) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const left = 40
  const top = 28
  if (logoImage?.dataUrl) {
    doc.addImage(logoImage.dataUrl, 'PNG', left, top - 8, 46, 46)
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(18, 52, 22)
  doc.text(REPORT_COMPANY_NAME, left + 58, top + 4)
  doc.setFontSize(8.5)
  doc.setTextColor(83, 102, 83)
  doc.text(REPORT_COMPANY_SUFFIX, left + 58, top + 17)
  doc.setFontSize(15)
  doc.setTextColor(27, 94, 32)
  doc.text(title, pageWidth - left, top + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 100)
  doc.text(subtitle || `Generated: ${new Date().toLocaleString()}`, pageWidth - left, top + 18, { align: 'right' })
  doc.text(`Filters: ${filters.filter(Boolean).join(' | ') || 'None'}`, left, top + 52)
  doc.setDrawColor(207, 220, 207)
  doc.line(left, top + 60, pageWidth - left, top + 60)
  return top + 74
}
