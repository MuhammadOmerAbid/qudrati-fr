'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, FileText, Pencil, Trash2, RefreshCw, X } from 'lucide-react'
import {
  PRODUCTION_INITIAL,
  PRODUCTS,
  PACKINGS,
  STATUS_COLORS,
  nextSerial,
  formatDate,
  Checkbox,
  AppButton,
  TableShell,
  ReportModal,
  SectionHeader,
  ui,
} from '@/components/store/shared/StoreShared'
import { StoreThemeDatePicker, StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'

const PRODUCTION_ORDER_DRAFT_KEY = 'store.productionOrderDrafts'

export default function ProductionOrderPage({ isSuperUser = true }) {
  const router = useRouter()
  const [orders, setOrders] = useState(PRODUCTION_INITIAL)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [showReport, setShowReport] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editor, setEditor] = useState({
    id: null,
    name: '',
    date: new Date().toISOString().slice(0, 10),
    items: [{ sr: 1, goods: '', packing: '', qty: '', status: 'Pending' }],
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const raw = window.sessionStorage.getItem(PRODUCTION_ORDER_DRAFT_KEY)
      if (!raw) return

      const drafts = JSON.parse(raw)
      if (!Array.isArray(drafts) || drafts.length === 0) return

      setOrders((prev) => {
        let serialNo = nextSerial(prev)
        const prepared = drafts.map((draft, index) => ({
          ...draft,
          id: draft.id || Date.now() + index,
          serialNo: serialNo++,
        }))
        return [...prepared, ...prev]
      })
    } catch {
      // Ignore malformed session data.
    } finally {
      window.sessionStorage.removeItem(PRODUCTION_ORDER_DRAFT_KEY)
    }
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return orders
    const q = search.toLowerCase()
    return orders.filter((order) =>
      [order.name, ...order.items.map((item) => `${item.goods} ${item.packing} ${item.status}`)]
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [orders, search])

  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach((order) => {
      const key = formatDate(order.date)
      if (!map[key]) map[key] = []
      map[key].push(order)
    })
    return map
  }, [filtered])

  const reportRows = useMemo(
    () =>
      orders.flatMap((order) =>
        order.items.map((item) => ({
          date: order.date,
          orderName: order.name,
          serialNo: order.serialNo,
          goods: item.goods,
          packing: item.packing,
          qty: item.qty,
          status: item.status,
        }))
      ),
    [orders]
  )

  const openEditEditor = (order) => {
    setEditor({ ...order, items: order.items.map((item) => ({ ...item })) })
    setShowEditor(true)
  }

  const openNewEditor = () => {
    router.push('/production-order/new')
  }

  const saveOrder = () => {
    const cleanedItems = editor.items
      .map((item, idx) => ({ ...item, sr: idx + 1, qty: Number(item.qty) || 0 }))
      .filter((item) => item.goods && item.packing)

    if (!cleanedItems.length) return

    if (editor.id) {
      setOrders((prev) =>
        prev.map((order) => (order.id === editor.id ? { ...editor, items: cleanedItems } : order))
      )
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
            <AppButton onClick={() => setOrders([...PRODUCTION_INITIAL])}>
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

      <div style={ui.searchWrap}>
        <Search size={15} color="#7a8a7a" />
        <input
          style={ui.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order name, goods, packing or status"
        />
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
        emptyText="No production orders found"
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
                            onClick={() => setOrders((prev) => prev.filter((entry) => entry.id !== order.id))}
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
                        ...[...new Set(Object.values(PRODUCTS).flat())].map((entry) => ({ value: entry, label: entry })),
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
                        ...PACKINGS.map((entry) => ({ value: entry, label: entry })),
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
            { key: 'orderName', label: 'Order Name' },
            { key: 'serialNo', label: 'P.Sr' },
            { key: 'date', label: 'Date' },
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
