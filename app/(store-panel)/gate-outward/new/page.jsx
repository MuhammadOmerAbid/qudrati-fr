'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { ArrowUpFromLine, Plus, X, ArrowLeft, Save } from 'lucide-react'
import { customersApi, finishedGoodsApi, gateOutwardApi, inventoryApi, packagingApi } from '@/infrastructure/api/endpoints'
import { incrementStoreEntries } from '@/application/services/store/storeEntryTracker'
import { StoreThemeDatePicker, StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'
import { limitPhoneNumber } from '@/lib/inputLimits'
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

const FALLBACK_PACKAGING_TYPES = ['Box', 'Bag', 'Carton', 'Wrap', 'Bundle']

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

  const rawId = entry?.id ?? idx

  return {
    id: `${prefix}-${rawId}`,
    inventoryItemId: entry?.id ?? null,
    source: SOURCE_INVENTORY,
    name,
    brand: String(entry?.brand || entry?.brand_name || '').trim(),
    category: String(entry?.category || entry?.category_name || '').trim(),
    subCategory: String(entry?.subcategory || entry?.subCategory || entry?.sub_category || '').trim(),
    unit: String(entry?.unit || 'Unit').trim() || 'Unit',
    available: toNumberOrNull(entry?.quantity ?? entry?.available),
  }
}

const normalizeFinishedGoodProduct = (entry, idx = 0, prefix = 'fg', productMeta = null) => {
  const firstMeta = productMeta || (Array.isArray(entry?.products)
    ? (entry.products[0] || {})
    : (entry?.products && typeof entry.products === 'object' ? entry.products : {}))

  const parentProduct = entry?.product && typeof entry.product === 'object' ? entry.product : {}
  const packing = String(firstMeta?.packing || firstMeta?.packaging || '').trim()
  const hasStockShape = Boolean(packing || firstMeta?.cartons != null || firstMeta?.product || parentProduct?.name)
  const available = hasStockShape
    ? toNumberOrNull(firstMeta?.cartons ?? firstMeta?.quantity ?? entry?.quantity)
    : null
  const name = String(
    firstMeta?.product
    || firstMeta?.name
    || parentProduct?.name
    || entry?.product_name
    || entry?.name
    || firstMeta?.description
    || entry?.brand
    || ''
  ).trim()
  if (!name) return null

  const brand = String(
    (hasStockShape ? entry?.brand : '')
    || entry?.brand_name
    || parentProduct?.brand_name
    || firstMeta?.brand
    || firstMeta?.brandName
    || ''
  ).trim()

  return {
    id: `${prefix}-${entry?.id ?? idx}-${idx}`,
    finishedGoodsId: entry?.id ?? null,
    finishedGoodsProductIndex: String(idx).split('-').pop(),
    finishedGoodsStockRow: hasStockShape,
    source: SOURCE_FINISHED_GOODS,
    name,
    brand,
    category: String(entry?.category || firstMeta?.category || '').trim(),
    subCategory: String(entry?.subcategory || entry?.subCategory || firstMeta?.subcategory || firstMeta?.subCategory || '').trim(),
    packing,
    unit: String(entry?.unit || 'Carton').trim() || 'Carton',
    available,
  }
}

const normalizeFinishedGoodEntryProducts = (entry, idx = 0, prefix = 'fg') => {
  if (Array.isArray(entry?.products) && entry.products.length) {
    return entry.products
      .map((product, productIdx) => normalizeFinishedGoodProduct(entry, `${idx}-${productIdx}`, prefix, product))
      .filter(Boolean)
  }

  const product = normalizeFinishedGoodProduct(entry, idx, prefix)
  return product ? [product] : []
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
  PRODUCTS.flatMap((entry, idx) => normalizeFinishedGoodEntryProducts(
    { id: entry.id, brand: entry.name, unit: entry.unit, quantity: entry.available, products: [{ code: entry.brand }] },
    idx,
    'mock-fg'
  ))
)

const blankItem = (source = '') => ({
  key: Date.now() + Math.random(),
  source,
  productId: '',
  packaging: '',
  numbering: '',
  batchNumber: '',
  quantity: '',
  unit: 'Unit',
  weightPerCarton: '',
  comment: '',
  error: '',
})

