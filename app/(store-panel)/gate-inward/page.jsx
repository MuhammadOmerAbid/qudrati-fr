'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { categoriesApi } from '@/infrastructure/api/endpoints'
import {
  ArrowDownToLine, Plus, Eye, Trash2, RotateCcw,
  FileText, Download, Search, Calendar,
  ChevronDown, ChevronLeft, ChevronRight, Edit2, X, CheckSquare, Square, FileSpreadsheet
} from 'lucide-react'

const MOCK_SUPPLIERS = [
  { id: 1, name: 'Soghat Enterprises', address: 'Plot 12, Industrial Area, Lahore' },
  { id: 2, name: 'Al-Faisal Trading', address: 'Shop 5, Main Market, Karachi' },
  { id: 3, name: 'Hassan & Sons', address: 'Block C, Gulberg III, Lahore' },
]
const MOCK_BRANDS = [
  { id: 1, name: 'Soghat' },
  { id: 2, name: 'General' },
  { id: 3, name: 'Premium' },
]
const MOCK_CATEGORIES = [
  { id: 1, brandId: 2, name: 'Seal' },
  { id: 2, brandId: 1, name: 'Bottle' },
  { id: 3, brandId: 1, name: 'Sticker' },
  { id: 4, brandId: 3, name: 'Carton' },
]
const MOCK_PRODUCTS = [
  { id: 1, categoryId: 1, name: '69 mm Seal' },
  { id: 2, categoryId: 1, name: '72 MM Seal' },
  { id: 3, categoryId: 2, name: '500ml Bottle' },
  { id: 4, categoryId: 2, name: '1L Bottle' },
  { id: 5, categoryId: 3, name: 'Front Sticker' },
  { id: 6, categoryId: 4, name: 'Standard Carton' },
]
const MOCK_UNITS = ['Unit', 'Bags', 'Carton', 'Dozen', 'KG', 'Litre']

const INITIAL_RECORDS = [
  { id: 1, grNo: 'QUD1', supplierId: 1, supplierName: 'Soghat Enterprises', address: 'Plot 12, Industrial Area, Lahore', note: 'First delivery', receiveDate: '27/05/2025', status: 'Received', items: [{ brandId: 2, brandName: 'General', categoryId: 1, categoryName: 'Seal', productId: 1, productName: '69 mm seal', quantity: 12000, unit: 'Unit' }] },
  { id: 2, grNo: 'QUD2', supplierId: 2, supplierName: 'Al-Faisal Trading', address: 'Shop 5, Main Market, Karachi', note: '', receiveDate: '27/05/2025', status: 'Received', items: [{ brandId: 2, brandName: 'General', categoryId: 1, categoryName: 'Seal', productId: 2, productName: '72 MM Seal', quantity: 9800, unit: 'Unit' }, { brandId: 2, brandName: 'General', categoryId: 1, categoryName: 'Seal', productId: 1, productName: '69 mm seal', quantity: 10500, unit: 'Unit' }] },
  { id: 3, grNo: 'QUD3', supplierId: 1, supplierName: 'Soghat Enterprises', address: 'Plot 12, Industrial Area, Lahore', note: 'Urgent order', receiveDate: '27/05/2025', status: 'Pending', items: [{ brandId: 2, brandName: 'General', categoryId: 1, categoryName: 'Seal', productId: 2, productName: '72 MM Seal', quantity: 1300, unit: 'Unit' }] },
  { id: 4, grNo: 'QUD4', supplierId: 3, supplierName: 'Hassan & Sons', address: 'Block C, Gulberg III, Lahore', note: '', receiveDate: '27/05/2025', status: 'Received', items: [{ brandId: 2, brandName: 'General', categoryId: 1, categoryName: 'Seal', productId: 1, productName: '69 mm seal', quantity: 1200, unit: 'Unit' }] },
  { id: 5, grNo: 'QUD5', supplierId: 1, supplierName: 'Soghat Enterprises', address: 'Plot 12, Industrial Area, Lahore', note: '', receiveDate: '03/06/2025', status: 'Received', items: [{ brandId: 2, brandName: 'General', categoryId: 1, categoryName: 'Seal', productId: 1, productName: '69 mm seal', quantity: 1230, unit: 'Unit' }] },
  { id: 6, grNo: 'QUD6', supplierId: 2, supplierName: 'Al-Faisal Trading', address: 'Shop 5, Main Market, Karachi', note: 'Old stock', receiveDate: '08/06/1999', status: 'Pending', items: [{ brandId: 2, brandName: 'General', categoryId: 1, categoryName: 'Seal', productId: 2, productName: '72 MM Seal', quantity: 33, unit: 'Bags' }] },
]

function fmtItems(items, field) { return items.map(i => i[field]).join(', ') }
function fmtQty(items) { return items.map(i => `${i.quantity} ${i.unit}`).join(', ') }

