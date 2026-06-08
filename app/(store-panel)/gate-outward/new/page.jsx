'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { ArrowUpFromLine, Plus, X, ArrowLeft, Save } from 'lucide-react'
import { customersApi, finishedGoodsApi, gateOutwardApi, inventoryApi } from '@/infrastructure/api/endpoints'
import { incrementStoreEntries } from '@/application/services/store/storeEntryTracker'
import { StoreThemeDatePicker, StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'
import {
  CUSTOMERS,
  GATE_OUTWARD_STORAGE_KEY,
  INITIAL_GATE_OUTWARD_RECORDS,
  PRODUCTS,
  UNITS,
} from '@/application/services/store/gateOutwardMock'

const SOURCE_INVENTORY = 'inventory'
const SOURCE_FINISHED_GOODS = 'finished_goods'
const MANUAL_CUSTOMER_STORAGE_KEY = 'qf-gate-outward-manual-customers'

const SOURCE_OPTIONS = [
  { value: SOURCE_INVENTORY, label: 'Inventory' },
  { value: SOURCE_FINISHED_GOODS, label: 'Finished Goods' },
]

const todayISO = () => new Date().toISOString().split('T')[0]

const toList = (value) => (Array.isArray(value) ? value : (value?.results || []))

const toNumberOrNull = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeCustomer = (entry, idx = 0, prefix = 'customer') => {
  const name = String(entry?.name || '').trim()
  if (!name) return null

  const rawId = entry?.id ?? `${prefix}-${idx}`
  return {
    id: String(rawId),
    name,
    address: String(entry?.address || ''),
    isManual: Boolean(entry?.isManual),
  }
}

const normalizeInventoryProduct = (entry, idx = 0, prefix = 'inv') => {
  const name = String(entry?.product || entry?.name || '').trim()
  if (!name) return null

  return {
    id: `${prefix}-${entry?.id ?? idx}`,
    source: SOURCE_INVENTORY,
    name,
    brand: String(entry?.brand || entry?.brand_name || '').trim(),
    unit: String(entry?.unit || 'Unit').trim() || 'Unit',
    available: toNumberOrNull(entry?.quantity ?? entry?.available),
  }
}

const normalizeFinishedGoodProduct = (entry, idx = 0, prefix = 'fg') => {
  const firstMeta = Array.isArray(entry?.products)
    ? (entry.products[0] || {})
    : (entry?.products && typeof entry.products === 'object' ? entry.products : {})

  const name = String(
    entry?.brand
    || entry?.product_name
    || firstMeta?.product
    || firstMeta?.name
    || firstMeta?.description
    || ''
  ).trim()
  if (!name) return null

  return {
    id: `${prefix}-${entry?.id ?? idx}`,
    source: SOURCE_FINISHED_GOODS,
    name,
    brand: String(firstMeta?.code || '').trim(),
    unit: String(entry?.unit || firstMeta?.packing || 'Unit').trim() || 'Unit',
    available: toNumberOrNull(entry?.quantity ?? firstMeta?.cartons ?? firstMeta?.quantity),
  }
}

const mergeCustomers = (...groups) => {
  const seen = new Set()
  const merged = []

  groups.flat().forEach((entry) => {
    if (!entry) return
    const name = String(entry.name || '').trim()
    if (!name) return

    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)

    merged.push({
      id: String(entry.id),
      name,
      address: String(entry.address || ''),
      isManual: Boolean(entry.isManual),
    })
  })

  return merged.sort((a, b) => a.name.localeCompare(b.name))
}

