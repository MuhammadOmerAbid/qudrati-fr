'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { requisitionApi } from '@/infrastructure/api/endpoints'
import {
  ClipboardList, Plus, RotateCcw, Eye, Trash2,
  Search, X, ChevronDown, ChevronUp, CheckSquare,
  Square, CornerUpLeft, FileSpreadsheet, Download, FileText
} from 'lucide-react'
import { ReportModal } from '@/components/store/shared/StoreShared'
import { StoreThemeDatePicker, StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'
const PRODUCTS = [
  { id: 1, name: '69 mm Seal',      category: 'Seal',    subCategory: '69mm',     unit: 'Unit' },
  { id: 2, name: '72 MM Seal',      category: 'Seal',    subCategory: '72mm',     unit: 'Unit' },
  { id: 3, name: '500ml Bottle',    category: 'Bottle',  subCategory: '500ml',    unit: 'Unit' },
  { id: 4, name: '1L Bottle',       category: 'Bottle',  subCategory: '1L',       unit: 'Unit' },
  { id: 5, name: 'Front Sticker',   category: 'Sticker', subCategory: 'Front',    unit: 'Unit' },
  { id: 6, name: 'Standard Carton', category: 'Carton',  subCategory: 'Standard', unit: 'Unit' },
]

const INITIAL_RECORDS = [
  {
    id: 1, receiverName: 'SAJJAD', entryBy: 'Demo Account', entryDate: '22/05/2025',
    comment: '',
    items: [{ productId: 1, productName: '69 mm seal', subCategory: '69mm', category: 'Seal', quantity: 1000, unit: 'Unit', returned: 0 }],
  },
  {
    id: 2, receiverName: 'HAMID', entryBy: 'Demo Account', entryDate: '27/05/2025',
    comment: 'Urgent requirement for production line.',
    items: [{ productId: 1, productName: '69 mm seal', subCategory: '69mm', category: 'Seal', quantity: 2000, unit: 'Unit', returned: 200 }],
  },
  {
    id: 3, receiverName: 'GULFAM', entryBy: 'Demo Account', entryDate: '27/05/2025',
    comment: '',
    items: [{ productId: 2, productName: '72 MM Seal', subCategory: '72mm', category: 'Seal', quantity: 1100, unit: 'Unit', returned: 0 }],
  },
  {
    id: 4, receiverName: 'xyz', entryBy: 'Demo Account', entryDate: '28/05/2025',
    comment: 'Mixed order for two departments. Please ensure careful handling.',
    items: [
      { productId: 1, productName: '69 mm seal', subCategory: '69mm', category: 'Seal', quantity: 100, unit: 'Unit', returned: 100 },
      { productId: 2, productName: '72 MM Seal', subCategory: '72mm', category: 'Seal', quantity: 100, unit: 'Unit', returned: 0 },
    ],
  },
  {
    id: 5, receiverName: 'ADNAN', entryBy: 'Demo Account', entryDate: '03/06/2025',
    comment: '',
    items: [
      { productId: 2, productName: '72 MM Seal', subCategory: '72mm', category: 'Seal', quantity: 500, unit: 'Unit', returned: 50 },
      { productId: 1, productName: '69 mm seal', subCategory: '69mm', category: 'Seal', quantity: 500, unit: 'Unit', returned: 0 },
    ],
  },
]

function parseDMYDate(value) {
  const [d, m, y] = String(value || '').split('/')
  if (!d || !m || !y) return null
  const date = new Date(`${y}-${m}-${d}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export default function RequisitionPage() {
  const router = useRouter()

  const [records, setRecords]             = useState([])
  const [search, setSearch]               = useState('')
  const [filterReceiver, setFilterReceiver] = useState('All Receivers')
  const [filterCategory, setFilterCategory] = useState('All Categories')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [selected, setSelected]           = useState([])
  const [expandedComment, setExpandedComment] = useState(null)
  const [returnModal, setReturnModal]     = useState(null)   // { record, itemIdx }
  const [viewRecord, setViewRecord]       = useState(null)
  const [showReport, setShowReport]       = useState(false)
  const [loading, setLoading]             = useState(false)
  const [loadError, setLoadError]         = useState('')

  const toDMY = (isoDate) => {
    if (!isoDate) return ''
    const [y, m, d] = String(isoDate).slice(0, 10).split('-')
    if (!y || !m || !d) return String(isoDate)
    return `${d}/${m}/${y}`
  }

  const normalizeItem = (item) => ({
    productId: item?.productId ?? item?.product_id ?? '',
    productName: String(item?.productName || item?.product_name || '').trim(),
    subCategory: String(item?.subCategory || item?.sub_category || '').trim(),
    category: String(item?.category || '').trim(),
    quantity: Number(item?.quantity) || 0,
    unit: String(item?.unit || 'Unit').trim() || 'Unit',
    returned: Number(item?.returned) || 0,
  })

  const normalizeRecord = (raw) => ({
    id: raw?.id,
    receiverName: String(raw?.receiver_name || '').trim(),
    entryBy: String(raw?.entry_by || '').trim(),
    entryDate: toDMY(raw?.entry_date),
    comment: String(raw?.comment || '').trim(),
    items: Array.isArray(raw?.items) ? raw.items.map(normalizeItem) : [],
  })

  const loadFromApi = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await requisitionApi.list()
      const list = Array.isArray(res) ? res : (res?.results || [])
      setRecords(list.map(normalizeRecord).filter((row) => row.id != null))
    } catch (err) {
      setLoadError(err?.message || 'Unable to load requisitions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFromApi() }, [])

  const receiverOptions = useMemo(() => {
    const receivers = records.map((record) => record.receiverName).filter(Boolean)
    return Array.from(new Set(receivers)).sort((a, b) => a.localeCompare(b))
  }, [records])

  const categoryOptions = useMemo(() => {
    const categories = records.flatMap((record) => record.items.map((item) => item.category)).filter(Boolean)
    return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b))
  }, [records])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r => {
      const text = [
        r.receiverName, r.entryBy, r.entryDate, r.comment,
        ...r.items.flatMap(i => [i.productName, i.subCategory, i.category, String(i.quantity), i.unit, String(i.returned), String(i.quantity - i.returned)])
      ].join(' ').toLowerCase()
      const matchesSearch = !q.trim() || text.includes(q)
      const matchesReceiver = filterReceiver === 'All Receivers' || r.receiverName === filterReceiver
      const matchesCategory = filterCategory === 'All Categories' || r.items.some((item) => item.category === filterCategory)
      const rowDate = parseDMYDate(r.entryDate)
      const fromDate = filterDateFrom ? new Date(`${filterDateFrom}T00:00:00`) : null
      const toDate = filterDateTo ? new Date(`${filterDateTo}T23:59:59`) : null
      const matchesFrom = !fromDate || (rowDate && rowDate >= fromDate)
      const matchesTo = !toDate || (rowDate && rowDate <= toDate)
      return matchesSearch && matchesReceiver && matchesCategory && matchesFrom && matchesTo
    })
  }, [records, search, filterReceiver, filterCategory, filterDateFrom, filterDateTo])

  const resetFilters = () => {
    setSearch('')
    setFilterReceiver('All Receivers')
    setFilterCategory('All Categories')
    setFilterDateFrom('')
    setFilterDateTo('')
    setSelected([])
  }

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleAll    = () => setSelected(s => s.length === filtered.length ? [] : filtered.map(r => r.id))
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return
    try {
      await requisitionApi.delete(id)
      setRecords(r => r.filter(x => x.id !== id))
      setSelected(s => s.filter(x => x !== id))
    } catch (err) {
      setLoadError(err?.message || 'Unable to delete requisition')
    }
  }
  const handleBulkDelete = async () => {
    if (!selected.length) return
    if (!window.confirm(`Delete ${selected.length} records?`)) return
    try {
      for (const id of selected) {
        // eslint-disable-next-line no-await-in-loop
        await requisitionApi.delete(id)
      }
      setRecords(r => r.filter(x => !selected.includes(x.id)))
      setSelected([])
    } catch (err) {
      setLoadError(err?.message || 'Unable to delete selected requisitions')
    }
  }
  const handleReturn = async (recordId, itemIdx, returnQty) => {
    try {
      const updated = await requisitionApi.returnGoods({ record_id: recordId, item_idx: itemIdx, return_qty: returnQty })
      const normalized = normalizeRecord(updated)
      setRecords(prev => prev.map(r => (r.id === normalized.id ? normalized : r)))
      setLoadError('')
      setReturnModal(null)
    } catch (err) {
      throw new Error(err?.message || 'Unable to record return')
    }
  }
  const exportRows = selected.length > 0 ? records.filter(r => selected.includes(r.id)) : filtered

  const exportCSV = (rows) => {
    const headers = ['Receiver Name', 'Entry By', 'Entry Date', 'Product', 'Sub-Category', 'Category', 'Issued Qty', 'Returned Qty', 'Net Qty', 'Unit', 'Comment']
    const lines = rows.flatMap(r =>
      r.items.map(item => [
        r.receiverName, r.entryBy, r.entryDate,
        item.productName, item.subCategory, item.category,
        item.quantity, item.returned, item.quantity - item.returned,
        item.unit, r.comment
      ].map(v => `"${v}"`).join(','))
    )
    const csv = [headers.join(','), ...lines].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'goods-requisition.csv'; a.click()
  }

  const reportRecords = selected.length > 0 ? records.filter(r => selected.includes(r.id)) : filtered
  const reportRows = useMemo(() => reportRecords.flatMap((r) => r.items.map((item) => ({
      _groupId: r.id,
      receiver: r.receiverName,
      entryBy: r.entryBy,
      date: r.entryDate,
      product: item.productName,
      category: item.category,
      issued: `${item.quantity} ${item.unit}`,
      returned: `${item.returned} ${item.unit}`,
      net: `${item.quantity - item.returned} ${item.unit}`,
      comment: r.comment || '-',
    }))), [reportRecords])

  return (
    <DashboardLayout>
      <div style={s.wrapper}>

        {/* Page Header */}
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.pageTitle}>Goods Requisition</h1>
            <p style={s.pageSubtitle}>View and manage requisition entries.</p>
          </div>
          <div style={s.headerActions}>
            <button style={s.iconBtn} title="Reset" onClick={resetFilters}>
              <RotateCcw size={16} />
            </button>
            <button style={s.reportBtn} onClick={() => setShowReport(true)}>
              <FileText size={14} /> View Report
            </button>
            <button style={s.addBtn} onClick={() => router.push('/requisition/new')}>
              <Plus size={16} /> Add New Entry
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ ...s.reportPanel, marginBottom: 14 }}>
            <div style={s.reportRow}><span style={s.reportLabel}>Loading requisitions...</span></div>
          </div>
        ) : null}
        {loadError ? (
          <div style={{ ...s.reportPanel, borderColor: '#fecaca', background: '#fef2f2', marginBottom: 14 }}>
            <div style={s.reportRow}><span style={{ ...s.reportLabel, color: '#991b1b' }}>{loadError}</span></div>
          </div>
        ) : null}

        {/* Keyword Search */}
        <div style={s.controlsCard}>
          <div style={s.filtersRow}>
            <StoreThemeDropdown
              value={filterReceiver}
              onChange={setFilterReceiver}
              placeholder="All Receivers"
              variant="pill"
              options={[
                { value: 'All Receivers', label: 'All Receivers' },
                ...receiverOptions.map((receiver) => ({ value: receiver, label: receiver })),
              ]}
            />
            <StoreThemeDropdown
              value={filterCategory}
              onChange={setFilterCategory}
              placeholder="All Categories"
              variant="pill"
              options={[
                { value: 'All Categories', label: 'All Categories' },
                ...categoryOptions.map((category) => ({ value: category, label: category })),
              ]}
            />
            <StoreThemeDatePicker value={filterDateFrom} onChange={setFilterDateFrom} placeholder="From Date" variant="pill" />
            <StoreThemeDatePicker value={filterDateTo} onChange={setFilterDateTo} placeholder="To Date" variant="pill" alignRight />
          </div>
          <div style={s.searchWrap}>
            <Search size={15} color="#7a8a7a" />
            <input
              style={s.searchInput}
              placeholder="Search by receiver / entry by / date / product / sub-category / category / comment..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button style={s.clearBtn} onClick={() => setSearch('')}><X size={14} /></button>}
          </div>
        </div>

        {/* Table */}
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
                <th style={s.th}>Receiver Name</th>
                <th style={s.th}>Entry By</th>
                <th style={s.th}>Entry Date</th>
                <th style={s.th}>Product</th>
                <th style={s.th}>Sub-Category</th>
                <th style={s.th}>Qty / Returned / Net</th>
                <th style={s.th}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Comment <ChevronDown size={12} color="#9ca3af" />
                  </div>
                </th>
                <th style={{ ...s.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={s.emptyCell}>
                  <div style={s.emptyState}>
                    <ClipboardList size={32} color="#d1d5db" />
                    <p style={{ margin: '8px 0 0', color: '#9ca3af', fontSize: 14 }}>No records found</p>
                  </div>
                </td></tr>
              ) : filtered.map(r => (
                r.items.map((item, idx) => (
                  <tr key={`${r.id}-${idx}`}
                    style={{ ...s.tr, backgroundColor: selected.includes(r.id) ? '#e8f0e8' : '#fff' }}
                  >
                    {/* Checkbox - first row only */}
                    <td style={s.td}>
                      {idx === 0 && (
                        <button style={s.checkBtn} onClick={() => toggleSelect(r.id)}>
                          {selected.includes(r.id)
                            ? <CheckSquare size={15} color="#54B45B" />
                            : <Square size={15} color="#9ca3af" />}
                        </button>
                      )}
                    </td>

                    {/* Receiver Name - first row only */}
                    <td style={{ ...s.td, fontWeight: idx === 0 ? 600 : 400, color: '#1a2e1b' }}>
                      {idx === 0 ? r.receiverName : ''}
                    </td>

                    {/* Entry By - first row only */}
                    <td style={s.td}>{idx === 0 ? r.entryBy : ''}</td>

                    {/* Date - first row only */}
                    <td style={s.td}>{idx === 0 ? r.entryDate : ''}</td>

                    {/* Product */}
                    <td style={s.td}>
                      <span style={s.productName}>{item.productName}</span>
                    </td>

                    {/* Sub-Category */}
                    <td style={s.td}>
                      <span style={s.subCatBadge}>{item.subCategory}</span>
                    </td>

                    {/* Qty / Returned / Net */}
                    <td style={s.td}>
                      <div style={s.qtyGroup}>
                        <span style={s.qtyIssued} title="Issued">{item.quantity} {item.unit}</span>
                        <span style={s.qtySep}>&gt;</span>
                        <span style={s.qtyReturned} title="Returned">-{item.returned} {item.unit}</span>
                        <span style={s.qtySep}>&gt;</span>
                        <span style={s.qtyNet} title="Net (in use)">{item.quantity - item.returned} {item.unit}</span>
                      </div>
                    </td>

                    {/* Comment - first row only, with expand dropdown arrow */}
                    <td style={s.td}>
                      {idx === 0 ? (
                        r.comment ? (
                          <div style={s.commentCell}>
                            <span style={s.commentText}>
                              {expandedComment === r.id
                                ? r.comment
                                : r.comment.length > 45 ? r.comment.slice(0, 45) + '...' : r.comment}
                            </span>
                            {r.comment.length > 45 && (
                              <button
                                style={s.commentToggle}
                                title={expandedComment === r.id ? 'Collapse' : 'Expand comment'}
                                onClick={() => setExpandedComment(expandedComment === r.id ? null : r.id)}
                              >
                                {expandedComment === r.id
                                  ? <ChevronUp size={12} />
                                  : <ChevronDown size={12} />}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#d1d5db', fontSize: 12 }}>-</span>
                        )
                      ) : ''}
                    </td>

                    {/* Actions */}
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      {idx === 0 && (
                        <div style={s.actionBtns}>
                          <button
                            style={s.returnBtn}
                            title="Return goods"
                            onClick={() => setReturnModal({ record: r, itemIdx: 0 })}
                          >
                            <CornerUpLeft size={14} />
                          </button>
                          <button style={s.viewBtn} title="View" onClick={() => setViewRecord(r)}>
                            <Eye size={14} />
                          </button>
                          <button style={s.delBtn} title="Delete" onClick={() => handleDelete(r.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                      {idx > 0 && (
                        <div style={s.actionBtns}>
                          <button
                            style={s.returnBtn}
                            title="Return this item"
                            onClick={() => setReturnModal({ record: r, itemIdx: idx })}
                          >
                            <CornerUpLeft size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
          <div style={s.tableFooter}>
            <span style={s.footerText}>
              Showing {filtered.length} of {records.length} entries
              {selected.length > 0 && <span style={s.selCount}> - {selected.length} selected</span>}
            </span>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {viewRecord && <ViewModal record={viewRecord} onClose={() => setViewRecord(null)} />}

      {showReport ? (
        <ReportModal
          title="Goods Requisition"
          data={reportRows}
          columns={[
            { key: 'receiver', label: 'Receiver', rowSpan: true },
            { key: 'entryBy', label: 'Entry By', rowSpan: true },
            { key: 'date', label: 'Date', rowSpan: true },
            { key: 'product', label: 'Product' },
            { key: 'category', label: 'Category' },
            { key: 'issued', label: 'Issued' },
            { key: 'returned', label: 'Returned' },
            { key: 'net', label: 'Net' },
            { key: 'comment', label: 'Comment', rowSpan: true },
          ]}
          onClose={() => setShowReport(false)}
        />
      ) : null}

      {/* Return Modal */}
      {returnModal && (
        <ReturnModal
          record={returnModal.record}
          itemIdx={returnModal.itemIdx}
          onClose={() => setReturnModal(null)}
          onReturn={handleReturn}
        />
      )}
    </DashboardLayout>
  )
}
function ViewModal({ record, onClose }) {
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div>
            <h2 style={s.modalTitle}>Requisition - {record.receiverName}</h2>
            <p style={s.modalSub}>{record.entryDate} - {record.entryBy}</p>
          </div>
          <button style={s.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={s.modalBody}>
          {record.comment && (
            <div style={s.commentBox}>
              <p style={s.commentBoxLabel}>Comment</p>
              <p style={s.commentBoxText}>{record.comment}</p>
            </div>
          )}
          <p style={s.itemsTitle}>Items ({record.items.length})</p>
          <table style={s.innerTable}>
            <thead>
              <tr>
                {['Product', 'Sub-Category', 'Category', 'Issued', 'Returned', 'Net'].map(h => (
                  <th key={h} style={s.innerTh}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {record.items.map((item, i) => (
                <tr key={i}>
                  <td style={s.innerTd}>{item.productName}</td>
                  <td style={s.innerTd}><span style={s.subCatBadge}>{item.subCategory}</span></td>
                  <td style={s.innerTd}>{item.category}</td>
                  <td style={s.innerTd}>{item.quantity} {item.unit}</td>
                  <td style={{ ...s.innerTd, color: '#ef4444' }}>-{item.returned} {item.unit}</td>
                  <td style={{ ...s.innerTd, fontWeight: 700, color: '#2d7a33' }}>{item.quantity - item.returned} {item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
function ReturnModal({ record, itemIdx, onClose, onReturn }) {
  const item = record.items[itemIdx]
  const maxReturn = item.quantity - item.returned
  const [qty, setQty]             = useState('')
  const [error, setError]         = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    const n = Number(qty)
    if (!qty || isNaN(n) || n <= 0) { setError('Enter a valid quantity'); return }
    if (n > maxReturn) { setError(`Max returnable: ${maxReturn} ${item.unit}`); return }
    setSubmitting(true)
    setError('')
    try {
      await onReturn(record.id, itemIdx, n)
    } catch (err) {
      setError(err?.message || 'Unable to record return')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div>
            <h2 style={s.modalTitle}>Return Goods</h2>
            <p style={s.modalSub}>{record.receiverName} - {item.productName}</p>
          </div>
          <button style={s.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={s.modalBody}>
          <div style={s.returnInfo}>
            <div style={s.returnInfoRow}><span style={s.returnInfoLabel}>Product</span><span style={s.returnInfoVal}>{item.productName} ({item.subCategory})</span></div>
            <div style={s.returnInfoRow}><span style={s.returnInfoLabel}>Category</span><span style={s.returnInfoVal}>{item.category}</span></div>
            <div style={s.returnInfoRow}><span style={s.returnInfoLabel}>Issued</span><span style={s.returnInfoVal}>{item.quantity} {item.unit}</span></div>
            <div style={s.returnInfoRow}><span style={s.returnInfoLabel}>Already Returned</span><span style={{ ...s.returnInfoVal, color: '#ef4444' }}>{item.returned} {item.unit}</span></div>
            <div style={s.returnInfoRow}><span style={s.returnInfoLabel}>Max Returnable</span><span style={{ ...s.returnInfoVal, color: '#2d7a33', fontWeight: 700 }}>{maxReturn} {item.unit}</span></div>
          </div>
          <label style={s.label}>Return Quantity</label>
          <input
            style={{ ...s.input, ...(error ? { borderColor: '#fca5a5' } : {}) }}
            type="number" min="1" max={maxReturn}
            placeholder={`Max ${maxReturn}`}
            value={qty}
            onChange={e => { setQty(e.target.value); setError('') }}
          />
          {error && <p style={s.errorText}>{error}</p>}
          <p style={s.returnNote}>
            Returning will add goods back to stock and reduce the net consumed quantity.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button style={s.cancelBtn} onClick={onClose} disabled={submitting}>Cancel</button>
            <button
              style={{ ...s.confirmReturnBtn, ...(submitting ? { opacity: 0.7, cursor: 'not-allowed' } : {}) }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              <CornerUpLeft size={14} /> {submitting ? 'Returning...' : 'Confirm Return'}
            </button>
          </div>
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
  table: { width: '100%', minWidth: 1120, borderCollapse: 'collapse' },
  thead: { background: '#e8eee8' },
  th: { padding: '12px 14px', fontSize: 12, fontWeight: 700, color: '#29472d', textAlign: 'left', borderBottom: '1px solid #d4dfd4', whiteSpace: 'nowrap', letterSpacing: '0.1px' },
  tr: { transition: 'background 0.15s' },
  td: { padding: '10px 14px', fontSize: 13, color: '#415443', borderBottom: '1px solid #e2e8e2', verticalAlign: 'top', background: '#ffffff' },
  productName: { fontSize: 13, fontWeight: 600, color: '#1f2f21' },
  subCatBadge: { display: 'inline-block', background: '#eef2ee', border: '1px solid #d4dfd4', color: '#2d7a33', borderRadius: 40, padding: '2px 9px', fontSize: 11.5, fontWeight: 700 },
  qtyGroup: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  qtyIssued: { fontSize: 12.5, color: '#374151', fontWeight: 500 },
  qtySep: { fontSize: 11, color: '#b2c0b3' },
  qtyReturned: { fontSize: 12.5, color: '#ef4444', fontWeight: 600 },
  qtyNet: { fontSize: 12.5, color: '#2d7a33', fontWeight: 700 },
  commentCell: { display: 'flex', alignItems: 'flex-start', gap: 4, maxWidth: 220 },
  commentText: { fontSize: 12.5, color: '#607062', lineHeight: 1.4, flex: 1 },
  commentToggle: { background: '#eef2ee', border: '1px solid #d4dfd4', borderRadius: 6, padding: '2px 4px', cursor: 'pointer', color: '#7a8a7a', display: 'flex', flexShrink: 0, marginTop: 1 },
  actionBtns: { display: 'flex', gap: 6, justifyContent: 'flex-end' },
  returnBtn: { background: '#fff7ed', border: '1px solid #fed7aa', color: '#ea580c', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' },
  viewBtn: { background: '#e8f0e8', border: '1px solid #d4dfd4', color: '#2d7a33', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' },
  delBtn: { background: '#fff5f5', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' },
  checkBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 },
  emptyCell: { textAlign: 'center', padding: '56px 0', background: '#ffffff' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  tableFooter: { padding: '11px 16px', borderTop: '1px solid #d4dfd4', background: '#e8eee8' },
  footerText: { fontSize: 12.5, color: '#607062', fontWeight: 500 },
  selCount: { color: '#1f7a2b', fontWeight: 700 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(8, 18, 10, 0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#f2f4f2', borderRadius: RADIUS, width: '100%', maxWidth: 620, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8e2', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' },
  modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #d4dfd4' },
  modalTitle: { fontSize: 18, fontWeight: 800, color: '#1a3d1f', margin: 0 },
  modalSub: { fontSize: 12.5, color: '#7a8a7a', margin: '4px 0 0' },
  modalClose: { background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 10, padding: 6, cursor: 'pointer', color: '#607062', display: 'flex' },
  modalBody: { padding: '20px 24px', overflowY: 'auto', flex: 1 },
  commentBox: { background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 10, padding: '12px 16px', marginBottom: 18 },
  commentBoxLabel: { fontSize: 11, fontWeight: 700, color: '#7a8a7a', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 6px' },
  commentBoxText: { fontSize: 13.5, color: '#374151', margin: 0, lineHeight: 1.6 },
  itemsTitle: { fontSize: 13, fontWeight: 700, color: '#29472d', marginBottom: 10 },
  innerTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  innerTh: { padding: '8px 10px', background: '#e8eee8', color: '#2d7a33', fontWeight: 700, fontSize: 11.5, textAlign: 'left', borderBottom: '1px solid #d4dfd4' },
  innerTd: { padding: '8px 10px', borderBottom: '1px solid #d4dfd4', color: '#415443', background: '#ffffff' },
  returnInfo: { background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  returnInfoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  returnInfoLabel: { fontSize: 12, color: '#7a8a7a', fontWeight: 600 },
  returnInfoVal: { fontSize: 13.5, color: '#374151', fontWeight: 500 },
  returnNote: { fontSize: 12, color: '#607062', marginTop: 10, padding: '8px 12px', background: '#ffffff', borderRadius: 8, border: '1px solid #d4dfd4', lineHeight: 1.5 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#607062', marginBottom: 4 },
  input: {
    width: '100%',
    background: '#ffffff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d4dfd4',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 13.5,
    color: '#1f2f21',
    outline: 'none',
    boxSizing: 'border-box',
  },
  errorText: { fontSize: 12, color: '#ef4444', margin: '4px 0 0' },
  cancelBtn: { background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 40, padding: '9px 20px', fontSize: 13.5, fontWeight: 600, color: '#374151', cursor: 'pointer' },
  confirmReturnBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#ea580c', border: 'none', borderRadius: 40, padding: '9px 20px', fontSize: 13.5, fontWeight: 600, color: '#fff', cursor: 'pointer' },
}



