'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { packagingApi } from '@/infrastructure/api/endpoints'
import { settingsTheme } from '@/components/settings/SettingsShared'
import { ArrowLeft, Save, Shield } from 'lucide-react'

export default function PackagingNewPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const isSuperuser = user?.role === 'superuser'
  const canEdit = isSuperuser || user?.permissions?.includes('packaging_edit')

  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [nameError, setNameError] = useState('')

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError('Packaging type is required')
      return
    }

    setSaving(true)
    setErrorMsg('')
    try {
      await packagingApi.create(name.trim())
      router.push('/settings/packaging')
    } catch {
      setErrorMsg('Failed to save packaging type. Please try again.')
      setSaving(false)
    }
  }

  if (!canEdit) {
    return (
      <DashboardLayout>
        <div style={s.deniedWrap}>
          <Shield size={48} color={settingsTheme.textSubtle} />
          <h2 style={s.deniedTitle}>Access Restricted</h2>
          <p style={s.deniedText}>You do not have permission to add packaging types.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div style={s.wrapper}>
        <div style={s.pageHeader}>
          <div style={s.headerLeft}>
            <button type="button" style={s.backBtn} onClick={() => router.push('/settings/packaging')}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={s.pageTitle}>Add Packaging</h1>
              <p style={s.pageSubtitle}>Create a new packaging type</p>
            </div>
          </div>

          <button type="button" style={saving ? s.saveBtnDisabled : s.saveBtn} onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save Packaging'}
          </button>
        </div>

        <div style={s.card}>
          {errorMsg ? <div style={s.errorBanner}>{errorMsg}</div> : null}

          <div style={s.fieldWrap}>
            <label style={s.label}>Packaging Type</label>
            <input
              type="text"
              style={{ ...s.input, ...(nameError ? s.inputError : {}) }}
              value={name}
              placeholder="Enter packaging type (e.g. Carton, Bag, Box)"
              onChange={(e) => {
                setName(e.target.value)
                setNameError('')
              }}
            />
            {nameError ? <span style={s.errorText}>{nameError}</span> : null}
          </div>

          <div style={s.footer}>
            <button type="button" style={s.cancelBtn} onClick={() => router.push('/settings/packaging')}>Cancel</button>
            <button type="button" style={saving ? s.saveBtnDisabled : s.saveBtn} onClick={handleSave} disabled={saving}>
              <Save size={15} /> {saving ? 'Saving...' : 'Save Packaging'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

const s = {
  wrapper: { maxWidth: 940, margin: '0 auto' },
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
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
  pageTitle: { margin: '0 0 4px', fontSize: 30, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.6px', color: settingsTheme.primary },
  pageSubtitle: { margin: 0, fontSize: 13.5, color: settingsTheme.textSubtle, fontWeight: 500 },
  card: {
    background: settingsTheme.pageTint,
    border: `1px solid ${settingsTheme.borderSoft}`,
    borderRadius: 20,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    padding: 24,
  },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 700, color: settingsTheme.textMuted },
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
  inputError: { borderColor: '#fca5a5', background: '#fff1f2' },
  errorText: { fontSize: 12, color: '#b91c1c' },
  errorBanner: {
    marginBottom: 12,
    background: '#fff1f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: 12.5,
    borderRadius: 10,
    padding: '8px 12px',
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
  deniedTitle: { margin: 0, fontSize: 20, fontWeight: 700, color: settingsTheme.text },
  deniedText: { margin: 0, fontSize: 14, color: settingsTheme.textMuted },
}

