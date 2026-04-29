'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { brandsApi } from '@/infrastructure/api/endpoints'
import {
  SettingsPageShell, SettingsTable, Toggle,
  ActionButtons, InlineInput, ConfirmDelete, Toast, settingsTheme,
} from '@/components/settings/SettingsShared'

export default function BrandsPage() {
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'
  const canEdit = isSuperuser || user?.permissions?.includes('brands_edit')
  const canDelete = isSuperuser || user?.permissions?.includes('brands_delete')

  const [brands, setBrands] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const showToast = (message, type = 'success') => setToast({ message, type })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const data = await brandsApi.list(params)
      setBrands(Array.isArray(data) ? data : data?.results || [])
    } catch { showToast('Failed to load brands', 'error') }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newName.trim()) return
    try {
      await brandsApi.create(newName.trim())
      setNewName(''); setAdding(false)
      showToast('Brand added successfully')
      load()
    } catch { showToast('Failed to add brand', 'error') }
  }

  const handleEdit = async (id) => {
    if (!editVal.trim()) return
    try {
      await brandsApi.update(id, editVal.trim())
      setEditId(null); setEditVal('')
      showToast('Brand updated')
      load()
    } catch { showToast('Failed to update brand', 'error') }
  }

  const handleToggle = async (brand) => {
    if (!canEdit) return
    try {
      await brandsApi.toggleStatus(brand.id, !brand.status)
      load()
    } catch { showToast('Failed to update status', 'error') }
  }

  const handleDelete = async () => {
    try {
      await brandsApi.delete(deleteTarget.id)
      setDeleteTarget(null)
      showToast('Brand deleted')
      load()
    } catch { showToast('Failed to delete brand', 'error') }
  }

  const filtered = brands.filter((b) => {
    if (filter === 'active') return b.status === true || b.status === 'active'
    if (filter === 'inactive') return b.status === false || b.status === 'inactive'
    return true
  })

  const columns = [
    { key: 'brand', label: 'Brand', align: 'center' },
    { key: 'status', label: 'Status', align: 'center' },
    { key: 'actions', label: 'Actions', align: 'center' },
  ]

  const tdStyle = { padding: '12px 20px' }

  const rows = [
    ...(adding ? [
      <tr key="new-row" style={{ background: '#edf8ef' }}>
        <td style={tdStyle}>
          <InlineInput
            value={newName}
            onChange={setNewName}
            onSave={handleAdd}
            onCancel={() => { setAdding(false); setNewName('') }}
            placeholder="Enter brand name"
          />
        </td>
        <td style={tdStyle}><Toggle checked={true} disabled /></td>
        <td style={tdStyle} />
      </tr>
    ] : []),
    ...filtered.map((brand) => (
      <tr key={brand.id} style={{ borderBottom: `1px solid ${settingsTheme.borderSoft}` }}
      >
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          {editId === brand.id ? (
            <InlineInput
              value={editVal}
              onChange={setEditVal}
              onSave={() => handleEdit(brand.id)}
              onCancel={() => { setEditId(null); setEditVal('') }}
              placeholder="Brand name"
            />
          ) : (
            <span style={{ fontSize: 14, color: '#425343' }}>{brand.name}</span>
          )}
        </td>
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          <Toggle checked={!!brand.status} onChange={() => handleToggle(brand)} disabled={!canEdit} />
        </td>
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          <ActionButtons
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={() => { setEditId(brand.id); setEditVal(brand.name) }}
            onDelete={() => setDeleteTarget(brand)}
          />
        </td>
      </tr>
    )),
  ]

  return (
    <DashboardLayout>
      <SettingsPageShell
        title="Brands"
        subtitle="Manage your brands"
        onAdd={() => { setAdding(true); setNewName('') }}
        onRefresh={load}
        filterValue={filter}
        onFilterChange={setFilter}
        addLabel="Add Brand"
        canEdit={isSuperuser}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: settingsTheme.textSubtle }}>Loading...</div>
        ) : (
          <SettingsTable columns={columns} rows={rows} emptyMsg="No brands found." />
        )}
      </SettingsPageShell>

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

