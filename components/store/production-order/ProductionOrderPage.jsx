'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, FileText, Pencil, Trash2, RefreshCw, X } from 'lucide-react'
import {
  STATUS_COLORS,
  formatDate,
  Checkbox,
  AppButton,
  TableShell,
  ReportModal,
  SectionHeader,
  ui,
} from '@/components/store/shared/StoreShared'
import { StoreThemeDatePicker, StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'
import { finishedGoodsApi, packagingApi, productionOrderApi } from '@/infrastructure/api/endpoints'

const toList = (value) => (Array.isArray(value) ? value : (value?.results || []))
const normalizeOrder = (order = {}, index = 0) => ({
  id: order.id,
  serialNo: order.serialNo ?? order.serial_no ?? index + 1,
  name: order.name || order.product?.name || '',
  date: order.date || '',
  status: order.status || 'Pending',
  items: Array.isArray(order.items) ? order.items.map((item, itemIndex) => ({
    id: item.id ?? item.sr ?? itemIndex + 1,
    sr: item.sr ?? itemIndex + 1,
    goods: item.goods || item.product || item.name || '',
    packing: item.packing || '',
    qty: item.qty ?? item.quantity ?? 0,
    status: item.status || order.status || 'Pending',
  })) : [],
})

function parseDateValue(value) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export default function ProductionOrderPage({ isSuperUser = true }) {
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All Status')
  const [filterGoods, setFilterGoods] = useState('All Goods')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [selected, setSelected] = useState([])
  const [showReport, setShowReport] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editor, setEditor] = useState({
    id: null,
    name: '',
    date: new Date().toISOString().slice(0, 10),
    items: [{ sr: 1, goods: '', packing: '', qty: '', status: 'Pending' }],
  })
  const [editorGoodsOptions, setEditorGoodsOptions] = useState([])
  const [editorPackingOptions, setEditorPackingOptions] = useState([])

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    if (!showEditor) return
    let active = true
    Promise.all([finishedGoodsApi.list(), packagingApi.list()]).then(([goodsRes, packingRes]) => {
      if (!active) return
      const goods = toList(goodsRes)
        .map((entry) => {
          const name = String(entry?.brand || entry?.name || '').trim()
          return name ? { value: name, label: name } : null
        })
        .filter(Boolean)
      const seen = new Set()
      const uniqueGoods = goods.filter(({ value }) => {
        const k = value.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      const packing = toList(packingRes)
        .map((entry) => {
          const name = String(entry?.name || entry?.packing || entry || '').trim()
          return name ? { value: name, label: name } : null
        })
        .filter(Boolean)
      setEditorGoodsOptions(uniqueGoods)
      setEditorPackingOptions(packing)
    }).catch(() => {})
    return () => { active = false }
  }, [showEditor])

  const loadOrders = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await productionOrderApi.list()
      const loaded = toList(data).map(normalizeOrder).filter((order) => order.items.length > 0)
      setOrders(loaded)
    } catch (err) {
      setLoadError(err?.message || 'Unable to load production orders')
    } finally {
      setLoading(false)
    }
  }

  const goodsOptions = useMemo(() => {
    const goods = orders.flatMap((order) => order.items.map((item) => item.goods)).filter(Boolean)
    return Array.from(new Set(goods)).sort((a, b) => a.localeCompare(b))
  }, [orders])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return orders.filter((order) => {
      const text = [order.name, order.date, ...order.items.map((item) => `${item.goods} ${item.packing} ${item.status}`)]
        .join(' ')
        .toLowerCase()
      const matchesSearch = !q.trim() || text.includes(q)
      const matchesStatus = filterStatus === 'All Status' || order.items.some((item) => item.status === filterStatus)
      const matchesGoods = filterGoods === 'All Goods' || order.items.some((item) => item.goods === filterGoods)
      const rowDate = parseDateValue(order.date)
      const fromDate = filterDateFrom ? new Date(`${filterDateFrom}T00:00:00`) : null
      const toDate = filterDateTo ? new Date(`${filterDateTo}T23:59:59`) : null
      const matchesFrom = !fromDate || (rowDate && rowDate >= fromDate)
      const matchesTo = !toDate || (rowDate && rowDate <= toDate)
      return matchesSearch && matchesStatus && matchesGoods && matchesFrom && matchesTo
    })
  }, [orders, search, filterStatus, filterGoods, filterDateFrom, filterDateTo])

  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach((order) => {
      const key = formatDate(order.date)
      if (!map[key]) map[key] = []
      map[key].push(order)
    })
    return map
  }, [filtered])

  const reportOrders = selected.length > 0 ? orders.filter((order) => selected.includes(order.id)) : filtered

  const reportRows = useMemo(
    () =>
      reportOrders.flatMap((order) =>
        order.items.map((item) => ({
          _groupId: order.id,
          date: order.date,
          orderName: order.name,
          serialNo: item.sr,
          goods: item.goods,
          packing: item.packing,
          qty: item.qty,
          status: item.status,
        }))
      ),
    [reportOrders]
  )

  const openEditEditor = (order) => {
    setEditor({ ...order, items: order.items.map((item) => ({ ...item })) })
    setShowEditor(true)
  }

  const openNewEditor = () => {
    router.push('/production-order/new')
  }

  const saveOrder = async () => {
    const cleanedItems = editor.items
      .map((item, idx) => ({ ...item, sr: idx + 1, qty: Number(item.qty) || 0 }))
      .filter((item) => item.goods && item.packing)

    if (!cleanedItems.length) return

    if (editor.id) {
      try {
        const saved = await productionOrderApi.update(editor.id, {
          name: editor.name,
          date: editor.date,
          status: cleanedItems.some((item) => item.status !== 'Completed') ? 'Pending' : 'Completed',
          items: cleanedItems,
        })
        setOrders((prev) =>
          prev.map((order) => (order.id === editor.id ? normalizeOrder(saved) : order))
        )
      } catch (err) {
        setLoadError(err?.message || 'Unable to update production order')
        return
      }
    }

    setShowEditor(false)
  }

  const toggleSelection = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]))
  }

  return (
    <div style={ui.pageWrap}>
      <SectionHeader
        title="Production Orders"
        subtitle="Track production order batches and item status"
        actions={(
          <>
            <AppButton onClick={loadOrders}>
              <RefreshCw size={14} />
            </AppButton>
            <AppButton onClick={() => setShowReport(true)}>
              <FileText size={14} /> View Report
            </AppButton>
            <AppButton
              type="primary"
              style={{ background: 'linear-gradient(90deg, #1B5E20 0%, #2E7D32 45%, #4CAF50 100%)', border: 'none', color: '#fff' }}
              onClick={openNewEditor}
            >
              <Plus size={14} /> Add Production Order
            </AppButton>
          </>
        )}
      />

      {loadError ? <div style={errorBanner}>{loadError}</div> : null}

      <div style={filterCard}>
        <div style={ui.filtersRow}>
          <StoreThemeDropdown
            value={filterStatus}
            onChange={setFilterStatus}
            placeholder="All Status"
            variant="pill"
            options={[
              { value: 'All Status', label: 'All Status' },
              ...Object.keys(STATUS_COLORS).map((status) => ({ value: status, label: status })),
            ]}
          />
          <StoreThemeDropdown
            value={filterGoods}
            onChange={setFilterGoods}
            placeholder="All Goods"
            variant="pill"
            options={[
              { value: 'All Goods', label: 'All Goods' },
              ...goodsOptions.map((goods) => ({ value: goods, label: goods })),
            ]}
          />
          <StoreThemeDatePicker value={filterDateFrom} onChange={setFilterDateFrom} placeholder="From Date" variant="pill" />
          <StoreThemeDatePicker value={filterDateTo} onChange={setFilterDateTo} placeholder="To Date" variant="pill" alignRight />
        </div>
        <div style={{ ...ui.searchWrap, marginTop: 12 }}>
          <Search size={15} color="#7a8a7a" />
          <input
            style={ui.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order name, goods, packing or status"
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
                    prev.length === filtered.length ? [] : filtered.map((order) => order.id)
                  )
                }
              />
            ),
          },
          { key: 'name', label: 'Name' },
          { key: 'serial', label: 'P.Sr' },
          { key: 'goods', label: 'Goods' },
          { key: 'packing', label: 'Packing' },
          { key: 'qty', label: 'Qty of Cartons' },
          { key: 'date', label: 'Date' },
          { key: 'status', label: 'Status' },
          { key: 'actions', label: 'Actions', align: 'right' },
        ]}
        emptyColSpan={filtered.length === 0 ? 9 : null}
        emptyText={loading ? 'Loading production orders...' : 'No production orders found'}
      >
        {Object.entries(grouped).flatMap(([dateKey, dayOrders]) => {
          const rows = []
          rows.push(
            <tr key={`date-${dateKey}`}>
              <td colSpan={9} style={ui.dateRow}>{dateKey}</td>
            </tr>
          )

          dayOrders.forEach((order) => {
            order.items.forEach((item, index) => {
              rows.push(
                <tr key={`${order.id}-${item.sr}`}>
                  <td style={ui.td}>
                    {index === 0 ? (
                      <Checkbox checked={selected.includes(order.id)} onChange={() => toggleSelection(order.id)} />
                    ) : null}
                  </td>
                  <td style={{ ...ui.td, fontWeight: index === 0 ? 700 : 400 }}>{index === 0 ? order.name : ''}</td>
                  <td style={ui.td}>{item.sr}</td>
                  <td style={ui.td}>{item.goods}</td>
                  <td style={ui.td}>{item.packing}</td>
                  <td style={{ ...ui.td, fontWeight: 700 }}>{item.qty}</td>
                  <td style={ui.td}>{index === 0 ? formatDate(order.date) : ''}</td>
                  <td style={ui.td}>
                    <StoreThemeDropdown
                      value={item.status}
                      onChange={(status) => {
                        productionOrderApi.updateItemStatus(order.id, item.id ?? item.sr, status).catch((err) => {
                          setLoadError(err?.message || 'Unable to update item status')
                        })
                        setOrders((prev) =>
                          prev.map((entry) =>
                            entry.id === order.id
                              ? {
                                  ...entry,
                                  items: entry.items.map((orderItem) =>
                                    orderItem.sr === item.sr ? { ...orderItem, status } : orderItem
                                  ),
                                }
                              : entry
                          )
                        )
                      }}
                      options={['Pending', 'In Progress', 'Completed'].map((entry) => ({ value: entry, label: entry }))}
                      variant="input"
                      compact
                      triggerStyle={{
                        minWidth: 118,
                        minHeight: 28,
                        borderRadius: 999,
                        padding: '5px 24px 5px 9px',
                        fontSize: 11,
                        fontWeight: 700,
                        ...(STATUS_COLORS[item.status] || {}),
                      }}
                    />
                  </td>
                  <td style={{ ...ui.td, textAlign: 'right' }}>
                    {index === 0 ? (
                      <div style={ui.inlineActionsRight}>
                        <button type="button" style={ui.iconButton} onClick={() => openEditEditor(order)}>
                          <Pencil size={13} />
                        </button>
                        {isSuperUser ? (
                          <button
                            type="button"
                            style={ui.iconDangerButton}
                            onClick={async () => {
                              if (!window.confirm('Delete this production order?')) return
                              try {
                                await productionOrderApi.delete(order.id)
                                setOrders((prev) => prev.filter((entry) => entry.id !== order.id))
                              } catch (err) {
                                setLoadError(err?.message || 'Unable to delete production order')
                              }
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              )
            })
          })

          return rows
        })}
      </TableShell>

      {showEditor ? (
        <div style={ui.overlay}>
          <div style={ui.modal}>
            <div style={ui.modalHeaderTop}>
              <div>
                <h3 style={ui.modalTitle}>Edit Production Order</h3>
                <p style={ui.modalSub}>Serial number is assigned automatically</p>
              </div>
              <AppButton onClick={() => setShowEditor(false)} style={ui.iconBtnOnly}>
                <X size={16} />
              </AppButton>
            </div>

            <div style={ui.formRow}>
              <div style={ui.formCol}>
                <label style={ui.label}>Order Name</label>
                <input
                  style={ui.input}
                  value={editor.name}
                  onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter order name"
                />
              </div>
              <div style={{ ...ui.formCol, maxWidth: 220 }}>
                <label style={ui.label}>Date</label>
                <StoreThemeDatePicker
                  value={editor.date}
                  onChange={(nextDate) => setEditor((prev) => ({ ...prev, date: nextDate }))}
                  placeholder="Select date"
                  variant="input"
                />
              </div>
            </div>

            <hr style={ui.divider} />

            {editor.items.map((item, idx) => (
              <div key={`item-${idx}`} style={ui.itemRow}>
                <div style={ui.itemRowTop}>
                  <span style={ui.itemTitle}>Order Item {idx + 1}</span>
                  {editor.items.length > 1 ? (
                    <button
                      type="button"
                      style={ui.iconDangerButton}
                      onClick={() =>
                        setEditor((prev) => ({
                          ...prev,
                          items: prev.items
                            .filter((_, index) => index !== idx)
                            .map((entry, index) => ({ ...entry, sr: index + 1 })),
                        }))
                      }
                    >
                      <X size={13} />
                    </button>
                  ) : null}
                </div>
                <div style={ui.formRow}>
                  <div style={ui.formCol}>
                    <label style={ui.label}>Goods</label>
                    <StoreThemeDropdown
                      value={item.goods}
                      onChange={(nextGoods) =>
                        setEditor((prev) => ({
                          ...prev,
                          items: prev.items.map((entry, index) =>
                            index === idx ? { ...entry, goods: nextGoods } : entry
                          ),
                        }))
                      }
                      variant="input"
                      placeholder="Select goods"
                      options={[
                        { value: '', label: 'Select goods' },
                        ...editorGoodsOptions,
                      ]}
                    />
                  </div>
                  <div style={ui.formCol}>
                    <label style={ui.label}>Packing</label>
                    <StoreThemeDropdown
                      value={item.packing}
                      onChange={(nextPacking) =>
                        setEditor((prev) => ({
                          ...prev,
                          items: prev.items.map((entry, index) =>
                            index === idx ? { ...entry, packing: nextPacking } : entry
                          ),
                        }))
                      }
                      variant="input"
                      placeholder="Select packing"
                      options={[
                        { value: '', label: 'Select packing' },
                        ...editorPackingOptions,
                      ]}
                    />
                  </div>
                  <div style={{ ...ui.formCol, maxWidth: 140 }}>
                    <label style={ui.label}>Cartons</label>
                    <input
                      type="number"
                      min={0}
                      style={ui.input}
                      value={item.qty}
                      onChange={(e) =>
                        setEditor((prev) => ({
                          ...prev,
                          items: prev.items.map((entry, index) =>
                            index === idx ? { ...entry, qty: e.target.value } : entry
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <AppButton
              onClick={() =>
                setEditor((prev) => ({
                  ...prev,
                  items: [
                    ...prev.items,
                    { sr: prev.items.length + 1, goods: '', packing: '', qty: '', status: 'Pending' },
                  ],
                }))
              }
              style={ui.addLineButton}
            >
              <Plus size={14} /> Add Item
            </AppButton>

            <div style={ui.modalActionsEnd}>
              <AppButton onClick={() => setShowEditor(false)}>Cancel</AppButton>
              <AppButton type="primary" onClick={saveOrder}>Update Order</AppButton>
            </div>
          </div>
        </div>
      ) : null}

      {showReport ? (
        <ReportModal
          title="Production Orders"
          data={reportRows}
          dateKey="date"
          columns={[
            { key: 'orderName', label: 'Order Name', rowSpan: true },
            { key: 'serialNo', label: 'P.Sr' },
            { key: 'date', label: 'Date', rowSpan: true },
            { key: 'goods', label: 'Goods' },
            { key: 'packing', label: 'Packing' },
            { key: 'qty', label: 'Qty of Cartons' },
            { key: 'status', label: 'Status' },
          ]}
          onClose={() => setShowReport(false)}
        />
      ) : null}
    </div>
  )
}

const filterCard = {
  backgroundColor: '#f2f4f2',
  borderRadius: 20,
  padding: 14,
  border: '1px solid #e2e8e2',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
}
