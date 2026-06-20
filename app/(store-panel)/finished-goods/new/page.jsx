'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Save, X } from 'lucide-react'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { incrementStoreEntries } from '@/application/services/store/storeEntryTracker'
import { finishedGoodsApi, packagingApi } from '@/infrastructure/api/endpoints'
import {
  BRANDS,
  PRODUCTS,
  PACKINGS,
  getWordCount,
} from '@/components/store/shared/StoreShared'
import { StoreThemeDatePicker, StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'

const todayISO = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ product: '', packing: '', cartons: '', comment: '' })
const toList = (value) => (Array.isArray(value) ? value : (value?.results || []))

const fallbackProductOptions = Object.values(PRODUCTS)
  .flat()
  .map((name, idx) => ({ id: `fallback-product-${idx}`, name, label: name }))

const fallbackPackingOptions = PACKINGS.map((name, idx) => ({ id: `fallback-packing-${idx}`, name }))

function normalizeFinishedGoodProduct(entry, idx = 0) {
  const meta = Array.isArray(entry?.products)
    ? (entry.products[0] || {})
    : (entry?.products && typeof entry.products === 'object' ? entry.products : {})
  const status = String(entry?.status || '').toLowerCase()
  if (status === 'inactive' || entry?.status === false) return null

  const name = String(entry?.brand || entry?.name || meta?.product || meta?.name || '').trim()
  if (!name) return null

  const details = [meta?.code, meta?.description].map((part) => String(part || '').trim()).filter(Boolean)
  return {
    id: String(entry?.id ?? `fg-product-${idx}`),
    name,
    label: details.length ? `${name} (${details.join(' - ')})` : name,
  }
}

function normalizePacking(entry, idx = 0) {
  const status = String(entry?.status || '').toLowerCase()
  if (status === 'inactive' || entry?.status === false) return null

  const name = String(entry?.name || entry?.packing || entry || '').trim()
  if (!name) return null
  return {
    id: String(entry?.id ?? `packing-${idx}`),
    name,
  }
}

