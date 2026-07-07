'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { finishedGoodsApi } from '@/infrastructure/api/endpoints'
import {
  SettingsPageShell, SettingsTable, Toggle,
  ActionButtons, InlineInput, ConfirmDelete, Toast, settingsTheme,
} from '@/components/settings/SettingsShared'

const todayISO = () => new Date().toISOString().split('T')[0]

const normalizeEntry = (entry) => {
  const statusValue = entry.status || 'Completed'
  const isActive = String(statusValue).toLowerCase() !== 'inactive'

  return {
    id: entry.id,
    name: entry.brand || '',
    isActive,
    statusValue,
    date: entry.date || todayISO(),
  }
}

export default function FinishedGoodProductsPage() {
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'
  const canEdit = isSuperuser
    || user?.permissions?.includes('finished-good-products_edit')
    || user?.permissions?.includes('finished_goods_edit')
    || user?.permissions?.includes('products_edit')
  const canDelete = isSuperuser
    || user?.permissions?.includes('finished-good-products_delete')
    || user?.permissions?.includes('finished_goods_delete')
    || user?.permissions?.includes('products_delete')

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
      const data = await finishedGoodsApi.list()
      const records = Array.isArray(data) ? data : data?.results || []
      setItems(records.map(normalizeEntry))
    } catch {
      showToast('Failed to load finished good products', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newName.trim()) return
    try {
      await finishedGoodsApi.create({
        brand: newName.trim(),
        date: todayISO(),
        status: 'Completed',
        products: [],
      })
      setNewName('')
      setAdding(false)
      showToast('Finished good product added')
      load()
    } catch {
      showToast('Failed to add entry', 'error')
    }
  }

  const handleEdit = async (id) => {
    if (!editVal.trim()) return
    try {
      await finishedGoodsApi.update(id, { brand: editVal.trim() })
      setEditId(null)
      setEditVal('')
      showToast('Entry updated')
      load()
    } catch {
      showToast('Failed to update', 'error')
    }
  }

  const handleToggle = async (item) => {
    if (!canEdit) return

    const nextStatus = item.isActive ? 'Inactive' : 'Completed'
    try {
      await finishedGoodsApi.update(item.id, { status: nextStatus })
      load()
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await finishedGoodsApi.delete(deleteTarget.id)
      setDeleteTarget(null)
      showToast('Entry deleted')
      load()
    } catch {
      showToast('Failed to delete entry', 'error')
    }
  }

  const filtered = items.filter((entry) => {
    if (filter === 'active') return entry.isActive
    if (filter === 'inactive') return !entry.isActive
    return true
  })

  const td = { padding: '12px 20px' }

  const rows = [
    ...(adding ? [
      <tr key="new" style={{ background: '#edf8ef' }}>
        <td style={td}>
          <InlineInput
            value={newName}
            onChange={setNewName}
            onSave={handleAdd}
            onCancel={() => { setAdding(false); setNewName('') }}
            placeholder="Name"
          />
        </td>
        <td style={td}><Toggle checked={true} disabled /></td>
        <td style={td} />
      </tr>
    ] : []),
    ...filtered.map((item) => (
      <tr
        key={item.id}
        style={{ borderBottom: `1px solid ${settingsTheme.borderSoft}` }}
      >
        <td style={{ ...td, textAlign: 'center' }}>
          {editId === item.id ? (
            <InlineInput
              value={editVal}
              onChange={setEditVal}
              onSave={() => handleEdit(item.id)}
              onCancel={() => { setEditId(null); setEditVal('') }}
              placeholder="Name"
            />
          ) : <span style={{ fontSize: 14, color: '#425343' }}>{item.name}</span>}
        </td>
        <td style={{ ...td, textAlign: 'center' }}>
          <Toggle
            checked={item.isActive}
            disabled={!canEdit}
            onChange={() => handleToggle(item)}
          />
        </td>
        <td style={{ ...td, textAlign: 'center' }}>
          <ActionButtons
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={() => { setEditId(item.id); setEditVal(item.name) }}
            onDelete={() => setDeleteTarget(item)}
          />
        </td>
      </tr>
    )),
  ]

  return (
    <DashboardLayout>
      <SettingsPageShell
        title="Finished Good Products"
        subtitle="Manage finished good product entries"
        onAdd={() => { setAdding(true); setNewName('') }}
        onRefresh={load}
        filterValue={filter}
        onFilterChange={setFilter}
        addLabel="Add Finished Good Product"
        canEdit={canEdit}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: settingsTheme.textSubtle }}>Loading...</div>
        ) : (
          <SettingsTable
            columns={[
              { key: 'name', label: 'Name', align: 'center' },
              { key: 'status', label: 'Status', align: 'center' },
              { key: 'actions', label: 'Actions', align: 'center' },
            ]}
            rows={rows}
            emptyMsg="No entries found."
          />
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

