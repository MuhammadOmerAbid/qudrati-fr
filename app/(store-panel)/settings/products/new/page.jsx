'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { brandsApi, categoriesApi, productsApi } from '@/infrastructure/api/endpoints'
import { SettingsSelect, settingsTheme } from '@/components/settings/SettingsShared'
import { ArrowLeft, Save, Shield } from 'lucide-react'

export default function ProductNewPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const isSuperuser = user?.role === 'superuser'
  const canEdit = isSuperuser || user?.permissions?.includes('products_edit')

  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [errors, setErrors] = useState({})
  const [isMobile, setIsMobile] = useState(false)
  const [form, setForm] = useState({ name: '', brand: '', category: '' })

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
    const loadOptions = async () => {
      setLoadingOptions(true)
      try {
        const [b, c] = await Promise.all([brandsApi.list(), categoriesApi.list()])
        if (!active) return
        setBrands(Array.isArray(b) ? b : b?.results || [])
        setCategories(Array.isArray(c) ? c : c?.results || [])
      } catch {
        if (active) setErrorMsg('Failed to load brand/category options.')
      } finally {
        if (active) setLoadingOptions(false)
      }
    }

    loadOptions()

    return () => {
      active = false
    }
  }, [])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Product name is required'
    if (!form.brand) next.brand = 'Brand is required'
    if (!form.category) next.category = 'Category is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    setSaving(true)
    setErrorMsg('')
    try {
      await productsApi.create({
        name: form.name.trim(),
        brand: form.brand,
        category: form.category,
      })
      router.push('/settings/products')
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save product. Please try again.')
      setSaving(false)
    }
  }

  if (!canEdit) {
    return (
      <DashboardLayout>
        <div style={s.deniedWrap}>
          <Shield size={48} color={settingsTheme.textSubtle} />
          <h2 style={s.deniedTitle}>Access Restricted</h2>
          <p style={s.deniedText}>You do not have permission to add products.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div style={{ ...s.wrapper, maxWidth: isMobile ? '100%' : 940 }}>
        <div style={s.pageHeader}>
          <div style={{ ...s.headerLeft, width: isMobile ? '100%' : 'auto' }}>
            <button type="button" style={s.backBtn} onClick={() => router.push('/settings/products')}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...s.pageTitle, fontSize: isMobile ? 20 : 30 }}>Add Product</h1>
              <p style={{ ...s.pageSubtitle, fontSize: isMobile ? 12 : 13.5 }}>Create a product using brand and category</p>
            </div>
          </div>

          <button type="button" style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving || loadingOptions}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save Product'}
          </button>
        </div>

        <div style={{ ...s.card, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 14 : 24 }}>
          {loadingOptions ? (
            <div style={s.loading}>Loading options...</div>
          ) : (
            <>
              {errorMsg ? <div style={s.errorBanner}>{errorMsg}</div> : null}

              <div style={s.fieldWrap}>
                <label style={s.label}>Product Name</label>
                <input
                  type="text"
                  style={{ ...s.input, ...(errors.name ? s.inputError : {}) }}
                  value={form.name}
                  placeholder="Enter product name"
                  onChange={(e) => setField('name', e.target.value)}
                />
                {errors.name ? <span style={s.errorText}>{errors.name}</span> : null}
              </div>

              <div style={s.row}>
                <div style={s.fieldWrap}>
                  <label style={s.label}>Brand</label>
                  <SettingsSelect
                    value={form.brand}
                    onChange={(e) => setField('brand', e.target.value)}
                    wrapperStyle={{ width: '100%' }}
                    selectStyle={{ ...s.selectInput, ...(errors.brand ? s.inputError : {}) }}
                  >
                    <option value="">Select Brand</option>
                    {brands.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.name}</option>
                    ))}
                  </SettingsSelect>
                  {errors.brand ? <span style={s.errorText}>{errors.brand}</span> : null}
                </div>

                <div style={s.fieldWrap}>
                  <label style={s.label}>Category</label>
                  <SettingsSelect
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value)}
                    wrapperStyle={{ width: '100%' }}
                    selectStyle={{ ...s.selectInput, ...(errors.category ? s.inputError : {}) }}
                  >
                    <option value="">Select Category</option>
                    {categories.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.name}</option>
                    ))}
                  </SettingsSelect>
                  {errors.category ? <span style={s.errorText}>{errors.category}</span> : null}
                </div>
              </div>

              <div style={s.footer}>
                <button type="button" style={{ ...s.cancelBtn, width: isMobile ? '100%' : 'auto' }} onClick={() => router.push('/settings/products')}>Cancel</button>
                <button type="button" style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
                  <Save size={15} /> {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

const s = {
  wrapper: {
    maxWidth: 940,
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
  loading: {
    padding: 32,
    textAlign: 'center',
    color: settingsTheme.textSubtle,
    fontSize: 13.5,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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

