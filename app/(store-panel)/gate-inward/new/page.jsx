'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { gateInwardApi, suppliersApi, brandsApi, categoriesApi, productsApi, unitsApi } from '@/infrastructure/api/endpoints'
import { incrementStoreEntries } from '@/application/services/store/storeEntryTracker'
import { Plus, X, ArrowLeft, Save, ChevronDown } from 'lucide-react'
import { StoreThemeDatePicker } from '@/components/store/shared/StoreThemeControls'

const DEFAULT_UNITS = ['Unit', 'Bags', 'Carton', 'Dozen', 'KG', 'Litre']

/* Auto-generate GR number */
const getNextGR = () => `QUD${Math.floor(Math.random() * 900) + 100}`

/* Today in YYYY-MM-DD for date input */
const todayISO = () => new Date().toISOString().split('T')[0]

/* Fresh blank item row */
const blankItem = (defaultUnit = 'Unit') => ({
  key: Date.now() + Math.random(),
  brandId: '', brandName: '',
  categoryId: '', categoryName: '',
  productId: '', productName: '',
  quantity: '', unit: defaultUnit,
})

function DropdownField({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  hasError = false,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const selected = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [options, value]
  )

  useEffect(() => {
    const handleOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div ref={rootRef} style={s.dropdownWrap} className="store-theme-dropdown">
      <button
        type="button"
        className="store-theme-dropdown-trigger"
        style={{
          ...s.dropdownTrigger,
          ...(disabled ? s.dropdownDisabled : {}),
          ...(hasError ? s.inputError : {}),
        }}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
      >
        <span style={selected ? s.dropdownValue : s.dropdownPlaceholder}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          size={14}
          style={{ ...s.dropdownChevron, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && !disabled ? (
        <div style={s.dropdownMenu} className="store-theme-dropdown-menu">
          {options.map((option) => {
            const active = String(option.value) === String(value)
            return (
              <button
                key={String(option.value)}
                type="button"
                className={`store-theme-dropdown-item${active ? ' store-theme-dropdown-item-active' : ''}`}
                style={{ ...s.dropdownItem, ...(active ? s.dropdownItemActive : {}) }}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default function GateInwardNewPage() {
  const router = useRouter()

  const [grNo, setGrNo] = useState(getNextGR())
  const [receiveDate, setReceiveDate] = useState(todayISO())
  const [supplierId, setSupplierId] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState([blankItem()])
  const [saving, setSaving] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState({})
  const [isMobile, setIsMobile] = useState(false)

  const [suppliers, setSuppliers] = useState([])
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [units, setUnits] = useState(DEFAULT_UNITS)

  useEffect(() => {
    let active = true

    const loadOptions = async () => {
      setLoadingOptions(true)
      setLoadError('')

      try {
        const [nextGrRes, suppliersRes, brandsRes, categoriesRes, productsRes, unitsRes] = await Promise.all([
          gateInwardApi.nextGR(),
          suppliersApi.list(),
          brandsApi.list(),
          categoriesApi.list(),
          productsApi.list(),
          unitsApi.list(),
        ])

        if (!active) return

        const suppliersList = Array.isArray(suppliersRes) ? suppliersRes : (suppliersRes?.results || [])
        const brandsList = Array.isArray(brandsRes) ? brandsRes : (brandsRes?.results || [])
        const categoriesListRaw = Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes?.results || [])
        const productsListRaw = Array.isArray(productsRes) ? productsRes : (productsRes?.results || [])
        const unitsListRaw = Array.isArray(unitsRes) ? unitsRes : (unitsRes?.results || [])

        const normalizedCategories = categoriesListRaw.map((entry) => ({
          ...entry,
          brandId: String(entry.brand ?? entry.brand_id ?? ''),
        }))

        const normalizedProducts = productsListRaw.map((entry) => ({
          ...entry,
          categoryId: String(entry.category ?? entry.category_id ?? ''),
        }))

        const unitNames = Array.from(
          new Set(
            unitsListRaw
              .map((entry) => String(entry?.name || '').trim())
              .filter(Boolean)
          )
        )

        const resolvedUnits = unitNames.length ? unitNames : DEFAULT_UNITS

        setGrNo(nextGrRes?.gr_no || getNextGR())
        setSuppliers(suppliersList)
        setBrands(brandsList)
        setCategories(normalizedCategories)
        setProducts(normalizedProducts)
        setUnits(resolvedUnits)
        setItems((prev) => prev.map((item) => ({ ...item, unit: item.unit || resolvedUnits[0] || 'Unit' })))
      } catch {
        if (!active) return
        setLoadError('Failed to load settings data. Please refresh and try again.')
      } finally {
        if (active) setLoadingOptions(false)
      }
    }

    loadOptions()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mobileQuery = window.matchMedia('(max-width: 640px)')
    const apply = () => setIsMobile(mobileQuery.matches)
    apply()
    mobileQuery.addEventListener('change', apply)
    return () => mobileQuery.removeEventListener('change', apply)
  }, [])

  /* Supplier selected */
  const handleSupplierChange = (nextValue) => {
    if (nextValue === '') {
      setSupplierId('')
      setAddress('')
      setErrors((err) => ({ ...err, supplier: undefined }))
      return
    }

    setSupplierId(String(nextValue))
    const selectedSupplier = suppliers.find((entry) => String(entry.id) === String(nextValue))
    setAddress(selectedSupplier?.address || '')
    setErrors((err) => ({ ...err, supplier: undefined }))
  }

  /* Item row update */
  const updateItem = (key, field, value) => {
    setItems((prev) => prev.map((item) => {
      if (item.key !== key) return item

      const updated = { ...item, [field]: value }

      if (field === 'brandId') {
        const selectedBrand = brands.find((entry) => String(entry.id) === String(value))
        updated.brandName = selectedBrand?.name || ''
        updated.categoryId = ''
        updated.categoryName = ''
        updated.productId = ''
        updated.productName = ''
      }

      if (field === 'categoryId') {
        const selectedCategory = categories.find((entry) => String(entry.id) === String(value))
        updated.categoryName = selectedCategory?.name || ''
        updated.productId = ''
        updated.productName = ''
      }

      if (field === 'productId') {
        const selectedProduct = products.find((entry) => String(entry.id) === String(value))
        updated.productName = selectedProduct?.name || ''
      }

      return updated
    }))

    setErrors((err) => ({ ...err, items: undefined }))
  }

  const addItem = () => setItems((prev) => [...prev, blankItem(units[0] || 'Unit')])
  const removeItem = (key) => setItems((prev) => prev.filter((entry) => entry.key !== key))

  /* Validate */
  const validate = () => {
    const nextErrors = {}

    if (!supplierId) nextErrors.supplier = 'Please select a supplier'

    const incomplete = items.some((item) => (
      !item.brandId || !item.categoryId || !item.productId || !item.quantity || Number(item.quantity) <= 0 || !item.unit
    ))

    if (incomplete) nextErrors.items = 'Please complete all item fields with valid quantity'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  /* Save */
  const handleSave = async () => {
    if (!validate()) return

    setSaving(true)
    setErrors((prev) => ({ ...prev, submit: undefined }))

    try {
      const selectedSupplier = suppliers.find((entry) => String(entry.id) === String(supplierId))

      const payloadItems = items.map((item) => ({
        brandId: Number(item.brandId),
        brandName: item.brandName,
        categoryId: Number(item.categoryId),
        categoryName: item.categoryName,
        productId: Number(item.productId),
        productName: item.productName,
        quantity: Number(item.quantity),
        unit: item.unit,
      }))

      await gateInwardApi.create({
        gr_no: grNo,
        supplier: Number(supplierId),
        supplier_name: selectedSupplier?.name || '',
        address: address.trim(),
        note: note.trim(),
        receive_date: receiveDate,
        status: 'Received',
        items: payloadItems,
      })

      incrementStoreEntries('gate-inward')
      router.push('/gate-inward')
    } catch {
      setErrors((prev) => ({
        ...prev,
        submit: 'Failed to save gate inward entry. Please try again.',
      }))
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div style={{ ...s.wrapper, maxWidth: isMobile ? '100%' : 1100 }}>

        {/* Page Header */}
        <div style={s.pageHeader}>
          <div style={{ ...s.headerLeft, width: isMobile ? '100%' : 'auto' }}>
            <button style={s.backBtn} onClick={() => router.push('/gate-inward')}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...s.pageTitle, fontSize: isMobile ? 20 : 30 }}>Gate Inward</h1>
              <p style={{ ...s.pageSubtitle, fontSize: isMobile ? 12 : 13.5 }}>Add new entry</p>
            </div>
          </div>
          <button
            style={{ ...(saving || loadingOptions ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }}
            onClick={handleSave}
            disabled={saving || loadingOptions}
          >
            <Save size={15} /> {saving ? 'Saving...' : 'SAVE'}
          </button>
        </div>

        {/* Form Card */}
        <div style={{ ...s.card, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 14 : 24 }}>

          {loadError ? <div style={s.itemsError}>{loadError}</div> : null}
          {errors.submit ? <div style={s.itemsError}>{errors.submit}</div> : null}

          {/* Top Row: GR, Date, Supplier */}
          <div style={{ ...s.topRow, gridTemplateColumns: isMobile ? '1fr' : s.topRow.gridTemplateColumns }}>
            {/* GR Number (read-only, auto) */}
            <div style={s.fieldGroup}>
              <label style={s.label}>GR Number:</label>
              <div style={s.readonlyInput}>{grNo}</div>
            </div>

            {/* Receive Date (auto today, changeable) */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Receive Date:</label>
              <StoreThemeDatePicker
                value={receiveDate}
                onChange={setReceiveDate}
                placeholder="Select date"
                variant="input"
              />
            </div>

            {/* Supplier dropdown */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Supplier Name:</label>
              <DropdownField
                value={supplierId}
                onChange={handleSupplierChange}
                hasError={Boolean(errors.supplier)}
                disabled={loadingOptions}
                placeholder="-- Select Supplier --"
                options={[
                  { value: '', label: '-- Select Supplier --' },
                  ...suppliers.map((sup) => ({ value: String(sup.id), label: sup.name })),
                ]}
              />
              {errors.supplier && <span style={s.errorText}>{errors.supplier}</span>}
            </div>
          </div>

          {/* Address & Note */}
          <div style={s.midRow}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Address*:</label>
              <textarea
                style={{ ...s.input, ...s.textarea }}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Auto-filled from supplier selection"
                readOnly={!!supplierId}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Note*:</label>
              <textarea
                style={{ ...s.input, ...s.textarea }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note..."
              />
            </div>
          </div>

          {/* Add item button */}
          <div style={s.itemsHeader}>
            <button style={s.addItemBtn} onClick={addItem} disabled={loadingOptions}>
              <Plus size={15} />
            </button>
          </div>

          <div style={s.divider} />

          {/* Item Rows */}
          {errors.items && <div style={s.itemsError}>{errors.items}</div>}

          {items.map((item, idx) => {
                      const brandCats = categories.filter((entry) => !entry.brandId || String(entry.brandId) === String(item.brandId))
            const catProds = products.filter((entry) => String(entry.categoryId) === String(item.categoryId))

            return (
              <div key={item.key} style={s.itemRow}>
                {/* Brand */}
                <div style={s.itemField}>
                  {idx === 0 && <label style={s.label}>Select Brand</label>}
                  <DropdownField
                    value={item.brandId}
                    onChange={(next) => updateItem(item.key, 'brandId', String(next))}
                    disabled={loadingOptions}
                    placeholder="Select Brand"
                    options={[
                      { value: '', label: 'Select Brand' },
                      ...brands.map((entry) => ({ value: String(entry.id), label: entry.name })),
                    ]}
                  />
                </div>

                {/* Category (brand-filtered) */}
                <div style={s.itemField}>
                  {idx === 0 && <label style={s.label}>Select Category</label>}
                  <DropdownField
                    value={item.categoryId}
                    onChange={(next) => updateItem(item.key, 'categoryId', String(next))}
                    disabled={loadingOptions || !item.brandId}
                    placeholder="Select Category"
                    options={[
                      { value: '', label: 'Select Category' },
                      ...brandCats.map((entry) => ({ value: String(entry.id), label: entry.name })),
                    ]}
                  />
                </div>

                {/* Product (category-filtered) */}
                <div style={s.itemField}>
                  {idx === 0 && <label style={s.label}>Select Product</label>}
                  <DropdownField
                    value={item.productId}
                    onChange={(next) => updateItem(item.key, 'productId', String(next))}
                    disabled={loadingOptions || !item.categoryId}
                    placeholder="Select Product"
                    options={[
                      { value: '', label: 'Select Product' },
                      ...catProds.map((entry) => ({ value: String(entry.id), label: entry.name })),
                    ]}
                  />
                </div>

                {/* Quantity */}
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

                {/* Unit */}
                <div style={{ ...s.itemField, flex: isMobile ? '1 1 calc(50% - 5px)' : '0 0 120px' }}>
                  {idx === 0 && <label style={s.label}>Select Unit</label>}
                  <DropdownField
                    value={item.unit}
                    onChange={(next) => updateItem(item.key, 'unit', String(next))}
                    disabled={loadingOptions}
                    placeholder="Select Unit"
                    options={units.map((entry) => ({ value: entry, label: entry }))}
                  />
                </div>

                {/* Remove */}
                <div style={{ ...s.itemField, flex: isMobile ? '1 1 100%' : '0 0 36px', alignSelf: isMobile ? 'flex-start' : 'flex-end' }}>
                  {items.length > 1 && (
                    <button style={s.removeBtn} onClick={() => removeItem(item.key)} title="Remove item">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Bottom Save Button */}
          <div style={s.formFooter}>
            <button style={{ ...s.cancelBtn, width: isMobile ? '100%' : 'auto' }} onClick={() => router.push('/gate-inward')}>Cancel</button>
            <button
              style={{ ...(saving || loadingOptions ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }}
              onClick={handleSave}
              disabled={saving || loadingOptions}
            >
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
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#54B45B',
    border: 'none',
    borderRadius: 40,
    padding: '11px 20px',
    fontSize: 13.5,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
  },
  saveBtnDisabled: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#b8dcbc',
    border: 'none',
    borderRadius: 40,
    padding: '11px 20px',
    fontSize: 13.5,
    fontWeight: 700,
    color: '#fff',
    cursor: 'not-allowed',
  },
  cancelBtn: {
    border: '1.5px solid #d4dfd4',
    borderRadius: 40,
    padding: '11px 20px',
    fontSize: 13.5,
    fontWeight: 600,
    color: '#2d7a33',
    background: '#ffffff',
    cursor: 'pointer',
  },
  card: { background: '#f2f4f2', borderRadius: 20, border: '1px solid #e2e8e2', padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  topRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 },
  midRow: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  itemField: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 130 },
  label: { fontSize: 12, fontWeight: 700, color: '#607062' },
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
  dropdownWrap: {
    position: 'relative',
    width: '100%',
  },
  dropdownTrigger: {
    width: '100%',
    minHeight: 40,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d4dfd4',
    borderRadius: 10,
    background: '#ffffff',
    color: '#1f2f21',
    padding: '9px 12px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    cursor: 'pointer',
    textAlign: 'left',
  },
  dropdownValue: {
    color: '#1f2f21',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dropdownPlaceholder: {
    color: '#8a9a8a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dropdownChevron: {
    color: '#607062',
    transition: 'transform 0.18s ease',
    flexShrink: 0,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    zIndex: 40,
    border: '1px solid #d4dfd4',
    borderRadius: 10,
    background: '#ffffff',
    boxShadow: '0 12px 28px rgba(26, 61, 31, 0.12)',
    overflow: 'auto',
    maxHeight: 220,
    padding: 4,
  },
  dropdownItem: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 12.5,
    color: '#1f2f21',
    textAlign: 'left',
    cursor: 'pointer',
  },
  dropdownItemActive: {
    background: '#e8f0e8',
    color: '#1f7a2b',
    fontWeight: 700,
  },
  dropdownDisabled: {
    background: '#f4f6f4',
    color: '#9aa69a',
    cursor: 'not-allowed',
  },
  inputError: { borderColor: '#fca5a5', background: '#fff1f2' },
  readonlyInput: { background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#374151', fontWeight: 700 },
  textarea: { height: 84, resize: 'vertical', fontFamily: 'inherit' },
  errorText: { fontSize: 12, color: '#b91c1c', marginTop: 2 },
  itemsError: { background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, color: '#b91c1c', marginBottom: 12 },
  itemsHeader: { display: 'flex', justifyContent: 'flex-end', marginBottom: 10 },
  addItemBtn: { background: '#54B45B', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' },
  divider: { height: 1, background: '#d4dfd4', marginBottom: 12 },
  itemRow: { display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #d4dfd4', borderRadius: 12, background: '#ffffff', padding: 10 },
  removeBtn: { background: '#fff1f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 36 },
  formFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid #d4dfd4', flexWrap: 'wrap' },
}