const uniqueProducts = (items) => {
  const seen = new Set()
  const list = []

  items.forEach((entry) => {
    if (!entry) return
    const key = `${entry.source}|${entry.name.toLowerCase()}|${(entry.brand || '').toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    list.push(entry)
  })

  return list
}

const fallbackCustomers = mergeCustomers(
  CUSTOMERS.map((entry, idx) => normalizeCustomer(entry, idx, 'mock-customer')).filter(Boolean)
)

const fallbackInventoryProducts = uniqueProducts(
  PRODUCTS.map((entry, idx) => normalizeInventoryProduct(entry, idx, 'mock-inv')).filter(Boolean)
)

const fallbackFinishedGoodsProducts = uniqueProducts(
  PRODUCTS.map((entry, idx) => normalizeFinishedGoodProduct(
    { id: entry.id, brand: entry.name, unit: entry.unit, quantity: entry.available, products: [{ code: entry.brand }] },
    idx,
    'mock-fg'
  )).filter(Boolean)
)

const blankItem = () => ({
  key: Date.now() + Math.random(),
  productId: '',
  quantity: '',
  unit: 'Unit',
  numbering: '',
  batchNumber: '',
  error: '',
})

function loadRecords() {
  if (typeof window === 'undefined') return INITIAL_GATE_OUTWARD_RECORDS
  try {
    const raw = window.localStorage.getItem(GATE_OUTWARD_STORAGE_KEY)
    if (!raw) return INITIAL_GATE_OUTWARD_RECORDS
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : INITIAL_GATE_OUTWARD_RECORDS
  } catch {
    return INITIAL_GATE_OUTWARD_RECORDS
  }
}

function saveRecords(next) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(GATE_OUTWARD_STORAGE_KEY, JSON.stringify(next))
}

function loadManualCustomers() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(MANUAL_CUSTOMER_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    const normalized = toList(parsed)
      .map((entry, idx) => normalizeCustomer({ ...entry, isManual: true }, idx, 'manual-customer'))
      .filter(Boolean)
      .map((entry) => ({ ...entry, isManual: true }))

    return mergeCustomers(normalized).filter((entry) => entry.isManual)
  } catch {
    return []
  }
}

function saveManualCustomers(list) {
  if (typeof window === 'undefined') return
  const safe = toList(list).map((entry) => ({
    id: String(entry.id),
    name: String(entry.name || '').trim(),
    address: String(entry.address || ''),
    isManual: true,
  }))
  window.localStorage.setItem(MANUAL_CUSTOMER_STORAGE_KEY, JSON.stringify(safe))
}

function nextGoNo(records) {
  const maxNum = records.reduce((max, r) => {
    const n = Number(String(r.goNo || '').replace(/\D/g, ''))
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)
  return `QUD${maxNum + 1}`
}

export default function GateOutwardNewPage() {
  const router = useRouter()

  const [goNo, setGoNo] = useState('QUD1')
  const [date, setDate] = useState(todayISO())
  const [customerId, setCustomerId] = useState('')
  const [address, setAddress] = useState('')
  const [manualCustomerName, setManualCustomerName] = useState('')

  const [vehicleNo, setVehicleNo] = useState('')
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [driverCnic, setDriverCnic] = useState('')

  const [note, setNote] = useState('')
  const [source, setSource] = useState('')

  const [items, setItems] = useState([blankItem()])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadWarning, setLoadWarning] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  const [customers, setCustomers] = useState(fallbackCustomers)
  const [manualCustomers, setManualCustomers] = useState([])
  const [productsBySource, setProductsBySource] = useState({
    [SOURCE_INVENTORY]: fallbackInventoryProducts,
    [SOURCE_FINISHED_GOODS]: fallbackFinishedGoodsProducts,
  })

  useEffect(() => {
    let active = true
    const loadNext = async () => {
      try {
        const res = await gateOutwardApi.nextGO()
        const go = String(res?.go_no || '').trim()
        if (active && go) setGoNo(go)
      } catch {
        const records = loadRecords()
        if (active) setGoNo(nextGoNo(records))
      }
    }
    loadNext()
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

  useEffect(() => {
    let active = true
    const persistedManual = loadManualCustomers()
    setManualCustomers(persistedManual)

    const loadOptions = async () => {
      setLoadingOptions(true)
      setLoadWarning('')

      try {
        const [customersRes, inventoryRes, finishedGoodsRes] = await Promise.all([
          customersApi.list(),
          inventoryApi.list(),
          finishedGoodsApi.list(),
        ])

        if (!active) return

        const apiCustomers = toList(customersRes)
          .map((entry, idx) => normalizeCustomer(entry, idx, 'api-customer'))
          .filter(Boolean)
        const mergedCustomers = mergeCustomers(apiCustomers, persistedManual)

        const inventoryProducts = uniqueProducts(
          toList(inventoryRes)
            .map((entry, idx) => normalizeInventoryProduct(entry, idx, 'inv'))
            .filter(Boolean)
        )
        const finishedGoodsProducts = uniqueProducts(
          toList(finishedGoodsRes)
            .map((entry, idx) => normalizeFinishedGoodProduct(entry, idx, 'fg'))
            .filter(Boolean)
        )

        setCustomers(mergedCustomers.length ? mergedCustomers : fallbackCustomers)
        setProductsBySource({
          [SOURCE_INVENTORY]: inventoryProducts,
          [SOURCE_FINISHED_GOODS]: finishedGoodsProducts,
        })
      } catch {
        if (!active) return

        setCustomers(mergeCustomers(fallbackCustomers, persistedManual))
        setProductsBySource({
          [SOURCE_INVENTORY]: fallbackInventoryProducts,
          [SOURCE_FINISHED_GOODS]: fallbackFinishedGoodsProducts,
        })
        setLoadWarning('Unable to fetch latest Settings data. Showing fallback options.')
      } finally {
        if (active) setLoadingOptions(false)
      }
    }

    loadOptions()
    return () => {
      active = false
    }
  }, [])

  const unitOptions = useMemo(() => {
    const all = new Set(UNITS)
    Object.values(productsBySource).flat().forEach((entry) => {
      const unitName = String(entry?.unit || '').trim()
      if (unitName) all.add(unitName)
    })
    return Array.from(all)
  }, [productsBySource])

  const customer = useMemo(
    () => customers.find((entry) => String(entry.id) === String(customerId)) || null,
    [customerId, customers]
  )

  const getProductsForSource = (source) => productsBySource[source] || []

  const getProduct = (source, productId) =>
    getProductsForSource(source).find((entry) => String(entry.id) === String(productId)) || null

  const hasStockLimit = (entry) => Number.isFinite(entry?.available)

  const handleAddManualCustomer = () => {
    const name = manualCustomerName.trim()
    if (!name) return

    const existing = customers.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      setCustomerId(String(existing.id))
      setAddress(existing.address || '')
      setManualCustomerName('')
      setErrors((prev) => ({ ...prev, customer: undefined }))
      return
    }

    const manualEntry = {
      id: `manual-${Date.now()}`,
      name,
      address: address.trim(),
      isManual: true,
    }

    const nextManual = mergeCustomers(manualCustomers, [manualEntry]).map((entry) => ({ ...entry, isManual: true }))
    const nextCustomers = mergeCustomers(customers, [manualEntry])

    setManualCustomers(nextManual)
    saveManualCustomers(nextManual)
    setCustomers(nextCustomers)
    setCustomerId(String(manualEntry.id))
    setManualCustomerName('')
    setErrors((prev) => ({ ...prev, customer: undefined }))
  }

  const updateItem = (key, field, value) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row
        const updated = { ...row, [field]: value, error: '' }

        if (field === 'productId') {
          const product = getProduct(source, value)
          updated.unit = product?.unit || row.unit
          if (updated.quantity && product && hasStockLimit(product) && Number(updated.quantity) > product.available) {
            updated.quantity = String(product.available)
            updated.error = `Quantity cannot be over ${product.available} ${product.unit}`
          }
        }

        if (field === 'quantity') {
          const product = getProduct(source, updated.productId)
          if (product && hasStockLimit(product) && Number(value) > product.available) {
            updated.quantity = String(product.available)
            updated.error = `Quantity cannot be over ${product.available} ${product.unit}`
          }
        }

        return updated
      })
    )

    setErrors((prev) => ({ ...prev, items: undefined }))
  }

  const addItem = () => setItems((prev) => [...prev, blankItem()])
  const removeItem = (key) => setItems((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== key) : prev))

  const validate = () => {
    const nextErrors = {}

    if (!date) nextErrors.date = 'Please select a date'
    if (!customerId) nextErrors.customer = 'Please select a customer'

    if (!source) nextErrors.source = 'Please select a source'

    const missing = items.some((row) => !row.productId || !row.quantity || Number(row.quantity) <= 0)
    if (missing) nextErrors.items = 'Please complete product and quantity for all rows'

    const overLimitRow = items.find((row) => {
      const product = getProduct(source, row.productId)
      if (!product || !hasStockLimit(product)) return false
      return Number(row.quantity) > product.available
    })

    if (overLimitRow) nextErrors.items = 'Quantity cannot be over available stock'

    const totalByProduct = items.reduce((acc, row) => {
      if (!row.productId) return acc
      acc[row.productId] = (acc[row.productId] || 0) + Number(row.quantity || 0)
      return acc
    }, {})

    const productOverTotal = Object.entries(totalByProduct).find(([productId, total]) => {
      const product = getProduct(source, productId)
      return product && hasStockLimit(product) && total > product.available
    })

    if (productOverTotal) {
      const product = getProduct(source, productOverTotal[0])
      const sourceName = SOURCE_OPTIONS.find((entry) => entry.value === source)?.label || source
      if (product) nextErrors.items = `${product.name} (${sourceName}): total quantity cannot be over ${product.available} ${product.unit}`
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)

    try {
      const customerPk = Number(customer?.id)
      const payload = {
        go_no: goNo,
        dispatch_date: date,
        vehicle_no: vehicleNo,
        driver_name: driverName,
        driver_phone: driverPhone,
        driver_cnic: driverCnic,
        customer: Number.isFinite(customerPk) ? customerPk : null,
        customer_name: customer?.name || '',
        address,
        note,
        source: SOURCE_OPTIONS.find((entry) => entry.value === source)?.label || source,
        sourceType: source,
        status: 'Dispatched',
        items: items.map((row) => {
          const product = getProduct(source, row.productId)
          return {
            source: SOURCE_OPTIONS.find((entry) => entry.value === source)?.label || source,
            sourceType: source,
            productId: product?.id ?? row.productId,
            productName: product?.name || '',
            brand: product?.brand || '',
            quantity: Number(row.quantity),
            unit: row.unit || product?.unit || 'Unit',
            numbering: row.numbering || '',
            batch_number: row.batchNumber || '',
          }
        }),
      }

      await gateOutwardApi.create(payload)
      incrementStoreEntries('gate-outward')
      router.push('/gate-outward')
    } catch {
      setErrors((prev) => ({ ...prev, form: 'Unable to save gate outward entry. Please check backend connection.' }))
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div style={{ ...s.wrapper, maxWidth: isMobile ? '100%' : 1100 }}>
        <div style={s.pageHeader}>
          <div style={{ ...s.headerLeft, width: isMobile ? '100%' : 'auto' }}>
            <button style={s.backBtn} onClick={() => router.push('/gate-outward')}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...s.pageTitle, fontSize: isMobile ? 20 : 30 }}><ArrowUpFromLine size={20} color="#54B45B" style={{ marginRight: 8 }} />Gate Outward</h1>
              <p style={{ ...s.pageSubtitle, fontSize: isMobile ? 12 : 13.5 }}>Add new entry</p>
            </div>
          </div>
          <button style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'SAVE'}
          </button>
        </div>

        <div style={{ ...s.card, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 14 : 24 }}>
          {loadWarning ? <div style={s.warningBanner}>{loadWarning}</div> : null}
          {errors.form ? <div style={s.warningBanner}>{errors.form}</div> : null}

          <div style={{ ...s.topRow, gridTemplateColumns: isMobile ? '1fr' : s.topRow.gridTemplateColumns }}>
            <div style={s.fieldGroup}>
              <label style={s.label}>GO Number:</label>
              <div style={s.readonlyInput}>{goNo}</div>
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Date:</label>
              <StoreThemeDatePicker
                value={date}
                onChange={setDate}
                placeholder="Select date"
                variant="input"
                triggerStyle={errors.date ? s.inputError : {}}
              />
              {errors.date && <span style={s.errorText}>{errors.date}</span>}
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Customer:</label>
              <StoreThemeDropdown
                value={customerId}
                disabled={loadingOptions}
                onChange={(id) => {
                  setCustomerId(id)
                  const picked = customers.find((entry) => String(entry.id) === String(id))
                  setAddress(picked?.address || '')
                  setErrors((prev) => ({ ...prev, customer: undefined }))
                }}
                variant="input"
                placeholder={loadingOptions ? 'Loading customers...' : 'Select Customer'}
                options={[
                  { value: '', label: loadingOptions ? 'Loading customers...' : 'Select Customer' },
                  ...customers.map((entry) => ({
                    value: String(entry.id),
                    label: `${entry.name}${entry.isManual ? ' (Manual)' : ''}`,
                  })),
                ]}
              />
              <div style={s.manualCustomerRow}>
                <input
                  style={s.manualCustomerInput}
                  placeholder="Type customer name and click Add"
                  value={manualCustomerName}
                  onChange={(e) => setManualCustomerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddManualCustomer()
                    }
                  }}
                />
                <button
                  type="button"
                  style={manualCustomerName.trim() ? s.manualCustomerBtn : s.manualCustomerBtnDisabled}
                  onClick={handleAddManualCustomer}
                  disabled={!manualCustomerName.trim()}
                >
                  Add
                </button>
              </div>
              {errors.customer && <span style={s.errorText}>{errors.customer}</span>}
            </div>
          </div>

          <div style={s.midRow}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Address:</label>
              <textarea
                style={{ ...s.input, ...s.textarea }}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Auto-filled from customer selection or type manually"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Note:</label>
              <textarea style={{ ...s.input, ...s.textarea }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note..." />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>Source:</label>
            <StoreThemeDropdown
              value={source}
              onChange={(nextSource) => {
                setSource(nextSource)
                setItems((prev) => prev.map((row) => ({ ...row, productId: '', quantity: '', unit: unitOptions[0] || 'Unit', error: '' })))
              }}
              variant="input"
              placeholder="Select Source"
              options={[
                { value: '', label: 'Select Source' },
                ...SOURCE_OPTIONS.map((entry) => ({ value: entry.value, label: entry.label })),
              ]}
            />
            {errors.source && <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>{errors.source}</p>}
          </div>

          <div style={{ ...s.driverRow, gridTemplateColumns: isMobile ? '1fr 1fr' : s.driverRow.gridTemplateColumns }}>
            <input style={s.input} placeholder="Vehicle No." value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
            <input style={s.input} placeholder="Driver Name" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
            <input style={s.input} placeholder="Driver Phone" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
            <input style={s.input} placeholder="Driver CNIC" value={driverCnic} onChange={(e) => setDriverCnic(e.target.value)} />
          </div>

          <div style={s.itemsHeader}>
            <button style={s.addItemBtn} onClick={addItem}>
              <Plus size={15} />
            </button>
          </div>

          <div style={s.divider} />

          {errors.items && <div style={s.itemsError}>{errors.items}</div>}

          {items.map((item, idx) => {
            const productsForSource = getProductsForSource(source)
            const product = getProduct(source, item.productId)

            let availableText = 'Select source above first'
            if (source && productsForSource.length === 0) availableText = 'No products available for selected source'
            if (source && productsForSource.length > 0) availableText = 'Select product to view available stock'
            if (product && hasStockLimit(product)) availableText = `Available: ${product.available} ${product.unit}`
            if (product && !hasStockLimit(product)) availableText = `Unit: ${product.unit}`

            return (
              <div key={item.key} style={s.itemBlock}>
                <div style={s.itemRow}>
                  <div style={s.itemField}>
                    {idx === 0 && <label style={s.label}>Select Product</label>}
                    <select
                      style={s.input}
                      value={item.productId}
                      onChange={(e) => updateItem(item.key, 'productId', e.target.value)}
                      disabled={!source}
                    >
                      <option value="">
                        {!source
                          ? 'Select source first'
                          : productsForSource.length === 0
                            ? 'No products found'
                            : 'Select Product'}
                      </option>
                      {productsForSource.map((entry) => (
                        <option key={`${item.source}-${entry.id}`} value={entry.id}>
                          {entry.name}{entry.brand ? ` (${entry.brand})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : '0 0 120px' }}>
                    {idx === 0 && <label style={s.label}>Quantity</label>}
                    <input
                      style={s.input}
                      type="number"
                      min="1"
                      placeholder="Quantity"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, 'quantity', e.target.value)}
                    />
                  </div>

                  <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : '0 0 120px' }}>
                    {idx === 0 && <label style={s.label}>Unit</label>}
                    <StoreThemeDropdown
                      value={item.unit}
                      onChange={(nextUnit) => updateItem(item.key, 'unit', nextUnit)}
                      variant="input"
                      options={UNITS.map((u) => ({ value: u, label: u }))}
                    />
                  </div>

                  <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : '0 0 130px' }}>
                    {idx === 0 && <label style={s.label}>Numbering</label>}
                    <input
                      style={s.input}
                      placeholder="Numbering"
                      value={item.numbering}
                      onChange={(e) => updateItem(item.key, 'numbering', e.target.value)}
                    />
                  </div>

                  <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : '0 0 130px' }}>
                    {idx === 0 && <label style={s.label}>Batch No.</label>}
                    <input
                      style={s.input}
                      placeholder="Batch No."
                      value={item.batchNumber}
                      onChange={(e) => updateItem(item.key, 'batchNumber', e.target.value)}
                    />
                  </div>

                  <div style={{ ...s.itemField, flex: isMobile ? '1 1 100%' : '0 0 36px', alignSelf: isMobile ? 'flex-start' : 'flex-end' }}>
                    {items.length > 1 && (
                      <button style={s.removeBtn} onClick={() => removeItem(item.key)} title="Remove item">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <p style={{ ...s.stockHint, color: item.error ? '#ef4444' : '#6b7280' }}>{item.error || availableText}</p>
              </div>
            )
          })}

          <div style={s.formFooter}>
            <button style={{ ...s.cancelBtn, width: isMobile ? '100%' : 'auto' }} onClick={() => router.push('/gate-outward')}>Cancel</button>
            <button style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
              <Save size={15} /> {saving ? 'Saving...' : 'SAVE'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

const s = {
  wrapper: { maxWidth: 1100, margin: '0 auto' },

  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 40, border: '1.5px solid #d4dfd4', background: '#ffffff', color: '#2d7a33', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  pageTitle: { fontSize: 30, fontWeight: 800, color: '#1a3d1f', margin: '0 0 4px', display: 'flex', alignItems: 'center', letterSpacing: '-0.6px', lineHeight: 1.2 },
  pageSubtitle: { fontSize: 13.5, color: '#7a8a7a', margin: 0, fontWeight: 500 },

  saveBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#54B45B', border: 'none', borderRadius: 40, padding: '11px 20px', fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'pointer' },
  saveBtnDisabled: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#b8dcbc', border: 'none', borderRadius: 40, padding: '11px 20px', fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'not-allowed' },
  cancelBtn: { border: '1.5px solid #d4dfd4', borderRadius: 40, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, color: '#2d7a33', background: '#ffffff', cursor: 'pointer' },

  card: { background: '#f2f4f2', borderRadius: 20, border: '1px solid #e2e8e2', padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  warningBanner: { background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, color: '#c2410c', fontSize: 12.5, padding: '8px 12px', marginBottom: 12 },

  topRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 },
  midRow: { display: 'flex', gap: 20, marginBottom: 14 },
  extraRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 14 },
  driverRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 },

  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  itemField: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },

  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#1f2f21', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
  inputError: { borderColor: '#fca5a5', background: '#fff5f5' },
  readonlyInput: { background: '#f0faf4', border: '1px solid #d1fae5', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, color: '#374151', fontWeight: 600 },

  manualCustomerRow: { display: 'flex', gap: 8, marginTop: 2 },
  manualCustomerInput: { flex: 1, border: '1px solid #d4dfd4', borderRadius: 10, padding: '7px 10px', fontSize: 12.5, color: '#1f2f21', background: '#ffffff', outline: 'none' },
  manualCustomerBtn: { border: 'none', borderRadius: 10, background: '#54B45B', color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '7px 14px', cursor: 'pointer' },
  manualCustomerBtnDisabled: { border: 'none', borderRadius: 8, background: '#d1d5db', color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '7px 14px', cursor: 'not-allowed' },

  textarea: { height: 80, resize: 'vertical', fontFamily: 'inherit' },
  textareaSmall: { height: 60, resize: 'vertical', fontFamily: 'inherit' },

  errorText: { fontSize: 11.5, color: '#ef4444', marginTop: 2 },
  itemsError: { background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#ef4444', marginBottom: 12 },

  itemsHeader: { display: 'flex', justifyContent: 'flex-end', marginBottom: 12 },
  addItemBtn: { background: '#54B45B', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', boxShadow: '0 2px 8px rgba(84,180,91,0.35)' },

  divider: { height: 1, background: '#f3f4f6', marginBottom: 16 },
  itemBlock: { marginBottom: 10 },
  itemRow: { display: 'flex', gap: 12, alignItems: 'flex-end' },
  stockHint: { margin: '4px 0 0', fontSize: 11.5, paddingLeft: 2 },

  removeBtn: { background: '#fff5f5', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 6, pa