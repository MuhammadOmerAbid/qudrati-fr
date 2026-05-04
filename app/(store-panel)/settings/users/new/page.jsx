'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { usersApi } from '@/infrastructure/api/endpoints'
import { SettingsSelect, settingsTheme } from '@/components/settings/SettingsShared'
import { ArrowLeft, ChevronDown, ChevronUp, Save, Shield } from 'lucide-react'

const ALL_SECTIONS = [
  { id: 'gate-inward', label: 'Gate Inward' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'goods-requisition', label: 'Goods Requisition' },
  { id: 'daily-production', label: 'Daily Production' },
  { id: 'finished-goods', label: 'Finished Goods' },
  { id: 'production-order', label: 'Production Order' },
  { id: 'gate-outward', label: 'Gate Outward' },
]

function Checkbox({ checked, onChange, disabled, color = settingsTheme.primarySoft }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange()}
      disabled={disabled}
      style={{
        width: 20,
        height: 20,
        borderRadius: 5,
        border: `2px solid ${checked ? color : '#cfd9cf'}`,
        background: checked ? color : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

function PermissionMatrix({ permissions = [], onChange }) {
  const has = (perm) => permissions.includes(perm)

  const toggle = (perm) => {
    const next = has(perm)
      ? permissions.filter((p) => p !== perm)
      : [...permissions, perm]
    onChange(next)
  }

  const toggleSection = (sectionId) => {
    if (has(sectionId)) {
      onChange(permissions.filter((p) => p !== sectionId && p !== `${sectionId}_edit` && p !== `${sectionId}_delete`))
    } else {
      onChange([...permissions, sectionId])
    }
  }

  return (
    <div style={s.permWrap}>
      <div style={s.permHeadGrid}>
        {['Section', 'View', 'Edit', 'Delete'].map((head) => (
          <div key={head} style={s.permHeadCell}>{head}</div>
        ))}
      </div>
      {ALL_SECTIONS.map((section) => {
        const hasView = has(section.id)
        return (
          <div key={section.id} style={s.permRowGrid}>
            <div style={s.permSectionCell}>{section.label}</div>
            <div style={s.permCell}>
              <Checkbox checked={hasView} onChange={() => toggleSection(section.id)} />
            </div>
            <div style={s.permCell}>
              <Checkbox
                checked={has(`${section.id}_edit`)}
                onChange={() => toggle(`${section.id}_edit`)}
                disabled={!hasView}
              />
            </div>
            <div style={s.permCell}>
              <Checkbox
                checked={has(`${section.id}_delete`)}
                onChange={() => toggle(`${section.id}_delete`)}
                disabled={!hasView}
                color="#de4a4a"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function UserNewPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const isSuperuser = user?.role === 'superuser'

  const [saving, setSaving] = useState(false)
  const [showPerm, setShowPerm] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [errors, setErrors] = useState({})
  const [isMobile, setIsMobile] = useState(false)
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
    permissions: [],
  })

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.username.trim()) next.username = 'Username is required'
    if (!form.password) next.password = 'Password is required'
    if (form.role !== 'superuser' && form.permissions.length === 0) {
      next.permissions = 'Select at least one section permission'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    setSaving(true)
    setErrorMsg('')
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        permissions: form.role === 'superuser' ? [] : form.permissions,
      }

      await usersApi.create(payload)
      router.push('/settings/users')
    } catch {
      setErrorMsg('Failed to create user. Please try again.')
      setSaving(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mobileQuery = window.matchMedia('(max-width: 640px)')
    const apply = () => setIsMobile(mobileQuery.matches)
    apply()
    mobileQuery.addEventListener('change', apply)
    return () => mobileQuery.removeEventListener('change', apply)
  }, [])

  if (!isSuperuser) {
    return (
      <DashboardLayout>
        <div style={s.deniedWrap}>
          <Shield size={48} color={settingsTheme.textSubtle} />
          <h2 style={s.deniedTitle}>Access Restricted</h2>
          <p style={s.deniedText}>Only super users can create team members.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div style={{ ...s.wrapper, maxWidth: isMobile ? '100%' : 980 }}>
        <div style={s.pageHeader}>
          <div style={{ ...s.headerLeft, width: isMobile ? '100%' : 'auto' }}>
            <button type="button" style={s.backBtn} onClick={() => router.push('/settings/users')}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...s.pageTitle, fontSize: isMobile ? 20 : 30 }}>Add User</h1>
              <p style={{ ...s.pageSubtitle, fontSize: isMobile ? 12 : 13.5 }}>Create a new team account and assign access</p>
            </div>
          </div>

          <button type="button" style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'Create User'}
          </button>
        </div>

        <div style={{ ...s.card, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 14 : 24 }}>
          {errorMsg ? <div style={s.errorBanner}>{errorMsg}</div> : null}

          <div style={{ ...s.grid2, gridTemplateColumns: isMobile ? '1fr' : s.grid2.gridTemplateColumns }}>
            <div style={s.fieldWrap}>
              <label style={s.label}>Username *</label>
              <input
                type="text"
                style={{ ...s.input, ...(errors.username ? s.inputError : {}) }}
                value={form.username}
                placeholder="username"
                onChange={(e) => setField('username', e.target.value)}
              />
              {errors.username ? <span style={s.errorText}>{errors.username}</span> : null}
            </div>
            <div style={s.fieldWrap}>
              <label style={s.label}>Email</label>
              <input
                type="email"
                style={s.input}
                value={form.email}
                placeholder="email@example.com"
                onChange={(e) => setField('email', e.target.value)}
              />
            </div>
          </div>

          <div style={{ ...s.grid2, gridTemplateColumns: isMobile ? '1fr' : s.grid2.gridTemplateColumns }}>
            <div style={s.fieldWrap}>
              <label style={s.label}>Password *</label>
              <input
                type="password"
                style={{ ...s.input, ...(errors.password ? s.inputError : {}) }}
                value={form.password}
                placeholder="********"
                onChange={(e) => setField('password', e.target.value)}
              />
              {errors.password ? <span style={s.errorText}>{errors.password}</span> : null}
            </div>
            <div style={s.fieldWrap}>
              <label style={s.label}>Role</label>
              <SettingsSelect
                value={form.role}
                onChange={(e) => setField('role', e.target.value)}
                wrapperStyle={{ width: '100%' }}
                selectStyle={s.selectInput}
              >
                <option value="user">User</option>
                <option value="superuser">Super User</option>
              </SettingsSelect>
            </div>
          </div>

          {form.role !== 'superuser' ? (
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setShowPerm((v) => !v)} style={s.permToggleBtn} type="button">
                <Shield size={14} color={settingsTheme.primary} />
                <span style={{ fontSize: 13, fontWeight: 700, color: settingsTheme.primary, flex: 1, textAlign: 'left' }}>
                  Section Permissions
                </span>
                {showPerm ? <ChevronUp size={14} color={settingsTheme.primary} /> : <ChevronDown size={14} color={settingsTheme.primary} />}
              </button>
              {showPerm ? <PermissionMatrix permissions={form.permissions} onChange={(next) => setField('permissions', next)} /> : null}
              {errors.permissions ? <span style={s.errorText}>{errors.permissions}</span> : null}
            </div>
          ) : (
            <div style={s.superUserNote}>
              <p style={{ margin: 0, fontSize: 12.5, color: '#8a5a00', fontWeight: 600 }}>
                Super users have full access to all sections including Settings.
              </p>
            </div>
          )}

          <div style={s.footer}>
            <button type="button" style={s.cancelBtn} onClick={() => router.push('/settings/users')}>Cancel</button>
            <button type="button" style={saving ? s.saveBtnDisabled : s.saveBtn} onClick={handleSave} disabled={saving}>
              <Save size={15} /> {saving ? 'Saving...' : 'Create User'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

const s = {
  wrapper: {
    maxWidth: 980,
    margin: '0 auto',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
    flexWrap: 'wrap',
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
    border: `1.5px solid ${settingsTheme.border}`,
    background: '#ffffff',
    color: settingsTheme.primarySoft,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  pageTitle: {
    margin: '0 0 4px',
    fontSize: 30,
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: '-0.6px',
    color: settingsTheme.primary,
  },
  pageSubtitle: {
    margin: 0,
    fontSize: 13.5,
    color: settingsTheme.textSubtle,
    fontWeight: 500,
  },
  card: {
    background: settingsTheme.pageTint,
    border: `1px solid ${settingsTheme.borderSoft}`,
    borderRadius: 20,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    padding: 24,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  },
  fieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: settingsTheme.textMuted,
  },
  input: {
    width: '100%',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: settingsTheme.border,
    borderRadius: 10,
    background: '#ffffff',
    color: settingsTheme.text,
    padding: '9px 12px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  },
  selectInput: {
    borderRadius: 10,
    padding: '9px 30px 9px 12px',
    fontSize: 13,
  },
  inputError: {
    borderColor: '#fca5a5',
    background: '#fff1f2',
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
    marginTop: 4,
  },
  errorBanner: {
    marginBottom: 12,
    background: '#fff1f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: 12.5,
    borderRadius: 10,
    padding: '8px 12px',
  },
  permToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    background: '#edf8ef',
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 10,
    padding: '9px 14px',
    cursor: 'pointer',
    marginBottom: 10,
  },
  superUserNote: {
    padding: '10px 14px',
    background: '#fff7e8',
    border: '1px solid #f0d8aa',
    borderRadius: 10,
    marginBottom: 16,
  },
  permWrap: {
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 12,
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  permHeadGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) 80px 80px 80px',
    background: '#eef2ee',
    borderBottom: `1px solid ${settingsTheme.border}`,
    minWidth: 460,
  },
  permHeadCell: {
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 700,
    color: settingsTheme.textMuted,
    textAlign: 'center',
  },
  permRowGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) 80px 80px 80px',
    borderBottom: `1px solid ${settingsTheme.borderSoft}`,
    alignItems: 'center',
    minWidth: 460,
  },
  permSectionCell: {
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: '#425343',
  },
  permCell: {
    display: 'flex',
    justifyContent: 'center',
  },
  permWrap: {
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 12,
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  permHeadGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) 80px 80px 80px',
    background: '#eef2ee',
    borderBottom: `1px solid ${settingsTheme.border}`,
    minWidth: 460,
  },
  permHeadCell: {
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 700,
    color: settingsTheme.textMuted,
    textAlign: 'center',
  },
  permRowGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) 80px 80px 80px',
    borderBottom: `1px solid ${settingsTheme.borderSoft}`,
    alignItems: 'center',
    minWidth: 460,
  },
  permSectionCell: {
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: '#425343',
  },
  permCell: {
    display: 'flex',
    justifyContent: 'center',
  },
  footer: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 16,
    borderTop: `1px solid ${settingsTheme.border}`,
    flexWrap: 'wrap',
  },
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 40,
    background: settingsTheme.primary,
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
    background: '#9eb7a1',
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
    border: `1.5px solid ${settingsTheme.border}`,
    borderRadius: 40,
    background: '#ffffff',
    color: settingsTheme.primarySoft,
    fontSize: 13.5,
    fontWeight: 600,
    padding: '11px 20px',
    cursor: 'pointer',
  },
  deniedWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 80,
    textAlign: 'center',
  },
  deniedTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: settingsTheme.text,
  },
  deniedText: {
    margin: 0,
    fontSize: 14,
    color: settingsTheme.textMuted,
  },
}

