'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp, Save, Shield } from 'lucide-react'
import AccountLayout from '@/presentation/layouts/AccountLayout'
import AccountPermissionMatrix, { ACCOUNT_PERMISSION_SECTIONS } from '@/components/accounts/AccountPermissionMatrix'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { usersApi } from '@/infrastructure/api/endpoints'

const FULL_ACCESS_ROLES = new Set(['superuser', 'admin', 'administrator'])
const hasFullAccessRole = (role) => FULL_ACCESS_ROLES.has(String(role || '').trim().toLowerCase())
const normalizeRoleForApi = (role) => (hasFullAccessRole(role) ? 'superuser' : 'user')

export default function AccountsUserNewPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'

  const [saving, setSaving] = useState(false)
  const [showPerm, setShowPerm] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    panel_password: '',
    role: 'user',
    permissions: ACCOUNT_PERMISSION_SECTIONS.map((section) => section.id),
  })

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.username.trim()) next.username = 'Username is required'
    if (!form.password) next.password = 'Password is required'
    if (!form.panel_password) next.panel_password = 'Panel password is required'
    if (!hasFullAccessRole(form.role) && form.permissions.length === 0) {
      next.permissions = 'Select at least one account permission'
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
        panel_password: form.panel_password,
        role: normalizeRoleForApi(form.role),
        permissions: hasFullAccessRole(form.role) ? [] : form.permissions,
      }

      await usersApi.create(payload)
      router.push('/accounts/settings')
    } catch (error) {
      setErrorMsg(error?.message || 'Failed to create user. Please try again.')
      setSaving(false)
    }
  }

  if (!isSuperuser) {
    return (
      <AccountLayout>
        <div style={s.deniedWrap}>
          <Shield size={48} color="#d1d5db" />
          <h2 style={s.deniedTitle}>Access Restricted</h2>
          <p style={s.deniedText}>Only super users can add team members.</p>
        </div>
      </AccountLayout>
    )
  }

  return (
    <AccountLayout>
      <div style={s.wrapper}>
        <div style={s.pageHeader}>
          <div style={s.headerLeft}>
            <button type="button" style={s.backBtn} onClick={() => router.push('/accounts/settings')}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={s.pageTitle}>Add User (Accounts)</h1>
              <p style={s.pageSubtitle}>Create a new account user and assign account panel permissions.</p>
            </div>
          </div>

          <button type="button" style={saving ? s.saveBtnDisabled : s.saveBtn} onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'Create User'}
          </button>
        </div>

        <div style={s.card}>
          {errorMsg ? <div style={s.errorBanner}>{errorMsg}</div> : null}

          <div style={s.grid2}>
            <div style={s.fieldWrap}>
              <label style={s.label}>Username *</label>
              <input
                type="text"
                style={{ ...s.input, ...(errors.username ? s.inputError : {}) }}
                value={form.username}
                placeholder="username"
                onChange={(event) => setField('username', event.target.value)}
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
                onChange={(event) => setField('email', event.target.value)}
              />
            </div>
          </div>

          <div style={s.grid2}>
            <div style={s.fieldWrap}>
              <label style={s.label}>Password *</label>
              <input
                type="password"
                style={{ ...s.input, ...(errors.password ? s.inputError : {}) }}
                value={form.password}
                placeholder="********"
                onChange={(event) => setField('password', event.target.value)}
              />
              {errors.password ? <span style={s.errorText}>{errors.password}</span> : null}
            </div>

            <div style={s.fieldWrap}>
              <label style={s.label}>Panel Password *</label>
              <input
                type="password"
                style={{ ...s.input, ...(errors.panel_password ? s.inputError : {}) }}
                value={form.panel_password}
                placeholder="Panel access password"
                onChange={(event) => setField('panel_password', event.target.value)}
              />
              {errors.panel_password ? <span style={s.errorText}>{errors.panel_password}</span> : null}
            </div>
          </div>

          <div style={s.grid2}>
            <div style={{ display: 'none' }} />
            <div style={s.fieldWrap}>
              <label style={s.label}>Role</label>
              <select
                value={form.role}
                onChange={(event) => setField('role', event.target.value)}
                style={s.select}
              >
                <option value="user">User</option>
                <option value="superuser">Super User</option>
              </select>
            </div>
          </div>

          {!hasFullAccessRole(form.role) ? (
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setShowPerm((open) => !open)} style={s.permToggleBtn} type="button">
                <Shield size={14} color="#14532d" />
                <span style={s.permToggleTitle}>Accounts Panel Permissions</span>
                {showPerm ? <ChevronUp size={14} color="#14532d" /> : <ChevronDown size={14} color="#14532d" />}
              </button>
              {showPerm ? <AccountPermissionMatrix permissions={form.permissions} onChange={(next) => setField('permissions', next)} /> : null}
              {errors.permissions ? <span style={s.errorText}>{errors.permissions}</span> : null}
            </div>
          ) : (
            <div style={s.superUserNote}>
              <p style={s.superUserNoteText}>
                Super users have full access to all account panel sections including settings.
              </p>
            </div>
          )}

          <div style={s.footer}>
            <button type="button" style={s.cancelBtn} onClick={() => router.push('/accounts/settings')}>Cancel</button>
            <button type="button" style={saving ? s.saveBtnDisabled : s.saveBtn} onClick={handleSave} disabled={saving}>
              <Save size={15} /> {saving ? 'Saving...' : 'Create User'}
            </button>
          </div>
        </div>
      </div>
    </AccountLayout>
  )
}

const s = {
  wrapper: {
    width: '100%',
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
    border: '1.5px solid #d1d5db',
    background: '#ffffff',
    color: '#166534',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  pageTitle: {
    margin: '0 0 4px',
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: '-0.4px',
    color: '#14532d',
  },
  pageSubtitle: {
    margin: 0,
    fontSize: 13.5,
    color: '#64748b',
    fontWeight: 500,
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
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
    color: '#475569',
  },
  input: {
    width: '100%',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: 10,
    background: '#ffffff',
    color: '#111827',
    padding: '9px 12px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: 10,
    background: '#ffffff',
    color: '#111827',
    padding: '9px 12px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
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
    background: '#eef5ef',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    padding: '9px 14px',
    cursor: 'pointer',
    marginBottom: 10,
  },
  permToggleTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#14532d',
    flex: 1,
    textAlign: 'left',
  },
  superUserNote: {
    padding: '10px 14px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 10,
    marginBottom: 16,
  },
  superUserNoteText: {
    margin: 0,
    fontSize: 12.5,
    color: '#92400e',
    fontWeight: 600,
  },
  footer: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 16,
    borderTop: '1px solid #e5e7eb',
    flexWrap: 'wrap',
  },
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 40,
    background: '#14532d',
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
    background: '#86a389',
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
    border: '1.5px solid #d1d5db',
    borderRadius: 40,
    background: '#ffffff',
    color: '#166534',
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
    color: '#111827',
  },
  deniedText: {
    margin: 0,
    fontSize: 14,
    color: '#64748b',
  },
}

