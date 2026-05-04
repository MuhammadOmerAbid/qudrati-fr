'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { usersApi } from '@/infrastructure/api/endpoints'
import { ConfirmDelete, SettingsSelect, Toast, settingsTheme } from '@/components/settings/SettingsShared'
import StorePermissionMatrix, { STORE_PERMISSION_SECTIONS } from '@/components/settings/StorePermissionMatrix'
import { X, Shield, Pencil, Trash2, Plus, ChevronDown, ChevronUp, RefreshCw, ArrowLeft } from 'lucide-react'

const FULL_ACCESS_ROLES = new Set(['superuser', 'admin', 'administrator'])
const hasFullAccessRole = (role) => FULL_ACCESS_ROLES.has(String(role || '').trim().toLowerCase())
const normalizeRoleForApi = (role) => (hasFullAccessRole(role) ? 'superuser' : 'user')

function UserModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user', permissions: [] })
  const [showPerm, setShowPerm] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial?.id
        ? {
            username: initial.username,
            email: initial.email || '',
            password: '',
            role: initial.role || 'user',
            permissions: initial.permissions || [],
          }
        : { username: '', email: '', password: '', role: 'user', permissions: [] })
      setShowPerm(true)
    }
  }, [open, initial])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mobileQuery = window.matchMedia('(max-width: 640px)')
    const apply = () => setIsMobile(mobileQuery.matches)
    apply()
    mobileQuery.addEventListener('change', apply)
    return () => mobileQuery.removeEventListener('change', apply)
  }, [])

  if (!open) return null
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <div style={overlay}>
      <div style={{ ...modal, width: isMobile ? 'calc(100vw - 24px)' : modal.width, padding: isMobile ? 16 : 28, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={modalHeader}>
          <h3 style={modalTitle}>{initial?.id ? 'Edit User' : 'Add New User'}</h3>
          <button onClick={onClose} style={closeBtn} type="button">
            <X size={18} color={settingsTheme.textMuted} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Username *</label>
            <input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="username" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@example.com" type="email" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>{initial?.id ? 'New Password (optional)' : 'Password *'}</label>
            <input value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="********" type="password" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Role</label>
            <SettingsSelect value={form.role} onChange={(e) => set('role', e.target.value)} wrapperStyle={{ width: '100%' }} selectStyle={selectInputStyle}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="superuser">Super User</option>
            </SettingsSelect>
          </div>
        </div>

        {!hasFullAccessRole(form.role) && (
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setShowPerm((v) => !v)} style={permToggleBtn} type="button">
              <Shield size={14} color={settingsTheme.primary} />
              <span style={{ fontSize: 13, fontWeight: 700, color: settingsTheme.primary, flex: 1, textAlign: 'left' }}>
                Store Panel Permissions
              </span>
              {showPerm
                ? <ChevronUp size={14} color={settingsTheme.primary} />
                : <ChevronDown size={14} color={settingsTheme.primary} />}
            </button>
            {showPerm && (
              <StorePermissionMatrix
                permissions={form.permissions}
                onChange={(next) => set('permissions', next)}
              />
            )}
          </div>
        )}

        {hasFullAccessRole(form.role) && (
          <div style={superUserNote}>
            <p style={{ margin: 0, fontSize: 12.5, color: '#8a5a00', fontWeight: 600 }}>
              Admin users have full access to all sections including Settings.
            </p>
          </div>
        )}

        <div style={modalActions}>
          <button onClick={onClose} style={secondaryBtn} type="button">Cancel</button>
          <button onClick={() => onSave(form)} style={primaryBtn} type="button">
            {initial?.id ? 'Update User' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AccessBadge({ perm }) {
  const section = STORE_PERMISSION_SECTIONS.find((s) => s.id === perm)
  if (!section) return null
  return <span style={accessBadge}>{section.label}</span>
}

export default function UsersPage() {
  const router = useRouter()
  const { user: currentUser } = useAuthStore()
  const isSuperuser = hasFullAccessRole(currentUser?.role)

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterAccess, setFilterAccess] = useState('all')
  const [modal, setModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  const showToast = (message, type = 'success') => setToast({ message, type })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await usersApi.list()
      setUsers(Array.isArray(data) ? data : data?.results || [])
    } catch {
      showToast('Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isSuperuser) {
      setUsers([])
      return
    }
    load()
  }, [isSuperuser, load])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mobileQuery = window.matchMedia('(max-width: 640px)')
    const apply = () => setIsMobile(mobileQuery.matches)
    apply()
    mobileQuery.addEventListener('change', apply)
    return () => mobileQuery.removeEventListener('change', apply)
  }, [])

  const handleSave = async (form) => {
    try {
      const payload = {
        username: form.username,
        email: form.email,
        role: normalizeRoleForApi(form.role),
        permissions: hasFullAccessRole(form.role) ? [] : form.permissions,
      }
      if (form.password) payload.password = form.password

      if (modal?.id) {
        await usersApi.update(modal.id, payload)
        showToast('User updated')
      } else {
        await usersApi.create(payload)
        showToast('User created')
      }
      setModal(null)
      load()
    } catch (error) {
      showToast(error?.message || 'Failed to save user', 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await usersApi.delete(deleteTarget.id)
      setDeleteTarget(null)
      showToast('User deleted')
      load()
    } catch (error) {
      showToast(error?.message || 'Failed to delete user', 'error')
    }
  }

  const handleToggleStatus = async (user) => {
    try {
      await usersApi.update(user.id, { is_active: !user.is_active })
      load()
    } catch (error) {
      showToast(error?.message || 'Failed to update status', 'error')
    }
  }

  const filtered = users.filter((user) => {
    if (filterAccess === 'superuser') return hasFullAccessRole(user.role)
    if (filterAccess === 'user') return !hasFullAccessRole(user.role)
    return true
  })

  if (!isSuperuser) {
    return (
      <DashboardLayout>
        <div style={deniedWrap}>
          <Shield size={48} color={settingsTheme.textSubtle} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: settingsTheme.text }}>Access Restricted</h2>
          <p style={{ margin: 0, fontSize: 14, color: settingsTheme.textMuted }}>Only super users can manage team members.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div style={{ ...pageShell, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 12 : 22 }}>
        <div style={{ ...pageHeader, marginBottom: isMobile ? 14 : 20 }}>
          <div style={{ ...headerLeft, width: isMobile ? '100%' : 'auto' }}>
            <button type="button" style={backBtn} onClick={() => router.push('/settings')} title="Back to settings">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...pageTitle, fontSize: isMobile ? 18 : 22 }}>Users & Permissions</h1>
              <p style={{ ...pageSubtitle, fontSize: isMobile ? 12 : 13 }}>Manage team access and roles</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
            <button onClick={load} style={iconBtn} type="button" title="Refresh">
              <RefreshCw size={16} color={settingsTheme.textMuted} />
            </button>
            <button onClick={() => router.push('/settings/users/new')} style={{ ...addBtn, padding: isMobile ? '10px 16px' : '11px 20px' }} type="button">
              <Plus size={15} /> Add User
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <SettingsSelect value={filterAccess} onChange={(e) => setFilterAccess(e.target.value)} wrapperStyle={{ minWidth: isMobile ? '100%' : 170, width: isMobile ? '100%' : 'auto' }} selectStyle={selectStyle}>
            <option value="all">All</option>
            <option value="superuser">Admins</option>
            <option value="user">Regular Users</option>
          </SettingsSelect>
        </div>

        <div style={tableWrap}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: settingsTheme.textSubtle }}>Loading...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
              <thead>
                <tr>
                  {['User', 'Access', 'Email', 'Status', 'Actions'].map((head) => (
                    <th key={head} style={tableHead}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: settingsTheme.textSubtle }}>No users found.</td></tr>
                ) : filtered.map((user) => (
                  <tr
                    key={user.id}
                    style={{ borderBottom: `1px solid ${settingsTheme.borderSoft}` }}
                  >
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: hasFullAccessRole(user.role)
                            ? 'linear-gradient(135deg,#de4a4a,#b92d2d)'
                            : 'linear-gradient(135deg,#2d7a33,#54B45B)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
                            {(user.username || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: settingsTheme.text }}>{user.username}</div>
                          <div style={{ fontSize: 11.5, color: hasFullAccessRole(user.role) ? '#c83535' : settingsTheme.primarySoft, fontWeight: 600 }}>
                            {hasFullAccessRole(user.role) ? 'Admin' : 'User'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 20px', textAlign: 'center', maxWidth: 280 }}>
                      {hasFullAccessRole(user.role) ? (
                        <span style={allAccessBadge}>All Access</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {(user.permissions || [])
                            .filter((perm) => !perm.includes('_edit') && !perm.includes('_delete'))
                            .map((perm) => <AccessBadge key={perm} perm={perm} />)}
                          {(!user.permissions || user.permissions.length === 0) && (
                            <span style={{ fontSize: 12.5, color: settingsTheme.textSubtle }}>No access granted</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 20px', textAlign: 'center', fontSize: 13.5, color: settingsTheme.textMuted }}>
                      {user.email || '-'}
                    </td>

                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleToggleStatus(user)}
                        type="button"
                        style={{
                          width: 42,
                          height: 24,
                          borderRadius: 999,
                          background: user.is_active !== false ? settingsTheme.primarySoft : '#cfd9cf',
                          border: 'none',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        <span style={{
                          position: 'absolute',
                          top: 3,
                          left: user.is_active !== false ? 21 : 3,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#fff',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.16)',
                        }} />
                      </button>
                    </td>

                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button onClick={() => setModal(user)} style={actionBtn} title="Edit" type="button">
                          <Pencil size={14} color={settingsTheme.textMuted} />
                        </button>
                        {user.id !== currentUser?.id && (
                          <button onClick={() => setDeleteTarget(user)} style={dangerActionBtn} title="Delete" type="button">
                            <Trash2 size={14} color={settingsTheme.danger} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={legendBox}>
          <span style={{ fontSize: 12, color: settingsTheme.textMuted, fontWeight: 700 }}>Permission legend:</span>
          {[
            { color: settingsTheme.primarySoft, label: 'View' },
            { color: settingsTheme.primary, label: 'Edit' },
            { color: '#de4a4a', label: 'Delete' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
              <span style={{ fontSize: 12, color: settingsTheme.textMuted }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <UserModal open={modal !== null} onClose={() => setModal(null)} onSave={handleSave} initial={modal} />
      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget?.username}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </DashboardLayout>
  )
}

const pageShell = {
  background: settingsTheme.pageTint,
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 20,
  padding: 22,
  boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
}

const pageHeader = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: 20,
}

const headerLeft = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}

const backBtn = {
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
}

const pageTitle = {
  margin: 0,
  fontSize: 22,
  fontWeight: 800,
  color: settingsTheme.text,
}

const pageSubtitle = {
  margin: '4px 0 0',
  fontSize: 13,
  color: settingsTheme.textMuted,
}

const iconBtn = {
  width: 36,
  height: 36,
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 10,
  background: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const primaryBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: settingsTheme.primarySoft,
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '8px 16px',
  fontSize: 13.5,
  fontWeight: 700,
  cursor: 'pointer',
}

const addBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '11px 20px',
  borderRadius: 40,
  border: 'none',
  background: 'linear-gradient(90deg, #1B5E20 0%, #2E7D32 45%, #4CAF50 100%)',
  color: '#fff',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
}

const selectStyle = {
  borderRadius: 40,
  padding: '8px 30px 8px 12px',
  fontSize: 13.5,
  color: settingsTheme.text,
  background: '#fff',
  cursor: 'pointer',
  outline: 'none',
}

const tableWrap = {
  background: '#fff',
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 14,
  overflowX: 'auto',
  overflowY: 'hidden',
}

const tableHead = {
  padding: '12px 20px',
  background: '#eef2ee',
  fontSize: 13,
  fontWeight: 700,
  color: '#455645',
  borderBottom: `1px solid ${settingsTheme.border}`,
  textAlign: 'center',
}

const actionBtn = {
  width: 30,
  height: 30,
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 8,
  background: '#f8faf8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}

const dangerActionBtn = {
  ...actionBtn,
  background: settingsTheme.dangerBg,
  border: '1px solid #fecaca',
}

const accessBadge = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 20,
  background: '#edf8ef',
  border: `1px solid ${settingsTheme.border}`,
  fontSize: 11.5,
  fontWeight: 700,
  color: settingsTheme.primary,
  margin: '2px 3px',
}

const allAccessBadge = {
  padding: '3px 10px',
  background: '#fff3f3',
  border: '1px solid #fecaca',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 700,
  color: '#c83535',
}

const legendBox = {
  marginTop: 16,
  padding: '12px 16px',
  background: '#f6f9f6',
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 10,
  display: 'flex',
  gap: 20,
  flexWrap: 'wrap',
}

const deniedWrap = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 80,
  gap: 12,
  textAlign: 'center',
}

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(26,46,27,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 999,
}

const modal = {
  background: '#fff',
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 16,
  padding: 28,
  width: 560,
  boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
}

const modalHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
}

const modalTitle = {
  margin: 0,
  fontSize: 17,
  fontWeight: 700,
  color: settingsTheme.text,
}

const closeBtn = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
}

const labelStyle = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 600,
  color: '#425343',
  marginBottom: 5,
}

const inputStyle = {
  width: '100%',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: settingsTheme.border,
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13.5,
  color: settingsTheme.text,
  outline: 'none',
  boxSizing: 'border-box',
}

const selectInputStyle = {
  borderRadius: 10,
  padding: '8px 30px 8px 12px',
}

const permToggleBtn = {
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
}

const superUserNote = {
  padding: '10px 14px',
  background: '#fff7e8',
  border: '1px solid #f0d8aa',
  borderRadius: 10,
  marginBottom: 16,
}

const modalActions = {
  display: 'flex',
  gap: 10,
  justifyContent: 'flex-end',
}

const secondaryBtn = {
  padding: '8px 18px',
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 10,
  background: '#fff',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
  color: '#425343',
}

