'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { gateOutwardApi } from '@/infrastructure/api/endpoints'
import {
  RotateCcw,
  Eye,
  Plus,
  Search,
  Square,
  CheckSquare,
  FileSpreadsheet,
  Download,
  FileText,
} from 'lucide-react'

function toDMY(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = String(isoDate).slice(0, 10).split('-')
  if (!y || !m || !d) return String(isoDate)
  return `${d}/${m}/${y}`
}

function normalizeItem(raw = {}) {
  return {
    productName: String(raw.productName || raw.product_name || '').trim(),
    brand: String(raw.brand || '').trim(),
    quantity: Number(raw.quantity) || 0,
    unit: String(raw.unit || 'Unit').trim() || 'Unit',
    source: String(raw.source || '').trim(),
  }
}

function normalizeGateOutwardRecord(raw = {}) {
  const items = Array.isArray(raw.items) ? raw.items.map(normalizeItem).filter((x) => x.productName || x.quantity) : []
  const fallback = normalizeItem({
    productName: raw.product_name,
    quantity: raw.quantity,
    unit: raw.unit,
  })

  return {
    id: raw.id,
    goNo: raw.go_no || `GO-${raw.id}`,
    date: toDMY(raw.dispatch_date),
    vehicleNo: raw.vehicle_no || '',
    driverName: raw.driver_name || '',
    customerName: raw.customer_name || '',
    address: raw.address || '',
    note: raw.note || '',
    numbering: raw.numbering || '',
    batchNumber: raw.batch_number || '',
    items: items.length ? items : [fallback],
  }
}

