'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { recipesApi } from '@/infrastructure/api/endpoints'
import {
  ConfirmDelete,
  Toast,
  ActionButtons,
  SettingsSelect,
  settingsTheme,
} from '@/components/settings/SettingsShared'
import { Plus, RefreshCw, Calculator, ArrowLeft } from 'lucide-react'

export default function RecipePage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const isSuperuser = user?.role === 'superuser'
  const canEdit = isSuperuser || user?.permissions?.includes('recipe_edit')
  const canDelete = isSuperuser || user?.permissions?.includes('recipe_delete')

  const [recipes, setRecipes] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  const showToast = (message, type = 'success') => setToast({ message, type })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await recipesApi.list()
      setRecipes(Array.isArray(data) ? data : data?.results || [])
    } catch {
      showToast('Failed to load recipes', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mobileQuery = window.matchMedia('(max-width: 640px)')
    const apply = () => setIsMobile(mobileQuery.matches)
    apply()
    mobileQuery.addEventListener('change', apply)
    return () => mobileQuery.removeEventListener('change', apply)
  }, [])

  const handleDelete = async () => {
    try {
      await recipesApi.delete(deleteTarget.id)
      setDeleteTarget(null)
      showToast('Recipe deleted')
      load()
    } catch {
      showToast('Failed to delete recipe', 'error')
    }
  }

  const filtered = recipes.filter((recipe) => {
    if (filter === 'active') return recipe.status === 'active' || recipe.status === true
    if (filter === 'inactive') return recipe.status !== 'active' && recipe.status !== true
    return true
  })

  const td = {
    padding: '12px 20px',
    fontSize: 14,
    color: '#425343',
    textAlign: 'center',
    verticalAlign: 'top',
  }

  return (
    <DashboardLayout>
      <div
        style={{
          ...pageShell,
          borderRadius: isMobile ? 14 : 20,
          padding: isMobile ? 12 : 22,
        }}
      >
        <div>
          <div style={{ ...pageHeader, marginBottom: isMobile ? 14 : 18 }}>
            <div style={{ ...headerLeft, width: isMobile ? '100%' : 'auto' }}>
              <button type="button" style={backBtn} onClick={() => router.push('/settings')} title="Back to settings">
                <ArrowLeft size={16} />
              </button>
              <div>
                <h1 style={{ ...pageTitle, fontSize: isMobile ? 18 : 22 }}>Recipe</h1>
                <p style={{ ...pageSubtitle, fontSize: isMobile ? 12 : 13 }}>Manage your recipes</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
              <button onClick={load} style={iconBtn} type="button" title="Refresh">
                <RefreshCw size={16} color={settingsTheme.textMuted} />
              </button>

              <button onClick={() => router.push('/settings/recipe/calculator')} style={ghostBtn} type="button">
                <Calculator size={15} /> Recipe Calculator
              </button>

              {canEdit ? (
                <button onClick={() => router.push('/settings/recipe/new')} style={addBtn} type="button">
                  <Plus size={15} /> Add Recipe
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ marginBottom: 14, display: 'flex', flexWrap: 'wrap' }}>
            <SettingsSelect value={filter} onChange={(e) => setFilter(e.target.value)} wrapperStyle={{ minWidth: isMobile ? '100%' : 130, width: isMobile ? '100%' : 'auto' }} selectStyle={selectStyle}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SettingsSelect>
          </div>

          <div style={tableShell}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: settingsTheme.textSubtle }}>Loading...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                <thead>
                  <tr>
                    {['Recipe Name', 'For Quantity', 'Items', 'Status', 'Actions'].map((header) => (
                      <th key={header} style={tableHead}>{header}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: settingsTheme.textSubtle }}>No recipes found.</td>
                    </tr>
                  ) : (
                    filtered.map((recipe) => (
                      <tr
                        key={recipe.id}
                        style={{ borderBottom: `1px solid ${settingsTheme.borderSoft}` }}
                      >
                        <td style={td}>{recipe.name}</td>
                        <td style={td}>{recipe.for_quantity} {recipe.for_unit}</td>
                        <td style={{ ...td, textAlign: 'left' }}>
                          {(recipe.items || []).map((item, idx) => (
                            <div key={idx} style={{ fontSize: 13, color: settingsTheme.textMuted }}>
                              {item.ingredient} - {item.quantity} {item.unit}
                            </div>
                          ))}
                        </td>
                        <td style={td}>{recipe.status === 'active' || recipe.status === true ? 'Active' : 'Inactive'}</td>
                        <td style={td}>
                          <ActionButtons
                            canEdit={canEdit}
                            canDelete={canDelete}
                            onEdit={() => router.push(`/settings/recipe/new?id=${recipe.id}`)}
                            onDelete={() => setDeleteTarget(recipe)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {toast ? <Toast {...toast} onClose={() => setToast(null)} /> : null}
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
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 18,
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

const tableShell = {
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

const ghostBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 40,
  background: '#fff',
  color: settingsTheme.primary,
  fontSize: 13.5,
  fontWeight: 700,
  padding: '10px 16px',
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