function DropdownField({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  compact = false,
  wrapStyle = {},
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const selected = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [options, value]
  )

  useEffect(() => {
    const onOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onEsc = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  return (
    <div ref={rootRef} style={{ ...s.dropdownWrap, ...wrapStyle }} className="store-theme-dropdown">
      <button
        type="button"
        className="store-theme-dropdown-trigger"
        style={{
          ...s.dropdownTrigger,
          ...(compact ? s.dropdownTriggerCompact : {}),
          ...(disabled ? s.dropdownDisabled : {}),
        }}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
      >
        <span style={selected ? s.dropdownValue : s.dropdownPlaceholder}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          size={12}
          style={{ ...s.dropdownChevronIcon, transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)` }}
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

// UPDATED: DatePicker with auto-positioning and right alignment option
function DatePicker({ value, onChange, placeholder = "Select date", alignRight = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const [tempDate, setTempDate] = useState(value ? new Date(value) : null)
  const [displayValue, setDisplayValue] = useState(value || '')
  const [calendarPosition, setCalendarPosition] = useState({
    position: 'fixed',
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    transform: 'translate(-50%, -50%)',
    width: 'min(320px, calc(100vw - 28px))',
    maxWidth: 'calc(100vw - 28px)',
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
  })
  const pickerRef = useRef(null)
  const buttonRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const currentDate = tempDate || new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()

  const calculatePosition = () => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const calendarHeight = 320
    const mobile = viewportWidth <= 640

    if (mobile) {
      setCalendarPosition({
        position: 'fixed',
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        transform: 'translate(-50%, -50%)',
        width: 'min(320px, calc(100vw - 28px))',
        maxWidth: 'calc(100vw - 28px)',
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
      })
      return
    }

    const calendarWidth = Math.min(320, viewportWidth - 28)
    const spaceBelow = viewportHeight - rect.bottom
    const placeAbove = spaceBelow < calendarHeight && rect.top > spaceBelow
    const desiredLeft = alignRight ? rect.right - calendarWidth : rect.left
    const clampedLeft = Math.max(14, Math.min(desiredLeft, viewportWidth - calendarWidth - 14))

    setCalendarPosition({
      position: 'fixed',
      top: placeAbove ? Math.max(12, rect.top - calendarHeight - 8) : Math.min(viewportHeight - calendarHeight - 12, rect.bottom + 8),
      left: clampedLeft,
      right: 'auto',
      bottom: 'auto',
      transform: 'none',
      width: calendarWidth,
      maxWidth: calendarWidth,
      maxHeight: 'calc(100vh - 24px)',
      overflowY: 'auto',
    })
  }

  useEffect(() => {
    if (isOpen) {
      calculatePosition()
      window.addEventListener('resize', calculatePosition)
      window.addEventListener('scroll', calculatePosition)
      return () => {
        window.removeEventListener('resize', calculatePosition)
        window.removeEventListener('scroll', calculatePosition)
      }
    }
  }, [isOpen, alignRight])

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target
      const clickedTrigger = containerRef.current?.contains(target)
      const clickedPicker = pickerRef.current?.contains(target)
      if (!clickedTrigger && !clickedPicker) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDateSelect = (day) => {
    const selected = new Date(currentYear, currentMonth, day)
    const formattedDate = selected.toISOString().split('T')[0]
    setTempDate(selected)
    setDisplayValue(formattedDate)
    onChange(formattedDate)
    setIsOpen(false)
  }

  const handleToday = () => {
    const today = new Date()
    const formattedDate = today.toISOString().split('T')[0]
    setTempDate(today)
    setDisplayValue(formattedDate)
    onChange(formattedDate)
    setIsOpen(false)
  }

  const handleClear = () => {
    setTempDate(null)
    setDisplayValue('')
    onChange('')
    setIsOpen(false)
  }

  const changeMonth = (increment) => {
    setTempDate(new Date(currentYear, currentMonth + increment, 1))
  }

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth)
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
    const days = []
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

    weekdays.forEach(day => {
      days.push(<div key={`header-${day}`} style={s.calendarWeekday}>{day}</div>)
    })

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} style={s.calendarDayEmpty}></div>)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = tempDate && 
        tempDate.getDate() === day && 
        tempDate.getMonth() === currentMonth && 
        tempDate.getFullYear() === currentYear
      const isToday = new Date().getDate() === day && 
        new Date().getMonth() === currentMonth && 
        new Date().getFullYear() === currentYear

      days.push(
        <button
          key={day}
          type="button"
          className="store-theme-calendar-day"
          onClick={() => handleDateSelect(day)}
          style={{
            ...s.calendarDay,
            ...(isSelected ? s.calendarDaySelected : {}),
            ...(isToday ? s.calendarDayToday : {})
          }}
        >
          {day}
        </button>
      )
    }

    return days
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const calendarPopup = isOpen ? (
    <div
      ref={pickerRef}
      className="store-theme-calendar-popup"
      style={{
        ...s.calendarContainer,
        ...calendarPosition,
        zIndex: 2200,
      }}
    >
      <div style={s.calendarHeader}>
        <button type="button" className="store-theme-calendar-nav-btn" onClick={() => changeMonth(-1)} style={s.calendarNavBtn}><ChevronLeft size={14} /></button>
        <span style={s.calendarMonthYear}>{monthNames[currentMonth]} {currentYear}</span>
        <button type="button" className="store-theme-calendar-nav-btn" onClick={() => changeMonth(1)} style={s.calendarNavBtn}><ChevronRight size={14} /></button>
      </div>
      <div style={s.calendarGrid}>{renderCalendar()}</div>
      <div style={s.calendarFooter}>
        <button type="button" className="store-theme-calendar-footer-btn" onClick={handleToday} style={s.calendarFooterBtn}>Today</button>
        <button type="button" className="store-theme-calendar-footer-btn" onClick={handleClear} style={s.calendarFooterBtn}>Clear</button>
      </div>
    </div>
  ) : null

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        ref={buttonRef}
        type="button"
        style={s.datePickerTrigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar size={13} color="#7a8a7a" />
        <span style={displayValue ? s.datePickerValue : s.datePickerPlaceholder}>
          {displayValue || placeholder}
        </span>
        <ChevronDown
          size={12}
          style={{ ...s.dropdownChevronIcon, transform: `translateY(-50%) rotate(${isOpen ? 180 : 0}deg)` }}
        />
      </button>

      {hasMounted && calendarPopup ? createPortal(calendarPopup, document.body) : null}
    </div>
  )
}

export default function GateInwardPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperUser = user?.role === 'superuser'

  const [records, setRecords] = useState(INITIAL_RECORDS)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All Status')
  const [filterBrand, setFilterBrand] = useState('All Brands')
  const [filterCategory, setFilterCategory] = useState('All Categories')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [selected, setSelected] = useState([])
  const [viewRecord, setViewRecord] = useState(null)
  const [editRecord, setEditRecord] = useState(null)
  const [showReportPanel, setShowReportPanel] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const sync = () => setIsMobile(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener('change', sync)
    return () => mediaQuery.removeEventListener('change', sync)
  }, [])

  const allBrands = useMemo(() => [...new Set(records.flatMap(r => r.items.map(i => i.brandName)))], [records])
  const allCategories = useMemo(() => {
    const fromRecords = records.flatMap(r => r.items.map(i => i.categoryName))
    const fromSettings = categoryOptions.map((entry) => entry.name)
    return [...new Set([...fromSettings, ...fromRecords].filter(Boolean))]
  }, [categoryOptions, records])

  useEffect(() => {
    let active = true
    categoriesApi.list()
      .then((data) => {
        if (!active) return
        const list = Array.isArray(data) ? data : []
        setCategoryOptions(list.filter((entry) => entry.status !== false))
      })
      .catch(() => {
        if (active) setCategoryOptions([])
      })
    return () => { active = false }
  }, [])

  const parseDate = (str) => {
    if (!str) return null
    if (str.includes('/')) {
      const [d, m, y] = str.split('/')
      return new Date(`${y}-${m}-${d}`)
    }
    return new Date(str)
  }

  const filtered = useMemo(() => records.filter(r => {
    const hay = [r.grNo, r.supplierName, r.address, r.note, r.receiveDate, r.status, ...r.items.map(i => `${i.brandName} ${i.categoryName} ${i.productName} ${i.quantity} ${i.unit}`)].join(' ').toLowerCase()
    const matchSearch = !search || hay.includes(search.toLowerCase())
    const matchStatus = filterStatus === 'All Status' || r.status === filterStatus
    const matchBrand = filterBrand === 'All Brands' || r.items.some(i => i.brandName === filterBrand)
    const matchCategory = filterCategory === 'All Categories' || r.items.some(i => i.categoryName === filterCategory)
    let matchDate = true
    if (filterDateFrom) matchDate = matchDate && parseDate(r.receiveDate) >= parseDate(filterDateFrom)
    if (filterDateTo) matchDate = matchDate && parseDate(r.receiveDate) <= parseDate(filterDateTo)
    return matchSearch && matchStatus && matchBrand && matchCategory && matchDate
  }), [records, search, filterStatus, filterBrand, filterCategory, filterDateFrom, filterDateTo])

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleAll = () => setSelected(s => s.length === filtered.length ? [] : filtered.map(r => r.id))
  const handleDelete = (id) => { if (window.confirm('Delete this record?')) setRecords(r => r.filter(x => x.id !== id)) }
  const handleBulkDelete = () => {
    if (!selected.length) return
    if (window.confirm(`Delete ${selected.length} selected records?`)) { setRecords(r => r.filter(x => !selected.includes(x.id))); setSelected([]) }
  }
  const handleSaveEdit = (updated) => { setRecords(r => r.map(x => x.id === updated.id ? updated : x)); setEditRecord(null) }

  const exportRows = selected.length > 0 ? records.filter(r => selected.includes(r.id)) : filtered

  const exportCSV = (rows) => {
    const headers = ['GR No', 'Supplier', 'Address', 'Brand', 'Category', 'Product', 'Quantity', 'Receive Date', 'Status', 'Note']
    const lines = rows.flatMap(r => r.items.map(item => [r.grNo, r.supplierName, r.address, item.brandName, item.categoryName, item.productName, `${item.quantity} ${item.unit}`, r.receiveDate, r.status, r.note].map(v => `"${v}"`).join(',')))
    const csv = [headers.join(','), ...lines].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'gate-inward-report.csv'; a.click()
  }

  const exportPDF = (rows) => {
    const win = window.open('', '_blank')
    win.document.write(`<html><head><title>Gate Inward Report</title><style>body{font-family:Arial;padding:20px;font-size:12px}h2{color:#2d7a33}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#f0fdf4;color:#1a2e1b;padding:8px;text-align:left;border-bottom:2px solid #bbf7d0}td{padding:7px 8px;border-bottom:1px solid #e5e7eb}.r{background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}.p{background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}</style></head><body><h2>Gate Inward Report</h2><p style="color:#6b7280">Generated: ${new Date().toLocaleDateString('en-PK')}</p><table><thead><tr><th>GR No</th><th>Supplier</th><th>Brand</th><th>Category</th><th>Product</th><th>Quantity</th><th>Date</th><th>Status</th></tr></thead><tbody>${rows.flatMap(r => r.items.map(item => `<tr><td>${r.grNo}</td><td>${r.supplierName}</td><td>${item.brandName}</td><td>${item.categoryName}</td><td>${item.productName}</td><td>${item.quantity} ${item.unit}</td><td>${r.receiveDate}</td><td><span class="${r.status === 'Received' ? 'r' : 'p'}">${r.status}</span></td></tr>`)).join('')}</tbody></table></body></html>`)
    win.document.close(); win.print()
  }

  const resetFilters = () => { setSearch(''); setFilterStatus('All Status'); setFilterBrand('All Brands'); setFilterCategory('All Categories'); setFilterDateFrom(''); setFilterDateTo(''); setSelected([]) }

  return (
    <DashboardLayout>
      <div style={s.wrapper}>
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.pageTitle}>Gate Inwards</h1>
            <p style={s.pageSubtitle}>View and manage inward material movements.</p>
          </div>
          <div style={s.headerActions}>
            <button style={s.iconBtn} title="Reset filters" onClick={resetFilters}><RotateCcw size={16} /></button>
            <button style={s.reportBtn} onClick={() => setShowReportPanel(v => !v)}><Eye size={15} /> View Report</button>
            <button style={s.addBtn} onClick={() => router.push('/gate-inward/new')}><Plus size={16} /> Add New Entry</button>
          </div>
        </div>

        {/* Report Panel */}
        {showReportPanel && (
          <div style={s.reportPanel}>
            <div style={s.reportRow}>
              <span style={s.reportLabel}><FileText size={14} color="#2d7a33" />Export {selected.length > 0 ? `${selected.length} selected` : `all ${filtered.length} filtered`} records:</span>
              <div style={s.reportBtns}>
                <button style={s.csvBtn} onClick={() => exportCSV(exportRows)}><FileSpreadsheet size={14} /> Export CSV</button>
                <button style={s.pdfBtn} onClick={() => exportPDF(exportRows)}><Download size={14} /> Export PDF</button>
                {selected.length > 0 && <button style={s.deleteSelBtn} onClick={handleBulkDelete}><Trash2 size={14} /> Delete ({selected.length})</button>}
              </div>
            </div>
          </div>
        )}

        <div style={{ ...s.controlsCard, padding: isMobile ? '12px' : s.controlsCard.padding }}>
          <div style={{ ...s.filtersRow, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, minmax(150px, 1fr))' }}>
            <div style={s.filterCell}>
              <DropdownField
                value={filterStatus}
                onChange={setFilterStatus}
                placeholder="All Status"
                options={['All Status', 'Received', 'Pending'].map((entry) => ({ value: entry, label: entry }))}
                compact
                wrapStyle={{ width: '100%', minWidth: 0 }}
              />
            </div>
            <div style={s.filterCell}>
              <DropdownField
                value={filterBrand}
                onChange={setFilterBrand}
                placeholder="All Brands"
                options={['All Brands', ...allBrands].map((entry) => ({ value: entry, label: entry }))}
                compact
                wrapStyle={{ width: '100%', minWidth: 0 }}
              />
            </div>
            <div style={s.filterCell}>
              <DropdownField
                value={filterCategory}
                onChange={setFilterCategory}
                placeholder="All Categories"
                options={['All Categories', ...allCategories].map((entry) => ({ value: entry, label: entry }))}
                compact
                wrapStyle={{ width: '100%', minWidth: 0 }}
              />
            </div>
            <div style={s.dateField}>
              <DatePicker
                value={filterDateFrom}
                onChange={setFilterDateFrom}
                placeholder="From Date"
              />
            </div>
            <div style={s.dateField}>
              <DatePicker
                value={filterDateTo}
                onChange={setFilterDateTo}
                placeholder="To Date"
                alignRight={true}
              />
            </div>
          </div>

          <div style={s.searchWrap}>
            <Search size={15} color="#7a8a7a" />
            <input style={s.searchInput} placeholder="Search across all fields..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button style={s.clearBtn} onClick={() => setSearch('')}><X size={14} /></button>}
          </div>
        </div>

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={{ ...s.th, width: 40 }}>
                  <button style={s.checkBtn} onClick={toggleAll}>{selected.length === filtered.length && filtered.length > 0 ? <CheckSquare size={15} color="#54B45B" /> : <Square size={15} color="#9ca3af" />}</button>
                </th>
                {['Gr No', 'Supplier', 'Brand', 'Category', 'Product', 'Quantity', 'Receive Date', 'Status'].map(h => <th key={h} style={s.th}>{h}</th>)}
                <th style={{ ...s.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} style={s.emptyCell}><div style={s.emptyState}><ArrowDownToLine size={32} color="#d1d5db" /><p style={{ margin: '8px 0 0', color: '#9ca3af', fontSize: 14 }}>No records found</p></div></td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} style={{ ...s.tr, backgroundColor: selected.includes(r.id) ? '#e8f0e8' : '#fff' }}
                  onMouseEnter={e => { if (!selected.includes(r.id)) e.currentTarget.style.backgroundColor = '#f7faf7' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = selected.includes(r.id) ? '#e8f0e8' : '#fff' }}>
                  <td style={s.td}><button style={s.checkBtn} onClick={() => toggleSelect(r.id)}>{selected.includes(r.id) ? <CheckSquare size={15} color="#54B45B" /> : <Square size={15} color="#9ca3af" />}</button></td>
                  <td style={{ ...s.td, fontWeight: 600, color: '#1a2e1b' }}>{r.grNo}</td>
                  <td style={s.td}>{r.supplierName}</td>
                  <td style={s.td}>{fmtItems(r.items, 'brandName')}</td>
                  <td style={s.td}>{fmtItems(r.items, 'categoryName')}</td>
                  <td style={s.td}>{fmtItems(r.items, 'productName')}</td>
                  <td style={s.td}>{fmtQty(r.items)}</td>
                  <td style={s.td}>{r.receiveDate}</td>
                  <td style={s.td}><span style={{ ...s.badge, ...(r.status === 'Received' ? s.badgeGreen : s.badgeYellow) }}>{r.status}</span></td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <div style={s.actionBtns}>
                      {isSuperUser && <button style={s.editBtn} title="Edit" onClick={() => setEditRecord(r)}><Edit2 size={14} /></button>}
                      <button style={s.viewBtn2} title="View" onClick={() => setViewRecord(r)}><Eye size={14} /></button>
                      <button style={s.delBtn} title="Delete" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={s.tableFooter}>
            <span style={s.footerText}>Showing {filtered.length} of {records.length} records{selected.length > 0 && <span style={s.selCount}> · {selected.length} selected</span>}</span>
          </div>
        </div>
      </div>

      {viewRecord && <ViewModal record={viewRecord} onClose={() => setViewRecord(null)} />}
      {editRecord && isSuperUser && <EditModal record={editRecord} suppliers={MOCK_SUPPLIERS} brands={MOCK_BRANDS} categories={MOCK_CATEGORIES} products={MOCK_PRODUCTS} units={MOCK_UNITS} onClose={() => setEditRecord(null)} onSave={handleSaveEdit} />}
    </DashboardLayout>
  )
}

function ViewModal({ record, onClose }) {
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div><h2 style={s.modalTitle}>Gate Inward - {record.grNo}</h2><p style={s.modalSub}>Record details</p></div>
          <button style={s.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={s.modalBody}>
          <div style={s.detailGrid}>
            {[['GR Number', record.grNo], ['Receive Date', record.receiveDate], ['Status', record.status], ['Supplier', record.supplierName]].map(([l, v]) => (
              <div key={l}><p style={s.detailLabel}>{l}</p><p style={s.detailValue}>{v}</p></div>
            ))}
            <div style={{ gridColumn: '1/-1' }}><p style={s.detailLabel}>Address</p><p style={s.detailValue}>{record.address}</p></div>
            {record.note && <div style={{ gridColumn: '1/-1' }}><p style={s.detailLabel}>Note</p><p style={s.detailValue}>{record.note}</p></div>}
          </div>
          <p style={s.itemsTitle}>Items ({record.items.length})</p>
          <table style={s.innerTable}>
            <thead><tr>{['Brand', 'Category', 'Product', 'Quantity', 'Unit'].map(h => <th key={h} style={s.innerTh}>{h}</th>)}</tr></thead>
            <tbody>{record.items.map((item, i) => (<tr key={i}><td style={s.innerTd}>{item.brandName}</td><td style={s.innerTd}>{item.categoryName}</td><td style={s.innerTd}>{item.productName}</td><td style={s.innerTd}>{item.quantity}</td><td style={s.innerTd}>{item.unit}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function EditModal({ record, suppliers, brands, categories, products, units, onClose, onSave }) {
  const [form, setForm] = useState({ ...record, items: record.items.map(i => ({ ...i })) })

  const updateItem = (idx, field, value) => {
    const items = form.items.map((it, i) => i === idx ? { ...it, [field]: value } : it)
    if (field === 'brandId') { const b = brands.find(b => b.id === Number(value)); items[idx].brandName = b?.name || ''; items[idx].categoryId = ''; items[idx].categoryName = ''; items[idx].productId = ''; items[idx].productName = '' }
    if (field === 'categoryId') { const c = categories.find(c => c.id === Number(value)); items[idx].categoryName = c?.name || ''; items[idx].productId = ''; items[idx].productName = '' }
    if (field === 'productId') { const p = products.find(p => p.id === Number(value)); items[idx].productName = p?.name || '' }
    setForm(f => ({ ...f, items }))
  }

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 740 }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div><h2 style={s.modalTitle}>Edit - {record.grNo}</h2><p style={s.modalSub}>Super user edit mode</p></div>
          <button style={s.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={s.modalBody}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={s.label}>GR Number</label><input style={s.input} value={form.grNo} onChange={e => setForm(f => ({ ...f, grNo: e.target.value }))} /></div>
            <div><label style={s.label}>Receive Date</label><input style={s.input} value={form.receiveDate} onChange={e => setForm(f => ({ ...f, receiveDate: e.target.value }))} /></div>
            <div>
              <label style={s.label}>Supplier</label>
              <DropdownField
                value={form.supplierId}
                onChange={(nextValue) => {
                  const sup = suppliers.find((x) => x.id === Number(nextValue))
                  if (!sup) return
                  setForm((f) => ({ ...f, supplierId: sup.id, supplierName: sup.name, address: sup.address }))
                }}
                placeholder="Select supplier"
                options={suppliers.map((entry) => ({ value: entry.id, label: entry.name }))}
                wrapStyle={{ minWidth: 0 }}
              />
            </div>
            <div>
              <label style={s.label}>Status</label>
              <DropdownField
                value={form.status}
                onChange={(nextValue) => setForm((f) => ({ ...f, status: nextValue }))}
                placeholder="Status"
                options={['Received', 'Pending'].map((entry) => ({ value: entry, label: entry }))}
                wrapStyle={{ minWidth: 0 }}
              />
            </div>
            <div style={{ gridColumn: '1/-1' }}><label style={s.label}>Address</label><textarea style={{ ...s.input, height: 60, resize: 'vertical' }} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={s.label}>Note</label><textarea style={{ ...s.input, height: 55, resize: 'vertical' }} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#374151' }}>Items</p>
            <button style={s.addItemBtn} onClick={() => setForm(f => ({ ...f, items: [...f.items, { brandId: '', brandName: '', categoryId: '', categoryName: '', productId: '', productName: '', quantity: '', unit: 'Unit' }] }))}><Plus size={13} /> Add Item</button>
          </div>

          {form.items.map((item, i) => {
            const brandCats = categories.filter(c => c.brandId === Number(item.brandId))
            const catProds = products.filter(p => p.categoryId === Number(item.categoryId))
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 72px 80px 32px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                <div>
                  <label style={s.label}>Brand</label>
                  <DropdownField
                    value={item.brandId}
                    onChange={(nextValue) => updateItem(i, 'brandId', nextValue)}
                    placeholder="Brand"
                    options={[
                      { value: '', label: 'Brand' },
                      ...brands.map((entry) => ({ value: entry.id, label: entry.name })),
                    ]}
                    wrapStyle={{ minWidth: 0 }}
                  />
                </div>
                <div>
                  <label style={s.label}>Category</label>
                  <DropdownField
                    value={item.categoryId}
                    onChange={(nextValue) => updateItem(i, 'categoryId', nextValue)}
                    placeholder="Category"
                    options={[
                      { value: '', label: 'Category' },
                      ...brandCats.map((entry) => ({ value: entry.id, label: entry.name })),
                    ]}
                    disabled={!item.brandId}
                    wrapStyle={{ minWidth: 0 }}
                  />
                </div>
                <div>
                  <label style={s.label}>Product</label>
                  <DropdownField
                    value={item.productId}
                    onChange={(nextValue) => updateItem(i, 'productId', nextValue)}
                    placeholder="Product"
                    options={[
                      { value: '', label: 'Product' },
                      ...catProds.map((entry) => ({ value: entry.id, label: entry.name })),
                    ]}
                    disabled={!item.categoryId}
                    wrapStyle={{ minWidth: 0 }}
                  />
                </div>
                <div><label style={s.label}>Qty</label><input style={s.input} type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} /></div>
                <div>
                  <label style={s.label}>Unit</label>
                  <DropdownField
                    value={item.unit}
                    onChange={(nextValue) => updateItem(i, 'unit', nextValue)}
                    placeholder="Unit"
                    options={units.map((entry) => ({ value: entry, label: entry }))}
                    wrapStyle={{ minWidth: 0 }}
                  />
                </div>
                <button style={s.removeItemBtn} onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))}><X size={13} /></button>
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={s.saveBtn} onClick={() => onSave(form)}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const RADIUS = 20

const s = {
  wrapper: { width: '100%' },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
    flexWrap: 'wrap',
  },
  pageTitle: { fontSize: 30, fontWeight: 800, color: '#1a3d1f', letterSpacing: '-0.6px', margin: '0 0 4px', display: 'flex', alignItems: 'center' },
  pageSubtitle: { fontSize: 13.5, color: '#7a8a7a', margin: 0 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: '40px',
    border: '1.5px solid #d4dfd4',
    backgroundColor: '#ffffff',
    color: '#2d7a33',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '11px 18px',
    borderRadius: '40px',
    border: '1.5px solid #d4dfd4',
    backgroundColor: '#ffffff',
    color: '#2d7a33',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '11px 20px',
    borderRadius: '40px',
    border: 'none',
    background: 'linear-gradient(90deg, #1B5E20 0%, #2E7D32 45%, #4CAF50 100%)',
    color: '#fff',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  reportPanel: {
    background: '#f2f4f2',
    border: '1px solid #e2e8e2',
    borderRadius: RADIUS,
    padding: '14px 18px',
    marginBottom: 14,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  reportRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  reportLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1a3d1f' },
  reportBtns: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  csvBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#fff',
    border: '1px solid #d4dfd4',
    borderRadius: 40,
    padding: '8px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#2d7a33',
    cursor: 'pointer',
  },
  pdfBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#2d7a33',
    border: 'none',
    borderRadius: 40,
    padding: '8px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#fff',
    cursor: 'pointer',
  },
  deleteSelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#fff',
    border: '1px solid #fecaca',
    borderRadius: 40,
    padding: '8px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#ef4444',
    cursor: 'pointer',
  },
  controlsCard: {
    backgroundColor: '#f2f4f2',
    borderRadius: RADIUS,
    padding: '14px 16px',
    border: '1px solid #e2e8e2',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    marginBottom: 14,
  },
  filtersRow: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(150px, 1fr))', gap: 10, marginBottom: 12 },
  filterCell: { minWidth: 0 },
  dropdownWrap: { position: 'relative', minWidth: 160 },
  dropdownTrigger: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    position: 'relative',
    background: '#fff',
    border: '1px solid #d4dfd4',
    borderRadius: 40,
    padding: '9px 34px 9px 14px',
    fontSize: 12.5,
    color: '#1f2f21',
    cursor: 'pointer',
    outline: 'none',
    minHeight: 38,
    textAlign: 'left',
  },
  dropdownTriggerCompact: {
    fontWeight: 600,
  },
  dropdownValue: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: '#1f2f21',
  },
  dropdownPlaceholder: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: '#7a8a7a',
  },
  dropdownChevronIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    color: '#7a8a7a',
    transition: 'transform 0.18s ease',
    flexShrink: 0,
    pointerEvents: 'none',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    zIndex: 45,
    background: '#fff',
    border: '1px solid #d4dfd4',
    borderRadius: 12,
    padding: 4,
    boxShadow: '0 12px 28px rgba(26, 61, 31, 0.12)',
    maxHeight: 240,
    overflowY: 'auto',
  },
  dropdownItem: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 12.5,
    color: '#1f2f21',
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
  dateField: { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #d4dfd4', borderRadius: 40, padding: '8px 11px', minWidth: 0, width: '100%', position: 'relative' },
  datePickerTrigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    width: '100%',
    position: 'relative',
  },
  datePickerValue: {
    fontSize: 12.5,
    color: '#1f2f21',
    fontWeight: 600,
  },
  datePickerPlaceholder: {
    fontSize: 12.5,
    color: '#7a8a7a',
    fontWeight: 600,
  },
  calendarContainer: {
    zIndex: 50,
    background: '#fff',
    border: '1px solid #d4dfd4',
    borderRadius: 12,
    padding: '12px',
    boxShadow: '0 12px 28px rgba(26, 61, 31, 0.15)',
    minWidth: '280px',
  },
  calendarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #e2e8e2',
  },
  calendarNavBtn: {
    background: 'transparent',
    border: '1px solid #d4dfd4',
    borderRadius: 8,
    padding: '4px 8px',
    cursor: 'pointer',
    color: '#2d7a33',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  calendarMonthYear: {
    fontSize: 13,
    fontWeight: 700,
    color: '#1a3d1f',
  },
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
    marginBottom: 12,
  },
  calendarWeekday: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 700,
    color: '#7a8a7a',
    padding: '6px 0',
  },
  calendarDay: {
    background: 'transparent',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 8,
    padding: '6px 0',
    textAlign: 'center',
    fontSize: 12,
    color: '#415443',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  calendarDayEmpty: {
    padding: '6px 0',
  },
  calendarDaySelected: {
    background: '#1a3d1f',
    color: '#fff',
    borderColor: '#1a3d1f',
  },
  calendarDayToday: {
    borderColor: '#2d7a33',
    fontWeight: 700,
  },
  calendarFooter: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTop: '1px solid #e2e8e2',
  },
  calendarFooterBtn: {
    background: 'transparent',
    border: '1px solid #d4dfd4',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: '#2d7a33',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #d4dfd4', borderRadius: 40, padding: '10px 14px' },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: 13.5, color: '#1f2f21', background: 'transparent' },
  clearBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#7a8a7a', display: 'flex', padding: 0 },
  tableWrap: {
    background: '#f2f4f2',
    borderRadius: RADIUS,
    border: '1px solid #e2e8e2',
    overflowX: 'auto',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  table: { width: '100%', minWidth: 1060, borderCollapse: 'collapse' },
  thead: { background: '#e8eee8' },
  th: { padding: '12px 14px', fontSize: 12, fontWeight: 700, color: '#29472d', textAlign: 'left', borderBottom: '1px solid #d4dfd4', whiteSpace: 'nowrap', letterSpacing: '0.1px' },
  tr: { transition: 'background 0.15s' },
  td: { padding: '11px 14px', fontSize: 13, color: '#415443', borderBottom: '1px solid #e2e8e2', background: '#ffffff' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: 40, fontSize: 11.5, fontWeight: 700 },
  badgeGreen: { background: '#e8f0e8', color: '#1f7a2b', border: '1px solid #d4dfd4' },
  badgeYellow: { background: '#fefce8', color: '#a16207', border: '1px solid #fef3c7' },
  actionBtns: { display: 'flex', gap: 6, justifyContent: 'flex-end' },
  editBtn: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' },
  viewBtn2: { background: '#e8f0e8', border: '1px solid #d4dfd4', color: '#2d7a33', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' },
  delBtn: { background: '#fff5f5', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' },
  checkBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 },
  emptyCell: { textAlign: 'center', padding: '56px 0', background: '#ffffff' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  tableFooter: { padding: '11px 16px', borderTop: '1px solid #d4dfd4', background: '#e8eee8' },
  footerText: { fontSize: 12.5, color: '#607062', fontWeight: 500 },
  selCount: { color: '#1f7a2b', fontWeight: 700 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(8, 18, 10, 0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#f2f4f2', borderRadius: RADIUS, width: '100%', maxWidth: 620, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8e2', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' },
  modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #d4dfd4' },
  modalTitle: { fontSize: 18, fontWeight: 800, color: '#1a3d1f', margin: 0 },
  modalSub: { fontSize: 12.5, color: '#7a8a7a', margin: '4px 0 0' },
  modalClose: { background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 10, padding: 6, cursor: 'pointer', color: '#607062', display: 'flex' },
  modalBody: { padding: '20px 24px', overflowY: 'auto', flex: 1 },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', marginBottom: 20 },
  detailLabel: { fontSize: 11, fontWeight: 700, color: '#7a8a7a', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 4px' },
  detailValue: { fontSize: 13.5, color: '#1f2f21', fontWeight: 600, margin: 0, padding: '7px 10px', background: '#ffffff', borderRadius: 9, border: '1px solid #d4dfd4' },
  itemsTitle: { fontSize: 13, fontWeight: 700, color: '#29472d', marginBottom: 10 },
  innerTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  innerTh: { padding: '8px 10px', background: '#e8eee8', color: '#2d7a33', fontWeight: 700, fontSize: 11.5, textAlign: 'left', borderBottom: '1px solid #d4dfd4' },
  innerTd: { padding: '8px 10px', borderBottom: '1px solid #d4dfd4', color: '#415443', background: '#ffffff' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#607062', marginBottom: 4 },
  input: { width: '100%', background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 10, padding: '9px 10px', fontSize: 13, color: '#1f2f21', outline: 'none', boxSizing: 'border-box' },
  addItemBtn: { display: 'flex', alignItems: 'center', gap: 5, background: '#ffffff', border: '1px solid #d4dfd4', color: '#2d7a33', borderRadius: 40, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' },
  removeItemBtn: { background: '#fff5f5', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignSelf: 'flex-end' },
  cancelBtn: { background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 40, padding: '9px 20px', fontSize: 13.5, fontWeight: 600, color: '#374151', cursor: 'pointer' },
  saveBtn: { background: '#1a3d1f', border: 'none', borderRadius: 40, padding: '9px 24px', fontSize: 13.5, fontWeight: 600, color: '#fff', cursor: 'pointer' },
}

