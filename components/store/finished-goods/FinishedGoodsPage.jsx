'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, FileText, Pencil, Trash2, ChevronDown, RefreshCw } from 'lucide-react'
import { finishedGoodsApi } from '@/infrastructure/api/endpoints'
import { StoreThemeDatePicker, StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'
import {
  formatDate,
  Checkbox,
  AppButton,
  TableShell,
  CommentEditorModal,
  ReportModal,
  SectionHeader,
  ui,
} from '@/components/store/shared/StoreShared'

const toList = (value) => (Array.isArray(value) ? value : (value?.results || []))
const normalizeEntry = (entry = {}) => ({
  id: entry.id,
  brand: entry.brand || '',
  date: entry.date || '',
  products: Array.isArray(entry.products) ? entry.products : [],
})

function parseDateValue(value) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export default function FinishedGoodsPage({ isSuperUser = true }) {
  const router = useRouter()
  const [entries, setEntries] = useState([])
  const [search, setSearch] = useState('')
  const [filterBrand, setFilterBrand] = useState('All Brands')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [selected, setSelected] = useState([])
  const [expanded, setExpanded] = useState({})
  const [showReport, setShowReport] = useState(false)
  const [commentEdit, setCommentEdit] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const loadEntries = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await finishedGoodsApi.list()
      setEntries(toList(data).map(normalizeEntry).filter((entry) => entry.products.length > 0))
    } catch (err) {
      setEntries([])
      setLoadError(err?.message || 'Unable to load finished goods')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [])

  const brandOptions = useMemo(() => {
    const brands = entries.map((entry) => entry.brand).filter(Boolean)
    return Array.from(new Set(brands)).sort((a, b) => a.localeCompare(b))
  }, [entries])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return entries.filter((entry) => {
      const text = [entry.brand, entry.date, ...entry.products.map((product) => `${product.product} ${product.packing}`)]
        .join(' ')
        .toLowerCase()
      const matchesSearch = !q.trim() || text.includes(q)
      const matchesBrand = filterBrand === 'All Brands' || entry.brand === filterBrand
      const rowDate = parseDateValue(entry.date)
      const fromDate = filterDateFrom ? new Date(`${filterDateFrom}T00:00:00`) : null
      const toDate = filterDateTo ? new Date(`${filterDateTo}T23:59:59`) : null
      const matchesFrom = !fromDate || (rowDate && rowDate >= fromDate)
      const matchesTo = !toDate || (rowDate && rowDate <= toDate)
      return matchesSearch && matchesBrand && matchesFrom && matchesTo
    })
  }, [entries, search, filterBrand, filterDateFrom, filterDateTo])

  const reportEntries = selected.length > 0 ? entries.filter((entry) => selected.includes(entry.id)) : filtered

  const reportRows = useMemo(
    () =>
      reportEntries.flatMap((entry) =>
        entry.products.map((product) => ({
          _groupId: entry.id,
          brand: entry.brand,
          date: entry.date,
          product: product.product,
          packing: product.packing,
          cartons: product.cartons,
          comment: product.comment,
        }))
      ),
    [reportEntries]
  )

  const totalCartons = (entry) =>
    entry.products.reduce((sum, product) => sum + (Number(product.cartons) || 0), 0)

  return (
    <div style={ui.pageWrap}>
      <SectionHeader
        title="Finished Goods"
        subtitle="Manage finished goods entries and carton totals"
        actions={(
          <>
            <AppButton onClick={loadEntries}>
              <RefreshCw size={14} />
            </AppButton>
            <AppButton onClick={() => setShowReport(true)}>
              <FileText size={14} /> View Report
            </AppButton>
            <AppButton
              type="primary"
              style={{ background: 'linear-gradient(90deg, #1B5E20 0%, #2E7D32 45%, #4CAF50 100%)', border: 'none', color: '#fff' }}
              onClick={() => router.push('/finished-goods/new')}
            >
              <Plus size={14} /> Add Entry
            </AppButton>
          </>
        )}
      />

      {loadError ? <div style={errorBanner}>{loadError}</div> : null}

      <div style={filterCard}>
        <div style={ui.filtersRow}>
          <StoreThemeDropdown
            value={filterBrand}
            onChange={setFilterBrand}
            placeholder="All Brands"
            variant="pill"
            options={[
              { value: 'All Brands', label: 'All Brands' },
              ...brandOptions.map((brand) => ({ value: brand, label: brand })),
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
        <div style={{ ...ui.searchWrap, marginTop: 12 }}>
          <Search size={15} color="#7a8a7a" />
          <input
            style={ui.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by brand, product or packing"
          />
        </div>
      </div>

      <TableShell
        columns={[
          {
            key: 'select',
            label: (
              <Checkbox
                checked={selected.length === filtered.length && filtered.length > 0}
                onChange={() =>
                  setSelected((prev) =>
                    prev.length === filtered.length ? [] : filtered.map((entry) => entry.id)
                  )
                }
              />
            ),
          },
          { key: 'brand', label: 'Brand' },
          { key: 'product', label: 'Product' },
          { key: 'packing', label: 'Packing' },
          { key: 'date', label: 'Date' },
          { key: 'cartons', label: 'Cartons' },
          { key: 'comment', label: 'Comment' },
          { key: 'detail', label: 'Details' },
          { key: 'action', label: 'Actions', align: 'right' },
        ]}
        emptyColSpan={filtered.length === 0 ? 9 : null}
        emptyText={loading ? 'Loading finished goods...' : 'No finished goods found'}
      >
        {filtered.flatMap((entry) => {
          const rows = []
          rows.push(
            <tr key={`${entry.id}-summary`} style={{ background: '#ffffff' }}>
              <td style={ui.td}>
                <Checkbox
                  checked={selected.includes(entry.id)}
                  onChange={() =>
                    setSelected((prev) =>
                      prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id]
                    )
                  }
                />
              </td>
              <td style={ui.brandPrimary}>{entry.brand}</td>
              <td style={ui.td}>{entry.products.length} product(s)</td>
              <td style={ui.td}>-</td>
              <td style={ui.td}>{formatDate(entry.date)}</td>
              <td style={{ ...ui.td, fontWeight: 700 }}>{totalCartons(entry).toLocaleString()} total</td>
              <td style={ui.td}>-</td>
              <td style={ui.td}>
                <button
                  type="button"
                  style={ui.iconButton}
                  onClick={() => setExpanded((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                >
                  <ChevronDown
                    size={14}
                    style={{
                      transform: expanded[entry.id] ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform .2s ease',
                    }}
                  />
                </button>
              </td>
              <td style={{ ...ui.td, textAlign: 'right' }}>
                {isSuperUser ? (
                  <button
                    type="button"
                    style={ui.iconDangerButton}
                    onClick={async () => {
                      if (!window.confirm('Delete this finished goods entry?')) return
                      try {
                        await finishedGoodsApi.delete(entry.id)
                        setEntries((prev) => prev.filter((item) => item.id !== entry.id))
                      } catch (err) {
                        setLoadError(err?.message || 'Unable to delete finished goods entry')
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </td>
            </tr>
          )

          if (expanded[entry.id]) {
            entry.products.forEach((product, index) => {
              rows.push(
                <tr key={`${entry.id}-product-${index}`} style={{ background: '#eef2ee' }}>
                  <td style={ui.td} />
                  <td style={ui.td} />
                  <td style={{ ...ui.td, fontWeight: 600, color: '#1f2f21' }}>- {product.product}</td>
                  <td style={ui.td}>{product.packing}</td>
                  <td style={ui.td} />
                  <td style={{ ...ui.td, fontWeight: 700 }}>{Number(product.cartons || 0).toLocaleString()}</td>
                  <td style={ui.td}>
                    <div style={ui.inlineActionsLeft}>
                      <span style={ui.smallMuted}>
                        {product.comment
                          ? `${product.comment.slice(0, 32)}${product.comment.length > 32 ? '...' : ''}`
                          : '-'}
                      </span>
                      <button
                        type="button"
                        style={ui.iconButton}
                        onClick={() =>
                          setCommentEdit({ id: entry.id, pidx: index, comment: product.comment })
                        }
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </td>
                  <td style={ui.td} />
                  <td style={ui.td} />
                </tr>
              )
            })
          }

          return rows
        })}
      </TableShell>

      {commentEdit ? (
        <CommentEditorModal
          value={commentEdit.comment}
          onCancel={() => setCommentEdit(null)}
          onSave={async (comment) => {
            const entry = entries.find((item) => item.id === commentEdit.id)
            if (!entry) return
            const nextProducts = entry.products.map((product, index) =>
              index === commentEdit.pidx ? { ...product, comment } : product
            )
            try {
              const saved = await finishedGoodsApi.update(entry.id, { products: nextProducts })
              setEntries((prev) => prev.map((item) => item.id === entry.id ? normalizeEntry(saved) : item))
              setCommentEdit(null)
            } catch (err) {
              setLoadError(err?.message || 'Unable to update comment')
            }
          }}
        />
      ) : null}

      {showReport ? (
        <ReportModal
          title="Finished Goods"
          data={reportRows}
          dateKey="date"
          columns={[
            { key: 'brand', label: 'Brand', rowSpan: true },
            { key: 'date', label: 'Date', rowSpan: true },
            { key: 'product', label: 'Product' },
            { key: 'packing', label: 'Packing' },
            { key: 'cartons', label: 'Cartons' },
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

const filterCard = {
  backgroundColor: '#f2f4f2',
  borderRadius: 20,
  padding: 14,
  border: '1px solid #e2e8e2',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
}
