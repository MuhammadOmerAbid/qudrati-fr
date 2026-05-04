'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Save, X } from 'lucide-react'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { PACKINGS, PRODUCTS } from '@/components/store/shared/StoreShared'
import { incrementStoreEntries } from '@/application/services/store/storeEntryTracker'
import { StoreThemeDatePicker, StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'

const PRODUCTION_ORDER_DRAFT_KEY = 'store.productionOrderDrafts'

const todayISO = () => new Date().toISOString().slice(0, 10)
const blankItem = (sr) => ({ sr, goods: '', packing: '', qty: '', status: 'Pending' })

export default function ProductionOrderNewPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [date, setDate] = useState(todayISO())
  const [items, setItems] = useState([blankItem(1)])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mobileQuery = window.matchMedia('(max-width: 640px)')
    const apply = () => setIsMobile(mobileQuery.matches)
    apply()
    mobileQuery.addEventListener('change', apply)
    return () => mobileQuery.removeEventListener('change', apply)
  }, [])

  const updateItem = (index, key, value) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)))
    setErrors((prev) => ({ ...prev, items: undefined }))
  }

  const addItem = () => setItems((prev) => [...prev, blankItem(prev.length + 1)])

  const removeItem = (index) => {
    setItems((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((item, idx) => ({ ...item, sr: idx + 1 }))
    )
  }

  const validate = () => {
    const nextErrors = {}
    const cleanItems = items
      .map((item, index) => ({
        ...item,
        sr: index + 1,
        qty: Number(item.qty) || 0,
      }))
      .filter((item) => item.goods && item.packing)

    if (!cleanItems.length) nextErrors.items = 'Add at least one complete order item'
    setErrors(nextErrors)
    return { valid: Object.keys(nextErrors).length === 0, cleanItems }
  }

  const handleSave = async () => {
    const { valid, cleanItems } = validate()
    if (!valid) return

    setSaving(true)
    try {
      const payload = {
        id: Date.now(),
        name: name.trim() || `Order-${Date.now().toString().slice(-4)}`,
        date,
        items: cleanItems,
      }

      const raw = window.sessionStorage.getItem(PRODUCTION_ORDER_DRAFT_KEY)
      const existing = raw ? JSON.parse(raw) : []
      window.sessionStorage.setItem(PRODUCTION_ORDER_DRAFT_KEY, JSON.stringify([payload, ...existing]))
      incrementStoreEntries('production-order')
      router.push('/production-order')
    } catch {
      setSaving(false)
    }
  }

  const goodsOptions = [...new Set(Object.values(PRODUCTS).flat())]

  return (
    <DashboardLayout>
      <div style={{ ...s.wrapper, maxWidth: isMobile ? '100%' : 1060 }}>
        <div style={s.pageHeader}>
          <div style={{ ...s.headerLeft, width: isMobile ? '100%' : 'auto' }}>
            <button type="button" style={s.backBtn} onClick={() => router.push('/production-order')}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...s.pageTitle, fontSize: isMobile ? 20 : 30 }}>Create Production Order</h1>
              <p style={{ ...s.pageSubtitle, fontSize: isMobile ? 12 : 13.5 }}>Create a production order with one or more line items</p>
            </div>
          </div>
          <button type="button" style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save Order'}
          </button>
        </div>

        <div style={{ ...s.card, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 14 : 20 }}>
          <div style={s.formRow}>
            <div style={s.formCol}>
              <label style={s.label}>Order Name</label>
              <input
                style={s.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter order name"
              />
            </div>
            <div style={{ ...s.formCol, maxWidth: isMobile ? '100%' : 240 }}>
              <label style={s.label}>Date</label>
              <StoreThemeDatePicker value={date} onChange={setDate} placeholder="Select date" variant="input" />
            </div>
          </div>

          <div style={s.divider} />

          <div style={s.itemHeader}>
            <p style={s.sectionTitle}>Order Items</p>
            <button type="button" style={s.addBtn} onClick={addItem}>
              <Plus size={14} /> Add Item
            </button>
          </div>

          {errors.items ? <p style={s.errorBanner}>{errors.items}</p> : null}

          {items.map((item, idx) => (
            <div key={`row-${idx}`} style={s.itemCard}>
              <div style={s.itemTop}>
                <span style={s.itemTitle}>Item {idx + 1}</span>
                {items.length > 1 ? (
                  <button type="button" style={s.removeBtn} onClick={() => removeItem(idx)}>
                    <X size={13} />
                  </button>
                ) : null}
              </div>

              <div style={s.formRow}>
                <div style={s.formCol}>
                  <label style={s.label}>Goods</label>
                  <StoreThemeDropdown
                    value={item.goods}
                    onChange={(nextValue) => updateItem(idx, 'goods', nextValue)}
                    variant="input"
                    placeholder="Select goods"
                    options={[
                      { value: '', label: 'Select goods' },
                      ...goodsOptions.map((entry) => ({ value: entry, label: entry })),
                    ]}
                  />
                </div>
                <div style={s.formCol}>
                  <label style={s.label}>Packing</label>
                  <StoreThemeDropdown
                    value={item.packing}
                    onChange={(nextValue) => updateItem(idx, 'packing', nextValue)}
                    variant="input"
                    placeholder="Select packing"
                    options={[
                      { value: '', label: 'Select packing' },
                      ...PACKINGS.map((entry) => ({ value: entry, label: entry })),
                    ]}
                  />
                </div>
                <div style={{ ...s.formCol, maxWidth: isMobile ? '100%' : 180 }}>
                  <label style={s.label}>Cartons</label>
                  <input
                    type="number"
                    min={0}
                    style={s.input}
                    value={item.qty}
                    onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <div style={s.footer}>
            <button type="button" style={{ ...s.cancelBtn, width: isMobile ? '100%' : 'auto' }} onClick={() => router.push('/production-order')}>
              Cancel
            </button>
            <button type="button" style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
              <Save size={15} /> {saving ? 'Saving...' : 'Save Order'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

const s = {
  wrapper: {
    maxWidth: 1060,
    margin: '0 auto',
  },
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 14,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 40,
    border: '1.5px solid #d4dfd4',
    background: '#ffffff',
    color: '#2d7a33',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  pageTitle: {
    margin: '0 0 4px',
    display: 'flex',
    alignItems: 'center',
    fontSize: 30,
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: '-0.6px',
    color: '#1a3d1f',
  },
  pageSubtitle: {
    margin: 0,
    fontSize: 13.5,
    color: '#7a8a7a',
    fontWeight: 500,
  },
  card: {
    background: '#f2f4f2',
    border: '1px solid #e2e8e2',
    borderRadius: 20,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    padding: 20,
  },
  formRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  formCol: {
    flex: 1,
    minWidth: 220,
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 700,
    color: '#607062',
  },
  input: {
    width: '100%',
    border: '1px solid #d4dfd4',
    borderRadius: 10,
    background: '#ffffff',
    color: '#1f2f21',
    padding: '9px 11px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  },
  divider: {
    height: 1,
    background: '#d4dfd4',
    margin: '16px 0 14px',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: '#1f2f21',
  },
  itemCard: {
    background: '#ffffff',
    border: '1px solid #d4dfd4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  itemTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#607062',
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1.5px solid #d4dfd4',
    borderRadius: 40,
    background: '#ffffff',
    color: '#2d7a33',
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 14px',
    cursor: 'pointer',
  },
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 40,
    background: '#54B45B',
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: 700,
    padding: '11px 20px',
    cursor: 'pointer',
  },
  saveBtnDisabled: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 40,
    background: '#b8dcbc',
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: 700,
    padding: '11px 20px',
    cursor: 'not-allowed',
  },
  cancelBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid #d4dfd4',
    borderRadius: 40,
    background: '#ffffff',
    color: '#2d7a33',
    fontSize: 13.5,
    fontWeight: 600,
    padding: '11px 20px',
    cursor: 'pointer',
  },
  footer: {
    marginTop: 16,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  errorBanner: {
    margin: '0 0 10px',
    background: '#fff1f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: 12.5,
    borderRadius: 10,
    padding: '8px 12px',
  },
}


