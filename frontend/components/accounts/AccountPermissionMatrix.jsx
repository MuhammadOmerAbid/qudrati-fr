import {
  Banknote,
  BarChart3,
  BookOpen,
  FileText,
  Receipt,
  Stamp,
  UserCheck,
  Users,
} from 'lucide-react'

export const ACCOUNT_PERMISSION_SECTIONS = [
  { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
  { id: 'general-ledger', label: 'General Ledger', icon: FileText },
  { id: 'accounts-payable', label: 'Accounts Payable', icon: Users },
  { id: 'accounts-receivable', label: 'Accounts Receivable', icon: UserCheck },
  { id: 'cash-bank', label: 'Cash & Bank', icon: Banknote },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'reports', label: 'Financial Reports', icon: BarChart3 },
  { id: 'vouchers', label: 'Vouchers', icon: Stamp },
]

function PermissionPill({ label, checked, onClick, disabled, tone }) {
  const tones = {
    view: {
      activeBg: '#2d7a33',
      activeBorder: '#2d7a33',
      activeColor: '#ffffff',
    },
    edit: {
      activeBg: '#14532d',
      activeBorder: '#14532d',
      activeColor: '#ffffff',
    },
    delete: {
      activeBg: '#dc2626',
      activeBorder: '#dc2626',
      activeColor: '#ffffff',
    },
  }

  const activeTone = tones[tone] || tones.view

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...s.pill,
        borderColor: checked ? activeTone.activeBorder : '#d1d5db',
        background: checked ? activeTone.activeBg : '#ffffff',
        color: checked ? activeTone.activeColor : '#475569',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}

export default function AccountPermissionMatrix({ permissions = [], onChange }) {
  const has = (permission) => permissions.includes(permission)

  const togglePermission = (permission) => {
    const next = has(permission)
      ? permissions.filter((entry) => entry !== permission)
      : [...permissions, permission]
    onChange(next)
  }

  const toggleSectionView = (sectionId) => {
    if (has(sectionId)) {
      onChange(
        permissions.filter(
          (entry) => entry !== sectionId
            && entry !== `${sectionId}_edit`
            && entry !== `${sectionId}_delete`,
        ),
      )
      return
    }

    onChange([...permissions, sectionId])
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.title}>Accounts Panel Permissions</span>
        <span style={s.hint}>Enable View first, then Edit/Delete.</span>
      </div>

      <div style={s.list}>
        {ACCOUNT_PERMISSION_SECTIONS.map((section) => {
          const Icon = section.icon
          const canView = has(section.id)
          return (
            <div key={section.id} style={s.row}>
              <div style={s.module}>
                <div style={s.iconWrap}>
                  <Icon size={16} color="#14532d" />
                </div>
                <div>
                  <p style={s.moduleTitle}>{section.label}</p>
                  <p style={s.moduleSub}>{section.id}</p>
                </div>
              </div>

              <div style={s.actions}>
                <PermissionPill
                  label="View"
                  checked={canView}
                  onClick={() => toggleSectionView(section.id)}
                  tone="view"
                />
                <PermissionPill
                  label="Edit"
                  checked={has(`${section.id}_edit`)}
                  onClick={() => togglePermission(`${section.id}_edit`)}
                  disabled={!canView}
                  tone="edit"
                />
                <PermissionPill
                  label="Delete"
                  checked={has(`${section.id}_delete`)}
                  onClick={() => togglePermission(`${section.id}_delete`)}
                  disabled={!canView}
                  tone="delete"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const s = {
  wrap: {
    border: '1px solid #d1d5db',
    borderRadius: 14,
    background: '#ffffff',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: '#eef5ef',
    borderBottom: '1px solid #d1d5db',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#111827',
  },
  hint: {
    fontSize: 11.5,
    fontWeight: 600,
    color: '#64748b',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '10px 12px',
    borderBottom: '1px solid #e5e7eb',
    flexWrap: 'wrap',
  },
  module: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 220,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: '1px solid #d1d5db',
    background: '#f3f7f3',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moduleTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: '#111827',
  },
  moduleSub: {
    margin: '2px 0 0',
    fontSize: 11.5,
    fontWeight: 600,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  pill: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: 999,
    background: '#ffffff',
    minWidth: 66,
    height: 30,
    padding: '0 12px',
    fontSize: 12,
    fontWeight: 700,
    transition: 'all 0.12s ease',
  },
}
