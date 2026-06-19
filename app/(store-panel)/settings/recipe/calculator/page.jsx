'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { recipesApi } from '@/infrastructure/api/endpoints'
import { SettingsSelect, settingsTheme, Toast } from '@/components/settings/SettingsShared'
import { ArrowLeft, Calculator, Printer, RefreshCw } from 'lucide-react'
import { openReportWindow } from '@/lib/reportDesign'

export default function RecipeCalculatorPage() {
  const router = useRouter()
  const [recipes, setRecipes] = useState([])
  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [desiredQuantity, setDesiredQuantity] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [toast, setToast] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  const selectedRecipe = useMemo(
    () => recipes.find((row) => String(row.id) === String(selectedRecipeId)) || null,
    [recipes, selectedRecipeId]
  )

  const loadRecipes = async () => {
    setLoading(true)
    try {
      const data = await recipesApi.list()
      const rows = Array.isArray(data) ? data : data?.results || []
      setRecipes(rows)
    } catch {
      setToast({ type: 'error', message: 'Failed to load recipes.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecipes()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mobileQuery = window.matchMedia('(max-width: 640px)')
    const apply = () => setIsMobile(mobileQuery.matches)
    apply()
    mobileQuery.addEventListener('change', apply)
    return () => mobileQuery.removeEventListener('change', apply)
  }, [])

  const calculateFallback = () => {
    if (!selectedRecipe) return null
    const baseQty = parseFloat(selectedRecipe.for_quantity || 1) || 1
    const desired = parseFloat(desiredQuantity)
    if (!desired || desired <= 0) return null
    const ratio = desired / baseQty
    return {
      id: selectedRecipe.id,
      name: selectedRecipe.name,
      for_unit: selectedRecipe.for_unit,
      desired_quantity: String(desired),
      items: (selectedRecipe.items || []).map((item) => ({
        ...item,
        scaled_qty: (parseFloat(item.quantity || 0) * ratio).toFixed(3),
      })),
    }
  }

  const handleCalculate = async () => {
    if (!selectedRecipeId) {
      setToast({ type: 'error', message: 'Please select a recipe first.' })
      return
    }
    const desired = parseFloat(desiredQuantity)
    if (!desired || desired <= 0) {
      setToast({ type: 'error', message: 'Desired quantity must be greater than zero.' })
      return
    }

    setCalculating(true)
    try {
      const data = await recipesApi.scale(selectedRecipeId, desiredQuantity)
      setResult(data)
    } catch {
      const fallback = calculateFallback()
      if (fallback) {
        setResult(fallback)
        setToast({ type: 'success', message: 'Used local calculation (scale endpoint unavailable).' })
      } else {
        setToast({ type: 'error', message: 'Unable to calculate recipe quantities.' })
      }
    } finally {
      setCalculating(false)
    }
  }

  const handlePrintReport = () => {
    if (!result) return
    const ok = openReportWindow({
      title: 'Recipe Calculator Report',
      subtitle: 'Scaled ingredient requirement',
      filters: [
        `Recipe: ${result.name || selectedRecipe?.name || '-'}`,
        `Desired Quantity: ${result.desired_quantity || desiredQuantity} ${result.for_unit || selectedRecipe?.for_unit || ''}`,
      ],
      columns: [
        { key: 'ingredient', label: 'Ingredient' },
        { key: 'quantity', label: 'Required Quantity' },
      ],
      rows: (result.items || []).map((item) => ({
        ingredient: item.ingredient || '-',
        quantity: `${item.scaled_qty || '0'} ${item.unit || ''}`,
      })),
    })
    if (!ok) {
      setToast({ type: 'error', message: 'Please allow popups to print the report.' })
    }
  }

  const handlePrintRecipe = () => {
    if (!selectedRecipe) return
    const ok = openReportWindow({
      title: 'Recipe Report',
      subtitle: 'Base recipe ingredients',
      filters: [
        `Recipe: ${selectedRecipe.name || '-'}`,
        `For Quantity: ${selectedRecipe.for_quantity || '1'} ${selectedRecipe.for_unit || ''}`,
      ],
      columns: [
        { key: 'ingredient', label: 'Ingredient' },
        { key: 'quantity', label: 'Quantity' },
      ],
      rows: (selectedRecipe.items || []).map((item) => ({
        ingredient: item.ingredient || '-',
        quantity: `${item.quantity || '0'} ${item.unit || ''}`,
      })),
    })
    if (!ok) {
      setToast({ type: 'error', message: 'Please allow popups to print the recipe.' })
    }
  }

  return (
    <DashboardLayout>
      <div style={{ ...s.pageShell, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 12 : 22 }}>
        <div style={s.header}>
          <div>
            <h1 style={{ ...s.title, fontSize: isMobile ? 18 : 22 }}>Recipe Calculator</h1>
            <p style={{ ...s.subtitle, fontSize: isMobile ? 12 : 13 }}>Scale recipe ingredients for a target output quantity.</p>
          </div>
          <div style={{ ...s.headerActions, width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
            <button type="button" onClick={loadRecipes} style={s.iconBtn} title="Refresh recipes">
              <RefreshCw size={16} color={settingsTheme.textMuted} />
            </button>
            <button type="button" onClick={() => router.push('/settings/recipe')} style={{ ...s.backBtn, padding: isMobile ? '9px 14px' : '9px 16px' }}>
              <ArrowLeft size={15} /> Back to Recipes
            </button>
          </div>
        </div>

        <div style={{ ...s.card, borderRadius: isMobile ? 12 : 14, padding: isMobile ? 14 : 18 }}>
          <div style={s.cardHead}>
            <Calculator size={20} color={settingsTheme.primarySoft} />
            <h2 style={s.cardTitle}>Calculation Inputs</h2>
          </div>

          {loading ? (
            <div style={s.loading}>Loading recipes...</div>
          ) : (
            <div style={s.formGrid}>
              <div>
                <label style={s.label}>Recipe</label>
                <SettingsSelect
                  value={selectedRecipeId}
                  onChange={(e) => {
                    setSelectedRecipeId(e.target.value)
                    setResult(null)
                  }}
                  wrapperStyle={{ width: '100%' }}
                  selectStyle={s.select}
                >
                  <option value="">Select recipe</option>
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={String(recipe.id)}>
                      {recipe.name}
                    </option>
                  ))}
                </SettingsSelect>
              </div>

              <div>
                <label style={s.label}>
                  Desired Quantity {selectedRecipe ? `(${selectedRecipe.for_unit || 'Unit'})` : ''}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={desiredQuantity}
                  onChange={(e) => setDesiredQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  style={s.input}
                />
              </div>
            </div>
          )}

          <div style={s.actions}>
            <button type="button" onClick={handleCalculate} style={{ ...s.calcBtn, width: isMobile ? '100%' : 'auto' }} disabled={calculating || loading}>
              {calculating ? 'Calculating...' : 'Calculate'}
            </button>
            <button
              type="button"
              onClick={handlePrintReport}
              style={{ ...s.printActionBtn, width: isMobile ? '100%' : 'auto', ...(!result ? s.disabledBtn : {}) }}
              disabled={!result}
            >
              <Printer size={14} /> Print Calculation
            </button>
            <button
              type="button"
              onClick={handlePrintRecipe}
              style={{ ...s.printActionBtn, width: isMobile ? '100%' : 'auto', ...(!selectedRecipe ? s.disabledBtn : {}) }}
              disabled={!selectedRecipe}
            >
              <Printer size={14} /> Print Recipe
            </button>
          </div>
        </div>

        {result ? (
          <div style={s.resultCard}>
            <div style={s.resultHead}>
              <h3 style={s.resultTitle}>
                Ingredients for {result.desired_quantity} {result.for_unit}
              </h3>
              <button type="button" onClick={handlePrintReport} style={s.printBtn}>
                <Printer size={14} /> Print Report
              </button>
            </div>
            <div style={s.resultTableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Ingredient</th>
                    <th style={s.th}>Required Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.items || []).map((item, idx) => (
                    <tr key={`${item.ingredient || 'ingredient'}-${idx}`} style={s.tr}>
                      <td style={s.td}>{item.ingredient || '-'}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: settingsTheme.primary }}>
                        {item.scaled_qty} {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {toast ? <Toast {...toast} onClose={() => setToast(null)} /> : null}
    </DashboardLayout>
  )
}

const s = {
  pageShell: {
    background: settingsTheme.pageTint,
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 20,
    padding: 22,
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: settingsTheme.text,
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: settingsTheme.textMuted,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  iconBtn: {
    width: 36,
    height: 36,
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 10,
    background: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 40,
    background: '#fff',
    color: settingsTheme.primary,
    fontSize: 13.5,
    fontWeight: 700,
    padding: '9px 16px',
    cursor: 'pointer',
  },
  card: {
    background: '#fff',
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 14,
    padding: 18,
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: settingsTheme.text,
  },
  loading: {
    padding: 20,
    fontSize: 13.5,
    color: settingsTheme.textSubtle,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  },
  label: {
    display: 'block',
    fontSize: 12.5,
    color: settingsTheme.textMuted,
    fontWeight: 600,
    marginBottom: 6,
  },
  select: {
    borderRadius: 10,
    padding: '9px 30px 9px 12px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: settingsTheme.border,
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 13.5,
    color: settingsTheme.text,
    background: '#fff',
    outline: 'none',
  },
  actions: {
    marginTop: 14,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  calcBtn: {
    border: 'none',
    borderRadius: 40,
    background: 'linear-gradient(90deg, #1B5E20 0%, #2E7D32 45%, #4CAF50 100%)',
    color: '#fff',
    fontSize: 13.5,
    fontWeight: 700,
    padding: '10px 22px',
    cursor: 'pointer',
  },
  printActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 40,
    background: '#fff',
    color: settingsTheme.primary,
    fontSize: 13.5,
    fontWeight: 700,
    padding: '10px 18px',
    cursor: 'pointer',
  },
  disabledBtn: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  resultCard: {
    background: '#fff',
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 14,
    overflow: 'hidden',
  },
  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    padding: '14px 18px',
    background: '#edf8ef',
    borderBottom: `1px solid ${settingsTheme.border}`,
  },
  resultTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
    color: settingsTheme.primary,
  },
  printBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 40,
    background: '#fff',
    color: settingsTheme.primary,
    fontSize: 12.5,
    fontWeight: 700,
    padding: '8px 12px',
    cursor: 'pointer',
  },
  resultTableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '11px 16px',
    fontSize: 12.5,
    fontWeight: 700,
    color: settingsTheme.textMuted,
    borderBottom: `1px solid ${settingsTheme.border}`,
  },
  tr: {
    borderBottom: `1px solid ${settingsTheme.borderSoft}`,
  },
  td: {
    padding: '11px 16px',
    fontSize: 13.5,
    color: settingsTheme.text,
  },
}

