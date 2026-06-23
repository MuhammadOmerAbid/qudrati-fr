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
  FileText,
} from 'lucide-react'
import { ReportModal } from '@/components/store/shared/StoreShared'
import { StoreThemeDatePicker, StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'

function toDMY(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = String(isoDate).slice(0, 10).split('-')
  if (!y || !m || !d) return String(isoDate)
  return `${d}/${m}/${y}`
}

function parseDMYDate(value) {
  const [d, m, y] = String(value || '').split('/')
  if (!d || !m || !y) return null
  const date = new Date(`${y}-${m}-${d}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeItem(raw = {}) {
  return {
    productName: String(raw.productName || raw.product_name || '').trim(),
    brand: String(raw.brand || '').trim(),
    numbering: String(raw.numbering || '').trim(),
    batchNumber: String(raw.batchNumber || raw.batch_number || '').trim(),
    packaging: String(raw.packaging || raw.packing || '').trim(),
    quantity: Number(raw.quantity) || 0,
    unit: String(raw.unit || 'Unit').trim() || 'Unit',
    source: String(raw.source || '').trim(),
  }
}

function normalizeGateOutwardRecord(raw = {}) {
  const items = Array.isArray(raw.items) ? raw.items.map((item) => {
    const normalized = normalizeItem(item)
    return {
      ...normalized,
      numbering: normalized.numbering || raw.numbering || '',
      batchNumber: normalized.batchNumber || raw.batch_number || '',
    }
  }).filter((x) => x.productName || x.quantity) : []
  const fallback = normalizeItem({
    productName: raw.product_name,
    numbering: raw.numbering,
    batchNumber: raw.batch_number,
    quantity: raw.quantity,
    unit: raw.unit,
    source: raw.source,
  })

  return {
    id: raw.id,
    goNo: raw.go_no || `GO-${raw.id}`,
    date: toDMY(raw.dispatch_date),
    vehicleNo: raw.vehicle_no || '',
    driverName: raw.driver_name || '',
    driverPhone: raw.driver_phone || raw.driverPhone || '',
    driverCnic: raw.driver_cnic || raw.driverCnic || '',
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
  const [filterSource, setFilterSource] = useState('All Sources')
  const [filterCustomer, setFilterCustomer] = useState('All Customers')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [selected, setSelected] = useState([])
  const [noteModal, setNoteModal] = useState(null)
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

  const sourceOptions = useMemo(() => {
    const sources = [
      'Inventory',
      'Finished Goods',
      ...records.flatMap((record) => record.items.map((item) => item.source)).filter(Boolean),
    ]
    return Array.from(new Set(sources)).sort((a, b) => a.localeCompare(b))
  }, [records])

  const customerOptions = useMemo(() => {
    const customers = records.map((record) => record.customerName).filter(Boolean)
    return Array.from(new Set(customers)).sort((a, b) => a.localeCompare(b))
  }, [records])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter((r) => {
      const text = [
        r.goNo,
        r.date,
        r.vehicleNo,
        r.driverName,
        r.driverPhone,
        r.driverCnic,
        r.customerName,
        r.address,
        r.note,
        r.numbering,
        r.batchNumber,
        ...r.items.flatMap((it) => [it.productName, it.brand, it.numbering, it.batchNumber, it.packaging, String(it.quantity), it.unit, it.source]),
      ]
        .join(' ')
        .toLowerCase()
      const matchesSearch = !q.trim() || text.includes(q)
      const matchesSource = filterSource === 'All Sources' || r.items.some((item) => item.source === filterSource)
      const matchesCustomer = filterCustomer === 'All Customers' || r.customerName === filterCustomer
      const rowDate = parseDMYDate(r.date)
      const fromDate = filterDateFrom ? new Date(`${filterDateFrom}T00:00:00`) : null
      const toDate = filterDateTo ? new Date(`${filterDateTo}T23:59:59`) : null
      const matchesFrom = !fromDate || (rowDate && rowDate >= fromDate)
      const matchesTo = !toDate || (rowDate && rowDate <= toDate)
      return matchesSearch && matchesSource && matchesCustomer && matchesFrom && matchesTo
    })
  }, [records, search, filterSource, filterCustomer, filterDateFrom, filterDateTo])

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    setSelected((prev) => (prev.length === filtered.length ? [] : filtered.map((r) => r.id)))
  }

  const resetFilters = () => {
    setSearch('')
    setFilterSource('All Sources')
    setFilterCustomer('All Customers')
    setFilterDateFrom('')
    setFilterDateTo('')
    setSelected([])
  }

  const exportCSV = (rows) => {
    const headers = ['GO No', 'Date', 'Product', 'Numbering', 'Batch Number', 'Packaging', 'Brand', 'Qty', 'Vehicle', 'Driver', 'Driver Phone', 'Driver CNIC', 'Customer', 'Address', 'Source', 'Note']
    const lines = rows.flatMap((r) =>
      r.items.map((item) =>
        [
          r.goNo,
          r.date,
          item.productName,
          item.numbering || '-',
          item.batchNumber || '-',
          item.packaging || '-',
          item.brand,
          `${item.quantity} ${item.unit}`,
          r.vehicleNo,
          r.driverName,
          r.driverPhone,
          r.driverCnic,
          r.customerName,
          r.address,
          item.source,
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

  const reportRecords = selected.length > 0 ? records.filter((r) => selected.includes(r.id)) : filtered
  const reportRows = useMemo(
    () => reportRecords.flatMap((r) =>
      r.items.reduce((rows, item) => {
        const previousEnd = rows.reduce((max, row) => Math.max(max, Number(row._numberEnd) || 0), 0)
        const cartons = Math.max(0, Math.floor(Number(item.quantity) || 0))
        const numberStart = cartons > 0 ? previousEnd + 1 : previousEnd
        const numberEnd = cartons > 0 ? previousEnd + cartons : previousEnd

        rows.push({
          _groupId: r.id,
          _numberEnd: numberEnd,
          goNo: r.goNo,
          date: r.date,
          product: item.productName,
          numbering: cartons > 0 ? `${numberStart}--${numberEnd}` : '-',
          batchNumber: item.batchNumber || '-',
          packaging: item.packaging || '-',
          brand: item.brand,
          quantity: `${item.quantity} ${item.unit}`,
          vehicle: r.vehicleNo || '-',
          driver: r.driverName || '-',
          driverPhone: r.driverPhone || '-',
          driverCnic: r.driverCnic || '-',
          customer: r.customerName || '-',
          address: r.address || '-',
          source: item.source || '-',
          note: r.note || '-',
        })
        return rows
      }, [])
    ),
    [reportRecords]
  )

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
            <button style={s.reportBtn} onClick={() => setShowReportPanel(true)}><FileText size={14} /> View Report</button>
            <button style={s.addBtn} onClick={() => router.push('/gate-outward/new')}><Plus size={16} /> Add New Entry</button>
          </div>
        </div>

        <div style={s.controlsCard}>
          <div style={s.filtersRow}>
            <StoreThemeDropdown
              value={filterSource}
              onChange={setFilterSource}
              placeholder="All Sources"
              variant="pill"
              options={[
                { value: 'All Sources', label: 'All Sources' },
                ...sourceOptions.map((source) => ({ value: source, label: source })),
              ]}
            />
            <StoreThemeDropdown
              value={filterCustomer}
              onChange={setFilterCustomer}
              placeholder="All Customers"
              variant="pill"
              options={[
                { value: 'All Customers', label: 'All Customers' },
                ...customerOptions.map((customer) => ({ value: customer, label: customer })),
              ]}
            />
            <StoreThemeDatePicker
              value={filterDateFrom}
              onChange={setFilterDateFrom}
              placeholder="From Date"
              variant="pill"
            />
            <StoreThemeDatePicker
              value={filterDateTo}
              onChange={setFilterDateTo}
              placeholder="To Date"
              variant="pill"
              alignRight
            />
          </div>
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
                  <input
                    type="checkbox"
                    style={s.checkbox}
                    checked={selected.length === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th style={s.th}>Go No</th>
                <th style={s.th}>Date</th>
                <th style={s.th}>Product</th>
                <th style={s.th}>Numbering</th>
                <th style={s.th}>Batch No</th>
                <th style={s.th}>Packaging</th>
                <th style={s.th}>Brand</th>
                <th style={s.th}>Qty</th>
                <th style={s.th}>Source</th>
                <th style={s.th}>Vehicle</th>
                <th style={s.th}>Driver</th>
                <th style={s.th}>Driver Phone</th>
                <th style={s.th}>Driver CNIC</th>
                <th style={s.th}>Customer</th>
                <th style={s.th}>Address</th>
                <th style={s.th}>Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={17} style={s.emptyCell}>{loading ? 'Loading...' : 'No gate outward records found.'}</td></tr>
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
                          <input
                            type="checkbox"
                            style={s.checkbox}
                            checked={selected.includes(record.id)}
                            onChange={() => toggleSelect(record.id)}
                          />
                        </td>
                      )}
                      {idx === 0 && <td style={{ ...s.td, fontWeight: 600, color: '#1a2e1b' }} rowSpan={record.items.length}>{record.goNo}</td>}
                      {idx === 0 && <td style={s.td} rowSpan={record.items.length}>{record.date}</td>}

                      <td style={s.td}>{item.productName}</td>
                      <td style={s.td}>{item.numbering || '-'}</td>
                      <td style={s.td}>{item.batchNumber || '-'}</td>
                      <td style={s.td}>{item.packaging || '-'}</td>
                      <td style={s.td}>{item.brand}</td>
                      <td style={s.td}>{item.quantity} {item.unit}</td>
                      <td style={s.td}>{item.source || '-'}</td>

                      {idx === 0 && <td style={s.td} rowSpan={record.items.length}>{record.vehicleNo || '-'}</td>}
                      {idx === 0 && <td style={s.td} rowSpan={record.items.length}>{record.driverName || '-'}</td>}
                      {idx === 0 && <td style={s.td} rowSpan={record.items.length}>{record.driverPhone || '-'}</td>}
                      {idx === 0 && <td style={s.td} rowSpan={record.items.length}>{record.driverCnic || '-'}</td>}
                      {idx === 0 && <td style={s.td} rowSpan={record.items.length}>{record.customerName || '-'}</td>}
                      {idx === 0 && <td style={s.td} rowSpan={record.items.length}>{record.address || '-'}</td>}
                      {idx === 0 && (
                        <td style={s.td} rowSpan={record.items.length}>
                          {record.note ? (
                            <button
                              type="button"
                              style={s.noteBtn}
                              onClick={() => setNoteModal({ title: record.goNo, note: record.note })}
                            >
                              <Eye size={13} /> View
                            </button>
                          ) : '-'}
                        </td>
                      )}
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

        {showReportPanel ? (
          <ReportModal
            title="Gate Outward"
            data={reportRows}
            columns={[
              { key: 'goNo', label: 'GO No', rowSpan: true, width: '4%' },
              { key: 'date', label: 'Date', rowSpan: true, width: '5%' },
              { key: 'srNo', label: 'Sr No', width: '5%' },
              { key: 'product', label: 'Product', width: '20%' },
              { key: 'packaging', label: 'Packaging', width: '14%' },
              { key: 'quantity', label: 'Qty', width: '10%' },
              { key: 'numbering', label: 'Numbering', width: '16%' },
              { key: 'batchNumber', label: 'Batch No', width: '15%' },
              { key: 'brand', label: 'Brand', width: '20%' },
              { key: 'vehicle', label: 'Vehicle', rowSpan: true, width: '5%' },
              { key: 'driver', label: 'Driver', rowSpan: true, width: '6%' },
              { key: 'driverPhone', label: 'Driver Phone', rowSpan: true, width: '7%' },
              { key: 'driverCnic', label: 'Driver CNIC', rowSpan: true, width: '7%' },
              { key: 'customer', label: 'Customer', rowSpan: true, width: '8%' },
              { key: 'address', label: 'Address', rowSpan: true, width: '8%' },
              { key: 'source', label: 'Source', rowSpan: true, width: '4%' },
              { key: 'note', label: 'Note', rowSpan: true, width: '4%' },
            ]}
            pdfTableStyle="gate-outward-grouped"
            onClose={() => setShowReportPanel(false)}
          />
        ) : null}

        {noteModal ? (
          <div style={s.modalOverlay} onClick={() => setNoteModal(null)}>
            <div style={s.noteModal} onClick={(e) => e.stopPropagation()}>
              <div style={s.noteModalHeader}>
                <div>
                  <h3 style={s.noteModalTitle}>Note</h3>
                  <p style={s.noteModalSub}>{noteModal.title}</p>
                </div>
                <button type="button" style={s.modalCloseBtn} onClick={() => setNoteModal(null)}>×</button>
              </div>
              <p style={s.noteModalText}>{noteModal.note}</p>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}

const RADIUS = 20
const TABLE_MIN_WIDTH = 1480

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
  filtersRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 12,
    marginBottom: 14,
  },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #d4dfd4', borderRadius: 40, padding: '10px 14px' },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: 13.5, color: '#1f2f21', background: 'transparent' },

  tableWrap: {
    background: '#e8eee8',
    borderRadius: RADIUS,
    border: '1px solid #e2e8e2',
    overflowX: 'auto',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  table: { width: '100%', minWidth: TABLE_MIN_WIDTH, borderCollapse: 'collapse', background: '#ffffff' },
  thead: { background: '#e8eee8' },
  th: { padding: '12px 14px', fontSize: 12, fontWeight: 700, color: '#29472d', textAlign: 'left', borderBottom: '1px solid #d4dfd4', whiteSpace: 'nowrap', letterSpacing: '0.1px' },
  tr: { transition: 'background 0.15s' },
  td: { padding: '11px 14px', fontSize: 13, color: '#415443', borderBottom: '1px solid #e2e8e2', background: '#ffffff' },
  noteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    border: '1px solid #d4dfd4',
    borderRadius: 999,
    background: '#ffffff',
    color: '#2d7a33',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8, 18, 10, 0.38)',
    zIndex: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  noteModal: {
    width: 'min(440px, 100%)',
    background: '#f8fbf8',
    border: '1px solid #cfe0d0',
    borderRadius: 16,
    boxShadow: '0 24px 70px rgba(0,0,0,0.22)',
    overflow: 'hidden',
  },
  noteModalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    padding: '16px 18px',
    borderBottom: '1px solid #d4dfd4',
    background: '#e8f3e9',
  },
  noteModalTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: '#123416' },
  noteModalSub: { margin: '4px 0 0', fontSize: 12, color: '#607062', fontWeight: 700 },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: '1px solid #d4dfd4',
    background: '#ffffff',
    color: '#2d7a33',
    fontSize: 20,
    lineHeight: '26px',
    cursor: 'pointer',
  },
  noteModalText: {
    margin: 0,
    padding: '18px',
    color: '#273529',
    fontSize: 14,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  checkbox: {
    width: 13,
    height: 13,
    cursor: 'pointer',
    accentColor: '#2d7a33',
  },
  emptyCell: { textAlign: 'center', padding: '56px 0', background: '#ffffff', fontSize: 14, color: '#9ca3af' },
  tableFooter: {
    minWidth: TABLE_MIN_WIDTH,
    boxSizing: 'border-box',
    padding: '11px 16px',
    borderTop: '1px solid #d4dfd4',
    background: '#e8eee8',
  },
  footerText: { fontSize: 12.5, color: '#607062', fontWeight: 500 },
  selCount: { color: '#1f7a2b', fontWeight: 700 },
}