function uniqueByName(options) {
  const seen = new Set()
  return options.filter((entry) => {
    const key = String(entry.name || '').trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default function FinishedGoodsNewPage() {
  const router = useRouter()
  const [brand, setBrand] = useState('')
  const [date, setDate] = useState(todayISO())
  const [items, setItems] = useState([blankItem()])
  const [productOptions, setProductOptions] = useState(fallbackProductOptions)
  const [packingOptions, setPackingOptions] = useState(fallbackPackingOptions)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadWarning, setLoadWarning] = useState('')
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

  useEffect(() => {
    let active = true
    const loadOptions = async () => {
      setLoadingOptions(true)
      setLoadWarning('')
      try {
        const [productsRes, packingRes] = await Promise.all([
          finishedGoodsApi.list(),
          packagingApi.list(),
        ])
        if (!active) return

        const nextProducts = toList(productsRes)
          .map((entry, idx) => normalizeFinishedGoodProduct(entry, idx))
          .filter(Boolean)
        const nextPacking = toList(packingRes)
          .map((entry, idx) => normalizePacking(entry, idx))
          .filter(Boolean)

        setProductOptions(nextProducts.length ? uniqueByName(nextProducts) : fallbackProductOptions)
        setPackingOptions(nextPacking.length ? uniqueByName(nextPacking) : fallbackPackingOptions)
      } catch {
        if (!active) return
        setProductOptions(fallbackProductOptions)
        setPackingOptions(fallbackPackingOptions)
        setLoadWarning('Unable to load Settings products/packing. Showing fallback options.')
      } finally {
        if (active) setLoadingOptions(false)
      }
    }

    loadOptions()
    return () => { active = false }
  }, [])

  const updateItem = (index, key, value) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)))
    setErrors((prev) => ({ ...prev, items: undefined }))
  }

  const addItem = () => setItems((prev) => [...prev, blankItem()])
  const removeItem = (index) => setItems((prev) => prev.filter((_, idx) => idx !== index))

  const validate = () => {
    const nextErrors = {}
    if (!brand) nextErrors.brand = 'Please select a brand'

    const cleanItems = items
      .map((item) => ({ ...item, cartons: Number(item.cartons) || 0 }))
      .filter((item) => item.product && item.packing)

    if (!cleanItems.length) nextErrors.items = 'Add at least one complete product row'
    setErrors(nextErrors)
    return { valid: Object.keys(nextErrors).length === 0, cleanItems }
  }

  const handleSave = async () => {
    const { valid, cleanItems } = validate()
    if (!valid) return

    setSaving(true)
    try {
      await finishedGoodsApi.create({
        brand,
        date,
        status: 'Completed',
        products: cleanItems,
      })
      incrementStoreEntries('finished-goods')
      router.push('/finished-goods')
    } catch {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div style={{ ...s.wrapper, maxWidth: isMobile ? '100%' : 1060 }}>
        <div style={s.pageHeader}>
          <div style={{ ...s.headerLeft, width: isMobile ? '100%' : 'auto' }}>
            <button type="button" style={s.backBtn} onClick={() => router.push('/finished-goods')}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...s.pageTitle, fontSize: isMobile ? 20 : 30 }}>Create Finished Goods Entry</h1>
              <p style={{ ...s.pageSubtitle, fontSize: isMobile ? 12 : 13.5 }}>Add brand-wise cartons with optional comments</p>
            </div>
          </div>
          <button type="button" style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>

        <div style={{ ...s.card, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 14 : 20 }}>
          {loadWarning ? <p style={s.errorBanner}>{loadWarning}</p> : null}

          <div style={s.formRow}>
            <div style={s.formCol}>
              <label style={s.label}>Brand</label>
              <StoreThemeDropdown
                value={brand}
                onChange={(nextBrand) => {
                  setBrand(nextBrand)
                  setErrors((prev) => ({ ...prev, brand: undefined }))
                }}
                hasError={Boolean(errors.brand)}
                variant="input"
                placeholder="Select brand"
                options={[
                  { value: '', label: 'Select brand' },
                  ...BRANDS.map((entry) => ({ value: entry, label: entry })),
                ]}
              />
              {errors.brand ? <p style={s.errorText}>{errors.brand}</p> : null}
            </div>
            <div style={{ ...s.formCol, maxWidth: isMobile ? '100%' : 240 }}>
              <label style={s.label}>Date</label>
              <StoreThemeDatePicker value={date} onChange={setDate} placeholder="Select date" variant="input" />
            </div>
          </div>

          <div style={s.divider} />

          <div style={s.itemHeader}>
            <p style={s.sectionTitle}>Products</p>
            <button type="button" style={s.addBtn} onClick={addItem}>
              <Plus size={14} /> Add Product
            </button>
          </div>

          {errors.items ? <p style={s.errorBanner}>{errors.items}</p> : null}

          {items.map((item, idx) => (
            <div key={`row-${idx}`} style={s.itemCard}>
              <div style={s.itemTop}>
                <span style={s.itemTitle}>Product {idx + 1}</span>
                {items.length > 1 ? (
                  <button type="button" style={s.removeBtn} onClick={() => removeItem(idx)}>
                    <X size={13} />
                  </button>
                ) : null}
              </div>

              <div style={s.formRow}>
                <div style={s.formCol}>
                  <label style={s.label}>Product</label>
                  <StoreThemeDropdown
                    value={item.product}
                    onChange={(nextProduct) => updateItem(idx, 'product', nextProduct)}
                    variant="input"
                    placeholder={loadingOptions ? 'Loading products...' : 'Select product'}
                    options={[
                      { value: '', label: loadingOptions ? 'Loading products...' : 'Select product' },
                      ...productOptions.map((entry) => ({ value: entry.name, label: entry.label })),
                    ]}
                  />
                </div>
                <div style={s.formCol}>
                  <label style={s.label}>Packing</label>
                  <StoreThemeDropdown
                    value={item.packing}
                    onChange={(nextPacking) => updateItem(idx, 'packing', nextPacking)}
                    variant="input"
                    placeholder={loadingOptions ? 'Loading packing...' : 'Select packing'}
                    options={[
                      { value: '', label: loadingOptions ? 'Loading packing...' : 'Select packing' },
                      ...packingOptions.map((entry) => ({ value: entry.name, label: entry.name })),
                    ]}
                  />
                </div>
                <div style={{ ...s.formCol, maxWidth: isMobile ? '100%' : 140 }}>
                  <label style={s.label}>Cartons</label>
                  <input
                    type="number"
                    min={0}
                    style={s.input}
                    value={item.cartons}
                    onChange={(e) => updateItem(idx, 'cartons', e.target.value)}
                  />
                </div>
              </div>

              <label style={s.label}>Comment</label>
              <textarea
                rows={3}
                style={s.textarea}
                value={item.comment}
                onChange={(e) => {
                  const next = e.target.value
                  if (getWordCount(next) <= 500) updateItem(idx, 'comment', next)
                }}
              />
              <p style={s.counter}>{getWordCount(item.comment)} / 500 words</p>
            </div>
          ))}

          <div style={s.footer}>
            <button type="button" style={{ ...s.cancelBtn, width: isMobile ? '100%' : 'auto' }} onClick={() => router.push('/finished-goods')}>
              Cancel
            </button>
            <button type="button" style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
              <Save size={15} /> {saving ? 'Saving...' : 'Save Entry'}
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
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d4dfd4',
    borderRadius: 10,
    background: '#ffffff',
    color: '#1f2f21',
    padding: '9px 11px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    border: '1px solid #d4dfd4',
    borderRadius: 10,
    background: '#ffffff',
    color: '#1f2f21',
    padding: '9px 11px',
    fontSize: 13,
    outline: 'none',
    resize: 'vertical',
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
  counter: {
    margin: '6px 0 0',
    fontSize: 11,
    color: '#7a8a7a',
    textAlign: 'right',
  },
  inputError: {
    borderColor: '#fca5a5',
    background: '#fff1f2',
  },
  errorText: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#b91c1c',
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


