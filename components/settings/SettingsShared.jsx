'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, Pencil, Trash2, X, Check, ChevronDown, ArrowLeft } from 'lucide-react'

export const settingsTheme = {
  primary: '#1a3d1f',
  primarySoft: '#2d7a33',
  primaryTint: '#e8f0e8',
  pageTint: '#f2f4f2',
  surface: '#ffffff',
  border: '#d4dfd4',
  borderSoft: '#e2e8e2',
  text: '#1a2e1b',
  textMuted: '#607062',
  textSubtle: '#7a8a7a',
  danger: '#dc2626',
  dangerBg: '#fff5f5',
}

function useSettingsViewport() {
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mobileQuery = window.matchMedia('(max-width: 640px)')
    const tabletQuery = window.matchMedia('(max-width: 1024px)')

    const apply = () => {
      setIsMobile(mobileQuery.matches)
      setIsTablet(tabletQuery.matches)
    }

    apply()
    mobileQuery.addEventListener('change', apply)
    tabletQuery.addEventListener('change', apply)
    return () => {
      mobileQuery.removeEventListener('change', apply)
      tabletQuery.removeEventListener('change', apply)
    }
  }, [])

  return { isMobile, isTablet }
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        background: checked ? settingsTheme.primarySoft : '#cfd9cf',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.16)',
        }}
      />
    </button>
  )
}

export function InlineInput({ value, onChange, onSave, onCancel, placeholder }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave()
          if (e.key === 'Escape') onCancel()
        }}
        style={{
          border: `1.5px solid ${settingsTheme.primarySoft}`,
          borderRadius: 10,
          padding: '6px 10px',
          fontSize: 13.5,
          outline: 'none',
          width: 'min(220px, 100%)',
          color: settingsTheme.text,
          background: '#fff',
        }}
      />
      <button
        onClick={onSave}
        style={{
          background: settingsTheme.primarySoft,
          border: 'none',
          borderRadius: 9,
          width: 30,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Check size={14} color="#fff" />
      </button>
      <button
        onClick={onCancel}
        style={{
          background: '#f4f6f4',
          border: `1px solid ${settingsTheme.border}`,
          borderRadius: 9,
          width: 30,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <X size={14} color={settingsTheme.textMuted} />
      </button>
    </div>
  )
}

export function SettingsSelect({
  value,
  onChange,
  children,
  disabled = false,
  wrapperStyle = {},
  selectStyle = {},
}) {
  return (
    <div
      className="app-theme-select-wrap"
      style={{ ...styles.selectWrap, ...(disabled ? styles.selectWrapDisabled : {}), ...wrapperStyle }}
    >
      <select
        className="app-theme-select"
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{ ...styles.select, ...selectStyle }}
      >
        {children}
      </select>
      <ChevronDown size={12} style={styles.selectChevron} />
    </div>
  )
}

export function SettingsPageShell({
  title,
  subtitle,
  onAdd,
  onRefresh,
  filterValue,
  onFilterChange,
  addLabel = '+ Add',
  canEdit = true,
  backTo = '/settings',
  showBack = true,
  children,
}) {
  const router = useRouter()
  const { isMobile, isTablet } = useSettingsViewport()

  return (
    <div
      style={{
        ...styles.page,
        borderRadius: isMobile ? 14 : 20,
        padding: isMobile ? 12 : isTablet ? 16 : 22,
      }}
    >
      <div
        style={{
          ...styles.header,
          marginBottom: isMobile ? 14 : 18,
        }}
      >
        <div
          style={{
            ...styles.headerLeft,
            width: isMobile ? '100%' : 'auto',
          }}
        >
          {showBack ? (
            <button
              type="button"
              onClick={() => router.push(backTo)}
              style={styles.backBtn}
              title="Back to settings"
            >
              <ArrowLeft size={16} />
            </button>
          ) : null}
          <div>
            <h1 style={{ ...styles.title, fontSize: isMobile ? 18 : 22 }}>{title}</h1>
            <p style={{ ...styles.subtitle, fontSize: isMobile ? 12 : 13 }}>{subtitle}</p>
          </div>
        </div>
        <div
          style={{
            ...styles.headerActions,
            width: isMobile ? '100%' : 'auto',
            justifyContent: isMobile ? 'space-between' : 'flex-start',
          }}
        >
          <button onClick={onRefresh} style={styles.iconBtn} title="Refresh">
            <RefreshCw size={16} color={settingsTheme.textMuted} />
          </button>
          {canEdit && (
            <button
              onClick={onAdd}
              style={{
                ...styles.addBtn,
                padding: isMobile ? '10px 16px' : '11px 20px',
              }}
            >
              <Plus size={15} />
              {addLabel}
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          ...styles.filterBar,
          flexWrap: 'wrap',
        }}
      >
        <SettingsSelect
          value={filterValue}
          onChange={(e) => onFilterChange(e.target.value)}
          wrapperStyle={{
            minWidth: isMobile ? '100%' : 150,
            width: isMobile ? '100%' : 'auto',
          }}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </SettingsSelect>
      </div>

      <div style={styles.tableWrap}>{children}</div>
    </div>
  )
}

export function SettingsTable({ columns, rows, emptyMsg = 'No records found.' }) {
  return (
    <table style={styles.table}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} style={{ ...styles.th, textAlign: col.align || 'center' }}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} style={styles.empty}>{emptyMsg}</td>
          </tr>
        ) : rows}
      </tbody>
    </table>
  )
}

