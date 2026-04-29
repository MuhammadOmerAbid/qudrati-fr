'use client'

import { useMemo, useState } from 'react'
import { Search, FileText, Pencil, Trash2, RefreshCw, X, History } from 'lucide-react'
import {
  BRANDS,
  INVENTORY_INITIAL,
  MONTHLY_HISTORY,
  Checkbox,
  AppButton,
  TableShell,
  CommentEditorModal,
  ReportModal,
  SectionHeader,
  ui,
} from '@/components/store/shared/StoreShared'
import { StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'
export default function InventoryPage({ isSuperUser = true }) {
  const [items, setItems] = useState(INVENTORY_INITIAL)
  const [brand, setBrand] = useState('All Brands')
  const [category, setCategory] = useState('All Categories')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [commentEdit, setCommentEdit] = useState(null)

  const filtered = useMemo(() => {
    let rows = [...items].sort((a, b) => a.brand.localeCompare(b.brand))

    if (brand !== 'All Brands') rows = rows.filter((row) => row.brand === brand)
    if (category !== 'All Categories') rows = rows.filter((row) => row.category === category)

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((row) => [row.brand, row.category, row.product, row.subcategory].join(' ').toLowerCase().includes(q))
    }

    return rows
  }, [items, brand, category, search])

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
    MONTHLY_HISTORY.forEach((row) => {
      if (!map[row.month]) map[row.month] = []
      map[row.month].push(row)
    })
    return map
  }, [])

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
            <AppButton title="Reset" onClick={() => setItems([...INVENTORY_INITIAL])}>
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
        <div style={{ minWidth: 170 }}>
          <StoreThemeDropdown
            value={brand}
            onChange={setBrand}
            compact
            variant="pill"
            placeholder="All Brands"
            options={['All Brands', ...BRANDS].map((entry) => ({ value: entry, label: entry }))}
          />
        </div>
        <div style={{ minWidth: 170 }}>
          <StoreThemeDropdown
            value={category}
            onChange={setCategory}
            compact
            variant="pill"
            placeholder="All Categories"
            options={['All Categories', 'Seal', 'Bottle', 'Sticker', 'Jar', 'Label'].map((entry) => ({ value: entry, label: entry }))}
          />
        </div>
      </div>

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
          { key: 'subcategory', label: 'Sub-Category' },
          { key: 'quantity', label: 'Quantity' },
          { key: 'comment', label: 'Comment' },
          { key: 'action', label: 'Actions', align: 'right' },
        ]}
        emptyColSpan={filtered.length === 0 ? 8 : null}
        emptyText="No inventory records found"
      >
        {Object.entries(grouped).flatMap(([brandName, rows]) =>
          rows.map((item, idx) => (
            <tr key={item.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f7faf7' }}>
              <td style={ui.td}><Checkbox checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} /></td>
              <td style={{ ...ui.td, ...(idx === 0 ? ui.brandPrimary : ui.brandMuted) }}>{idx === 0 ? brandName : ''}</td>
              <td style={ui.td}>{item.category}</td>
              <td style={ui.td}>{item.product}</td>
              <td style={ui.td}>{item.subcategory || '-'}</td>
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
                  <button type="button" style={ui.iconDangerButton} onClick={() => setItems((prev) => prev.filter((row) => row.id !== item.id))}>
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
          onSave={(comment) => {
            setItems((prev) => prev.map((row) => (row.id === commentEdit.id ? { ...row, comment } : row)))
            setCommentEdit(null)
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
            {Object.entries(groupedHistory).map(([month, rows]) => (
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
          data={items}
          columns={[
            { key: 'brand', label: 'Brand' },
            { key: 'category', label: 'Category' },
            { key: 'product', label: 'Product' },
            { key: 'subcategory', label: 'Sub-Category' },
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