const normalizePackagingType = (entry, idx = 0) => {
  const name = String(entry?.name || entry?.packaging || entry || '').trim()
  if (!name) return null
  const isInactive = entry && typeof entry === 'object' && (entry.status === false || entry.status === 'inactive')
  if (isInactive) return null
  return {
    id: String(entry?.id ?? name ?? idx),
    name,
  }
}

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
  const [packagingTypes, setPackagingTypes] = useState(
    FALLBACK_PACKAGING_TYPES.map((name, idx) => ({ id: String(idx + 1), name }))
  )

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
        const [customersRes, inventoryRes, finishedGoodsRes, packagingRes] = await Promise.all([
          customersApi.list(),
          inventoryApi.list(),
          finishedGoodsApi.list(),
          packagingApi.list(),
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
            .flatMap((entry, idx) => normalizeFinishedGoodEntryProducts(entry, idx, 'fg'))
        )
        const packagingList = toList(packagingRes)
          .map((entry, idx) => normalizePackagingType(entry, idx))
          .filter(Boolean)

        setCustomers(mergedCustomers.length ? mergedCustomers : fallbackCustomers)
        setProductsBySource({
          [SOURCE_INVENTORY]: inventoryProducts.length ? inventoryProducts : fallbackInventoryProducts,
          [SOURCE_FINISHED_GOODS]: finishedGoodsProducts,
        })
        setPackagingTypes(packagingList.length
          ? packagingList
          : FALLBACK_PACKAGING_TYPES.map((name, idx) => ({ id: String(idx + 1), name })))
      } catch {
        if (!active) return

        setCustomers(mergeCustomers(fallbackCustomers, persistedManual))
        setProductsBySource({
          [SOURCE_INVENTORY]: fallbackInventoryProducts,
          [SOURCE_FINISHED_GOODS]: fallbackFinishedGoodsProducts,
        })
        setPackagingTypes(FALLBACK_PACKAGING_TYPES.map((name, idx) => ({ id: String(idx + 1), name })))
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

        if (field === 'source') {
          updated.productId = ''
          updated.packaging = ''
          updated.numbering = ''
          updated.batchNumber = ''
          updated.quantity = ''
          updated.weightPerCarton = ''
          updated.unit = unitOptions[0] || 'Unit'
        }

        if (field === 'productId') {
          const product = getProduct(updated.source, value)
          updated.unit = product?.unit || row.unit
          if (updated.source === SOURCE_FINISHED_GOODS) {
            updated.packaging = product?.packing || ''
          }
          if (updated.quantity && product && hasStockLimit(product) && Number(updated.quantity) > product.available) {
            updated.quantity = String(product.available)
            updated.error = `Quantity cannot be over ${product.available} ${product.unit}`
          }
        }

        if (field === 'quantity') {
          const product = getProduct(updated.source, updated.productId)
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

  const addItem = () => setItems((prev) => {
    const inheritedSource = [...prev].reverse().find((row) => row.source)?.source || ''
    return [...prev, blankItem(inheritedSource)]
  })
  const removeItem = (key) => setItems((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== key) : prev))

  const focusNextItemCell = (fromElement) => {
    if (typeof window === 'undefined') return
    const current = fromElement || document.activeElement
    const block = current?.closest?.('[data-go-item-block]')
    if (!block) return

    const cells = Array.from(block.querySelectorAll('[data-go-item-cell]'))
      .filter((cell) => {
        const disabled = cell.disabled || cell.getAttribute('aria-disabled') === 'true'
        return !disabled && cell.offsetParent !== null
      })
    const index = cells.indexOf(current)
    const next = cells[index >= 0 ? index + 1 : 0]
    next?.focus?.()
  }

  const handleItemCellKeyDown = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    focusNextItemCell(event.currentTarget)
  }

  const validate = () => {
    const nextErrors = {}

    if (!date) nextErrors.date = 'Please select a date'
    if (!customerId) nextErrors.customer = 'Please select a customer'

    const missing = items.some((row) => !row.source || !row.productId || !row.quantity || Number(row.quantity) <= 0)
    const missingPackaging = items.some((row) => row.source === SOURCE_FINISHED_GOODS && !row.packaging)
    if (missing) nextErrors.items = 'Please complete source, product, and quantity for all rows'
    if (!missing && missingPackaging) nextErrors.items = 'Please select packaging for finished goods rows'

    const overLimitRow = items.find((row) => {
      const product = getProduct(row.source, row.productId)
      if (!product || !hasStockLimit(product)) return false
      return Number(row.quantity) > product.available
    })

    if (overLimitRow) nextErrors.items = 'Quantity cannot be over available stock'

    const totalBySourceAndProduct = items.reduce((acc, row) => {
      if (!row.source || !row.productId) return acc
      const key = `${row.source}::${row.productId}`
      acc[key] = (acc[key] || 0) + Number(row.quantity || 0)
      return acc
    }, {})

    const productOverTotal = Object.entries(totalBySourceAndProduct).find(([key, total]) => {
      const [source, productId] = key.split('::')
      const product = getProduct(source, productId)
      return product && hasStockLimit(product) && total > product.available
    })

    if (productOverTotal) {
      const [source, productId] = productOverTotal[0].split('::')
      const product = getProduct(source, productId)
      const sourceName = SOURCE_OPTIONS.find((entry) => entry.value === source)?.label || source
      nextErrors.items = `${product.name} (${sourceName}): total quantity cannot be over ${product.available} ${product.unit}`
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)

    try {
      const payload = {
        go_no: goNo,
        dispatch_date: date,
        vehicle_no: vehicleNo,
        driver_name: driverName,
        driver_phone: driverPhone,
        driver_cnic: driverCnic,
        customer_name: customer?.name || '',
        address,
        note,
        numbering: '',
        batch_number: '',
        status: 'Dispatched',
        items: items.map((row) => {
          const product = getProduct(row.source, row.productId)
          const weightPerCarton = row.source === SOURCE_FINISHED_GOODS ? Number(row.weightPerCarton || 0) : 0
          const totalWeight = weightPerCarton > 0 ? weightPerCarton * Number(row.quantity || 0) : 0
          return {
            source: SOURCE_OPTIONS.find((entry) => entry.value === row.source)?.label || row.source,
            sourceType: row.source,
            productId: product?.id ?? row.productId,
            finishedGoodsId: product?.finishedGoodsId ?? null,
            finished_goods_id: product?.finishedGoodsId ?? null,
            finishedGoodsProductIndex: product?.finishedGoodsProductIndex ?? null,
            finished_goods_product_index: product?.finishedGoodsProductIndex ?? null,
            finishedGoodsStockRow: Boolean(product?.finishedGoodsStockRow),
            finished_goods_stock_row: Boolean(product?.finishedGoodsStockRow),
            packaging: row.source === SOURCE_FINISHED_GOODS ? row.packaging : '',
            packing: row.source === SOURCE_FINISHED_GOODS ? row.packaging : '',
            inventoryItemId: product?.inventoryItemId ?? null,
            inventory_item_id: product?.inventoryItemId ?? null,
            productName: product?.name || '',
            brand: product?.brand || '',
            category: product?.category || '',
            categoryName: product?.category || '',
            subCategory: product?.subCategory || '',
            subcategory: product?.subCategory || '',
            numbering: row.source === SOURCE_FINISHED_GOODS ? row.numbering || '' : '',
            batchNumber: row.source === SOURCE_FINISHED_GOODS ? row.batchNumber || '' : '',
            batch_number: row.source === SOURCE_FINISHED_GOODS ? row.batchNumber || '' : '',
            quantity: Number(row.quantity),
            unit: row.unit || product?.unit || 'Unit',
            weightPerCarton,
            weight_per_carton: weightPerCarton,
            totalWeight,
            total_weight: totalWeight,
            comment: row.comment || '',
            itemComment: row.comment || '',
            item_comment: row.comment || '',
          }
        }),
      }

      await gateOutwardApi.create(payload)
      incrementStoreEntries('gate-outward')
      router.push('/gate-outward')
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        form: err?.message || 'Unable to save gate outward entry. Please check backend connection.',
      }))
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div style={{ ...s.wrapper, maxWidth: isMobile ? '100%' : 1480 }}>
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

          <div style={{ ...s.driverRow, gridTemplateColumns: isMobile ? '1fr 1fr' : s.driverRow.gridTemplateColumns }}>
            <input style={s.input} placeholder="Vehicle No." value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
            <input style={s.input} placeholder="Driver Name" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
            <input style={s.input} placeholder="Driver Phone" value={driverPhone} maxLength={11} inputMode="numeric" onChange={(e) => setDriverPhone(limitPhoneNumber(e.target.value))} />
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
            const productsForSource = getProductsForSource(item.source)
            const product = getProduct(item.source, item.productId)
            const packagingOptions = [
              ...(product?.packing ? [{ value: product.packing, label: product.packing }] : []),
              ...packagingTypes
                .filter((entry) => String(entry.name) !== String(product?.packing || ''))
                .map((entry) => ({ value: entry.name, label: entry.name })),
            ]

            let availableText = 'Select source first'
            if (item.source && productsForSource.length === 0) availableText = 'No products available for selected source'
            if (item.source && productsForSource.length > 0) availableText = 'Select product to view available stock'
            if (product && hasStockLimit(product)) availableText = `Available: ${product.available} ${product.unit}`
            if (product && !hasStockLimit(product)) availableText = `Unit: ${product.unit}`

            return (
              <div key={item.key} style={s.itemBlock} data-go-item-block>
                <div
                  style={{
                    ...s.itemRow,
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                  }}
                >
                  <div style={{ ...s.itemField, flex: isMobile ? '1 1 100%' : '0 0 145px' }}>
                    {idx === 0 && <label style={s.label}>Source</label>}
                    <StoreThemeDropdown
                      value={item.source}
                      onChange={(nextSource) => updateItem(item.key, 'source', nextSource)}
                      onSelectComplete={(_, __, triggerEl) => focusNextItemCell(triggerEl)}
                      variant="input"
                      placeholder="Source"
                      triggerProps={{ 'data-go-item-cell': true }}
                      options={[
                        { value: '', label: 'Source' },
                        ...SOURCE_OPTIONS.map((entry) => ({ value: entry.value, label: entry.label })),
                      ]}
                    />
                  </div>

                  <div style={{ ...s.itemField, flex: isMobile ? '1 1 100%' : '1 1 190px', minWidth: isMobile ? undefined : 180 }}>
                    {idx === 0 && <label style={s.label}>Select Product</label>}
                    <StoreThemeDropdown
                      value={item.productId}
                      onChange={(nextProductId) => updateItem(item.key, 'productId', nextProductId)}
                      onSelectComplete={(_, __, triggerEl) => focusNextItemCell(triggerEl)}
                      disabled={!item.source}
                      variant="input"
                      triggerProps={{ 'data-go-item-cell': true }}
                      placeholder={
                        !item.source
                          ? 'Select source first'
                          : productsForSource.length === 0
                            ? 'No products found'
                            : 'Select Product'
                      }
                      options={[
                        {
                          value: '',
                          label: !item.source
                            ? 'Select source first'
                            : productsForSource.length === 0
                              ? 'No products found'
                              : 'Select Product',
                        },
                        ...productsForSource.map((entry) => ({
                          value: entry.id,
                          label: `${entry.name}${entry.brand ? ` (${entry.brand})` : ''}`,
                        })),
                      ]}
                    />
                  </div>

                  {item.source === SOURCE_FINISHED_GOODS && (
                    <div style={{ ...s.itemField, flex: isMobile ? '1 1 100%' : '0 0 150px' }}>
                      {idx === 0 && <label style={s.label}>Packaging</label>}
                      <StoreThemeDropdown
                        value={item.packaging}
                        onChange={(nextPackaging) => updateItem(item.key, 'packaging', nextPackaging)}
                        onSelectComplete={(_, __, triggerEl) => focusNextItemCell(triggerEl)}
                        variant="input"
                        triggerProps={{ 'data-go-item-cell': true }}
                        placeholder={loadingOptions ? 'Loading packaging...' : 'Select Packaging'}
                        options={[
                          { value: '', label: loadingOptions ? 'Loading packaging...' : 'Select Packaging' },
                          ...packagingOptions,
                        ]}
                      />
                    </div>
                  )}

                  {item.source === SOURCE_FINISHED_GOODS && (
                    <>
                      <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 6px)' : '0 0 120px' }}>
                        {idx === 0 && <label style={s.label}>Numbering</label>}
                        <input
                          style={s.input}
                          data-go-item-cell
                          placeholder="Manual or auto"
                          value={item.numbering}
                          onKeyDown={handleItemCellKeyDown}
                          onChange={(e) => updateItem(item.key, 'numbering', e.target.value)}
                        />
                      </div>

                      <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 6px)' : '0 0 120px' }}>
                        {idx === 0 && <label style={s.label}>Batch No</label>}
                        <input
                          style={s.input}
                          data-go-item-cell
                          placeholder="Batch No"
                          value={item.batchNumber}
                          onKeyDown={handleItemCellKeyDown}
                          onChange={(e) => updateItem(item.key, 'batchNumber', e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : '0 0 105px' }}>
                    {idx === 0 && <label style={s.label}>Quantity</label>}
                    <input
                      style={s.input}
                      type="number"
                      min="1"
                      data-go-item-cell
                      placeholder="Quantity"
                      value={item.quantity}
                      onKeyDown={handleItemCellKeyDown}
                      onChange={(e) => updateItem(item.key, 'quantity', e.target.value)}
                    />
                  </div>

                  {item.source === SOURCE_FINISHED_GOODS && (
                    <>
                      <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : '0 0 130px' }}>
                        {idx === 0 && <label style={s.label}>Weight Per Carton</label>}
                        <input
                          style={s.input}
                          type="number"
                          min="0"
                          step="0.01"
                          data-go-item-cell
                          placeholder="Weight / carton"
                          value={item.weightPerCarton}
                          onKeyDown={handleItemCellKeyDown}
                          onChange={(e) => updateItem(item.key, 'weightPerCarton', e.target.value)}
                        />
                      </div>

                      <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : '0 0 105px' }}>
                        {idx === 0 && <label style={s.label}>Total Weight</label>}
                        <div style={s.readonlyInput}>
                          {Number(item.weightPerCarton || 0) > 0 && Number(item.quantity || 0) > 0
                            ? Number(Number(item.weightPerCarton || 0) * Number(item.quantity || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                            : '-'}
                        </div>
                      </div>
                    </>
                  )}

                  <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : '0 0 95px' }}>
                    {idx === 0 && <label style={s.label}>Unit</label>}
                    <StoreThemeDropdown
                      value={item.unit}
                      onChange={(nextUnit) => updateItem(item.key, 'unit', nextUnit)}
                      onSelectComplete={(_, __, triggerEl) => focusNextItemCell(triggerEl)}
                      variant="input"
                      triggerProps={{ 'data-go-item-cell': true }}
                      options={unitOptions.map((u) => ({ value: u, label: u }))}
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

                <div style={s.itemCommentWrap}>
                  <label style={s.label}>Comment</label>
                  <textarea
                    style={{ ...s.input, ...s.textareaSmall }}
                    value={item.comment}
                    onChange={(e) => updateItem(item.key, 'comment', e.target.value)}
                    placeholder="Comment for this product..."
                  />
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
  wrapper: { width: '100%', maxWidth: 1480, margin: '0 auto', boxSizing: 'border-box' },

  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 40, border: '1.5px solid #d4dfd4', background: '#ffffff', color: '#2d7a33', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  pageTitle: { fontSize: 30, fontWeight: 800, color: '#1a3d1f', margin: '0 0 4px', display: 'flex', alignItems: 'center', letterSpacing: '-0.6px', lineHeight: 1.2 },
  pageSubtitle: { fontSize: 13.5, color: '#7a8a7a', margin: 0, fontWeight: 500 },

  saveBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#54B45B', border: 'none', borderRadius: 40, padding: '11px 20px', fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'pointer' },
  saveBtnDisabled: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#b8dcbc', border: 'none', borderRadius: 40, padding: '11px 20px', fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'not-allowed' },
  cancelBtn: { border: '1.5px solid #d4dfd4', borderRadius: 40, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, color: '#2d7a33', background: '#ffffff', cursor: 'pointer' },

  card: { background: '#f2f4f2', borderRadius: 20, border: '1px solid #e2e8e2', padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box' },
  warningBanner: { background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, color: '#c2410c', fontSize: 12.5, padding: '8px 12px', marginBottom: 12 },

  topRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 },
  midRow: { display: 'flex', gap: 20, marginBottom: 14 },
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
  itemBlock: { marginBottom: 10, overflow: 'visible', paddingBottom: 2 },
  itemRow: { display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' },
  itemCommentWrap: { marginTop: 8, maxWidth: 520 },
  stockHint: { margin: '4px 0 0', fontSize: 11.5, paddingLeft: 2 },

  removeBtn: { background: '#fff5f5', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 6, padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 36 },

  formFooter: { display: 'flex', gap: 10, justifyContent: 'center', marginTop: 28, paddingTop: 20, borderTop: '1px solid #f3f4f6' },
}



