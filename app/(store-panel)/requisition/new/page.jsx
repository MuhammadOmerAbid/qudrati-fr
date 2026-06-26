'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { ArrowLeft, Save, Plus, X } from 'lucide-react'
import { incrementStoreEntries } from '@/application/services/store/storeEntryTracker'
import {
  StoreThemeDatePicker,
  StoreThemeDropdown,
  focusNextKeyboardCell,
  handleKeyboardCellEnter,
  keyboardCellTriggerProps,
} from '@/components/store/shared/StoreThemeControls'
import { brandsApi, inventoryApi, requisitionApi } from '@/infrastructure/api/endpoints'
import { useAuthStore } from '@/application/state/auth/useAuthStore'


const todayISO = () => new Date().toISOString().split('T')[0]
const blankItem = () => ({ key: Date.now() + Math.random(), productId: '', quantity: '' })
const toList = (value) => (Array.isArray(value) ? value : (value?.results || []))

export default function RequisitionNewPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [products, setProducts] = useState([])
  const [brands, setBrands] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadWarning, setLoadWarning] = useState('')

  const [receiverName, setReceiverName] = useState('')
  const [date, setDate]                 = useState(todayISO())
  const [comment, setComment]           = useState('')
  const [items, setItems]               = useState([blankItem()])
  const [saving, setSaving]             = useState(false)
  const [errors, setErrors]             = useState({})
  const [isMobile, setIsMobile]         = useState(false)

  const COMMENT_LIMIT = 500

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoadingProducts(true)
      setLoadWarning('')
      try {
        const [res, brandsRes] = await Promise.all([
          inventoryApi.list(),
          brandsApi.list(),
        ])
        const rows = toList(res)
        if (active) {
          setProducts(rows)
          setBrands(toList(brandsRes))
        }
      } catch {
        if (active) {
          setProducts([])
          setBrands([])
          setLoadWarning('Unable to load Inventory from backend. Showing fallback options.')
        }
      } finally {
        if (active) setLoadingProducts(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mobileQuery = window.matchMedia('(max-width: 640px)')
    const apply = () => setIsMobile(mobileQuery.matches)
    apply()
    mobileQuery.addEventListener('change', apply)
    return () => mobileQuery.removeEventListener('change', apply)
  }, [])

  const productOptions = useMemo(() => {
    const brandNameById = new Map(brands.map((brand) => [String(brand.id), brand.name]))
    const apiOptions = products.map((p) => ({
      id: p.id,
      name: p.product || p.name,
      brand: p.brand_name || brandNameById.get(String(p.brand)) || p.brand || '',
      category: p.category || p.category_name || '',
      subCategory: p.subcategory || p.subCategory || p.sub_category || '',
      unit: p.unit || 'Unit',
      available: Number(p.quantity),
    }))
    return apiOptions
  }, [brands, products])

  const getProduct = (id) => productOptions.find(p => String(p.id) === String(id))
  const selectedIds = items.map(i => String(i.productId)).filter(Boolean)

  const updateItem = (key, field, value) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i))
    setErrors(e => ({ ...e, items: undefined }))
  }
  const addItem    = () => setItems(prev => [...prev, blankItem()])
  const removeItem = (key) => setItems(prev => prev.filter(i => i.key !== key))

  const validate = () => {
    const e = {}
    if (!receiverName.trim()) e.receiverName = 'Receiver name is required'
    const incomplete = items.some(i => !i.productId || !i.quantity || Number(i.quantity) <= 0)
    if (incomplete) e.items = 'Please complete all product rows'

    const overAvailable = items.find((item) => {
      const prod = getProduct(item.productId)
      return prod && Number.isFinite(prod.available) && Number(item.quantity || 0) > prod.available
    })
    if (overAvailable) {
      const prod = getProduct(overAvailable.productId)
      e.items = `${prod.name}: quantity cannot be more than available stock (${prod.available} ${prod.unit})`
    }

    const totals = items.reduce((acc, item) => {
      if (!item.productId) return acc
      acc[item.productId] = (acc[item.productId] || 0) + Number(item.quantity || 0)
      return acc
    }, {})
    const duplicateOverAvailable = Object.entries(totals).find(([productId, total]) => {
      const prod = getProduct(productId)
      return prod && Number.isFinite(prod.available) && total > prod.available
    })
    if (duplicateOverAvailable) {
      const prod = getProduct(duplicateOverAvailable[0])
      e.items = `${prod.name}: total requested quantity cannot be more than available stock (${prod.available} ${prod.unit})`
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        receiver_name: receiverName.trim(),
        entry_by: user?.username || '',
        entry_date: date,
        comment: String(comment || '').trim(),
        items: items.map((row) => {
          const prod = getProduct(row.productId)
          return {
            productId: prod?.id ?? row.productId,
            inventoryItemId: prod?.id ?? row.productId,
            inventory_item_id: prod?.id ?? row.productId,
            productName: prod?.name || '',
            brand: prod?.brand || '',
            brandName: prod?.brand || '',
            subCategory: prod?.subCategory || '',
            category: prod?.category || '',
            quantity: Number(row.quantity),
            unit: prod?.unit || 'Unit',
            returned: 0,
          }
        }),
      }
      await requisitionApi.create(payload)
      incrementStoreEntries('goods-requisition')
      router.push('/requisition')
    } catch (err) {
      setErrors((prev) => ({ ...prev, form: err?.message || 'Unable to save requisition' }))
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div style={{ ...s.wrapper, maxWidth: isMobile ? '100%' : 960 }}>

        {/* Page Header */}
        <div style={s.pageHeader}>
          <div style={{ ...s.headerLeft, width: isMobile ? '100%' : 'auto' }}>
            <button style={s.backBtn} onClick={() => router.push('/requisition')}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...s.pageTitle, fontSize: isMobile ? 20 : 30 }}>Add Goods Requisition</h1>
              <p style={{ ...s.pageSubtitle, fontSize: isMobile ? 12 : 13.5 }}>Create a new goods requisition entry</p>
            </div>
          </div>
          <button style={{ ...(saving ? s.saveBtnDis : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'SAVE'}
          </button>
        </div>

        {/* Form Card */}
        <div style={{ ...s.card, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 14 : 24 }}>
          {loadWarning ? <div style={s.itemsError}>{loadWarning}</div> : null}
          {errors.form ? <div style={s.itemsError}>{errors.form}</div> : null}

          {/* Row 1: Receiver Name + Date */}
          <div style={{ ...s.topRow, gridTemplateColumns: isMobile ? '1fr' : s.topRow.gridTemplateColumns }}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Receiver Name:</label>
              <input
                style={{ ...s.input, ...(errors.receiverName ? s.inputError : {}) }}
                placeholder="Enter receiver name"
                value={receiverName}
                onChange={e => { setReceiverName(e.target.value); setErrors(er => ({ ...er, receiverName: undefined })) }}
              />
              {errors.receiverName && <span style={s.errorText}>{errors.receiverName}</span>}
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Date:</label>
              <StoreThemeDatePicker value={date} onChange={setDate} placeholder="Select date" variant="input" />
            </div>
          </div>

          {/* Product Section Header */}
          <div style={s.sectionHeader}>
            <label style={s.label}>Select Product:</label>
          </div>

          {errors.items && <div style={s.itemsError}>{errors.items}</div>}

          {/* Column Headers */}
          {!isMobile ? <div style={s.colHeaderRow}>
            <div style={{ flex: 2 }}><span style={s.subLabel}>Product</span></div>
            <div style={{ flex: 1 }}><span style={s.subLabel}>Brand</span></div>
            <div style={{ flex: 1 }}><span style={s.subLabel}>Sub-Category / Type</span></div>
            <div style={{ flex: 1 }}><span style={s.subLabel}>Category</span></div>
            <div style={{ flex: '0 0 110px' }}><span style={s.subLabel}>Quantity</span></div>
            <div style={{ flex: '0 0 80px' }}><span style={s.subLabel}>Unit</span></div>
            <div style={{ flex: '0 0 36px' }} />
          </div> : null}

          {/* Product Rows */}
          {items.map((item) => {
            const prod = getProduct(item.productId)
            const availableProducts = productOptions.filter(
              (p) => !selectedIds.includes(String(p.id)) || String(p.id) === String(item.productId)
            )

            return (
              <div key={item.key} style={{ ...s.productRow, flexWrap: isMobile ? 'wrap' : 'nowrap' }} data-keyboard-cell-scope>

                {/* Product dropdown */}
                <div style={{ ...s.itemField, flex: isMobile ? '1 1 100%' : 2 }}>
                  <StoreThemeDropdown
                    value={item.productId}
                    onChange={(nextProductId) => updateItem(item.key, 'productId', String(nextProductId))}
                    onSelectComplete={(_, __, triggerEl) => focusNextKeyboardCell(triggerEl)}
                    variant="input"
                    triggerProps={keyboardCellTriggerProps}
                    placeholder={loadingProducts ? 'Loading products...' : 'Select Product'}
                    options={[
                      { value: '', label: loadingProducts ? 'Loading products...' : 'Select Product' },
                      ...availableProducts.map((p) => ({
                        value: String(p.id),
                        label: `${p.name}${p.brand ? ` (${p.brand})` : ''}`,
                      })),
                    ]}
                  />
                </div>

                {/* Brand (auto from product/settings) */}
                <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : 1 }}>
                  <div style={s.typeDisplay}>
                    {prod
                      ? <span style={s.brandBadge}>{prod.brand || '-'}</span>
                      : <span style={s.typePlaceholder}>-</span>}
                  </div>
                </div>

                {/* Sub-Category / Type (auto from product) */}
                <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : 1 }}>
                  <div style={s.typeDisplay}>
                    {prod
                      ? <span style={s.subCatBadge}>{prod.subCategory}</span>
                      : <span style={s.typePlaceholder}>—</span>}
                  </div>
                </div>

                {/* Category (auto from product) */}
                <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : 1 }}>
                  <div style={s.typeDisplay}>
                    {prod
                      ? <span style={s.catBadge}>{prod.category}</span>
                      : <span style={s.typePlaceholder}>—</span>}
                  </div>
                </div>

                {/* Quantity */}
                <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : '0 0 110px' }}>
                  <input
                    style={s.input}
                    type="number"
                    min="1"
                    max={Number.isFinite(prod?.available) ? prod.available : undefined}
                    data-keyboard-cell
                    placeholder="Qty"
                    value={item.quantity}
                    onKeyDown={handleKeyboardCellEnter}
                    onChange={e => updateItem(item.key, 'quantity', e.target.value)}
                  />
                  {prod && Number.isFinite(prod.available) ? (
                    <span style={s.stockHint}>Available: {prod.available} {prod.unit}</span>
                  ) : null}
                </div>

                {/* Unit (read-only from product) */}
                <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : '0 0 80px' }}>
                  <div style={s.unitDisplay}>{prod?.unit || '—'}</div>
                </div>

                {/* Remove Button */}
                <div style={{ ...s.itemField, flex: isMobile ? '1 1 100%' : '0 0 36px', alignSelf: isMobile ? 'flex-start' : 'center' }}>
                  {items.length > 1 && (
                    <button style={s.removeBtn} onClick={() => removeItem(item.key)} title="Remove">
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Selected Products Summary */}
          <div style={s.selectedSection}>
            <p style={s.selectedTitle}>Selected Products</p>
            {items.filter(i => i.productId && i.quantity).length === 0 ? (
              <p style={s.noSelected}>No products selected.</p>
            ) : (
              <div style={s.selectedList}>
                {items.filter(i => i.productId && i.quantity).map(item => {
                  const prod = getProduct(item.productId)
                  return prod ? (
                    <div key={item.key} style={s.selectedChip}>
                      <span style={s.chipName}>{prod.name}</span>
                      <span style={s.chipBrand}>{prod.brand || '-'}</span>
                      <span style={s.chipSubCat}>{prod.subCategory}</span>
                      <span style={s.chipCat}>{prod.category}</span>
                      <span style={s.chipQty}>{item.quantity} {prod.unit}</span>
                    </div>
                  ) : null
                })}
              </div>
            )}
          </div>

          {/* Add Another Product Button */}
          <button style={s.addProductBtn} onClick={addItem}>
            <Plus size={14} /> Add Another Product
          </button>

          {/* Comment Box */}
          <div style={s.commentSection}>
            <div style={s.commentLabelRow}>
              <label style={s.label}>Comment</label>
              <span style={{
                ...s.charCount,
                color: comment.length >= COMMENT_LIMIT ? '#ef4444' : comment.length > 400 ? '#f59e0b' : '#9ca3af'
              }}>
                {comment.length} / {COMMENT_LIMIT}
              </span>
            </div>
            <textarea
              style={s.commentInput}
              placeholder="Add any additional notes or instructions (optional)..."
              value={comment}
              maxLength={COMMENT_LIMIT}
              onChange={e => setComment(e.target.value)}
              rows={4}
            />
            {comment.length >= COMMENT_LIMIT && (
              <span style={s.limitWarning}>Character limit of {COMMENT_LIMIT} reached</span>
            )}
          </div>

          {/* Footer */}
          <div style={s.formFooter}>
            <button style={{ ...s.cancelBtn, width: isMobile ? '100%' : 'auto' }} onClick={() => router.push('/requisition')}>Cancel</button>
            <button style={{ ...(saving ? s.saveBtnDis : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
              <Save size={15} /> {saving ? 'Saving...' : 'SAVE'}
            </button>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}

const s = {
  wrapper: { maxWidth: 960, margin: '0 auto' },
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
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
  pageTitle: { fontSize: 30, fontWeight: 800, color: '#1a3d1f', margin: '0 0 4px', display: 'flex', alignItems: 'center', letterSpacing: '-0.6px', lineHeight: 1.2 },
  pageSubtitle: { fontSize: 13.5, color: '#7a8a7a', margin: 0, fontWeight: 500 },
  saveBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#54B45B', border: 'none', borderRadius: 40, padding: '11px 20px', fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'pointer' },
  saveBtnDis: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#b8dcbc', border: 'none', borderRadius: 40, padding: '11px 20px', fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'not-allowed' },
  cancelBtn: { border: '1.5px solid #d4dfd4', borderRadius: 40, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, color: '#2d7a33', background: '#ffffff', cursor: 'pointer' },
  card: { background: '#f2f4f2', borderRadius: 20, border: '1px solid #e2e8e2', padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  topRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionHeader: { marginBottom: 8 },
  label: { fontSize: 12, fontWeight: 700, color: '#607062' },
  subLabel: { fontSize: 11.5, fontWeight: 600, color: '#7a8a7a', display: 'block' },
  input: {
    background: '#ffffff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d4dfd4',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 13,
    color: '#1f2f21',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  inputError: { borderColor: '#fca5a5', background: '#fff1f2' },
  errorText: { fontSize: 12, color: '#b91c1c', marginTop: 2 },
  itemsError: { background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, color: '#b91c1c', marginBottom: 12 },
  colHeaderRow: { display: 'flex', gap: 10, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #d4dfd4' },
  productRow: { display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' },
  itemField: { display: 'flex', flexDirection: 'column', flex: 1 },
  typeDisplay: { display: 'flex', alignItems: 'center', height: 40, paddingLeft: 4 },
  subCatBadge: { display: 'inline-block', background: '#eef2ee', border: '1px solid #d4dfd4', color: '#2d7a33', borderRadius: 40, padding: '2px 9px', fontSize: 11.5, fontWeight: 700 },
  brandBadge: { display: 'inline-block', background: '#ffffff', border: '1px solid #cfe0d0', color: '#123416', borderRadius: 40, padding: '2px 9px', fontSize: 11.5, fontWeight: 800 },
  catBadge: { display: 'inline-block', background: '#e8f0e8', border: '1px solid #d4dfd4', color: '#1f7a2b', borderRadius: 40, padding: '2px 9px', fontSize: 11.5, fontWeight: 700 },
  typePlaceholder: { color: '#b2c0b3', fontSize: 13 },
  unitDisplay: { height: 40, display: 'flex', alignItems: 'center', fontSize: 12.5, color: '#607062', fontWeight: 600, paddingLeft: 4 },
  stockHint: { marginTop: 4, fontSize: 11.5, color: '#607062', fontWeight: 600 },
  removeBtn: { background: '#fff1f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 38 },
  selectedSection: { background: '#ffffff', borderRadius: 12, border: '1px solid #d4dfd4', padding: '14px 16px', margin: '18px 0 12px' },
  selectedTitle: { fontSize: 13, fontWeight: 700, color: '#1f2f21', margin: '0 0 10px' },
  noSelected: { fontSize: 13, color: '#7a8a7a', margin: 0 },
  selectedList: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  selectedChip: { display: 'flex', alignItems: 'center', gap: 6, background: '#f2f4f2', border: '1px solid #d4dfd4', borderRadius: 40, padding: '4px 10px' },
  chipName: { fontSize: 12.5, fontWeight: 600, color: '#1f2f21' },
  chipBrand: { fontSize: 11, color: '#123416', background: '#ffffff', border: '1px solid #cfe0d0', borderRadius: 40, padding: '1px 8px', fontWeight: 800 },
  chipSubCat: { fontSize: 11, color: '#2d7a33', background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 40, padding: '1px 8px', fontWeight: 700 },
  chipCat: { fontSize: 11, color: '#1f7a2b', background: '#e8f0e8', border: '1px solid #d4dfd4', borderRadius: 40, padding: '1px 8px', fontWeight: 700 },
  chipQty: { fontSize: 12.5, color: '#2d7a33', fontWeight: 700 },
  addProductBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1.5px dashed #d4dfd4', color: '#2d7a33', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' },
  commentSection: { marginTop: 24 },
  commentLabelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  charCount: { fontSize: 12, fontWeight: 500, transition: 'color 0.2s' },
  commentInput: { width: '100%', background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1f2f21', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.6 },
  limitWarning: { fontSize: 11.5, color: '#b91c1c', marginTop: 4, display: 'block' },
  formFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid #d4dfd4', flexWrap: 'wrap' },
}


