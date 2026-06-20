'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { brandsApi, finishedGoodsApi } from '@/infrastructure/api/endpoints'
import { settingsTheme } from '@/components/settings/SettingsShared'
import { ArrowLeft, Save, Shield } from 'lucide-react'
import { StoreThemeDropdown } from '@/components/store/shared/StoreThemeControls'

const todayISO = () => new Date().toISOString().split('T')[0]

export default function FinishedGoodProductsNewPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const isSuperuser = user?.role === 'superuser'
  const canEdit = isSuperuser
    || user?.permissions?.includes('finished-good-products_edit')
    || user?.permissions?.includes('finished_goods_edit')
    || user?.permissions?.includes('products_edit')

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [errors, setErrors] = useState({})
  const [isMobile, setIsMobile] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', description: '' })
  const [brands, setBrands] = useState([])
  const [loadingBrands, setLoadingBrands] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mobileQuery = window.matchMedia('(max-width: 640px)')
    const apply = () => setIsMobile(mobileQuery.matches)
    apply()
    mobileQuery.addEventListener('change', apply)
    return () => mobileQuery.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    let active = true
    const loadBrands = async () => {
      setLoadingBrands(true)
      try {
        const data = await brandsApi.list()
        const list = Array.isArray(data) ? data : (data?.results || [])
        if (active) {
          setBrands(list.filter((brand) => brand.status !== false && String(brand.status || '').toLowerCase() !== 'inactive'))
        }
      } catch {
        if (active) setBrands([])
      } finally {
        if (active) setLoadingBrands(false)
      }
    }
    loadBrands()
    return () => { active = false }
  }, [])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Brand is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    setSaving(true)
    setErrorMsg('')
    try {
      await finishedGoodsApi.create({
        brand: form.name.trim(),
        date: todayISO(),
        status: 'Completed',
        products: [{
          code: form.code.trim(),
          description: form.description.trim(),
        }],
      })
      router.push('/settings/finished-good-products')
    } catch {
      setErrorMsg('Failed to save entry. Please try again.')
      setSaving(false)
    }
  }

  if (!canEdit) {
    return (
      <DashboardLayout>
        <div style={s.deniedWrap}>
          <Shield size={48} color={settingsTheme.textSubtle} />
          <h2 style={s.deniedTitle}>Access Restricted</h2>
          <p style={s.deniedText}>You do not have permission to add entries.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div style={{ ...s.wrapper, maxWidth: isMobile ? '100%' : 940 }}>
        <div style={s.pageHeader}>
          <div style={{ ...s.headerLeft, width: isMobile ? '100%' : 'auto' }}>
            <button type="button" style={s.backBtn} onClick={() => router.push('/settings/finished-good-products')}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...s.pageTitle, fontSize: isMobile ? 20 : 30 }}>Add Finished Good Product</h1>
              <p style={{ ...s.pageSubtitle, fontSize: isMobile ? 12 : 13.5 }}>Create a new finished good product entry</p>
            </div>
          </div>

          <button type="button" style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>

        <div style={{ ...s.card, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 14 : 24 }}>
          {errorMsg ? <div style={s.errorBanner}>{errorMsg}</div> : null}

          <div style={s.fieldWrap}>
            <label style={s.label}>Brand</label>
            <StoreThemeDropdown
              value={form.name}
              onChange={(nextBrand) => setField('name', nextBrand)}
              hasError={Boolean(errors.name)}
              variant="input"
              placeholder={loadingBrands ? 'Loading brands...' : 'Select brand'}
              options={[
                { value: '', label: loadingBrands ? 'Loading brands...' : 'Select brand' },
                ...brands.map((brand) => ({ value: brand.name, label: brand.name })),
              ]}
            />
            {errors.name ? <span style={s.errorText}>{errors.name}</span> : null}
          </div>

          <div style={s.fieldWrap}>
            <label style={s.label}>Code</label>
            <input
              type="text"
              style={s.input}
              value={form.code}
              placeholder="Enter code or reference"
              onChange={(e) => setField('code', e.target.value)}
            />
          </div>

          <div style={s.fieldWrap}>
            <label style={s.label}>Description</label>
            <input
              type="text"
              style={s.input}
              value={form.description}
              placeholder="Description"
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>

          <div style={s.footer}>
            <button type="button" style={{ ...s.cancelBtn, width: isMobile ? '100%' : 'auto' }} onClick={() => router.push('/settings/finished-good-products')}>Cancel</button>
            <button type="button" style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
              <Save size={15} /> {saving ? 'Saving...' : 'Save Entry'}
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

