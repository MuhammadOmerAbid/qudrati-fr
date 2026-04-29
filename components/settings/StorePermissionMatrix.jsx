import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Factory,
  Package,
  Warehouse,
  BoxIcon,
} from 'lucide-react'
import { settingsTheme } from '@/components/settings/SettingsShared'

export const STORE_PERMISSION_SECTIONS = [
  { id: 'gate-inward', label: 'Gate Inward', icon: ArrowDownToLine },
  { id: 'gate-outward', label: 'Gate Outward', icon: ArrowUpFromLine },
  { id: 'goods-requisition', label: 'Goods Requisition', icon: ClipboardList },
  { id: 'daily-production', label: 'Daily Production', icon: Factory },
  { id: 'finished-goods', label: 'Finished Goods', icon: Package },
  { id: 'production-order', label: 'Production Order', icon: BoxIcon },
  { id: 'inventory', label: 'Inventory', icon: Warehouse },
]

function PermissionPill({ label, checked, onClick, disabled, tone }) {
  const toneStyles = {
    view: {
      activeBg: settingsTheme.primarySoft,
      activeBorder: settingsTheme.primarySoft,
      activeColor: '#ffffff',
    },
    edit: {
      activeBg: settingsTheme.primary,
      activeBorder: settingsTheme.primary,
      activeColor: '#ffffff',
    },
    delete: {
      activeBg: '#de4a4a',
      activeBorder: '#de4a4a',
      activeColor: '#ffffff',
    },
  }

  const activeTone = toneStyles[tone] || toneStyles.view

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...s.pill,
        borderColor: checked ? activeTone.activeBorder : settingsTheme.border,
        background: checked ? activeTone.activeBg : '#ffffff',
        color: checked ? activeTone.activeColor : settingsTheme.textMuted,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}

export default function StorePermissionMatrix({ permissions = [], onChange }) {
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
        <span style={s.title}>Store Panel Permissions</span>
        <span style={s.hint}>Enable View first, then Edit/Delete.</span>
      </div>

      <div style={s.list}>
        {STORE_PERMISSION_SECTIONS.map((section) => {
          const Icon = section.icon
          const canView = has(section.id)
          return (
            <div key={section.id} style={s.row}>
              <div style={s.module}>
                <div style={s.iconWrap}>
                  <Icon size={16} color={settingsTheme.primary} />
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
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 14,
    background: '#ffffff',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: '#eef2ee',
    borderBottom: `1px solid ${settingsTheme.border}`,
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 12.5,
    fontWeight: 700,
    color: settingsTheme.text,
  },
  hint: {
    fontSize: 11.5,
    fontWeight: 600,
    color: settingsTheme.textMuted,
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
    borderBottom: `1px solid ${settingsTheme.borderSoft}`,
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
    border: `1px solid ${settingsTheme.border}`,
    background: '#f3f8f3',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moduleTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: settingsTheme.text,
  },
  moduleSub: {
    margin: '2px 0 0',
    fontSize: 11.5,
    fontWeight: 600,
    color: settingsTheme.textSubtle,
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
