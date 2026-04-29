'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { categoriesApi } from '@/infrastructure/api/endpoints'
import {
  SettingsPageShell, SettingsTable, Toggle,
  ActionButtons, InlineInput, ConfirmDelete, Toast, settingsTheme,
} from '@/components/settings/SettingsShared'

export default function CategoriesPage() {
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'
  const canEdit = isSuperuser || user?.permissions?.includes('categories_edit')
  const canDelete = isSuperuser || user?.permissions?.includes('categories_delete')

  const [items, setItems] = useState([])
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
      const data = await categoriesApi.list()
      setItems(Array.isArray(data) ? data : data?.results || [])
    } catch { showToast('Failed to load categories', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newName.trim()) return
    try {
      await categoriesApi.create(newName.trim())
      setNewName(''); setAdding(false)
      showToast('Category added'); load()
    } catch { showToast('Failed to add category', 'error') }
  }

  const handleEdit = async (id) => {
    if (!editVal.trim()) return
    try {
      await categoriesApi.update(id, { name: editVal.trim() })
      setEditId(null); setEditVal(''); showToast('Category updated'); load()
    } catch { showToast('Failed to update', 'error') }
  }

  const handleToggle = async (item) => {
    if (!canEdit) return
    try { await categoriesApi.toggleStatus(item.id, !item.status); load() }
    catch { showToast('Failed to update status', 'error') }
  }

  const handleDelete = async () => {
    try {
      await categoriesApi.delete(deleteTarget.id)
      setDeleteTarget(null); showToast('Category deleted'); load()
    } catch { showToast('Failed to delete', 'error') }
  }

  const filtered = items.filter((b) => {
    if (filter === 'active') return b.status === true || b.status === 'active'
    if (filter === 'inactive') return b.status === false || b.status === 'inactive'
    return true
  })

  const td = { padding: '12px 20px' }

  const rows = [
    ...(adding ? [
      <tr key="new" style={{ background: '#edf8ef' }}>
        <td style={td}>
          <InlineInput value={newName} onChange={setNewName} onSave={handleAdd}
            onCancel={() => { setAdding(false); setNewName('') }} placeholder="Category name" />
        </td>
        <td style={td}><Toggle checked={true} disabled /></td>
        <td style={td} />
      </tr>
    ] : []),
    ...filtered.map((item) => (
      <tr key={item.id} style={{ borderBottom: `1px solid ${settingsTheme.borderSoft}` }}
      >
        <td style={{ ...td, textAlign: 'center' }}>
          {editId === item.id ? (
            <InlineInput value={editVal} onChange={setEditVal}
              onSave={() => handleEdit(item.id)}
              onCancel={() => { setEditId(null); setEditVal('') }} placeholder="Category name" />
          ) : <span style={{ fontSize: 14, color: '#425343' }}>{item.name}</span>}
        </td>
        <td style={{ ...td, textAlign: 'center' }}>
          <Toggle checked={!!item.status} onChange={() => handleToggle(item)} disabled={!canEdit} />
        </td>
        <td style={{ ...td, textAlign: 'center' }}>
          <ActionButtons canEdit={canEdit} canDelete={canDelete}
            onEdit={() => { setEditId(item.id); setEditVal(item.name) }}
            onDelete={() => setDeleteTarget(item)} />
        </td>
      </tr>
    )),
  ]

  return (
    <DashboardLayout>
      <SettingsPageShell title="Categories" subtitle="Manage your categories"
        onAdd={() => { setAdding(true); setNewName('') }} onRefresh={load}
        filterValue={filter} onFilterChange={setFilter}
        addLabel="Add Category" canEdit={canEdit}>
        {loading
          ? <div style={{ padding: 40, textAlign: 'center', color: settingsTheme.textSubtle }}>Loading...</div>
          : <SettingsTable columns={[
              { key: 'cat', label: 'Category', align: 'center' },
              { key: 'status', label: 'Status', align: 'center' },
              { key: 'actions', label: 'Actions', align: 'center' },
            ]} rows={rows} emptyMsg="No categories found." />
        }
      </SettingsPageShell>
      <ConfirmDelete open={!!deleteTarget} name={deleteTarget?.name}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </DashboardLayout>
  )
}

