'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

function normalizeOptions(options = []) {
  return options.map((option) => {
    if (typeof option === 'object' && option !== null) {
      return {
        value: option.value,
        label: option.label ?? String(option.value ?? ''),
      }
    }
    return { value: option, label: String(option ?? '') }
  })
}

function isSameValue(a, b) {
  return String(a ?? '') === String(b ?? '')
}

export function StoreThemeDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select',
  disabled = false,
  hasError = false,
  compact = false,
  variant = 'input',
  wrapStyle,
  triggerStyle,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const searchRef = useRef(null)
  const normalizedOptions = useMemo(() => normalizeOptions(options), [options])
  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return normalizedOptions
    return normalizedOptions.filter((option) => (
      String(option.label ?? '').toLowerCase().includes(needle) ||
      String(option.value ?? '').toLowerCase().includes(needle)
    ))
  }, [normalizedOptions, query])

  const selected = useMemo(
    () => normalizedOptions.find((opt) => isSameValue(opt.value, value)),
    [normalizedOptions, value]
  )

  const selectOption = (option) => {
    if (!option) return
    onChange(option.value)
    setOpen(false)
    setQuery('')
    triggerRef.current?.focus()
  }

  const openMenu = () => {
    if (disabled) return
    setOpen(true)
  }

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

  useEffect(() => {
    if (!open) return
    const selectedIndex = normalizedOptions.findIndex((option) => isSameValue(option.value, value))
    setQuery('')
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    window.setTimeout(() => searchRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    setActiveIndex((prev) => {
      if (!filteredOptions.length) return 0
      return Math.min(prev, filteredOptions.length - 1)
    })
  }, [filteredOptions.length])

  const handleTriggerKeyDown = (event) => {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu()
      setActiveIndex((prev) => {
        if (!filteredOptions.length) return 0
        if (event.key === 'ArrowDown') return Math.min(prev + 1, filteredOptions.length - 1)
        return Math.max(prev - 1, 0)
      })
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) {
        selectOption(filteredOptions[activeIndex])
      } else {
        openMenu()
      }
    }
  }

  const handleSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(filteredOptions.length - 1, 0)))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      selectOption(filteredOptions[activeIndex])
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  const triggerBase = variant === 'pill' ? styles.dropdownTriggerPill : styles.dropdownTriggerInput

  return (
    <div ref={rootRef} style={{ ...styles.dropdownWrap, ...(wrapStyle || {}) }} className="store-theme-dropdown">
      <button
        ref={triggerRef}
        type="button"
        className="store-theme-dropdown-trigger"
        style={{
          ...triggerBase,
          ...(compact ? styles.dropdownTriggerCompact : {}),
          ...(disabled ? styles.dropdownDisabled : {}),
          ...(hasError ? styles.inputError : {}),
          ...(triggerStyle || {}),
        }}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={selected ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          size={12}
          style={{
            ...styles.dropdownChevronIcon,
            transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          }}
        />
      </button>

      {open && !disabled ? (
        <div style={styles.dropdownMenu} className="store-theme-dropdown-menu" role="listbox">
          <div style={styles.dropdownSearchWrap}>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search..."
              style={styles.dropdownSearchInput}
              className="store-theme-dropdown-search"
            />
          </div>
          {filteredOptions.length ? filteredOptions.map((option, index) => {
            const active = isSameValue(option.value, value)
            const highlighted = index === activeIndex
            return (
              <button
                key={String(option.value)}
                type="button"
                className={`store-theme-dropdown-item${active ? ' store-theme-dropdown-item-active' : ''}`}
                style={{
                  ...styles.dropdownItem,
                  ...(highlighted ? styles.dropdownItemHighlighted : {}),
                  ...(active ? styles.dropdownItemActive : {}),
                }}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
                role="option"
                aria-selected={active}
              >
                {option.label}
              </button>
            )
          }) : (
            <div style={styles.dropdownEmpty}>No results</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function StoreThemeDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  alignRight = false,
  variant = 'input',
  triggerStyle,
}) {
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

  const buttonRef = useRef(null)
  const containerRef = useRef(null)
  const pickerRef = useRef(null)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  useEffect(() => {
    setDisplayValue(value || '')
    setTempDate(value ? new Date(value) : null)
  }, [value])

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
    if (!isOpen) return
    calculatePosition()
    window.addEventListener('resize', calculatePosition)
    window.addEventListener('scroll', calculatePosition)
    return () => {
      window.removeEventListener('resize', calculatePosition)
      window.removeEventListener('scroll', calculatePosition)
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

    weekdays.forEach((day) => {
      days.push(
        <div key={`header-${day}`} style={styles.calendarWeekday}>
          {day}
        </div>
      )
    })

    for (let i = 0; i < firstDay; i += 1) {
      days.push(<div key={`empty-${i}`} style={styles.calendarDayEmpty} />)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const isSelected =
        tempDate &&
        tempDate.getDate() === day &&
        tempDate.getMonth() === currentMonth &&
        tempDate.getFullYear() === currentYear
      const isToday =
        new Date().getDate() === day &&
        new Date().getMonth() === currentMonth &&
        new Date().getFullYear() === currentYear

      days.push(
        <button
          key={day}
          type="button"
          className="store-theme-calendar-day"
          onClick={() => handleDateSelect(day)}
          style={{
            ...styles.calendarDay,
            ...(isSelected ? styles.calendarDaySelected : {}),
            ...(isToday ? styles.calendarDayToday : {}),
          }}
        >
          {day}
        </button>
      )
    }
    return days
  }

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const triggerBase = variant === 'pill' ? styles.datePickerTriggerPill : styles.datePickerTriggerInput

  const calendarPopup = isOpen ? (
    <div
      ref={pickerRef}
      className="store-theme-calendar-popup"
      style={{
        ...styles.calendarContainer,
        ...calendarPosition,
      }}
    >
      <div style={styles.calendarHeader}>
        <button type="button" className="store-theme-calendar-nav-btn" onClick={() => changeMonth(-1)} style={styles.calendarNavBtn}>
          <ChevronLeft size={14} />
        </button>
        <span style={styles.calendarMonthYear}>
          {monthNames[currentMonth]} {currentYear}
        </span>
        <button type="button" className="store-theme-calendar-nav-btn" onClick={() => changeMonth(1)} style={styles.calendarNavBtn}>
          <ChevronRight size={14} />
        </button>
      </div>
      <div style={styles.calendarGrid}>{renderCalendar()}</div>
      <div style={styles.calendarFooter}>
        <button type="button" className="store-theme-calendar-footer-btn" onClick={handleToday} style={styles.calendarFooterBtn}>
          Today
        </button>
        <button type="button" className="store-theme-calendar-footer-btn" onClick={handleClear} style={styles.calendarFooterBtn}>
          Clear
        </button>
      </div>
    </div>
  ) : null

  return (
    <div ref={containerRef} style={styles.dateWrap}>
      <button
        ref={buttonRef}
        type="button"
        style={{ ...triggerBase, ...(triggerStyle || {}) }}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Calendar size={13} color="#7a8a7a" />
        <span style={displayValue ? styles.datePickerValue : styles.datePickerPlaceholder}>
          {displayValue || placeholder}
        </span>
        <ChevronDown
          size={12}
          style={{
            ...styles.dropdownChevronIcon,
          transform: `translateY(-50%) rotate(${isOpen ? 180 : 0}deg)`,
        }}
      />
      </button>

      {hasMounted && calendarPopup ? createPortal(calendarPopup, document.body) : null}
    </div>
  )
}

const styles = {
  dropdownWrap: {
    position: 'relative',
    width: '100%',
  },
  dropdownTriggerPill: {
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
    boxSizing: 'border-box',
    lineHeight: 1.25,
  },
  dropdownTriggerInput: {
    width: '100%',
    minHeight: 40,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d4dfd4',
    borderRadius: 10,
    background: '#ffffff',
    color: '#1f2f21',
    padding: '9px 34px 9px 12px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    position: 'relative',
    cursor: 'pointer',
    textAlign: 'left',
    lineHeight: 1.3,
  },
  dropdownTriggerCompact: {
    fontWeight: 600,
  },
  dropdownValue: {
    flex: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: '#1f2f21',
  },
  dropdownPlaceholder: {
    flex: 1,
    minWidth: 0,
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
  dropdownSearchWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    background: '#fff',
    padding: '4px 4px 6px',
  },
  dropdownSearchInput: {
    width: '100%',
    border: '1px solid #d4dfd4',
    borderRadius: 8,
    background: '#f8faf8',
    color: '#1f2f21',
    fontSize: 12.5,
    outline: 'none',
    padding: '8px 9px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  dropdownItemHighlighted: {
    background: '#f1f6f1',
  },
  dropdownItemActive: {
    background: '#e8f0e8',
    color: '#1f7a2b',
    fontWeight: 700,
  },
  dropdownEmpty: {
    padding: '10px',
    color: '#7a8a7a',
    fontSize: 12.5,
  },
  dropdownDisabled: {
    background: '#f4f6f4',
    color: '#9aa69a',
    cursor: 'not-allowed',
  },
  inputError: {
    borderColor: '#fca5a5',
    background: '#fff1f2',
  },
  dateWrap: {
    position: 'relative',
    width: '100%',
  },
  datePickerTriggerPill: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #d4dfd4',
    borderRadius: 40,
    padding: '9px 34px 9px 12px',
    background: '#fff',
    color: '#1f2f21',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    position: 'relative',
    minHeight: 38,
    boxSizing: 'border-box',
    lineHeight: 1.25,
  },
  datePickerTriggerInput: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #d4dfd4',
    borderRadius: 10,
    padding: '9px 34px 9px 12px',
    background: '#fff',
    color: '#1f2f21',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
    position: 'relative',
    minHeight: 40,
    boxSizing: 'border-box',
    lineHeight: 1.3,
  },
  datePickerValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    color: '#1f2f21',
    fontWeight: 600,
  },
  datePickerPlaceholder: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    color: '#7a8a7a',
    fontWeight: 600,
  },
  calendarContainer: {
    zIndex: 2200,
    background: '#fff',
    border: '1px solid #d4dfd4',
    borderRadius: 12,
    padding: 12,
    boxShadow: '0 12px 28px rgba(26, 61, 31, 0.15)',
    minWidth: 'min(280px, calc(100vw - 28px))',
    maxWidth: 'calc(100vw - 28px)',
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
    gap: 4,
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
}