export function ActionButtons({ onEdit, onDelete, canEdit, canDelete }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {canEdit && (
        <button onClick={onEdit} style={styles.actionBtn} title="Edit">
          <Pencil size={14} color={settingsTheme.textMuted} />
        </button>
      )}
      {canDelete && (
        <button onClick={onDelete} style={{ ...styles.actionBtn, ...styles.deleteBtn }} title="Delete">
          <Trash2 size={14} color={settingsTheme.danger} />
        </button>
      )}
    </div>
  )
}

export function ConfirmDelete({ open, name, onConfirm, onCancel }) {
  const { isMobile } = useSettingsViewport()
  if (!open) return null
  return (
    <div style={styles.overlay}>
      <div
        style={{
          ...styles.dialog,
          width: isMobile ? 'calc(100vw - 24px)' : 360,
          padding: isMobile ? 18 : 26,
        }}
      >
        <h3 style={styles.dialogTitle}>Delete Confirmation</h3>
        <p style={styles.dialogText}>
          Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
        </p>
        <div style={styles.dialogActions}>
          <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
          <button onClick={onConfirm} style={styles.confirmBtn}>Delete</button>
        </div>
      </div>
    </div>
  )
}

export function Toast({ message, type = 'success', onClose }) {
  const { isMobile } = useSettingsViewport()
  useEffect(() => {
    const t = setTimeout(onClose, 2800)
    return () => clearTimeout(t)
  }, [onClose])

  const isSuccess = type === 'success'
  return (
    <div style={{
      ...styles.toast,
      right: isMobile ? 12 : 24,
      left: isMobile ? 12 : 'auto',
      bottom: isMobile ? 12 : 24,
      maxWidth: isMobile ? 'calc(100vw - 24px)' : 420,
      background: isSuccess ? '#edf8ef' : '#fff3f3',
      border: `1px solid ${isSuccess ? '#cce8cf' : '#fecaca'}`,
      color: isSuccess ? '#1f5e25' : settingsTheme.danger,
    }}>
      {message}
    </div>
  )
}

const styles = {
  page: {
    background: settingsTheme.pageTint,
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 20,
    padding: 22,
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 14,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 999,
    background: '#fff',
    color: settingsTheme.primarySoft,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: settingsTheme.text,
    letterSpacing: '-0.2px',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: settingsTheme.textMuted,
  },
  headerActions: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 10,
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'linear-gradient(90deg, #1B5E20 0%, #2E7D32 45%, #4CAF50 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 40,
    padding: '11px 20px',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  filterBar: {
    marginBottom: 14,
    display: 'flex',
    gap: 10,
  },
  selectWrap: {
    position: 'relative',
    display: 'inline-flex',
    minWidth: 150,
  },
  selectWrapDisabled: {
    opacity: 0.75,
  },
  select: {
    width: '100%',
    appearance: 'none',
    WebkitAppearance: 'none',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: settingsTheme.border,
    borderRadius: 40,
    padding: '8px 30px 8px 12px',
    fontSize: 13.5,
    color: settingsTheme.text,
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
    lineHeight: 1.3,
  },
  selectChevron: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: settingsTheme.textSubtle,
  },
  tableWrap: {
    background: '#fff',
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 14,
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  table: {
    width: '100%',
    minWidth: 640,
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 20px',
    background: '#eef2ee',
    fontSize: 13,
    fontWeight: 700,
    color: '#455645',
    borderBottom: `1px solid ${settingsTheme.border}`,
  },
  empty: {
    padding: 40,
    textAlign: 'center',
    color: settingsTheme.textSubtle,
    fontSize: 14,
  },
  actionBtn: {
    width: 30,
    height: 30,
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 8,
    background: '#f8faf8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  deleteBtn: {
    background: settingsTheme.dangerBg,
    border: '1px solid #fecaca',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(26,46,27,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  dialog: {
    background: '#fff',
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 16,
    padding: 26,
    width: 360,
    boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
  },
  dialogTitle: {
    margin: '0 0 10px',
    fontSize: 17,
    fontWeight: 700,
    color: settingsTheme.text,
  },
  dialogText: {
    margin: '0 0 20px',
    fontSize: 13.5,
    color: settingsTheme.textMuted,
    lineHeight: 1.5,
  },
  dialogActions: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '8px 18px',
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 10,
    background: '#fff',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    color: '#425343',
  },
  confirmBtn: {
    padding: '8px 18px',
    border: 'none',
    borderRadius: 10,
    background: settingsTheme.danger,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    color: '#fff',
  },
  toast: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    padding: '12px 20px',
    borderRadius: 12,
    fontSize: 13.5,
    fontWeight: 600,
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
    zIndex: 9999,
    animation: 'fadeSlideUp 0.2s ease',
  },
}
