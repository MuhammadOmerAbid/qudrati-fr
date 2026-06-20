export const REPORT_LOGO_SRC = '/qudarti-packaging-logo.png'
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

export function getUserDisplayName(user) {
  if (!user || typeof user !== 'object') return 'Unknown user'
  return String(
    user.full_name
    || user.fullName
    || user.name
    || user.username
    || user.email
    || 'Unknown user'
  ).trim() || 'Unknown user'
}

export function buildReportHtml({
  title,
  subtitle = '',
  filters = [],
  columns = [],
  rows = [],
  generatedAt = new Date(),
  generatedBy = 'Unknown user',
}) {
  const safeTitle = escapeHtml(title)
  const safeSubtitle = escapeHtml(subtitle)
  const generatedText = generatedAt.toLocaleString()
  const isWideReport = columns.length > 8
  const widthForColumn = (col) => {
    if (col.width) return col.width
    const key = String(col.key || '').toLowerCase()
    const label = String(col.label || '').toLowerCase()
    if (key.includes('product') || key.includes('goods') || key.includes('item')) return '18%'
    if (key.includes('customer') || key.includes('supplier') || key.includes('receiver')) return '14%'
    if (key.includes('driver') || key.includes('address')) return '12%'
    if (key.includes('date')) return '8%'
    if (key.includes('qty') || key.includes('quantity') || key.includes('net') || key.includes('issued')) return '8%'
    if (key.includes('no') || label.includes('no')) return '7%'
    return ''
  }
  const colGroup = columns.map((col) => {
    const width = widthForColumn(col)
    return `<col${width ? ` style="width:${escapeHtml(width)}"` : ''} />`
  }).join('')
  const tableHead = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('')
  const groupSizes = rows.reduce((acc, row) => {
    if (row?._groupId == null) return acc
    const key = String(row._groupId)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const groupSeen = new Set()
  const tableBody = rows.length
    ? rows.map((row) => {
        const groupKey = row?._groupId == null ? '' : String(row._groupId)
        const firstInGroup = groupKey ? !groupSeen.has(groupKey) : true
        if (groupKey && firstInGroup) groupSeen.add(groupKey)
        const rowClasses = [
          groupKey && firstInGroup ? 'group-start' : '',
          groupKey && !firstInGroup ? 'group-cont' : '',
        ].filter(Boolean).join(' ')
        const cells = columns.map((col) => {
          if (col.rowSpan && groupKey && !firstInGroup) return ''
          const raw = typeof col.render === 'function' ? col.render(row) : row[col.key]
          const rowSpan = col.rowSpan && groupKey && groupSizes[groupKey] > 1 ? ` rowspan="${groupSizes[groupKey]}" class="entry-cell"` : ''
          return `<td${rowSpan}>${escapeHtml(formatReportValue(raw))}</td>`
        }).join('')
        return `<tr${rowClasses ? ` class="${rowClasses}"` : ''}>${cells}</tr>`
      }).join('')
    : `<tr><td colspan="${columns.length}" class="empty">No records found</td></tr>`

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      * { box-sizing: border-box; }
      html, body, .page, .header, .meta-box, th, td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { margin: 0; background: #eef4ef; color: #17231a; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
      .page { width: min(${isWideReport ? '1360px' : '1160px'}, calc(100% - 32px)); margin: 18px auto; background: #fff; border: 1px solid ${REPORT_BORDER}; box-shadow: 0 18px 46px rgba(18, 52, 22, .10); }
      .header { display: flex; align-items: stretch; justify-content: space-between; gap: 18px; background: linear-gradient(115deg, #0f2f14 0%, ${REPORT_GREEN_DARK} 42%, ${REPORT_GREEN} 72%, #287a31 100%); color: #fff; padding: 20px 24px; }
      .brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
      .logo-frame { width: 116px; height: 74px; display: flex; align-items: center; justify-content: center; padding: 0; flex: 0 0 auto; }
      .logo { display: block; width: 100%; height: 100%; object-fit: contain; }
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
      .table-shell { border: 1px solid ${REPORT_BORDER}; overflow: hidden; background: #fff; }
      table { width: 100%; border-collapse: collapse; table-layout: ${isWideReport ? 'fixed' : 'auto'}; }
      th { background: linear-gradient(180deg, #23772e 0%, ${REPORT_GREEN} 100%); color: #fff; text-align: left; font-size: 10.5px; border-right: 1px solid rgba(255,255,255,.22); padding: 9px 8px; text-transform: uppercase; letter-spacing: .45px; }
      td { border-top: 1px solid #111; border-right: 1px solid #111; padding: 8px 8px; vertical-align: top; color: #273529; line-height: 1.35; background: #fff; }
      .entry-cell { vertical-align: middle; font-weight: 700; color: #123416; background: #fff; }
      .group-start td { border-top: 1px solid #111; }
      .group-start .entry-cell { border-left: 1px solid #111; background: #fff; }
      .group-cont td { border-top: 1px solid #111; }
      tr:hover td { background: ${REPORT_GREEN_SOFT}; }
      .empty { text-align: center; color: #64748b; padding: 22px; }
      .footer { margin-top: 16px; padding-top: 10px; border-top: 2px solid ${REPORT_GREEN_SOFT}; color: #647464; font-size: 11px; display: flex; justify-content: space-between; gap: 12px; }
      .seal { font-weight: 800; color: ${REPORT_GREEN}; }
      @media print {
        ${isWideReport ? '@page { size: A4 landscape; margin: 8mm; }' : '@page { size: A4 portrait; margin: 8mm; }'}
        body { background: #fff; }
        .page { width: 100%; margin: 0; border: none; box-shadow: none; }
        .content { padding: 5mm; }
        .header { padding: 5mm; background: linear-gradient(115deg, #0f2f14 0%, ${REPORT_GREEN_DARK} 48%, ${REPORT_GREEN} 100%) !important; }
        .company, .suffix, .eyebrow, h1, .subtitle { color: #fff !important; }
        .logo-frame { background: transparent !important; }
        .meta { grid-template-columns: 1fr .55fr 1.25fr; gap: 6px; margin-bottom: 9px; }
        .meta-box { background: #f8fbf8 !important; border-left-color: ${REPORT_GREEN_MID} !important; min-height: 42px; padding: 7px 9px; }
        .meta-label { font-size: 8.5px; }
        .meta-value { font-size: 10px; }
        th { background: ${REPORT_GREEN} !important; color: #fff !important; font-size: ${isWideReport ? '8.2px' : '9.2px'}; padding: ${isWideReport ? '5px 5px' : '7px 6px'}; letter-spacing: .2px; }
        td { background: #fff !important; border-color: #111 !important; font-size: ${isWideReport ? '8.4px' : '9.5px'}; padding: ${isWideReport ? '5px 5px' : '6px 6px'}; line-height: 1.18; overflow-wrap: anywhere; word-break: normal; }
        .entry-cell { background: #fff !important; border-left-color: #111 !important; }
        .group-start td { border-top-color: #111 !important; }
        .footer { margin-top: 10px; }
        tr:hover td { background: inherit; }
        .no-print { display: none; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="header">
        <div class="brand">
          <div class="logo-frame"><img class="logo" src="${REPORT_LOGO_SRC}?v=2" alt="${escapeHtml(REPORT_COMPANY_NAME)}" /></div>
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
          <div class="meta-box"><span class="meta-label">Generated By</span><span class="meta-value">${escapeHtml(generatedBy)}</span></div>
        </section>
        <div class="table-shell">
          <table>
            <colgroup>${colGroup}</colgroup>
            <thead><tr>${tableHead}</tr></thead>
            <tbody>${tableBody}</tbody>
          </table>
        </div>
        <section class="footer">
          <span class="seal">${escapeHtml(REPORT_COMPANY_NAME)}</span>
          <span>System generated report</span>
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
  if (typeof document === 'undefined') return false
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.srcdoc = buildReportHtml(config)
  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }, 1000)
  }
  iframe.onload = () => {
    iframe.contentWindow?.addEventListener('afterprint', cleanup, { once: true })
  }
  document.body.appendChild(iframe)
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

export function addPdfReportHeader(doc, { title, subtitle = '', generatedBy = 'Unknown user', recordCount = null, logoImage = null }) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const left = 40
  const top = 26
  const headerHeight = 72
  const brandTextLeft = left + 76

  const bands = [
    [0, 18, 52, 22],
    [0.34, 20, 70, 26],
    [0.58, 27, 94, 32],
    [0.78, 35, 122, 49],
  ]
  bands.forEach(([start, r, g, b], index) => {
    const x = pageWidth * start
    const nextStart = bands[index + 1]?.[0] ?? 1
    doc.setFillColor(r, g, b)
    doc.rect(x, 0, pageWidth * (nextStart - start), headerHeight, 'F')
  })

  if (logoImage?.dataUrl) {
    const maxLogoWidth = 66
    const maxLogoHeight = 46
    const ratio = logoImage.width && logoImage.height ? logoImage.width / logoImage.height : 1
    let logoWidth = maxLogoWidth
    let logoHeight = logoWidth / ratio
    if (logoHeight > maxLogoHeight) {
      logoHeight = maxLogoHeight
      logoWidth = logoHeight * ratio
    }
    doc.addImage(logoImage.dataUrl, 'PNG', left, top - 12, logoWidth, logoHeight)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text(REPORT_COMPANY_NAME, brandTextLeft, top + 2)
  doc.setFontSize(8.5)
  doc.setTextColor(220, 236, 221)
  doc.text(REPORT_COMPANY_SUFFIX, brandTextLeft, top + 16)

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
    ['Records', recordCount ?? String(subtitle).match(/Records:\s*([^|]+)/i)?.[1]?.trim() ?? '-'],
    ['Generated By', generatedBy],
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
