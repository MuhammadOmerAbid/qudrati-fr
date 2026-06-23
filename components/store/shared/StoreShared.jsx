'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, FileText, Pencil, Trash2, RefreshCw, Download, X, History, Printer } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { StoreThemeDatePicker, StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'
import { addPdfReportHeader, formatReportValue, getUserDisplayName, loadImageDataUrl, openReportWindow } from '@/lib/reportDesign'
import { useAuthStore } from '@/application/state/auth/useAuthStore'

export const BRANDS = ['Soghaat', 'Raja', 'Handi', 'Qudarti', 'General']

export const CATEGORIES = {
  Soghaat: ['Bottle', 'Sticker'],
  Raja: ['Seal', 'Bottle'],
  Handi: ['Seal', 'Jar'],
  Qudarti: ['Seal', 'Label'],
  General: ['Seal', 'Bottle', 'Sticker'],
}

export const PRODUCTS = {
  Seal: ['69 mm Seal', '72 MM Seal', '85 MM Seal'],
  Bottle: ['500ml Bottle', '1L Bottle', '2L Bottle'],
  Sticker: ['Front Sticker', 'Back Sticker', 'Side Sticker'],
  Jar: ['250g Jar', '500g Jar', '1kg Jar'],
  Label: ['Price Label', 'Barcode Label'],
}

export const PACKINGS = ['Box', 'Bag', 'Carton', 'Wrap', 'Bundle']

export const INVENTORY_INITIAL = [
  { id: 1, brand: 'General', category: 'Seal', product: '69 mm Seal', subcategory: '69mm', quantity: 23997, unit: 'Unit', comment: '' },
  { id: 2, brand: 'General', category: 'Seal', product: '72 MM Seal', subcategory: '72mm', quantity: 8033, unit: 'Unit', comment: '' },
  { id: 3, brand: 'Soghaat', category: 'Bottle', product: '500ml Bottle', subcategory: '', quantity: 1500, unit: 'Unit', comment: '' },
  { id: 4, brand: 'Raja', category: 'Seal', product: '69 mm Seal', subcategory: '69mm', quantity: 4200, unit: 'Unit', comment: '' },
  { id: 5, brand: 'Handi', category: 'Jar', product: '250g Jar', subcategory: '', quantity: 700, unit: 'Unit', comment: '' },
]

export const MONTHLY_HISTORY = [
  { month: 'March 2026', category: 'Seal', product: '69 mm Seal', outgoing: 4500, unit: 'Unit' },
  { month: 'March 2026', category: 'Seal', product: '72 MM Seal', outgoing: 1200, unit: 'Unit' },
  { month: 'March 2026', category: 'Bottle', product: '500ml Bottle', outgoing: 320, unit: 'Unit' },
  { month: 'February 2026', category: 'Seal', product: '69 mm Seal', outgoing: 3800, unit: 'Unit' },
  { month: 'February 2026', category: 'Jar', product: '250g Jar', outgoing: 150, unit: 'Unit' },
]

export const PRODUCTION_INITIAL = [
  {
    id: 1,
    serialNo: 1,
    name: 'Morning Shift Batch',
    date: '2026-03-22',
    items: [
      { sr: 1, goods: '69 mm Seal', packing: 'Carton', qty: 54, status: 'Pending' },
      { sr: 2, goods: '72 MM Seal', packing: 'Box', qty: 10, status: 'Completed' },
      { sr: 3, goods: '500ml Bottle', packing: 'Bag', qty: 12, status: 'In Progress' },
    ],
  },
  {
    id: 2,
    serialNo: 2,
    name: 'Sticker Line',
    date: '2026-03-27',
    items: [
      { sr: 1, goods: 'Front Sticker', packing: 'Bundle', qty: 5, status: 'Pending' },
      { sr: 2, goods: '1L Bottle', packing: 'Carton', qty: 6, status: 'Pending' },
    ],
  },
]

