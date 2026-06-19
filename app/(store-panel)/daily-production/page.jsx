'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { dailyProductionApi } from '@/infrastructure/api/endpoints'
import {
  Factory, Plus, RotateCcw, Eye, Trash2, Search, X,
  CheckSquare, Square, FileSpreadsheet, Download, FileText,
  ChevronDown, ChevronUp, Calendar
} from 'lucide-react'
import { ReportModal } from '@/components/store/shared/StoreShared'
import { StoreThemeDatePicker, StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'

const INITIAL_RECORDS = [
  { id: 1, product: 'Seal Packing Line A', startTime: '08:00', endTime: '14:00', noOfLabour: 12, date: '27/05/2025', note: 'Morning shift, full capacity run.' },
  { id: 2, product: 'Bottle Filling Unit', startTime: '09:00', endTime: '13:30', noOfLabour: 8,  date: '27/05/2025', note: '' },
  { id: 3, product: 'Sticker Application', startTime: '10:00', endTime: '16:00', noOfLabour: 5,  date: '27/05/2025', note: 'Machine maintenance at 12:00 - 30 min stop.' },
  { id: 4, product: 'Seal Packing Line B', startTime: '07:30', endTime: '15:30', noOfLabour: 10, date: '03/06/2025', note: '' },
  { id: 5, product: 'Carton Assembly',     startTime: '08:00', endTime: '12:00', noOfLabour: 6,  date: '03/06/2025', note: 'Short run - material shortage.' },
  { id: 6, product: 'Bottle Filling Unit', startTime: '13:00', endTime: '18:00', noOfLabour: 9,  date: '08/04/2026', note: '' },
]

const DAILY_TABLE_COLS = ['56px', '320px', '130px', '130px', '140px', '130px', '130px']

function parseDMY(str) {
  if (!str) return null
  const [d, m, y] = str.split('/')
  if (!d || !m || !y) return null
  const date = new Date(`${y}-${m}-${d}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function calcHours(start, end) {
  if (!start || !end) return '-'
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return '-'
  const h = Math.floor(mins / 60), m2 = mins % 60
  return m2 > 0 ? `${h}h ${m2}m` : `${h}h`
}

export default function DailyProductionPage() {
  const router = useRouter()

  const [records, setRecords] = useState([])
  const [search, setSearch]   = useState('')
  const [filterProduct, setFilterProduct] = useState('All Products')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [selected, setSelected] = useState([])
  const [viewRecord, setViewRecord] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [collapsedDates, setCollapsedDates] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const toDMY = (isoDate) => {
    if (!isoDate) return ''
    const [y, m, d] = String(isoDate).slice(0, 10).split('-')
    if (!y || !m || !d) return String(isoDate)
    return `${d}/${m}/${y}`
  }

  const normalizeEntry = (parent, entry, idx) => ({
    id: `DP-${parent.id}-${idx}`,
    parentId: parent.id,
    product: String(entry?.product || '').trim(),
    startTime: String(entry?.startTime || entry?.start_time || '').trim(),
    endTime: String(entry?.endTime || entry?.end_time || '').trim(),
    noOfLabour: Number(entry?.noOfLabour || entry?.no_of_labour) || 0,
    date: toDMY(parent.date),
    note: String(entry?.note || parent.note || '').trim(),
  })

  const loadFromApi = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await dailyProductionApi.list()
      const list = Array.isArray(res) ? res : (res?.results || [])
      const flattened = list.flatMap((row) => {
        const entries = Array.isArray(row?.entries) ? row.entries : []
        if (entries.length === 0) return [normalizeEntry(row, {}, 0)]
        return entries.map((entry, idx) => normalizeEntry(row, entry, idx))
      })
      setRecords(flattened)
    } catch (err) {
      setLoadError(err?.message || 'Unable to load daily production records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFromApi() }, [])

  const productOptions = useMemo(() => {
    const products = records.map((record) => record.product).filter(Boolean)
    return Array.from(new Set(products)).sort((a, b) => a.localeCompare(b))
  }, [records])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r => {
      const text = [r.product, r.startTime, r.endTime, r.noOfLabour, r.date, r.note]
        .join(' ').toLowerCase()
      const matchesSearch = !q.trim() || text.includes(q)
      const matchesProduct = filterProduct === 'All Products' || r.product === filterProduct
      const rowDate = parseDMY(r.date)
      const fromDate = filterDateFrom ? new Date(`${filterDateFrom}T00:00:00`) : null
      const toDate = filterDateTo ? new Date(`${filterDateTo}T23:59:59`) : null
      const matchesFrom = !fromDate || (rowDate && rowDate >= fromDate)
      const matchesTo = !toDate || (rowDate && rowDate <= toDate)
      return matchesSearch && matchesProduct && matchesFrom && matchesTo
    })
  }, [records, search, filterProduct, filterDateFrom, filterDateTo])

  const resetFilters = () => {
    setSearch('')
    setFilterProduct('All Products')
    setFilterDateFrom('')
    setFilterDateTo('')
    setSelected([])
  }

  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      if (!map[r.date]) map[r.date] = []
      map[r.date].push(r)
    })
    // Sort dates descending
    return Object.entries(map).sort((a, b) => (parseDMY(b[0]) || 0) - (parseDMY(a[0]) || 0))
  }, [filtered])
  const toggleSelect  = (id)  => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleAll     = ()    => setSelected(s => s.length === filtered.length ? [] : filtered.map(r => r.id))
  const toggleDate    = (date) => setCollapsedDates(p => ({ ...p, [date]: !p[date] }))
  const handleDelete = async (id) => {
    const target = records.find((row) => row.id === id)
    if (!target) return
    if (!window.confirm('Delete this production record (all entries under this date record)?')) return
    try {
      await dailyProductionApi.delete(target.parentId)
      setRecords((prev) => prev.filter((row) => row.parentId !== target.parentId))
      setSelected((prev) => prev.filter((selId) => {
        const selRow = records.find((r) => r.id === selId)
        return selRow?.parentId !== target.parentId
      }))
    } catch (err) {
      setLoadError(err?.message || 'Unable to delete daily production record')
    }
  }
  const handleBulkDelete = async () => {
    if (!selected.length) return
    if (!window.confirm(`Delete ${selected.length} selected entries (by parent records)?`)) return
    const parentIds = Array.from(new Set(
      selected
        .map((selId) => records.find((row) => row.id === selId)?.parentId)
        .filter(Boolean)
    ))
    try {
      for (const parentId of parentIds) {
        // eslint-disable-next-line no-await-in-loop
        await dailyProductionApi.delete(parentId)
      }
      setRecords((prev) => prev.filter((row) => !parentIds.includes(row.parentId)))
      setSelected([])
    } catch (err) {
      setLoadError(err?.message || 'Unable to delete selected daily production records')
    }
  }
  const exportRows = selected.length > 0 ? records.filter(r => selected.includes(r.id)) : filtered

  const exportCSV = (rows) => {
    const headers = ['Product', 'Start Time', 'End Time', 'Hours', 'No of Labour', 'Date', 'Note']
    const lines = rows.map(r => [r.product, r.startTime, r.endTime, calcHours(r.startTime, r.endTime), r.noOfLabour, r.date, r.note].map(v => `"${v}"`).join(','))
    const csv = [headers.join(','), ...lines].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'daily-production.csv'; a.click()
  }

  const reportRows = useMemo(() => exportRows.map((r) => ({
    ...r,
    hours: calcHours(r.startTime, r.endTime),
    note: r.note || '-',
  })), [exportRows])

  return (
    <DashboardLayout>
      <div style={s.wrapper}>

        {/* Page Header */}
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.pageTitle}>Daily Production</h1>
            <p style={s.pageSubtitle}>View and manage production entries.</p>
          </div>
          <div style={s.headerActions}>
            <button style={s.iconBtn} title="Reset" onClick={resetFilters}><RotateCcw size={16} /></button>
            <button style={s.reportBtn} onClick={() => setShowReport(true)}><FileText size={14} /> View Report</button>
            <button style={s.addBtn} onClick={() => router.push('/daily-production/new')}><Plus size={16} /> Add New Entry</button>
          </div>
        </div>

        {loading ? (
          <div style={{ ...s.reportPanel, marginBottom: 14 }}>
            <div style={s.reportRow}><span style={s.reportLabel}>Loading daily production...</span></div>
          </div>
        ) : null}
        {loadError ? (
          <div style={{ ...s.reportPanel, borderColor: '#fecaca', background: '#fef2f2', marginBottom: 14 }}>
            <div style={s.reportRow}><span style={{ ...s.reportLabel, color: '#991b1b' }}>{loadError}</span></div>
          </div>
        ) : null}

        {/* Search */}
        <div style={s.controlsCard}>
          <div style={s.filtersRow}>
            <StoreThemeDropdown
              value={filterProduct}
              onChange={setFilterProduct}
              placeholder="All Products"
              variant="pill"
              options={[
                { value: 'All Products', label: 'All Products' },
                ...productOptions.map((product) => ({ value: product, label: product })),
              ]}
            />
            <StoreThemeDatePicker value={filterDateFrom} onChange={setFilterDateFrom} placeholder="From Date" variant="pill" />
            <StoreThemeDatePicker value={filterDateTo} onChange={setFilterDateTo} placeholder="To Date" variant="pill" alignRight />
          </div>
          <div style={s.searchWrap}>
            <Search size={15} color="#7a8a7a" />
            <input style={s.searchInput} placeholder="Search by product..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button style={s.clearBtn} onClick={() => setSearch('')}><X size={14} /></button>}
          </div>
        </div>

        {/* Table */}
        <div style={s.tableWrap}>

          {/* Global table header */}
          <table style={s.table}>
            <colgroup>
              {DAILY_TABLE_COLS.map((width, idx) => (
                <col key={`head-col-${idx}`} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr style={s.thead}>
                <th style={{ ...s.th, width: 40 }}>
                  <button style={s.checkBtn} onClick={toggleAll}>
                    {selected.length === filtered.length && filtered.length > 0
                      ? <CheckSquare size={15} color="#54B45B" />
                      : <Square size={15} color="#9ca3af" />}
                  </button>
                </th>
                <th style={s.th}>Product</th>
                <th style={s.th}>Start Time</th>
                <th style={s.th}>End Time</th>
                <th style={s.th}>Total Hours</th>
                <th style={s.th}>No of Labour</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
          </table>

          {/* Date-grouped sections */}
          {grouped.length === 0 ? (
            <div style={s.emptyState}>
              <Factory size={32} color="#d1d5db" />
              <p style={{ margin: '8px 0 0', color: '#9ca3af', fontSize: 14 }}>No records found</p>
            </div>
          ) : grouped.map(([date, dateRecords]) => {
            const isCollapsed = collapsedDates[date]
            const totalLabour = dateRecords.reduce((sum, r) => sum + Number(r.noOfLabour), 0)
            const dateSelected = dateRecords.filter(r => selected.includes(r.id)).length

            return (
              <div key={date} style={s.dateGroup}>
                {/* Date Section Header */}
                <button style={s.dateSectionBtn} onClick={() => toggleDate(date)}>
                  <div style={s.dateSectionLeft}>
                    <Calendar size={14} color="#2d7a33" />
                    <span style={s.dateSectionLabel}>{date}</span>
                    <span style={s.dateSectionCount}>{dateRecords.length} {dateRecords.length === 1 ? 'entry' : 'entries'}</span>
                    <span style={s.dateSectionLabour}>- {totalLabour} total labour</span>
                  </div>
                  <div style={s.dateSectionRight}>
                    {dateSelected > 0 && <span style={s.dateSelBadge}>{dateSelected} selected</span>}
                    {isCollapsed ? <ChevronDown size={15} color="#9ca3af" /> : <ChevronUp size={15} color="#9ca3af" />}
                  </div>
                </button>

                {/* Rows */}
                {!isCollapsed && (
                  <table style={{ ...s.table, borderTop: 'none' }}>
                    <colgroup>
                      {DAILY_TABLE_COLS.map((width, idx) => (
                        <col key={`${date}-col-${idx}`} style={{ width }} />
                      ))}
                    </colgroup>
                    <tbody>
                      {dateRecords.map(r => (
                        <tr key={r.id}
                          style={{ ...s.tr, backgroundColor: selected.includes(r.id) ? '#e8f0e8' : '#fff' }}
                        >
                          <td style={{ ...s.td, width: 40 }}>
                            <button style={s.checkBtn} onClick={() => toggleSelect(r.id)}>
                              {selected.includes(r.id) ? <CheckSquare size={15} color="#54B45B" /> : <Square size={15} color="#9ca3af" />}
                            </button>
                          </td>
                          <td style={{ ...s.td, fontWeight: 600, color: '#1a2e1b' }}>{r.product}</td>
                          <td style={s.td}><span style={s.timeBadge}>{r.startTime || '-'}</span></td>
                          <td style={s.td}><span style={s.timeBadge}>{r.endTime || '-'}</span></td>
                          <td style={s.td}><span style={s.hoursBadge}>{calcHours(r.startTime, r.endTime)}</span></td>
                          <td style={s.td}>{r.noOfLabour}</td>
                          <td style={{ ...s.td, textAlign: 'right' }}>
                            <div style={s.actionBtns}>
                              <button style={s.viewBtn} title="View" onClick={() => setViewRecord(r)}><Eye size={14} /></button>
                              <button style={s.delBtn} title="Delete" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
          <div style={s.tableFooter}>
            <span style={s.footerText}>
              {filtered.length} entries across {grouped.length} dates
              {selected.length > 0 && <span style={s.selCount}> - {selected.length} selected</span>}
            </span>
          </div>
        </div>
      </div>

      {showReport ? (
        <ReportModal
          title="Daily Production"
          data={reportRows}
          columns={[
            { key: 'product', label: 'Product' },
            { key: 'startTime', label: 'Start' },
            { key: 'endTime', label: 'End' },
            { key: 'hours', label: 'Hours' },
            { key: 'noOfLabour', label: 'Labour' },
            { key: 'date', label: 'Date' },
            { key: 'note', label: 'Note' },
          ]}
          onClose={() => setShowReport(false)}
        />
      ) : null}
      {viewRecord && <ViewModal record={viewRecord} onClose={() => setViewRecord(null)} />}
    </DashboardLayout>
  )
}

function ViewModal({ record, onClose }) {
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div>
            <h2 style={s.modalTitle}>{record.product}</h2>
            <p style={s.modalSub}>{record.date}</p>
          </div>
          <button style={s.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={s.modalBody}>
          <div style={s.detailGrid}>
            {[['Start Time', record.startTime || '-'], ['End Time', record.endTime || '-'], ['Total Hours', calcHours(record.startTime, record.endTime)], ['No of Labour', record.noOfLabour], ['Date', record.date]].map(([l, v]) => (
              <div key={l}><p style={s.detailLabel}>{l}</p><p style={s.detailValue}>{v}</p></div>
            ))}
          </div>
          {record.note && (
            <div style={s.noteBox}>
              <p style={s.noteLabel}>Note</p>
              <p style={s.noteText}>{record.note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
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
  deleteSelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#fff',
    border: '1px solid #fecaca',
    borderRadius: 40,
    padding: '8px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#ef4444',
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
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#ffffff',
    border: '1px solid #d4dfd4',
    borderRadius: 40,
    padding: '10px 14px',
  },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: 13.5, color: '#1f2f21', background: 'transparent' },
  clearBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#7a8a7a', display: 'flex', padding: 0 },
  tableWrap: {
    background: '#f2f4f2',
    borderRadius: RADIUS,
    border: '1px solid #e2e8e2',
    overflowX: 'auto',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  table: { width: '100%', minWidth: 1036, borderCollapse: 'collapse', tableLayout: 'fixed' },
  thead: { background: '#e8eee8' },
  th: { padding: '12px 14px', fontSize: 12, fontWeight: 700, color: '#29472d', textAlign: 'left', borderBottom: '1px solid #d4dfd4', whiteSpace: 'nowrap', letterSpacing: '0.1px' },
  tr: { transition: 'background 0.15s' },
  td: { padding: '11px 14px', fontSize: 13, color: '#415443', borderBottom: '1px solid #e2e8e2', background: '#ffffff' },
  timeBadge: { background: '#eef2ee', borderRadius: 40, border: '1px solid #d4dfd4', padding: '2px 9px', fontSize: 12.5, fontWeight: 600, color: '#374151', fontFamily: 'monospace' },
  hoursBadge: { background: '#e8f0e8', border: '1px solid #d4dfd4', borderRadius: 40, padding: '2px 9px', fontSize: 12.5, fontWeight: 700, color: '#2d7a33' },
  actionBtns: { display: 'flex', gap: 6, justifyContent: 'flex-end' },
  viewBtn: { background: '#e8f0e8', border: '1px solid #d4dfd4', color: '#2d7a33', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' },
  delBtn: { background: '#fff5f5', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' },
  checkBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 },
  dateGroup: { borderBottom: '1px solid #d4dfd4' },
  dateSectionBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#e8eee8', border: 'none', cursor: 'pointer', borderBottom: '1px solid #d4dfd4' },
  dateSectionLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  dateSectionLabel: { fontSize: 13.5, fontWeight: 700, color: '#1f2f21' },
  dateSectionCount: { fontSize: 11.5, color: '#2d7a33', background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 40, padding: '2px 8px', fontWeight: 700 },
  dateSectionLabour: { fontSize: 12, color: '#607062' },
  dateSectionRight: { display: 'flex', alignItems: 'center', gap: 8 },
  dateSelBadge: { fontSize: 11.5, color: '#2d7a33', background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 40, padding: '2px 8px', fontWeight: 700 },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 0' },
  tableFooter: { padding: '11px 16px', borderTop: '1px solid #d4dfd4', background: '#e8eee8' },
  footerText: { fontSize: 12.5, color: '#607062', fontWeight: 500 },
  selCount: { color: '#1f7a2b', fontWeight: 700 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(8, 18, 10, 0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#f2f4f2', borderRadius: RADIUS, width: '100%', maxWidth: 500, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8e2', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' },
  modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #d4dfd4' },
  modalTitle: { fontSize: 18, fontWeight: 800, color: '#1a3d1f', margin: 0 },
  modalSub: { fontSize: 12.5, color: '#7a8a7a', margin: '4px 0 0' },
  modalClose: { background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 10, padding: 6, cursor: 'pointer', color: '#607062', display: 'flex' },
  modalBody: { padding: '20px 24px', overflowY: 'auto', flex: 1 },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', marginBottom: 16 },
  detailLabel: { fontSize: 11, fontWeight: 700, color: '#7a8a7a', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 4px' },
  detailValue: { fontSize: 14, color: '#1f2f21', fontWeight: 600, margin: 0, padding: '7px 10px', background: '#ffffff', borderRadius: 9, border: '1px solid #d4dfd4' },
  noteBox: { background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 10, padding: '12px 16px' },
  noteLabel: { fontSize: 11, fontWeight: 700, color: '#7a8a7a', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 6px' },
  noteText: { fontSize: 13.5, color: '#374151', margin: 0, lineHeight: 1.6 },
}



