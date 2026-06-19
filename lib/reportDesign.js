export const REPORT_LOGO_SRC = '/qudartinew.png'
export const REPORT_COMPANY_NAME = 'Qudarti Food Processors'
export const REPORT_COMPANY_SUFFIX = '(SMC-PVT) LTD.'
export const REPORT_GREEN_DARK = '#123416'
export const REPORT_GREEN = '#1b5e20'
export const REPORT_GREEN_MID = '#2d7a33'
export const REPORT_GREEN_SOFT = '#e8f3e9'
export const REPORT_BORDER = '#cfe0d0'

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
  const generatedText = generatedAt.toLocaleString()
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
      body { margin: 0; background: #eef4ef; color: #17231a; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
      .page { width: min(1160px, calc(100% - 32px)); margin: 18px auto; background: #fff; border: 1px solid ${REPORT_BORDER}; box-shadow: 0 18px 46px rgba(18, 52, 22, .10); }
      .header { display: flex; align-items: stretch; justify-content: space-between; gap: 18px; background: linear-gradient(135deg, ${REPORT_GREEN_DARK} 0%, ${REPORT_GREEN} 58%, ${REPORT_GREEN_MID} 100%); color: #fff; padding: 20px 24px; }
      .brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
      .logo-frame { width: 82px; height: 82px; border-radius: 14px; background: #fff; display: flex; align-items: center; justify-content: center; padding: 8px; flex: 0 0 auto; box-shadow: inset 0 0 0 1px rgba(255,255,255,.55); }
      .logo { width: 100%; height: 100%; object-fit: contain; }
      .company { margin: 0; font-size: 23px; line-height: 1.1; color: #fff; font-weight: 800; }
      .suffix { margin: 5px 0 0; font-size: 11px; color: rgba(255,255,255,.82); font-weight: 700; letter-spacing: .9px; }
      .report-name { text-align: right; min-width: 250px; display: flex; flex-direction: column; justify-content: center; }
      .eyebrow { margin: 0 0 6px; color: rgba(255,255,255,.76); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.6px; }
      h1 { margin: 0; font-size: 24px; color: #fff; line-height: 1.15; }
      .subtitle { margin: 7px 0 0; color: rgba(255,255,255,.82); font-size: 12px; }
      .content { padding: 20px 24px 22px; }
      .meta { display: grid; grid-template-columns: 1.1fr .65fr 1.6fr; gap: 10px; margin: 0 0 16px; }
      .meta-box { border: 1px solid ${REPORT_BORDER}; background: #f8fbf8; padding: 10px 12px; border-left: 4px solid ${REPORT_GREEN_MID}; min-height: 54px; }
      .meta-label { display: block; color: #637463; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .7px; }
      .meta-value { display: block; margin-top: 4px; color: #1e2d20; font-weight: 800; overflow-wrap: anywhere; }
      .table-shell { border: 1px solid ${REPORT_BORDER}; overflow: hidden; }
      table { width: 100%; border-collapse: collapse; }
      th { background: ${REPORT_GREEN}; color: #fff; text-align: left; font-size: 10.5px; border-right: 1px solid rgba(255,255,255,.18); padding: 9px 8px; text-transform: uppercase; letter-spacing: .45px; }
      td { border-top: 1px solid #e1e9e1; border-right: 1px solid #edf2ed; padding: 8px 8px; vertical-align: top; color: #273529; line-height: 1.35; }
      tr:nth-child(even) td { background: #f8fbf8; }
      tr:hover td { background: ${REPORT_GREEN_SOFT}; }
      .empty { text-align: center; color: #64748b; padding: 22px; }
      .footer { margin-top: 16px; padding-top: 10px; border-top: 2px solid ${REPORT_GREEN_SOFT}; color: #647464; font-size: 11px; display: flex; justify-content: space-between; gap: 12px; }
      .seal { font-weight: 800; color: ${REPORT_GREEN}; }
      @media print {
        body { background: #fff; }
        .page { width: 100%; margin: 0; border: none; box-shadow: none; }
        .content { padding: 10mm; }
        .header { padding: 8mm 10mm; }
        tr:hover td { background: inherit; }
        .no-print { display: none; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="header">
        <div class="brand">
          <div class="logo-frame"><img class="logo" src="${REPORT_LOGO_SRC}" alt="${escapeHtml(REPORT_COMPANY_NAME)}" /></div>
          <div>
            <p class="company">${escapeHtml(REPORT_COMPANY_NAME)}</p>
            <p class="suffix">${escapeHtml(REPORT_COMPANY_SUFFIX)}</p>
          </div>
        </div>
        <div class="report-name">
          <p class="eyebrow">Operational Report</p>
          <h1>${safeTitle}</h1>
          ${safeSubtitle ? `<p class="subtitle">${safeSubtitle}</p>` : ''}
        </div>
      </section>
      <div class="content">
        <section class="meta">
          <div class="meta-box"><span class="meta-label">Generated</span><span class="meta-value">${escapeHtml(generatedText)}</span></div>
          <div class="meta-box"><span class="meta-label">Records</span><span class="meta-value">${rows.length}</span></div>
          <div class="meta-box"><span class="meta-label">Filters</span><span class="meta-value">${escapeHtml(filterText || 'None')}</span></div>
        </section>
        <div class="table-shell">
          <table>
            <thead><tr>${tableHead}</tr></thead>
            <tbody>${tableBody}</tbody>
          </table>
        </div>
        <section class="footer">
          <span class="seal">${escapeHtml(REPORT_COMPANY_NAME)}</span>
          <span>System generated report | Green & white official format</span>
        </section>
      </div>
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
  const top = 26
  const headerHeight = 72

  doc.setFillColor(18, 52, 22)
  doc.rect(0, 0, pageWidth, headerHeight, 'F')
  doc.setFillColor(27, 94, 32)
  doc.rect(pageWidth * 0.58, 0, pageWidth * 0.42, headerHeight, 'F')

  doc.setDrawColor(255, 255, 255)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(left, top - 13, 50, 50, 7, 7, 'FD')
  if (logoImage?.dataUrl) {
    doc.addImage(logoImage.dataUrl, 'PNG', left + 5, top - 8, 40, 40)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text(REPORT_COMPANY_NAME, left + 62, top + 2)
  doc.setFontSize(8.5)
  doc.setTextColor(220, 236, 221)
  doc.text(REPORT_COMPANY_SUFFIX, left + 62, top + 16)
  doc.setFontSize(7.5)
  doc.setTextColor(203, 226, 205)
  doc.text('OFFICIAL GREEN & WHITE REPORT', left + 62, top + 30)

  doc.setFontSize(15)
  doc.setTextColor(255, 255, 255)
  doc.text(title, pageWidth - left, top + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(220, 236, 221)
  doc.text(subtitle || `Generated: ${new Date().toLocaleString()}`, pageWidth - left, top + 18, { align: 'right' })

  const metaTop = headerHeight + 14
  const metaHeight = 28
  const metaGap = 8
  const metaWidth = (pageWidth - (left * 2) - (metaGap * 2)) / 3
  const meta = [
    ['Generated', new Date().toLocaleString()],
    ['Filters', filters.filter(Boolean).join(' | ') || 'None'],
    ['Format', 'Qudarti official report'],
  ]

  meta.forEach(([label, value], index) => {
    const x = left + ((metaWidth + metaGap) * index)
    doc.setFillColor(248, 251, 248)
    doc.setDrawColor(207, 224, 208)
    doc.roundedRect(x, metaTop, metaWidth, metaHeight, 4, 4, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.8)
    doc.setTextColor(99, 116, 99)
    doc.text(label.toUpperCase(), x + 7, metaTop + 10)
    doc.setFontSize(8)
    doc.setTextColor(30, 45, 32)
    const lines = doc.splitTextToSize(String(value), metaWidth - 14)
    doc.text(lines.slice(0, 2), x + 7, metaTop + 21)
  })

  return metaTop + metaHeight + 16
}
