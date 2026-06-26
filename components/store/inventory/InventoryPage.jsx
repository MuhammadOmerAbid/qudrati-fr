'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, FileText, Pencil, Trash2, RefreshCw, X, History } from 'lucide-react'
import { categoriesApi, inventoryApi } from '@/infrastructure/api/endpoints'
import {
  Checkbox,
  AppButton,
  TableShell,
  CommentEditorModal,
  ReportModal,
  SectionHeader,
  ui,
} from '@/components/store/shared/StoreShared'
import { StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'

const toList = (value) => (Array.isArray(value) ? value : (value?.results || []))
const normalizeInventoryRow = (row = {}) => ({
  id: row.id,
  brand: row.brand || '',
  category: row.category_name || row.categoryName || row.category || '',
  product: row.product || '',
  subcategory: row.subcategory || row.subCategory || row.sub_category || '',
  quantity: Number(row.quantity || 0),
  unit: row.unit || 'Unit',
  comment: row.comment || '',
})

export default function InventoryPage({ isSuperUser = true }) {
  const [items, setItems] = useState([])
  const [brand, setBrand] = useState('All Brands')
  const [category, setCategory] = useState('All Categories')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyData, setHistoryData] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [showReport, setShowReport] = useState(false)
  const [commentEdit, setCommentEdit] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [categoryItems, setCategoryItems] = useState([])

  const loadInventory = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [inventoryResult, categoryResult] = await Promise.allSettled([
        inventoryApi.list(),
        categoriesApi.list(),
      ])

      if (inventoryResult.status === 'rejected') throw inventoryResult.reason

      setItems(toList(inventoryResult.value).map(normalizeInventoryRow))
      if (categoryResult.status === 'fulfilled') {
        setCategoryItems(toList(categoryResult.value))
      }
    } catch (err) {
      setItems([])
      setLoadError(err?.message || 'Unable to load inventory records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInventory()
  }, [])

  useEffect(() => {
    if (!showHistory) return
    let active = true
    setHistoryLoading(true)
    setHistoryError('')
    inventoryApi.history().then((data) => {
      if (!active) return
      const rows = Array.isArray(data) ? data : (data?.results || [])
      setHistoryData(rows.map((row) => ({
        month: String(row.month || row.period || '').trim(),
        category: String(row.category || row.category_name || '').trim(),
        product: String(row.product || row.product_name || '').trim(),
        outgoing: Number(row.outgoing || row.quantity || row.total || 0),
        unit: String(row.unit || 'Unit').trim(),
      })).filter((row) => row.month))
    }).catch((err) => {
      if (!active) return
      setHistoryError(err?.message || 'Unable to load history')
    }).finally(() => {
      if (active) setHistoryLoading(false)
    })
    return () => { active = false }
  }, [showHistory])

  const filtered = useMemo(() => {
    let rows = [...items].sort((a, b) => a.brand.localeCompare(b.brand))

    if (brand !== 'All Brands') rows = rows.filter((row) => row.brand === brand)
    if (category !== 'All Categories') rows = rows.filter((row) => row.category === category)

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((row) => [row.brand, row.category, row.product].join(' ').toLowerCase().includes(q))
    }

    return rows
  }, [items, brand, category, search])

  const brandOptions = useMemo(() => {
    const fromApi = items.map((item) => item.brand).filter(Boolean)
    return ['All Brands', ...new Set(fromApi)]
  }, [items])

  const categoryOptions = useMemo(() => {
    const fromApi = items.map((item) => item.category).filter(Boolean)
    const fromSettings = categoryItems
      .filter((item) => item.status !== false && item.status !== 'inactive')
      .map((item) => item.name)
      .filter(Boolean)
    return ['All Categories', ...new Set([...fromSettings, ...fromApi])]
  }, [categoryItems, items])

  useEffect(() => {
    if (category !== 'All Categories' && !categoryOptions.includes(category)) {
      setCategory('All Categories')
    }
  }, [category, categoryOptions])

  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach((item) => {
      if (!map[item.brand]) map[item.brand] = []
      map[item.brand].push(item)
    })
    return map
  }, [filtered])

  const groupedHistory = useMemo(() => {
    const map = {}
    historyData.forEach((row) => {
      const month = String(row.month || row.period || '').trim()
      if (!month) return
      if (!map[month]) map[month] = []
      map[month].push(row)
    })
    return map
  }, [historyData])

  const reportSourceRows = selected.length > 0 ? items.filter((item) => selected.includes(item.id)) : filtered

  const reportRows = useMemo(
    () => [...reportSourceRows]
      .sort((a, b) => (
        a.brand.localeCompare(b.brand)
        || a.category.localeCompare(b.category)
        || a.product.localeCompare(b.product)
      ))
      .map((row) => ({ ...row, _groupId: row.brand || `inventory-${row.id}` })),
    [reportSourceRows]
  )

  const toggleSelectAll = () => {
    setSelected((prev) => (prev.length === filtered.length ? [] : filtered.map((row) => row.id)))
  }

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  return (
    <div style={ui.pageWrap}>
      <SectionHeader
        title="Inventory"
        subtitle="View and manage inventory stock"
        actions={(
          <>
            <AppButton title="Refresh" onClick={loadInventory}>
              <RefreshCw size={14} />
            </AppButton>
            <AppButton onClick={() => setShowHistory(true)}>
              <History size={14} /> Monthly History
            </AppButton>
            <AppButton onClick={() => setShowReport(true)}>
              <FileText size={14} /> View Report
            </AppButton>
          </>
        )}
      />

      <div style={ui.filtersRow}>
        <div style={{ minWidth: 0 }}>
          <StoreThemeDropdown
            value={brand}
            onChange={setBrand}
            compact
            variant="pill"
            placeholder="All Brands"
            options={brandOptions.map((entry) => ({ value: entry, label: entry }))}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <StoreThemeDropdown
            value={category}
            onChange={setCategory}
            compact
            variant="pill"
            placeholder="All Categories"
            options={categoryOptions.map((entry) => ({ value: entry, label: entry }))}
          />
        </div>
      </div>

      {loadError ? (
        <div style={errorBanner}>
          {loadError}
        </div>
      ) : null}

      <div style={ui.searchWrap}>
        <Search size={15} color="#7a8a7a" />
        <input
          style={ui.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search inventory by brand, category, product"
        />
      </div>

      <TableShell
        columns={[
          { key: 'select', label: <Checkbox checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} /> },
          { key: 'brand', label: 'Brand' },
          { key: 'category', label: 'Category' },
          { key: 'product', label: 'Product' },
          { key: 'quantity', label: 'Quantity' },
          { key: 'comment', label: 'Comment' },
          { key: 'action', label: 'Actions', align: 'right' },
        ]}
        emptyColSpan={filtered.length === 0 ? 7 : null}
        emptyText={loading ? 'Loading inventory records...' : 'No inventory records found'}
      >
        {Object.entries(grouped).flatMap(([brandName, rows]) =>
          rows.map((item, idx) => (
            <tr key={item.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f7faf7' }}>
              <td style={ui.td}><Checkbox checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} /></td>
              <td style={{ ...ui.td, ...(idx === 0 ? ui.brandPrimary : ui.brandMuted) }}>{idx === 0 ? brandName : ''}</td>
              <td style={ui.td}>{item.category}</td>
              <td style={ui.td}>{item.product}</td>
              <td style={{ ...ui.td, fontWeight: 700 }}>{item.quantity.toLocaleString()} {item.unit}</td>
              <td style={ui.td}>
                <div style={ui.inlineActionsLeft}>
                  <span style={ui.smallMuted}>
                    {item.comment ? `${item.comment.slice(0, 42)}${item.comment.length > 42 ? '...' : ''}` : '-'}
                  </span>
                  <button type="button" style={ui.iconButton} onClick={() => setCommentEdit(item)}>
                    <Pencil size={13} />
                  </button>
                </div>
              </td>
              <td style={{ ...ui.td, textAlign: 'right' }}>
                {isSuperUser ? (
                  <button
                    type="button"
                    style={ui.iconDangerButton}
                    onClick={async () => {
                      if (!window.confirm('Delete this inventory record?')) return
                      try {
                        await inventoryApi.delete(item.id)
                        setItems((prev) => prev.filter((row) => row.id !== item.id))
                      } catch (err) {
                        setLoadError(err?.message || 'Unable to delete inventory record')
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </td>
            </tr>
          ))
        )}
      </TableShell>

      {commentEdit ? (
        <CommentEditorModal
          value={commentEdit.comment}
          subtitle="Add or update note (maximum 500 words)"
          onCancel={() => setCommentEdit(null)}
          onSave={async (comment) => {
            try {
              const saved = await inventoryApi.updateComment(commentEdit.id, comment)
              const normalized = normalizeInventoryRow(saved)
              setItems((prev) => prev.map((row) => (row.id === commentEdit.id ? normalized : row)))
              setCommentEdit(null)
            } catch (err) {
              setLoadError(err?.message || 'Unable to update inventory comment')
            }
          }}
        />
      ) : null}

      {showHistory ? (
        <div style={ui.overlay} onClick={() => setShowHistory(false)}>
          <div style={{ ...ui.modal, maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
            <div style={ui.modalHeaderTop}>
              <div>
                <h3 style={ui.modalTitle}>Monthly Outgoing History</h3>
                <p style={ui.modalSub}>Category-wise outgoing totals by month</p>
              </div>
              <AppButton onClick={() => setShowHistory(false)} style={ui.iconBtnOnly}>
                <X size={16} />
              </AppButton>
            </div>
            {historyLoading ? (
              <p style={ui.modalSub}>Loading history...</p>
            ) : historyError ? (
              <p style={{ ...ui.modalSub, color: '#c0392b' }}>{historyError}</p>
            ) : Object.keys(groupedHistory).length === 0 ? (
              <p style={ui.modalSub}>No history data available.</p>
            ) : Object.entries(groupedHistory).map(([month, rows]) => (
              <div key={month} style={ui.monthGroup}>
                <p style={ui.monthTitle}>{month}</p>
                <table style={ui.table}>
                  <thead>
                    <tr>
                      <th style={ui.th}>Category</th>
                      <th style={ui.th}>Product</th>
                      <th style={ui.th}>Total Outgoing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={`${month}-${idx}`}>
                        <td style={ui.td}>{row.category}</td>
                        <td style={ui.td}>{row.product}</td>
                        <td style={{ ...ui.td, fontWeight: 700 }}>{row.outgoing.toLocaleString()} {row.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showReport ? (
        <ReportModal
          title="Inventory"
          data={reportRows}
          selectFilters={[
            {
              key: 'brand',
              label: 'Brand',
              allValue: 'All Brands',
              initialValue: brand,
              placeholder: 'All Brands',
              options: brandOptions.map((entry) => ({ value: entry, label: entry })),
            },
            {
              key: 'category',
              label: 'Category',
              allValue: 'All Categories',
              initialValue: category,
              placeholder: 'All Categories',
              options: categoryOptions.map((entry) => ({ value: entry, label: entry })),
            },
          ]}
          columns={[
            { key: 'brand', label: 'Brand', rowSpan: true },
            { key: 'category', label: 'Category' },
            { key: 'product', label: 'Product' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'unit', label: 'Unit' },
            { key: 'comment', label: 'Comment' },
          ]}
          onClose={() => setShowReport(false)}
        />
      ) : null}
    </div>
  )
}

const errorBanner = {
  background: '#fff1f2',
  border: '1px solid #fecaca',
  borderRadius: 10,
  padding: '9px 12px',
  color: '#b91c1c',
  fontSize: 13,
  fontWeight: 600,
}

