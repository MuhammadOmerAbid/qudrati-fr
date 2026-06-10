'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { recipesApi } from '@/infrastructure/api/endpoints'
import { SettingsSelect, settingsTheme, Toast } from '@/components/settings/SettingsShared'
import { ArrowLeft, Calculator, Printer, RefreshCw } from 'lucide-react'

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

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  const handlePrintReport = () => {
    if (!result) return
    const reportWindow = window.open('', '_blank', 'width=1000,height=800')
    if (!reportWindow) {
      setToast({ type: 'error', message: 'Please allow popups to print the report.' })
      return
    }

    const items = result.items || []
    const rows = items.map((item) => `
      <tr>
        <td>${escapeHtml(item.ingredient || '-')}</td>
        <td>${escapeHtml(item.scaled_qty || '0')} ${escapeHtml(item.unit || '')}</td>
      </tr>
    `).join('')

    reportWindow.document.open()
    reportWindow.document.write(`
      <html>
        <head>
          <title>Recipe Calculator Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #1f2937; padding: 28px; font-size: 13px; }
            .head { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #bbf7d0; padding-bottom: 14px; margin-bottom: 18px; }
            h1 { margin: 0; color: #1B5E20; font-size: 22px; }
            .meta { color: #6b7280; margin: 4px 0 0; }
            .summary { background: #edf8ef; border: 1px solid #bbf7d0; padding: 12px 14px; margin-bottom: 18px; }
            .summary p { margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f0fdf4; color: #1a2e1b; text-align: left; padding: 10px; border-bottom: 2px solid #bbf7d0; }
            td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
            @media print { body { padding: 18px; } }
          </style>
        </head>
        <body>
          <div class="head">
            <div>
              <h1>Recipe Calculator Report</h1>
              <p class="meta">Generated: ${escapeHtml(new Date().toLocaleString('en-PK'))}</p>
            </div>
          </div>
          <div class="summary">
            <p><strong>Recipe:</strong> ${escapeHtml(result.name || selectedRecipe?.name || '-')}</p>
            <p><strong>Desired Quantity:</strong> ${escapeHtml(result.desired_quantity || desiredQuantity)} ${escapeHtml(result.for_unit || selectedRecipe?.for_unit || '')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Required Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="2">No ingredients available.</td></tr>'}
            </tbody>
          </table>
          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `)
    reportWindow.document.close()
  }

  const handlePrintRecipe = () => {
    if (!selectedRecipe) return
    const reportWindow = window.open('', '_blank', 'width=1000,height=800')
    if (!reportWindow) {
      setToast({ type: 'error', message: 'Please allow popups to print the recipe.' })
      return
    }

    const items = selectedRecipe.items || []
    const rows = items.map((item) => `
      <tr>
        <td>${escapeHtml(item.ingredient || '-')}</td>
        <td>${escapeHtml(item.quantity || '0')} ${escapeHtml(item.unit || '')}</td>
      </tr>
    `).join('')

    reportWindow.document.open()
    reportWindow.document.write(`
      <html>
        <head>
          <title>Recipe Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #1f2937; padding: 28px; font-size: 13px; }
            .head { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #bbf7d0; padding-bottom: 14px; margin-bottom: 18px; }
            h1 { margin: 0; color: #1B5E20; font-size: 22px; }
            .meta { color: #6b7280; margin: 4px 0 0; }
            .summary { background: #edf8ef; border: 1px solid #bbf7d0; padding: 12px 14px; margin-bottom: 18px; }
            .summary p { margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f0fdf4; color: #1a2e1b; text-align: left; padding: 10px; border-bottom: 2px solid #bbf7d0; }
            td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
            @media print { body { padding: 18px; } }
          </style>
        </head>
        <body>
          <div class="head">
            <div>
              <h1>Recipe Report</h1>
              <p class="meta">Generated: ${escapeHtml(new Date().toLocaleString('en-PK'))}</p>
            </div>
          </div>
          <div class="summary">
            <p><strong>Recipe:</strong> ${escapeHtml(selectedRecipe.name || '-')}</p>
            <p><strong>For Quantity:</strong> ${escapeHtml(selectedRecipe.for_quantity || '1')} ${escapeHtml(selectedRecipe.for_unit || '')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="2">No ingredients available.</td></tr>'}
            </tbody>
          </table>
          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `)
    reportWindow.document.close()
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