export const FINISHED_INITIAL = [
  {
    id: 1,
    brand: 'Soghaat',
    date: '2026-03-22',
    products: [
      { product: '500ml Bottle', packing: 'Carton', cartons: 6, comment: '' },
      { product: '1L Bottle', packing: 'Box', cartons: 6, comment: '' },
    ],
  },
  {
    id: 2,
    brand: 'Raja',
    date: '2026-03-27',
    products: [
      { product: '69 mm Seal', packing: 'Carton', cartons: 100, comment: '' },
      { product: '72 MM Seal', packing: 'Bag', cartons: 56, comment: '' },
    ],
  },
  {
    id: 3,
    brand: 'Handi',
    date: '2026-04-01',
    products: [
      { product: '250g Jar', packing: 'Box', cartons: 1800, comment: '' },
      { product: '500g Jar', packing: 'Carton', cartons: 1230, comment: '' },
    ],
  },
]

export const STATUS_COLORS = {
  Pending: { background: '#fefce8', color: '#a16207', borderColor: '#fef3c7' },
  Completed: { background: '#e8f0e8', color: '#1f7a2b', borderColor: '#d4dfd4' },
  'In Progress': { background: '#eef2ee', color: '#2d7a33', borderColor: '#d4dfd4' },
}

export function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function getWordCount(text = '') {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function nextSerial(orders) {
  const max = orders.reduce((current, order) => Math.max(current, order.serialNo ?? 0), 0)
  return max + 1
}

export function exportCsv(filename, columns, rows) {
  const header = columns.map((col) => col.label).join(',')
  const body = rows
    .map((row) => columns.map((col) => `"${String(row[col.key] ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function Checkbox({ checked, onChange, disabled = false }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      style={ui.checkbox}
    />
  )
}

export function AppButton({ children, type = 'ghost', onClick, style, title, disabled = false }) {
  const base = type === 'primary' ? ui.btnPrimary : type === 'danger' ? ui.btnDanger : ui.btnGhost
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled} style={{ ...base, ...style }}>
      {children}
    </button>
  )
}

export function TableShell({ columns, children, emptyText, emptyColSpan }) {
  return (
    <div style={ui.card}>
      <div style={ui.tableScroll}>
        <table style={ui.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ ...ui.th, ...(col.align === 'right' ? { textAlign: 'right' } : {}) }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {children}
            {emptyColSpan ? (
              <tr>
                <td colSpan={emptyColSpan} style={ui.emptyCell}>
                  {emptyText}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function CommentEditorModal({ value, title = 'Edit Comment', onCancel, onSave, subtitle = 'Maximum 500 words' }) {
  const [comment, setComment] = useState(value || '')

  return (
    <div style={ui.overlay}>
      <div style={{ ...ui.modal, maxWidth: 520 }}>
        <div style={ui.modalHeaderTop}>
          <div>
            <h3 style={ui.modalTitle}>{title}</h3>
            <p style={ui.modalSub}>{subtitle}</p>
          </div>
          <AppButton onClick={onCancel} style={ui.iconBtnOnly}>
            <X size={16} />
          </AppButton>
        </div>
        <textarea
          style={ui.textarea}
          rows={7}
          value={comment}
          onChange={(e) => {
            const next = e.target.value
            if (getWordCount(next) <= 500) setComment(next)
          }}
        />
        <p style={ui.charCounter}>{getWordCount(comment)} / 500 words</p>
        <div style={ui.modalActionsEnd}>
          <AppButton onClick={onCancel}>Cancel</AppButton>
          <AppButton type="primary" onClick={() => onSave(comment)}>Save</AppButton>
        </div>
      </div>
    </div>
  )
}

export function ReportModal({ title, data, columns, dateKey, selectFilters = [], pdfTableStyle = 'default', onClose }) {
  const { user } = useAuthStore()
  const generatedBy = getUserDisplayName(user)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedFilters, setSelectedFilters] = useState(() =>
    Object.fromEntries(selectFilters.map((filter) => [filter.key, filter.initialValue ?? filter.allValue ?? '']))
  )

  useEffect(() => {
    setSelectedFilters((prev) => {
      const next = { ...prev }
      let changed = false
      selectFilters.forEach((filter) => {
        const current = next[filter.key]
        const values = (filter.options || []).map((option) => (
          typeof option === 'object' && option !== null ? option.value : option
        ))
        if (current === undefined) {
          next[filter.key] = filter.initialValue ?? filter.allValue ?? ''
          changed = true
        } else if (!values.some((value) => String(value ?? '') === String(current ?? ''))) {
          next[filter.key] = filter.allValue ?? ''
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [selectFilters])

  const rows = useMemo(() => {
    let filtered = [...data]

    selectFilters.forEach((filter) => {
      const selected = selectedFilters[filter.key]
      const allValue = filter.allValue ?? ''
      if (selected !== undefined && String(selected) !== String(allValue)) {
        filtered = filtered.filter((row) => String(row[filter.key] ?? '') === String(selected))
      }
    })

    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter((row) => JSON.stringify(row).toLowerCase().includes(q))
    }

    if (dateKey && fromDate) {
      filtered = filtered.filter((row) => {
        const d = new Date(row[dateKey])
        return !Number.isNaN(d.getTime()) && d >= new Date(fromDate)
      })
    }

    if (dateKey && toDate) {
      filtered = filtered.filter((row) => {
        const d = new Date(row[dateKey])
        if (Number.isNaN(d.getTime())) return false
        const limit = new Date(toDate)
        limit.setHours(23, 59, 59, 999)
        return d <= limit
      })
    }

    return filtered
  }, [data, dateKey, fromDate, search, selectFilters, selectedFilters, toDate])

  const groupState = useMemo(() => {
    const sizes = {}
    const firstIndexes = {}
    rows.forEach((row, index) => {
      if (row?._groupId == null) return
      const key = String(row._groupId)
      sizes[key] = (sizes[key] || 0) + 1
      if (firstIndexes[key] == null) firstIndexes[key] = index
    })
    return { sizes, firstIndexes }
  }, [rows])

  const isFirstGroupRow = (row, rowIndex) => {
    if (row?._groupId == null) return true
    return groupState.firstIndexes[String(row._groupId)] === rowIndex
  }

  const selectedFilterLabels = useMemo(() => selectFilters
    .map((filter) => {
      const selected = selectedFilters[filter.key]
      const allValue = filter.allValue ?? ''
      if (selected === undefined || String(selected) === String(allValue)) return ''
      const option = (filter.options || []).find((entry) => {
        const value = typeof entry === 'object' && entry !== null ? entry.value : entry
        return String(value ?? '') === String(selected ?? '')
      })
      const label = typeof option === 'object' && option !== null ? option.label : option
      return `${filter.label}: ${label || selected}`
    })
    .filter(Boolean), [selectFilters, selectedFilters])

  const printReportPdf = () => {
    const appliedFilters = [
      ...selectedFilterLabels,
      search.trim() ? `Keyword: ${search.trim()}` : '',
      fromDate ? `From: ${formatDate(fromDate)}` : '',
      toDate ? `To: ${formatDate(toDate)}` : '',
    ].filter(Boolean)

    openReportWindow({
      title: `${title} Report`,
      subtitle: 'Store module report',
      filters: appliedFilters,
      columns,
      rows,
      generatedBy,
      tableStyle: pdfTableStyle,
    })
  }

  const downloadReportPdf = async () => {
    const orientation = columns.length > 7 ? 'landscape' : 'portrait'
    const patientPdfTable = pdfTableStyle === 'patient-records'
    const groupedGateOutwardTable = pdfTableStyle === 'gate-outward-grouped'
    const doc = new jsPDF({
      orientation,
      unit: 'pt',
      format: 'a4',
    })

    const filters = [
      ...selectedFilterLabels,
      search.trim() ? `Keyword: ${search.trim()}` : '',
      fromDate ? `From: ${formatDate(fromDate)}` : '',
      toDate ? `To: ${formatDate(toDate)}` : '',
    ].filter(Boolean)

    const logoImage = await loadImageDataUrl()
    const startY = addPdfReportHeader(doc, {
      title: `${title} Report`,
      subtitle: `Generated: ${new Date().toLocaleString()} | Records: ${rows.length}`,
      generatedBy,
      recordCount: rows.length,
      logoImage,
    })

    if (groupedGateOutwardTable) {
      const groups = []
      const seen = new Map()
      rows.forEach((row, index) => {
        const key = row?._groupId == null ? `row-${index}` : String(row._groupId)
        if (!seen.has(key)) {
          const group = { key, rows: [] }
          seen.set(key, group)
          groups.push(group)
        }
        seen.get(key).rows.push(row)
      })

      const goKeys = ['goNo', 'date', 'vehicle', 'driver', 'driverPhone', 'driverCnic', 'customer', 'address', 'source', 'note']
      const goColumns = goKeys
        .map((key) => columns.find((col) => col.key === key))
        .filter(Boolean)
      const itemColumns = columns.filter((col) => !goKeys.includes(col.key))
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = { left: 28, right: 28 }
      let cursorY = startY

      groups.forEach((group) => {
        const first = group.rows[0] || {}
        if (cursorY > pageHeight - 120) {
          doc.addPage()
          cursorY = 32
        }

        const metaRows = [
          goColumns.slice(0, 5),
          goColumns.slice(5, 10),
        ].filter((line) => line.length)

        autoTable(doc, {
          startY: cursorY,
          body: metaRows.map((line) =>
            line.map((col) => {
              const raw = col.key === dateKey ? formatDate(first[col.key]) : first[col.key]
              return {
                content: `${col.label.toUpperCase()}\n${formatReportValue(raw)}`,
                styles: { fontStyle: 'bold' },
              }
            })
          ),
          theme: 'grid',
          margin,
          tableWidth: 'auto',
          styles: {
            font: 'helvetica',
            fontSize: 7.4,
            cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
            textColor: [20, 36, 52],
            lineColor: [205, 214, 222],
            lineWidth: 0.45,
            fillColor: [239, 246, 252],
            minCellHeight: 20,
            valign: 'middle',
            overflow: 'linebreak',
          },
          alternateRowStyles: { fillColor: [239, 246, 252] },
          didParseCell: (data) => {
            if (data.section !== 'body') return
            const parts = String(data.cell.raw?.content || data.cell.raw || '').split('\n')
            data.cell.text = parts
          },
        })

        cursorY = doc.lastAutoTable.finalY

        autoTable(doc, {
          startY: cursorY,
          head: [itemColumns.map((col) => col.label)],
          body: group.rows.map((row) =>
            itemColumns.map((col) => formatReportValue(col.key === dateKey ? formatDate(row[col.key]) : row[col.key]))
          ),
          theme: 'grid',
          margin,
          tableWidth: 'auto',
          styles: {
            font: 'helvetica',
            fontSize: 7.2,
            cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
            textColor: [34, 34, 34],
            lineColor: [205, 214, 222],
            lineWidth: 0.45,
            fillColor: [255, 255, 255],
            minCellHeight: 16,
            overflow: 'linebreak',
          },
          headStyles: {
            fillColor: [248, 250, 252],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            lineColor: [205, 214, 222],
            lineWidth: 0.45,
          },
          alternateRowStyles: { fillColor: [252, 252, 252] },
        })

        cursorY = doc.lastAutoTable.finalY + 12
      })

      const safeName = `${title.toLowerCase().replace(/\s+/g, '-')}-report.pdf`
      doc.save(safeName)
      return
    }

    const head = [columns.map((col) => col.label)]
    const body = rows.length
      ? rows.map((row, rowIndex) => {
          const groupKey = row?._groupId == null ? '' : String(row._groupId)
          const firstInGroup = isFirstGroupRow(row, rowIndex)
          return columns.reduce((cells, col) => {
            if (col.rowSpan && groupKey && !firstInGroup) return cells
            const raw = row[col.key]
            const value = col.key === dateKey ? formatDate(raw) : raw
            const content = value || value === 0 ? String(value) : '-'
            if (col.rowSpan && groupKey && groupState.sizes[groupKey] > 1) {
              cells.push({
                content,
                rowSpan: groupState.sizes[groupKey],
                styles: {
                  valign: 'middle',
                  fontStyle: 'bold',
                  fillColor: patientPdfTable ? [255, 255, 255] : [242, 248, 243],
                  textColor: patientPdfTable ? [35, 35, 35] : [18, 52, 22],
                },
              })
              return cells
            }
            cells.push(content)
            return cells
          }, [])
        })
      : [['No records found', ...Array(Math.max(0, columns.length - 1)).fill('')]]

    const tableMargin = patientPdfTable ? { left: 24, right: 24 } : { left: 40, right: 40 }
    const usableTableWidth = doc.internal.pageSize.getWidth() - tableMargin.left - tableMargin.right
    const columnStyles = patientPdfTable
      ? columns.reduce((styles, col, index) => {
          const match = String(col.width || '').match(/^([\d.]+)%$/)
          if (match) {
            styles[index] = { cellWidth: usableTableWidth * (Number(match[1]) / 100) }
          }
          return styles
        }, {})
      : {}

    autoTable(doc, {
      startY,
      head,
      body,
      theme: 'grid',
      margin: tableMargin,
      styles: {
        font: 'helvetica',
        fontSize: patientPdfTable ? 6.8 : 8.5,
        cellPadding: patientPdfTable ? { top: 3.2, right: 3, bottom: 3.2, left: 3 } : 5,
        overflow: 'linebreak',
        textColor: patientPdfTable ? [38, 38, 38] : [31, 47, 33],
        lineColor: patientPdfTable ? [160, 160, 160] : [17, 17, 17],
        lineWidth: patientPdfTable ? 0.35 : 0.5,
        fillColor: [255, 255, 255],
        minCellHeight: patientPdfTable ? 14 : undefined,
        valign: patientPdfTable ? 'middle' : 'top',
      },
      headStyles: {
        fillColor: patientPdfTable ? [245, 247, 246] : [27, 94, 32],
        textColor: patientPdfTable ? [24, 24, 24] : [255, 255, 255],
        fontStyle: 'bold',
        lineColor: patientPdfTable ? [120, 120, 120] : [255, 255, 255],
        lineWidth: patientPdfTable ? 0.45 : undefined,
        fontSize: patientPdfTable ? 6.6 : undefined,
        cellPadding: patientPdfTable ? { top: 4, right: 3, bottom: 4, left: 3 } : undefined,
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        lineColor: patientPdfTable ? [160, 160, 160] : [17, 17, 17],
      },
      alternateRowStyles: { fillColor: patientPdfTable ? [250, 250, 250] : [255, 255, 255] },
      columnStyles,
      tableLineColor: patientPdfTable ? [120, 120, 120] : [17, 17, 17],
      tableLineWidth: patientPdfTable ? 0.45 : 0,
      showHead: 'everyPage',
    })

    const safeName = `${title.toLowerCase().replace(/\s+/g, '-')}-report.pdf`
    doc.save(safeName)
  }

  return (
    <div style={ui.overlay} onClick={onClose}>
      <div style={{ ...ui.modal, maxWidth: 980 }} onClick={(e) => e.stopPropagation()}>
        <div style={ui.modalHeaderTop}>
          <div>
            <h3 style={ui.modalTitle}>{title} Report</h3>
            <p style={ui.modalSub}>Filter records and export report files</p>
          </div>
          <AppButton onClick={onClose} style={ui.iconBtnOnly}>
            <X size={16} />
          </AppButton>
        </div>

        <div style={ui.reportToolbar}>
          {selectFilters.map((filter) => (
            <div key={filter.key} style={{ flex: '1 1 170px', minWidth: 0, maxWidth: 240 }}>
              <StoreThemeDropdown
                value={selectedFilters[filter.key] ?? filter.allValue ?? ''}
                onChange={(next) => setSelectedFilters((prev) => ({ ...prev, [filter.key]: next }))}
                compact
                variant="pill"
                placeholder={filter.placeholder || filter.label}
                options={filter.options || []}
              />
            </div>
          ))}

          <div style={ui.searchWrapSmall}>
            <Search size={14} color="#7a8a7a" />
            <input
              style={ui.searchInputBare}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in report"
            />
          </div>

          {dateKey ? (
            <>
              <div style={{ flex: '1 1 170px', minWidth: 0, maxWidth: 240 }}>
                <StoreThemeDatePicker
                  value={fromDate}
                  onChange={setFromDate}
                  placeholder="From date"
                  variant="pill"
                />
              </div>
              <div style={{ flex: '1 1 170px', minWidth: 0, maxWidth: 240 }}>
                <StoreThemeDatePicker
                  value={toDate}
                  onChange={setToDate}
                  placeholder="To date"
                  variant="pill"
                  alignRight
                />
              </div>
            </>
          ) : null}

          <AppButton
            onClick={() => exportCsv(`${title.toLowerCase().replace(/\s+/g, '-')}-report.csv`, columns, rows)}
          >
            <Download size={14} /> CSV
          </AppButton>
          <AppButton
            onClick={downloadReportPdf}
            style={{ borderColor: '#d4dfd4', color: '#2d7a33', background: '#ffffff' }}
          >
            <FileText size={14} /> Download PDF
          </AppButton>
          <AppButton
            style={{ borderColor: '#fecaca', color: '#b91c1c', background: '#fff1f2' }}
            onClick={printReportPdf}
          >
            <Printer size={14} /> Print
          </AppButton>
        </div>

        <div style={ui.reportTableWrap}>
          <table style={ui.table}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} style={ui.th}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={columns.length} style={ui.emptyCell}>No records found</td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => {
                  const groupKey = row?._groupId == null ? '' : String(row._groupId)
                  const firstInGroup = isFirstGroupRow(row, rowIndex)
                  return (
                  <tr key={`report-${rowIndex}`}>
                    {columns.map((col) => {
                      if (col.rowSpan && !isFirstGroupRow(row, rowIndex)) return null
                      const raw = row[col.key]
                      const value = col.key === dateKey ? formatDate(raw) : raw
                      const span = col.rowSpan && groupKey ? groupState.sizes[groupKey] : 1
                      const entryCell = col.rowSpan && groupKey
                      return (
                        <td
                          key={col.key}
                          style={{
                            ...ui.td,
                            ...(groupKey && firstInGroup ? ui.reportGroupStartTd : {}),
                            ...(entryCell ? ui.reportEntryCell : {}),
                          }}
                          rowSpan={span > 1 ? span : undefined}
                        >
                          {value || value === 0 ? value : '-'}
                        </td>
                      )
                    })}
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <p style={ui.metaText}>{rows.length} record(s)</p>
      </div>
    </div>
  )
}

export function SectionHeader({ title, subtitle, actions }) {
  return (
    <div style={ui.sectionHeader}>
      <div>
        <h2 style={ui.pageTitle}>{title}</h2>
        <p style={ui.pageSub}>{subtitle}</p>
      </div>
      <div style={ui.headerActions}>{actions}</div>
    </div>
  )
}


export const ui = {
  pageWrap: {
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 14,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  pageTitle: {
    margin: 0,
    fontSize: 'clamp(24px, 5vw, 30px)',
    lineHeight: 1.2,
    letterSpacing: '-0.6px',
    fontWeight: 800,
    color: '#1a3d1f',
  },
  pageSub: {
    margin: '6px 0 0 0',
    fontSize: 13.5,
    color: '#7a8a7a',
    fontWeight: 500,
  },
  headerActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  filtersRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 8,
  },
  card: {
    border: '1px solid #e2e8e2',
    borderRadius: 20,
    background: '#f2f4f2',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
  },
  tableScroll: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    background: '#e8eee8',
    borderBottom: '1px solid #d4dfd4',
    color: '#29472d',
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'left',
    padding: '12px 14px',
    whiteSpace: 'nowrap',
  },
  td: {
    borderBottom: '1px solid #e2e8e2',
    color: '#415443',
    fontSize: 13,
    padding: '11px 14px',
    verticalAlign: 'middle',
    background: '#ffffff',
  },
  reportGroupStartTd: {
    borderTop: '1.5px solid #2d7a33',
  },
  reportEntryCell: {
    borderLeft: '2px solid #2d7a33',
    background: '#f2f8f3',
    color: '#123416',
    fontWeight: 700,
  },
  emptyCell: {
    textAlign: 'center',
    color: '#7a8a7a',
    fontSize: 13,
    padding: '38px 14px',
  },
  dateRow: {
    background: '#e8eee8',
    color: '#2d7a33',
    fontWeight: 700,
    fontSize: 13,
    borderBottom: '1px solid #d4dfd4',
    padding: '10px 14px',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid #d4dfd4',
    borderRadius: 40,
    padding: '10px 12px',
    background: '#ffffff',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    width: '100%',
    fontSize: 13,
    color: '#1f2f21',
    background: 'transparent',
  },
  searchWrapSmall: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #d4dfd4',
    borderRadius: 40,
    padding: '8px 10px',
    minWidth: 0,
    width: 'min(100%, 320px)',
    flex: '1 1 220px',
    background: '#fff',
  },
  searchInputBare: {
    border: 'none',
    outline: 'none',
    fontSize: 13,
    width: '100%',
    color: '#1f2f21',
    background: 'transparent',
  },
  select: {
    border: '1px solid #d4dfd4',
    borderRadius: 40,
    padding: '9px 34px 9px 14px',
    fontSize: 12.5,
    color: '#1f2f21',
    outline: 'none',
    background: '#ffffff',
    minWidth: 130,
    appearance: 'none',
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364758b' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9L12 15L18 9'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
  },
  statusSelect: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 999,
    padding: '5px 24px 5px 9px',
    fontSize: 11,
    fontWeight: 700,
    outline: 'none',
    appearance: 'none',
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364758b' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9L12 15L18 9'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
  },
  checkbox: {
    width: 15,
    height: 15,
    cursor: 'pointer',
    accentColor: '#2d7a33',
  },
  btnGhost: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1.5px solid #d4dfd4',
    borderRadius: 40,
    background: '#ffffff',
    color: '#2d7a33',
    fontSize: 13,
    fontWeight: 600,
    padding: '10px 14px',
    cursor: 'pointer',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 40,
    background: '#1a3d1f',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    padding: '10px 16px',
    cursor: 'pointer',
  },
  btnDanger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid #fecaca',
    borderRadius: 40,
    background: '#fff1f2',
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: 600,
    padding: '10px 16px',
    cursor: 'pointer',
  },
  inlineActionsLeft: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  inlineActionsRight: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  iconButton: {
    border: '1px solid #d4dfd4',
    borderRadius: 8,
    background: '#fff',
    color: '#607062',
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  iconDangerButton: {
    border: '1px solid #fecaca',
    borderRadius: 8,
    background: '#fff1f2',
    color: '#b91c1c',
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  iconBtnOnly: {
    width: 30,
    height: 30,
    padding: 0,
    justifyContent: 'center',
  },
  brandPrimary: {
    color: '#2d7a33',
    fontWeight: 700,
    padding: '11px 14px',
    borderBottom: '1px solid #e2e8e2',
    fontSize: 13,
  },
  brandMuted: {
    color: '#b2c0b3',
    fontWeight: 400,
    padding: '11px 14px',
    borderBottom: '1px solid #e2e8e2',
    fontSize: 13,
  },
  smallMuted: {
    color: '#607062',
    fontSize: 12,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8, 18, 10, 0.42)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 780,
    maxHeight: '90vh',
    overflowY: 'auto',
    borderRadius: 20,
    background: '#f2f4f2',
    border: '1px solid #e2e8e2',
    boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
    padding: 16,
  },
  modalHeaderTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  modalTitle: {
    margin: 0,
    color: '#1a3d1f',
    fontSize: 18,
    fontWeight: 800,
  },
  modalSub: {
    margin: '4px 0 0 0',
    fontSize: 12,
    color: '#7a8a7a',
  },
  modalActionsEnd: {
    marginTop: 16,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalActionsCenter: {
    marginTop: 16,
    display: 'flex',
    justifyContent: 'center',
  },
  formRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  formCol: {
    flex: 1,
    minWidth: 'min(220px, 100%)',
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#607062',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    border: '1px solid #d4dfd4',
    borderRadius: 10,
    padding: '9px 11px',
    fontSize: 13,
    color: '#1f2f21',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
  },
  inputDate: {
    border: '1px solid #d4dfd4',
    borderRadius: 40,
    padding: '8px 10px',
    fontSize: 12.5,
    color: '#1f2f21',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    border: '1px solid #d4dfd4',
    borderRadius: 10,
    padding: '9px 11px',
    fontSize: 13,
    color: '#1f2f21',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: 74,
  },
  charCounter: {
    margin: '6px 0 0 0',
    fontSize: 11,
    color: '#7a8a7a',
    textAlign: 'right',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #d4dfd4',
    margin: '12px 0 14px 0',
  },
  itemRow: {
    border: '1px solid #d4dfd4',
    background: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  itemRowTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 12,
    color: '#607062',
    fontWeight: 700,
  },
  addLineButton: {
    justifyContent: 'center',
    width: '100%',
    borderStyle: 'dashed',
    color: '#2d7a33',
    borderColor: '#d4dfd4',
    background: '#ffffff',
  },
  saveBtn: {
    minWidth: 180,
    justifyContent: 'center',
  },
  reportToolbar: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 12,
    alignItems: 'center',
    width: '100%',
  },
  reportTableWrap: {
    border: '1px solid #e2e8e2',
    borderRadius: 20,
    overflow: 'auto',
  },
  metaText: {
    margin: '10px 0 0 0',
    fontSize: 12,
    color: '#607062',
  },
  monthGroup: {
    marginBottom: 16,
  },
  monthTitle: {
    margin: '0 0 8px 0',
    fontSize: 14,
    color: '#2d7a33',
    fontWeight: 700,
  },
}
