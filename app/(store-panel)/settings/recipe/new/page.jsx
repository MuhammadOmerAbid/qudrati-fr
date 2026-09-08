'use client'

import { useEffect, useMemo, useState } from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { recipesApi, unitsApi } from '@/infrastructure/api/endpoints'
import { SettingsSelect, settingsTheme } from '@/components/settings/SettingsShared'
import { ArrowLeft, Plus, Save, Shield, Trash2 } from 'lucide-react'

const blankItem = (defaultUnit = '') => ({ ingredient: '', quantity: '', unit: defaultUnit })

function normalizeForm(recipe) {
  const items = Array.isArray(recipe?.items) && recipe.items.length > 0
    ? recipe.items.map((item) => ({
        ingredient: item?.ingredient || '',
        quantity: item?.quantity ?? '',
        unit: item?.unit || '',
      }))
    : [blankItem()]

  return {
    name: recipe?.name || '',
    for_quantity: recipe?.for_quantity ?? '',
    for_unit: recipe?.for_unit || '',
    items,
  }
}

function RecipeNewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()

  const recipeId = searchParams.get('id')
  const isEdit = Boolean(recipeId)

  const isSuperuser = user?.role === 'superuser'
  const canEdit = isSuperuser || user?.permissions?.includes('recipe_edit')

  const [form, setForm] = useState(() => normalizeForm())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [errors, setErrors] = useState({})
  const [isMobile, setIsMobile] = useState(false)
  const [unitOptions, setUnitOptions] = useState([])
  const [loadingUnits, setLoadingUnits] = useState(true)
  const [unitError, setUnitError] = useState('')

  const title = isEdit ? 'Edit Recipe' : 'Add Recipe'
  const subtitle = isEdit ? 'Update recipe details and ingredients' : 'Create a new recipe'

  useEffect(() => {
    if (!isEdit) {
      setForm(normalizeForm())
      return
    }

    let active = true

    const loadRecipe = async () => {
      setLoading(true)
      setErrorMsg('')
      try {
        let recipe = null
        try {
          recipe = await recipesApi.get(recipeId)
        } catch {
          const data = await recipesApi.list()
          const rows = Array.isArray(data) ? data : data?.results || []
          recipe = rows.find((row) => String(row.id) === String(recipeId)) || null
        }

        if (!recipe) {
          if (active) setErrorMsg('Recipe not found.')
          return
        }

        if (active) setForm(normalizeForm(recipe))
      } catch {
        if (active) setErrorMsg('Failed to load recipe details.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRecipe()

    return () => {
      active = false
    }
  }, [isEdit, recipeId])

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
    setLoadingUnits(true)
    setUnitError('')
    unitsApi.list({ status: 'active' })
      .then((data) => {
        if (!active) return
        const rows = Array.isArray(data) ? data : (data?.results || [])
        const names = Array.from(new Set(
          rows
            .filter((entry) => entry?.status !== false && String(entry?.status || '').toLowerCase() !== 'inactive')
            .map((entry) => String(entry?.name || entry || '').trim())
            .filter(Boolean)
        ))
        setUnitOptions(names)
        setForm((prev) => ({
          ...prev,
          for_unit: prev.for_unit || names[0] || '',
          items: prev.items.map((item) => ({ ...item, unit: item.unit || names[0] || '' })),
        }))
        if (!names.length) setUnitError('No active units are available in Unit Settings.')
      })
      .catch(() => {
        if (!active) return
        setUnitOptions([])
        setUnitError('Unable to load units from Unit Settings.')
      })
      .finally(() => {
        if (active) setLoadingUnits(false)
      })
    return () => { active = false }
  }, [])

  const canRemoveItem = useMemo(() => form.items.length > 1, [form.items.length])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const setItem = (index, key, value) => {
    setForm((prev) => {
      const items = [...prev.items]
      items[index] = { ...items[index], [key]: value }
      return { ...prev, items }
    })
    setErrors((prev) => ({ ...prev, items: undefined }))
  }

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, blankItem(unitOptions[0] || '')] }))
    setErrors((prev) => ({ ...prev, items: undefined }))
  }

  const removeItem = (index) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, idx) => idx !== index) }))
  }

  const validate = () => {
    const next = {}

    if (!form.name.trim()) next.name = 'Recipe name is required'
    if (!form.for_unit) next.for_unit = 'Select a unit from Unit Settings'

    const forQty = parseFloat(form.for_quantity)
    if (!form.for_quantity || Number.isNaN(forQty) || forQty <= 0) {
      next.for_quantity = 'Enter a valid quantity'
    }

    const hasInvalidItems = form.items.some((item) => {
      const qty = parseFloat(item.quantity)
      return !item.ingredient.trim() || Number.isNaN(qty) || qty <= 0 || !item.unit
    })

    if (hasInvalidItems) {
      next.items = 'Complete all ingredient rows with valid quantity and unit'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    setSaving(true)
    setErrorMsg('')

    const payload = {
      name: form.name.trim(),
      for_quantity: parseFloat(form.for_quantity),
      for_unit: form.for_unit,
      items: form.items.map((item) => ({
        ingredient: item.ingredient.trim(),
        quantity: parseFloat(item.quantity),
        unit: item.unit,
      })),
    }

    try {
      if (isEdit) {
        await recipesApi.update(recipeId, payload)
      } else {
        await recipesApi.create(payload)
      }
      router.push('/settings/recipe')
    } catch {
      setErrorMsg('Failed to save recipe. Please try again.')
      setSaving(false)
    }
  }

  if (!canEdit) {
    return (
      <DashboardLayout>
        <div style={s.deniedWrap}>
          <Shield size={48} color={settingsTheme.textSubtle} />
          <h2 style={s.deniedTitle}>Access Restricted</h2>
          <p style={s.deniedText}>You do not have permission to modify recipes.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div style={{ ...s.wrapper, maxWidth: isMobile ? '100%' : 960 }}>
        <div style={s.pageHeader}>
          <div style={{ ...s.headerLeft, width: isMobile ? '100%' : 'auto' }}>
            <button type="button" style={s.backBtn} onClick={() => router.push('/settings/recipe')}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...s.pageTitle, fontSize: isMobile ? 20 : 30 }}>{title}</h1>
              <p style={{ ...s.pageSubtitle, fontSize: isMobile ? 12 : 13.5 }}>{subtitle}</p>
            </div>
          </div>

          <button type="button" style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving || loading || loadingUnits}>
            <Save size={15} /> {saving ? 'Saving...' : isEdit ? 'Update Recipe' : 'Save Recipe'}
          </button>
        </div>

        <div style={{ ...s.card, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 14 : 24 }}>
          {loading ? (
            <div style={s.loading}>Loading recipe...</div>
          ) : (
            <>
              <div style={s.topRow}>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Recipe Name</label>
                  <input
                    type="text"
                    style={{ ...s.input, ...(errors.name ? s.inputError : {}) }}
                    value={form.name}
                    placeholder="e.g. Tea"
                    onChange={(e) => setField('name', e.target.value)}
                  />
                  {errors.name ? <span style={s.errorText}>{errors.name}</span> : null}
                </div>

                <div style={s.qtyRow}>
                  <div style={{ ...s.fieldGroup, flex: 1 }}>
                    <label style={s.label}>For Quantity</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      style={{ ...s.input, ...(errors.for_quantity ? s.inputError : {}) }}
                      value={form.for_quantity}
                      placeholder="e.g. 1"
                      onChange={(e) => setField('for_quantity', e.target.value)}
                    />
                    {errors.for_quantity ? <span style={s.errorText}>{errors.for_quantity}</span> : null}
                  </div>

                  <div style={{ ...s.fieldGroup, width: isMobile ? '100%' : 140 }}>
                    <label style={s.label}>Unit</label>
                    <SettingsSelect
                      value={form.for_unit}
                      onChange={(e) => setField('for_unit', e.target.value)}
                      wrapperStyle={{ width: '100%' }}
                      selectStyle={s.selectInput}
                    >
                      <option value="">Select Unit</option>
                      {unitOptions.map((unit) => <option key={unit}>{unit}</option>)}
                      {form.for_unit && !unitOptions.includes(form.for_unit) ? <option>{form.for_unit}</option> : null}
                    </SettingsSelect>
                    {errors.for_unit ? <span style={s.errorText}>{errors.for_unit}</span> : null}
                  </div>
                </div>
              </div>

              <div style={s.sectionHeader}>
                <p style={s.sectionTitle}>Ingredients</p>
                <button type="button" style={{ ...s.addItemBtn, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }} onClick={addItem}>
                  <Plus size={13} /> Add Ingredient
                </button>
              </div>

              {errors.items ? <div style={s.itemsError}>{errors.items}</div> : null}
              {errorMsg ? <div style={s.itemsError}>{errorMsg}</div> : null}
              {unitError ? <div style={s.itemsError}>{unitError}</div> : null}

              {form.items.map((item, idx) => (
                <div key={`ingredient-${idx}`} style={s.itemRow}>
                  <div style={{ ...s.itemField, flex: isMobile ? '1 1 100%' : 2, minWidth: isMobile ? '100%' : 130 }}>
                    <label style={s.subLabel}>Ingredient</label>
                    <input
                      type="text"
                      style={s.input}
                      value={item.ingredient}
                      placeholder="Ingredient name"
                      onChange={(e) => setItem(idx, 'ingredient', e.target.value)}
                    />
                  </div>

                  <div style={{ ...s.itemField, width: isMobile ? 'calc(50% - 5px)' : 130, minWidth: isMobile ? 'calc(50% - 5px)' : 130 }}>
                    <label style={s.subLabel}>Quantity</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      style={s.input}
                      value={item.quantity}
                      placeholder="0"
                      onChange={(e) => setItem(idx, 'quantity', e.target.value)}
                    />
                  </div>

                  <div style={{ ...s.itemField, width: isMobile ? 'calc(50% - 5px)' : 130, minWidth: isMobile ? 'calc(50% - 5px)' : 130 }}>
                    <label style={s.subLabel}>Unit</label>
                    <SettingsSelect
                      value={item.unit}
                      onChange={(e) => setItem(idx, 'unit', e.target.value)}
                      wrapperStyle={{ width: '100%' }}
                      selectStyle={s.selectInput}
                    >
                      <option value="">Select Unit</option>
                      {unitOptions.map((unit) => <option key={unit}>{unit}</option>)}
                      {item.unit && !unitOptions.includes(item.unit) ? <option>{item.unit}</option> : null}
                    </SettingsSelect>
                  </div>

                  <div style={{ ...s.itemField, width: isMobile ? '100%' : 36, justifyContent: isMobile ? 'flex-start' : 'flex-end', minWidth: isMobile ? '100%' : 36 }}>
                    {canRemoveItem ? (
                      <button type="button" style={s.removeBtn} onClick={() => removeItem(idx)} title="Remove ingredient">
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}

              <div style={s.formFooter}>
                <button type="button" style={{ ...s.cancelBtn, width: isMobile ? '100%' : 'auto' }} onClick={() => router.push('/settings/recipe')}>Cancel</button>
                <button type="button" style={{ ...(saving ? s.saveBtnDisabled : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
                  <Save size={15} /> {saving ? 'Saving...' : isEdit ? 'Update Recipe' : 'Save Recipe'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function RecipeNewPage() {
  return (
    <Suspense fallback={<DashboardLayout><div style={{ padding: 32, textAlign: 'center', color: settingsTheme.textSubtle }}>Loading...</div></DashboardLayout>}>
      <RecipeNewContent />
    </Suspense>
  )
}

const s = {
  wrapper: {
    maxWidth: 960,
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
  topRow: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
    marginBottom: 14,
  },
  qtyRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: settingsTheme.textMuted,
  },
  subLabel: {
    fontSize: 11.5,
    fontWeight: 700,
    color: settingsTheme.textSubtle,
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
  inputError: {
    borderColor: '#fca5a5',
    background: '#fff1f2',
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
  },
  selectInput: {
    borderRadius: 10,
    padding: '9px 30px 9px 12px',
    fontSize: 13,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: settingsTheme.text,
  },
  addItemBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 40,
    background: 'linear-gradient(90deg, #1B5E20 0%, #2E7D32 45%, #4CAF50 100%)',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 600,
    padding: '11px 20px',
    cursor: 'pointer',
  },
  itemsError: {
    marginBottom: 10,
    background: '#fff1f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: 12.5,
    borderRadius: 10,
    padding: '8px 12px',
  },
  itemRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 10,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 12,
    background: '#ffffff',
    padding: 10,
  },
  itemField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 130,
  },
  removeBtn: {
    width: 34,
    height: 36,
    background: '#fff1f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formFooter: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 20,
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

