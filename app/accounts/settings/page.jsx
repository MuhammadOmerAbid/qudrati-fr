'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountLayout from '@/presentation/layouts/AccountLayout'
import AccountPermissionMatrix, { ACCOUNT_PERMISSION_SECTIONS } from '@/components/accounts/AccountPermissionMatrix'
import { KeyRound, Lock, Plus, RefreshCcw, Settings, Shield } from 'lucide-react'
import { panelPasswordApi } from '@/infrastructure/api/endpoints'
import {
  loadAuditLogsFromStorage,
  loadClosedAccountingPeriodsFromStorage,
} from '@/application/services/accounts/accountsWorkflow'

const DEFAULT_ACCOUNT_USER_PERMISSIONS = ACCOUNT_PERMISSION_SECTIONS.map((section) => section.id)

function currentPeriodLabel() {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function formatDateTime(value) {
  const ms = Date.parse(String(value || ''))
  if (!Number.isFinite(ms)) return '-'
  return new Date(ms).toLocaleString()
}

function toKey(value) {
  return String(value || '').trim().toLowerCase()
}

export default function AccountsSettingsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'

  const [tab, setTab] = useState('period')
  const [closedPeriods, setClosedPeriods] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [auditSearch, setAuditSearch] = useState('')
  const [showPanelPwModal, setShowPanelPwModal] = useState(false)
  const [noticeText, setNoticeText] = useState('')
  const [errorText, setErrorText] = useState('')
  const [rolePreview, setRolePreview] = useState('user')
  const [userPermissionPreview, setUserPermissionPreview] = useState(DEFAULT_ACCOUNT_USER_PERMISSIONS)

  const refreshState = () => {
    try {
      setClosedPeriods(loadClosedAccountingPeriodsFromStorage())
      setAuditLogs(loadAuditLogsFromStorage())
      setErrorText('')
    } catch (error) {
      setErrorText(error?.message || 'Unable to load settings data')
    }
  }

  useEffect(() => {
    refreshState()
  }, [])

  const currentPeriod = currentPeriodLabel()
  const currentClosed = useMemo(() => (
    closedPeriods.some((item) => toKey(item.periodLabel) === toKey(currentPeriod))
  ), [closedPeriods, currentPeriod])

  const filteredAudit = useMemo(() => {
    const needle = toKey(auditSearch)
    if (!needle) return auditLogs
    return auditLogs.filter((log) => {
      const haystack = toKey([
        log.action,
        log.entity,
        log.entityCode,
        log.user,
        log.note,
        log.at,
      ].join(' '))
      return haystack.includes(needle)
    })
  }, [auditLogs, auditSearch])

  if (!isSuperuser) {
    return (
      <AccountLayout>
        <div style={s.restrictedWrap}>
          <Shield size={48} color="#d4dfd4" />
          <p style={s.restrictedTitle}>Settings Access Restricted</p>
          <p style={s.restrictedSub}>Only Super Users can access Accounts Settings.</p>
        </div>
      </AccountLayout>
    )
  }

  return (
    <AccountLayout>
      <div style={s.page}>
        <section style={s.hero}>
          <div style={s.heroLeft}>
            <div style={s.heroIcon}><Settings size={22} color="#166534" /></div>
            <div>
              <h1 style={s.title}>Accounts Settings</h1>
              <p style={s.subtitle}>Period locks, permissions, audit trail, and reset controls.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...s.refreshBtn, gap: 6 }} onClick={() => setShowPanelPwModal(true)}>
              <KeyRound size={14} /> My Panel Password
            </button>
            <button style={s.refreshBtn} onClick={refreshState}>
              <RefreshCcw size={14} /> Refresh
            </button>
          </div>
        </section>

        {noticeText ? <p style={s.noticeText}>{noticeText}</p> : null}
        {errorText ? <p style={s.errorText}>{errorText}</p> : null}

        <div style={s.tabs}>
          {[
            { id: 'period', label: 'Period Control' },
            { id: 'roles', label: 'Role Permissions' },
            { id: 'audit', label: 'Audit Trail' },
            { id: 'general', label: 'General' },
          ].map((item) => (
            <button key={item.id} style={{ ...s.tab, ...(tab === item.id ? s.tabActive : {}) }} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'period' ? (
          <div style={s.card}>
            <h3 style={s.cardTitle}>Accounting Period Lock</h3>
            <p style={s.cardSub}>Close month-end period to stop edits/postings in that month.</p>

            <div style={s.periodBanner}>
              <div>
                <p style={s.periodLabel}>Current Period</p>
                <p style={s.periodVal}>{currentPeriod}</p>
              </div>
              <span style={{ ...s.openBadge, color: currentClosed ? '#b91c1c' : '#16a34a' }}>{currentClosed ? 'Closed' : 'Open'}</span>
            </div>

            <div style={s.periodActions}>
              <button
                style={{ ...s.closeBtn, opacity: currentClosed ? 0.55 : 1, cursor: currentClosed ? 'not-allowed' : 'pointer' }}
                disabled={currentClosed}
                onClick={() => router.push('/accounts/settings/close-period')}
              >
                <Lock size={14} /> Close Current Period
              </button>
            </div>

            <div style={s.tableCard}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>Period</th>
                    <th style={s.th}>Closed By</th>
                    <th style={s.th}>Closed At</th>
                    <th style={s.th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {closedPeriods.map((entry) => (
                    <tr key={entry.id} style={s.trow}>
                      <td style={s.td}>{entry.periodLabel}</td>
                      <td style={s.td}>{entry.closedBy || '-'}</td>
                      <td style={s.td}>{formatDateTime(entry.closedAt)}</td>
                      <td style={s.td}>{entry.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {closedPeriods.length === 0 ? <p style={s.empty}>No closed periods yet.</p> : null}
            </div>
          </div>
        ) : null}

        {tab === 'roles' ? (
          <div style={s.card}>
            <div style={s.roleHeaderRow}>
              <div>
                <h3 style={s.cardTitle}>Role Permissions</h3>
                <p style={s.cardSub}>Configure account panel permissions with the same layout pattern as Store panel access.</p>
              </div>
              <button type="button" style={s.addUserBtn} onClick={() => router.push('/accounts/settings/users/new')}>
                <Plus size={14} /> Add New User
              </button>
            </div>

            <div style={s.roleSwitch}>
              <button
                type="button"
                style={{ ...s.roleSwitchBtn, ...(rolePreview === 'user' ? s.roleSwitchBtnActive : {}) }}
                onClick={() => setRolePreview('user')}
              >
                User
              </button>
              <button
                type="button"
                style={{ ...s.roleSwitchBtn, ...(rolePreview === 'superuser' ? s.roleSwitchBtnActive : {}) }}
                onClick={() => setRolePreview('superuser')}
              >
                Super User
              </button>
            </div>

            {rolePreview === 'user' ? (
              <AccountPermissionMatrix
                permissions={userPermissionPreview}
                onChange={setUserPermissionPreview}
              />
            ) : (
              <div style={s.superUserNote}>
                <p style={s.superUserNoteTitle}>Super users have full access.</p>
                <p style={s.superUserNoteText}>All account modules, edit/delete operations, settings controls, and period closure remain fully available.</p>
              </div>
            )}
          </div>
        ) : null}

        {tab === 'audit' ? (
          <div style={s.card}>
            <h3 style={s.cardTitle}>Audit Trail</h3>
            <p style={s.cardSub}>Recent immutable accounting events.</p>
            <div style={s.auditToolbar}>
              <input
                style={s.searchInput}
                placeholder="Search action, entity, user..."
                value={auditSearch}
                onChange={(event) => setAuditSearch(event.target.value)}
              />
            </div>
            <div style={s.tableCard}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>Action</th>
                    <th style={s.th}>Entity</th>
                    <th style={s.th}>Code</th>
                    <th style={s.th}>User</th>
                    <th style={s.th}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.map((log, index) => (
                    <tr key={`${log.id}-${log.at}-${index}`} style={s.trow}>
                      <td style={s.td}>{log.action}</td>
                      <td style={s.td}>{log.entity}</td>
                      <td style={s.td}>{log.entityCode || '-'}</td>
                      <td style={s.td}>{log.user || '-'}</td>
                      <td style={s.td}>{formatDateTime(log.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredAudit.length === 0 ? <p style={s.empty}>No audit entries found.</p> : null}
            </div>
          </div>
        ) : null}

        {tab === 'general' ? (
          <div style={s.card}>
            <h3 style={s.cardTitle}>General Controls</h3>
            <p style={s.cardSub}>Danger zone actions for superuser only.</p>
          </div>
        ) : null}
      </div>

      {showPanelPwModal && (
        <ResetPanelPasswordModal
          onClose={() => setShowPanelPwModal(false)}
          onSuccess={() => setNoticeText('Panel password updated successfully.')}
        />
      )}
    </AccountLayout>
  )
}

function ResetPanelPasswordModal({ onClose, onSuccess }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!password) return setError('Password is required')
    if (password !== confirm) return setError('Passwords do not match')
    setSaving(true)
    setError('')
    try {
      await panelPasswordApi.setOwn(password)
      onSuccess()
      onClose()
    } catch {
      setError('Failed to update panel password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 380, boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#14532d' }}>Reset My Panel Password</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>✕</button>
        </div>
        {error && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 12.5, color: '#b91c1c' }}>{error}</div>}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>New Panel Password *</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="New panel password" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>Confirm Panel Password *</label>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" placeholder="Confirm panel password" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1.5px solid #d1d5db', borderRadius: 10, background: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: '#166534' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', border: 'none', borderRadius: 10, background: '#14532d', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { width: '100%', display: 'flex', flexDirection: 'column', gap: 14 },
  restrictedWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 380, gap: 12 },
  restrictedTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: '#1a3d1f' },
  restrictedSub: { margin: 0, fontSize: 13, color: '#64748b' },
  hero: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    border: '1px solid #d1fae5',
    background: 'linear-gradient(120deg, #f0fdf4 0%, #ecfeff 100%)',
    borderRadius: 16,
    padding: 'clamp(12px, 2.4vw, 16px) clamp(12px, 2.6vw, 18px)',
  },
  heroLeft: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 320px' },
  heroIcon: { width: 40, height: 40, borderRadius: 12, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { margin: 0, fontSize: 'clamp(18px, 3.2vw, 22px)', color: '#14532d', fontWeight: 800 },
  subtitle: { margin: '4px 0 0', fontSize: 12.5, color: '#166534' },
  refreshBtn: {
    border: '1px solid #d1d5db',
    borderRadius: 10,
    background: '#ffffff',
    color: '#1f2937',
    padding: '8px 10px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  noticeText: { margin: 0, padding: '9px 11px', borderRadius: 9, border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#065f46', fontSize: 12.5, fontWeight: 600 },
  errorText: { margin: 0, padding: '9px 11px', borderRadius: 9, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: 12.5, fontWeight: 600 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: { padding: '8px 12px', borderRadius: 999, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  tabActive: { border: '1px solid #14532d', background: '#14532d', color: '#ffffff' },
  card: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 14 },
  cardTitle: { margin: 0, fontSize: 16, color: '#111827', fontWeight: 800 },
  cardSub: { margin: '4px 0 12px', fontSize: 12.5, color: '#64748b' },
  roleHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  addUserBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 999, background: '#14532d', color: '#ffffff', padding: '9px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  roleSwitch: { display: 'inline-flex', gap: 8, border: '1px solid #d1d5db', borderRadius: 999, padding: 4, background: '#f8fafc', marginBottom: 12 },
  roleSwitchBtn: { border: 'none', background: 'transparent', color: '#475569', borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  roleSwitchBtnActive: { background: '#14532d', color: '#ffffff' },
  superUserNote: { border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 12, padding: '12px 14px' },
  superUserNoteTitle: { margin: 0, fontSize: 13.5, fontWeight: 800, color: '#92400e' },
  superUserNoteText: { margin: '4px 0 0', fontSize: 12.5, color: '#a16207', lineHeight: 1.45 },
  periodBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, border: '1px solid #d1fae5', background: '#f0fdf4', borderRadius: 12, padding: '10px 12px' },
  periodLabel: { margin: 0, fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' },
  periodVal: { margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: '#14532d' },
  openBadge: { fontSize: 12.5, fontWeight: 800 },
  periodActions: { marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' },
  closeBtn: { border: '1px solid #14532d', borderRadius: 10, background: '#14532d', color: '#fff', padding: '8px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
  tableCard: { marginTop: 10, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 700 },
  thead: { background: '#f1f5f9' },
  th: { padding: '10px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'left' },
  trow: { borderTop: '1px solid #e5e7eb' },
  td: { padding: '9px 10px', fontSize: 12.5, color: '#111827' },
  empty: { margin: 0, padding: '14px 10px', color: '#64748b', fontSize: 12.5, textAlign: 'center' },
  auditToolbar: { marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' },
  searchInput: { border: '1px solid #d1d5db', borderRadius: 10, padding: '8px 10px', fontSize: 12.5, color: '#111827', width: '100%', maxWidth: 320, fontFamily: 'inherit' },
}

