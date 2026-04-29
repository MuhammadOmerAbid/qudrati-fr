'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { packagingApi } from '@/infrastructure/api/endpoints'
import {
  SettingsPageShell, SettingsTable, Toggle,
  ActionButtons, InlineInput, ConfirmDelete, Toast, settingsTheme,
} from '@/components/settings/SettingsShared'

export default function PackagingPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'
  const canEdit = isSuperuser || user?.permissions?.includes('packaging_edit')
  const canDelete = isSuperuser || user?.permissions?.includes('packaging_delete')

  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => setToast({ message, type })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await packagingApi.list()
      setItems(Array.isArray(data) ? data : data?.results || [])
    } catch {
      showToast('Failed to load packaging types', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleEdit = async (id) => {
    if (!editVal.trim()) return
    try {
      await packagingApi.update(id, editVal.trim())
      setEditId(null)
      setEditVal('')
      showToast('Packaging type updated')
      load()
    } catch {
      showToast('Failed to update packaging type', 'error')
    }
  }

  const handleToggle = async (item) => {
    if (!canEdit) return
    try {
      await packagingApi.toggleStatus(item.id, !item.status)
      load()
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await packagingApi.delete(deleteTarget.id)
      setDeleteTarget(null)
      showToast('Packaging type deleted')
      load()
    } catch {
      showToast('Failed to delete packaging type', 'error')
    }
  }

  const filtered = items.filter((entry) => {
    if (filter === 'active') return entry.status === true || entry.status === 'active'
    if (filter === 'inactive') return entry.status === false || entry.status === 'inactive'
    return true
  })

  const td = { padding: '12px 20px' }

  const rows = filtered.map((item) => (
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
            placeholder="Packaging type name"
          />
        ) : (
          <span style={{ fontSize: 14, color: '#425343' }}>{item.name}</span>
        )}
      </td>
      <td style={{ ...td, textAlign: 'center' }}>
        <Toggle checked={!!item.status} onChange={() => handleToggle(item)} disabled={!canEdit} />
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
  ))

  return (
    <DashboardLayout>
      <SettingsPageShell
        title="Packaging"
        subtitle="Manage packaging types (Carton, Bag, Box, etc.)"
        onAdd={() => router.push('/settings/packaging/new')}
        onRefresh={load}
        filterValue={filter}
        onFilterChange={setFilter}
        addLabel="Add Packaging"
        canEdit={canEdit}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: settingsTheme.textSubtle }}>Loading...</div>
        ) : (
          <SettingsTable
            columns={[
              { key: 'packaging', label: 'Packaging Type', align: 'center' },
              { key: 'status', label: 'Status', align: 'center' },
              { key: 'actions', label: 'Actions', align: 'center' },
            ]}
            rows={rows}
            emptyMsg="No packaging types found."
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

