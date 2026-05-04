'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { productsApi, brandsApi, categoriesApi } from '@/infrastructure/api/endpoints'
import {
  SettingsTable,
  SettingsSelect,
  Toggle,
  ActionButtons,
  ConfirmDelete,
  Toast,
  settingsTheme,
} from '@/components/settings/SettingsShared'
import { X, RefreshCw, Plus, ArrowLeft } from 'lucide-react'

function ProductModal({ open, onClose, onSave, brands, categories, initial }) {
  const [form, setForm] = useState({ name: '', brand: '', category: '' })

  useEffect(() => {
    if (open) setForm(initial || { name: '', brand: '', category: '' })
  }, [open, initial])

  if (!open) return null
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <h3 style={modalTitle}>{initial?.id ? 'Edit Product' : 'Add Product'}</h3>
          <button onClick={onClose} style={closeBtn} type="button">
            <X size={18} color={settingsTheme.textMuted} />
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Product Name</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Enter product name"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Brand</label>
          <SettingsSelect value={form.brand} onChange={(e) => set('brand', e.target.value)} wrapperStyle={{ width: '100%' }} selectStyle={selectInputStyle}>
            <option value="">Select Brand</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </SettingsSelect>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Category</label>
          <SettingsSelect value={form.category} onChange={(e) => set('category', e.target.value)} wrapperStyle={{ width: '100%' }} selectStyle={selectInputStyle}>
            <option value="">Select Category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SettingsSelect>
        </div>

        <div style={modalActions}>
          <button onClick={onClose} style={secondaryBtn} type="button">Cancel</button>
          <button onClick={() => onSave(form)} style={primaryBtn} type="button">
            {initial?.id ? 'Update' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'
  const canEdit = isSuperuser || user?.permissions?.includes('products_edit')
  const canDelete = isSuperuser || user?.permissions?.includes('products_delete')

  const [items, setItems] = useState([])
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [filter, setFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  const showToast = (message, type = 'success') => setToast({ message, type })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, b, c] = await Promise.all([
        productsApi.list({ status: filter !== 'all' ? filter : undefined }),
        brandsApi.list(),
        categoriesApi.list(),
      ])
      setItems(Array.isArray(p) ? p : p?.results || [])
      setBrands(Array.isArray(b) ? b : b?.results || [])
      setCategories(Array.isArray(c) ? c : c?.results || [])
    } catch {
      showToast('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

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
      const payload = { name: form.name, brand: form.brand, category: form.category }
      if (modal?.id) {
        await productsApi.update(modal.id, payload)
        showToast('Product updated')
      } else {
        await productsApi.create(payload)
        showToast('Product added')
      }
      setModal(null)
      load()
    } catch {
      showToast('Failed to save product', 'error')
    }
  }

  const handleToggle = async (item) => {
    if (!canEdit) return
    try {
      await productsApi.toggleStatus(item.id, !item.status)
      load()
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await productsApi.delete(deleteTarget.id)
      setDeleteTarget(null)
      showToast('Product deleted')
      load()
    } catch {
      showToast('Failed to delete product', 'error')
    }
  }

  const filtered = items.filter((p) => {
    const statusOk = filter === 'all' || (filter === 'active' ? !!p.status : !p.status)
    const brandOk = !brandFilter || String(p.brand) === brandFilter || p.brand_name === brandFilter
    const catOk = !catFilter || String(p.category) === catFilter || p.category_name === catFilter
    return statusOk && brandOk && catOk
  })

  const td = { padding: '13px 20px', textAlign: 'center', fontSize: 14, color: '#425343' }
  const rows = filtered.map((item) => (
    <tr
      key={item.id}
      style={{ borderBottom: `1px solid ${settingsTheme.borderSoft}` }}
    >
      <td style={td}>{item.name}</td>
      <td style={td}>{item.brand_name || brands.find((b) => b.id === item.brand)?.name || '-'}</td>
      <td style={td}>{item.category_name || categories.find((c) => c.id === item.category)?.name || '-'}</td>
      <td style={td}>
        <Toggle checked={!!item.status} onChange={() => handleToggle(item)} disabled={!canEdit} />
      </td>
      <td style={td}>
        <ActionButtons
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={() => setModal({ ...item, brand: String(item.brand || ''), category: String(item.category || '') })}
          onDelete={() => setDeleteTarget(item)}
        />
      </td>
    </tr>
  ))

  return (
    <DashboardLayout>
      <div
        style={{
          ...pageShell,
          borderRadius: isMobile ? 14 : 20,
          padding: isMobile ? 12 : 22,
        }}
      >
        <div
          style={{
            ...pageHeader,
            marginBottom: isMobile ? 14 : 20,
          }}
        >
          <div style={{ ...headerLeft, width: isMobile ? '100%' : 'auto' }}>
            <button type="button" style={backBtn} onClick={() => router.push('/settings')} title="Back to settings">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...pageTitle, fontSize: isMobile ? 18 : 22 }}>Products</h1>
              <p style={{ ...pageSubtitle, fontSize: isMobile ? 12 : 13 }}>Manage your products</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
            <button onClick={load} style={iconBtn} title="Refresh" type="button">
              <RefreshCw size={16} color={settingsTheme.textMuted} />
            </button>
            {canEdit && (
              <button onClick={() => router.push('/settings/products/new')} style={{ ...addBtn, padding: isMobile ? '10px 16px' : '11px 20px' }} type="button">
                <Plus size={15} /> Add Product
              </button>
            )}
          </div>
        </div>

        <div style={filters}>
          <SettingsSelect value={filter} onChange={(e) => setFilter(e.target.value)} wrapperStyle={{ minWidth: isMobile ? '100%' : 140, width: isMobile ? '100%' : 'auto' }} selectStyle={selectStyle}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SettingsSelect>
          <SettingsSelect value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} wrapperStyle={{ minWidth: isMobile ? '100%' : 170, width: isMobile ? '100%' : 'auto' }} selectStyle={selectStyle}>
            <option value="">All Brands</option>
            {brands.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
          </SettingsSelect>
          <SettingsSelect value={catFilter} onChange={(e) => setCatFilter(e.target.value)} wrapperStyle={{ minWidth: isMobile ? '100%' : 180, width: isMobile ? '100%' : 'auto' }} selectStyle={selectStyle}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </SettingsSelect>
        </div>

        <div style={tableShell}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: settingsTheme.textSubtle }}>Loading...</div>
          ) : (
            <SettingsTable
              columns={[
                { key: 'product', label: 'Product', align: 'center' },
                { key: 'brand', label: 'Brand', align: 'center' },
                { key: 'category', label: 'Category', align: 'center' },
                { key: 'status', label: 'Status', align: 'center' },
                { key: 'actions', label: 'Actions', align: 'center' },
              ]}
              rows={rows}
              emptyMsg="No products found."
            />
          )}
        </div>
      </div>

      <ProductModal
        open={modal !== null}
        onClose={() => setModal(null)}
        onSave={handleSave}
        brands={brands}
        categories={categories}
        initial={modal}
      />
      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget?.name}
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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
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

const filters = {
  display: 'flex',
  gap: 10,
  marginBottom: 14,
  flexWrap: 'wrap',
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

const tableShell = {
  background: '#fff',
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 14,
  overflowX: 'auto',
  overflowY: 'hidden',
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
  width: 'min(420px, calc(100vw - 24px))',
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

const modalActions = {
  display: 'flex',
  gap: 10,
  justifyContent: 'flex-end',
}