export default function GateOutwardPage() {
  const router = useRouter()
  const [records, setRecords] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [showReportPanel, setShowReportPanel] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const res = await gateOutwardApi.list()
        const list = Array.isArray(res) ? res : (res?.results || [])
        const normalized = list.map(normalizeGateOutwardRecord).filter((row) => row.id != null)
        if (active) setRecords(normalized)
      } catch (err) {
        if (active) setLoadError(err?.message || 'Unable to load gate outward records')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return records
    const q = search.toLowerCase()
    return records.filter((r) => {
      const text = [
        r.goNo,
        r.date,
        r.vehicleNo,
        r.driverName,
        r.customerName,
        r.address,
        r.note,
        r.numbering,
        r.batchNumber,
        ...r.items.flatMap((it) => [it.productName, it.brand, String(it.quantity), it.unit, it.source]),
      ]
        .join(' ')
        .toLowerCase()
      return text.includes(q)
    })
  }, [records, search])

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    setSelected((prev) => (prev.length === filtered.length ? [] : filtered.map((r) => r.id)))
  }

  const resetFilters = () => {
    setSearch('')
    setSelected([])
  }

  const exportRows = selected.length > 0 ? records.filter((r) => selected.includes(r.id)) : filtered

  const exportCSV = (rows) => {
    const headers = ['GO No', 'Date', 'Product', 'Brand', 'Qty', 'Vehicle', 'Driver', 'Customer', 'Address', 'Source', 'Numbering', 'Batch Number', 'Note']
    const lines = rows.flatMap((r) =>
      r.items.map((item) =>
        [
          r.goNo,
          r.date,
          item.productName,
          item.brand,
          `${item.quantity} ${item.unit}`,
          r.vehicleNo,
          r.driverName,
          r.customerName,
          r.address,
          item.source,
          r.numbering || '-',
          r.batchNumber || '-',
          r.note || '-',
        ]
          .map((v) => `"${v}"`)
          .join(',')
      )
    )

    const csv = [headers.join(','), ...lines].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'gate-outward-report.csv'
    a.click()
  }

  const exportPDF = (rows) => {
    const win = window.open('', '_blank')
    win.document.write(`
      <html>
        <head>
          <title>Gate Outward Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            h2 { color: #2d7a33; margin: 0 0 4px; }
            p { margin: 0 0 10px; color: #6b7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f0fdf4; color: #1a2e1b; padding: 8px; text-align: left; border-bottom: 2px solid #bbf7d0; }
            td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <h2>Gate Outward Report</h2>
          <p>Generated: ${new Date().toLocaleDateString('en-PK')}</p>
          <table>
            <tr>
              <th>GO No</th><th>Date</th><th>Product</th><th>Brand</th><th>Qty</th><th>Vehicle</th><th>Driver</th><th>Customer</th><th>Address</th>
            </tr>
            ${rows
              .flatMap((r) =>
                r.items.map(
                  (item) => `<tr>
                    <td>${r.goNo}</td>
                    <td>${r.date}</td>
                    <td>${item.productName}</td>
                    <td>${item.brand}</td>
                    <td>${item.quantity} ${item.unit}</td>
                    <td>${r.vehicleNo || '-'}</td>
                    <td>${r.driverName || '-'}</td>
                    <td>${r.customerName || '-'}</td>
                    <td>${r.address || '-'}</td>
                  </tr>`
                )
              )
              .join('')}
          </table>
        </body>
      </html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <DashboardLayout>
      <div style={s.wrapper}>
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.pageTitle}>Gate Outwards</h1>
            <p style={s.pageSubtitle}>View and manage outward material movements.</p>
          </div>
          <div style={s.headerActions}>
            <button style={s.iconBtn} title="Reset filters" onClick={resetFilters}><RotateCcw size={16} /></button>
            <button style={s.reportBtn} onClick={() => setShowReportPanel((v) => !v)}><Eye size={15} /> View Report</button>
            <button style={s.addBtn} onClick={() => router.push('/gate-outward/new')}><Plus size={16} /> Add New Entry</button>
          </div>
        </div>

        {showReportPanel && (
          <div style={s.reportPanel}>
            <div style={s.reportRow}>
              <span style={s.reportLabel}><FileText size={14} color="#2d7a33" />Export {selected.length > 0 ? `${selected.length} selected` : `all ${filtered.length} filtered`} records:</span>
              <div style={s.reportBtns}>
                <button style={s.csvBtn} onClick={() => exportCSV(exportRows)}><FileSpreadsheet size={14} /> Export CSV</button>
                <button style={s.pdfBtn} onClick={() => exportPDF(exportRows)}><Download size={14} /> Export PDF</button>
              </div>
            </div>
          </div>
        )}

        <div style={s.controlsCard}>
          <div style={s.searchWrap}>
            <Search size={15} color="#7a8a7a" />
            <input
              style={s.searchInput}
              placeholder="Search by product, vehicle, driver, or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loadError ? <div style={{ ...s.reportPanel, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{loadError}</div> : null}

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={{ ...s.th, width: 40 }}>
                  <button style={s.checkBtn} onClick={toggleAll}>
                    {selected.length === filtered.length && filtered.length > 0
                      ? <CheckSquare size={15} color="#54B45B" />
                      : <Square size={15} color="#9ca3af" />}
                  </button>
                </th>
                <th style={s.th}>Go No</th>
                <th style={s.th}>Date</th>
                <th style={s.th}>Product</th>
                <th style={s.th}>Brand</th>
                <th style={s.th}>Qty</th>
                <th style={s.th}>Vehicle</th>
                <th style={s.th}>Driver</th>
                <th style={s.th}>Customer</th>
                <th style={s.th}>Address</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} style={s.emptyCell}>{loading ? 'Loading...' : 'No gate outward records found.'}</td></tr>
              ) : (
                filtered.map((record) =>
                  record.items.map((item, idx) => (
                    <tr
                      key={`${record.id}-${idx}`}
                      style={{ ...s.tr, backgroundColor: selected.includes(record.id) ? '#e8f0e8' : '#fff' }}
                      onMouseEnter={(e) => { if (!selected.includes(record.id)) e.currentTarget.style.backgroundColor = '#f7faf7' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selected.includes(record.id) ? '#e8f0e8' : '#fff' }}
                    >
                      {idx === 0 && (
                        <td style={s.td} rowSpan={record.items.length}>
                          <button style={s.checkBtn} onClick={() => toggleSelect(record.id)}>
                            {selected.includes(record.id)
                              ? <CheckSquare size={15} color="#54B45B" />
                              : <Square size={15} color="#9ca3af" />}
                          </button>
                        </td>
                      )}
                      {idx === 0 && <td style={{ ...s.td, fontWeight: 600, color: '#1a2e1b' }} rowSpan={record.items.length}>{record.goNo}</td>}
                      {idx === 0 && <td style={s.td} rowSpan={record.items.length}>{record.date}</td>}

                      <td style={s.td}>{item.productName}</td>
                      <td style={s.td}>{item.brand}</td>
                      <td style={s.td}>{item.quantity} {item.unit}</td>

                      {idx === 0 && <td style={s.td} rowSpan={record.items.length}>{record.vehicleNo || '-'}</td>}
                      {idx === 0 && <td style={s.td} rowSpan={record.items.length}>{record.driverName || '-'}</td>}
                      {idx === 0 && <td style={s.td} rowSpan={record.items.length}>{record.customerName || '-'}</td>}
                      {idx === 0 && <td style={s.td} rowSpan={record.items.length}>{record.address || '-'}</td>}
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
          <div style={s.tableFooter}>
            <span style={s.footerText}>Showing {filtered.length} of {records.length} records{selected.length > 0 && <span style={s.selCount}> · {selected.length} selected</span>}</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

const RADIUS = 20

const s = {
  wrapper: { width: '100%' },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
    flexWrap: 'wrap',
  },
  pageTitle: { fontSize: 30, fontWeight: 800, color: '#1a3d1f', letterSpacing: '-0.6px', margin: '0 0 4px', display: 'flex', alignItems: 'center' },
  pageSubtitle: { fontSize: 13.5, color: '#7a8a7a', margin: 0 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },

  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: '40px',
    border: '1.5px solid #d4dfd4',
    backgroundColor: '#ffffff',
    color: '#2d7a33',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '11px 18px',
    borderRadius: '40px',
    border: '1.5px solid #d4dfd4',
    backgroundColor: '#ffffff',
    color: '#2d7a33',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '11px 20px',
    borderRadius: '40px',
    border: 'none',
    background: 'linear-gradient(90deg, #1B5E20 0%, #2E7D32 45%, #4CAF50 100%)',
    color: '#fff',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
  },

  reportPanel: {
    background: '#f2f4f2',
    border: '1px solid #e2e8e2',
    borderRadius: RADIUS,
    padding: '14px 18px',
    marginBottom: 14,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  reportRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  reportLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1a3d1f' },
  reportBtns: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  csvBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#fff',
    border: '1px solid #d4dfd4',
    borderRadius: 40,
    padding: '8px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#2d7a33',
    cursor: 'pointer',
  },
  pdfBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#2d7a33',
    border: 'none',
    borderRadius: 40,
    padding: '8px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#fff',
    cursor: 'pointer',
  },

  controlsCard: {
    backgroundColor: '#f2f4f2',
    borderRadius: RADIUS,
    padding: '14px 16px',
    border: '1px solid #e2e8e2',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    marginBottom: 14,
  },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #d4dfd4', borderRadius: 40, padding: '10px 14px' },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: 13.5, color: '#1f2f21', background: 'transparent' },

  tableWrap: {
    background: '#f2f4f2',
    borderRadius: RADIUS,
    border: '1px solid #e2e8e2',
    overflowX: 'auto',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  table: { width: '100%', minWidth: 1060, borderCollapse: 'collapse' },
  thead: { background: '#e8eee8' },
  th: { padding: '12px 14px', fontSize: 12, fontWeight: 700, color: '#29472d', textAlign: 'left', borderBottom: '1px solid #d4dfd4', whiteSpace: 'nowrap', letterSpacing: '0.1px' },
  tr: { transition: 'background 0.15s' },
  td: { padding: '11px 14px', fontSize: 13, color: '#415443', borderBottom: '1px solid #e2e8e2', background: '#ffffff' },
  checkBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 },
  emptyCell: { textAlign: 'center', padding: '56px 0', background: '#ffffff', fontSize: 14, color: '#9ca3af' },
  tableFooter: { padding: '11px 16px', borderTop: '1px solid #d4dfd4', background: '#e8eee8' },
  footerText: { fontSize: 12.5, color: '#607062', fontWeight: 500 },
  selCount: { color: '#1f7a2b', fontWeight: 700 },
}





