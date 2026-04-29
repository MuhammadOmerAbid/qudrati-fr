'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { finishedGoodsApi } from '@/infrastructure/api/endpoints'
import {
  SettingsPageShell, SettingsTable, Toggle,
  ActionButtons, ConfirmDelete, Toast, settingsTheme,
} from '@/components/settings/SettingsShared'
import { Check, X } from 'lucide-react'

const todayISO = () => new Date().toISOString().split('T')[0]

const normalizeEntry = (entry) => {
  const meta = Array.isArray(entry.products)
    ? (entry.products[0] || {})
    : (entry.products && typeof entry.products === 'object' ? entry.products : {})

  const statusValue = entry.status || 'Completed'
  const isActive = String(statusValue).toLowerCase() !== 'inactive'

  return {
    id: entry.id,
    name: entry.brand || '',
    code: meta.code || '',
    description: meta.description || '',
    isActive,
    statusValue,
    date: entry.date || todayISO(),
  }
}

export default function FinishedGoodProductsPage() {
  const router = useRouter()
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
  const [editForm, setEditForm] = useState({ name: '', code: '', description: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState(null)

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

  const startEdit = (item) => {
    setEditId(item.id)
    setEditForm({
      name: item.name || '',
      code: item.code || '',
      description: item.description || '',
    })
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditForm({ name: '', code: '', description: '' })
  }

  const saveEdit = async () => {
    if (!editForm.name.trim()) {
      showToast('Name is required', 'error')
      return
    }

    try {
      await finishedGoodsApi.update(editId, {
        brand: editForm.name.trim(),
        products: [{
          code: editForm.code.trim(),
          description: editForm.description.trim(),
        }],
      })
      showToast('Entry updated')
      cancelEdit()
      load()
    } catch {
      showToast('Failed to save entry', 'error')
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

  const td = { padding: '12px 20px', textAlign: 'center', fontSize: 14, color: '#425343' }

  const rows = filtered.map((item) => {
    const isEditing = editId === item.id
    return (
      <tr
        key={item.id}
        style={{ borderBottom: `1px solid ${settingsTheme.borderSoft}` }}
      >
        <td style={td}>
          {isEditing ? (
            <input
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              style={s.cellInput}
              placeholder="Name"
            />
          ) : item.name}
        </td>
        <td style={{ ...td, color: settingsTheme.textMuted }}>
          {isEditing ? (
            <input
              value={editForm.code}
              onChange={(e) => setEditForm((prev) => ({ ...prev, code: e.target.value }))}
              style={s.cellInput}
              placeholder="Code"
            />
          ) : (item.code || '-')}
        </td>
        <td style={{ ...td, color: settingsTheme.textMuted }}>
          {isEditing ? (
            <input
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              style={s.cellInput}
              placeholder="Description"
            />
          ) : (item.description || '-')}
        </td>
        <td style={td}>
          <Toggle
            checked={item.isActive}
            disabled={!canEdit || isEditing}
            onChange={() => handleToggle(item)}
          />
        </td>
        <td style={td}>
          {isEditing ? (
            <div style={s.editActions}>
              <button type="button" onClick={saveEdit} style={s.saveBtn} title="Save">
                <Check size={14} color="#fff" />
              </button>
              <button type="button" onClick={cancelEdit} style={s.cancelBtn} title="Cancel">
                <X size={14} color={settingsTheme.textMuted} />
              </button>
            </div>
          ) : (
            <ActionButtons
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => startEdit(item)}
              onDelete={() => setDeleteTarget(item)}
            />
          )}
        </td>
      </tr>
    )
  })

  return (
    <DashboardLayout>
      <SettingsPageShell
        title="Finished Good Products"
        subtitle="Manage finished good product entries"
        onAdd={() => router.push('/settings/finished-good-products/new')}
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
              { key: 'code', label: 'Code', align: 'center' },
              { key: 'description', label: 'Description', align: 'center' },
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

const s = {
  cellInput: {
    width: '100%',
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 9,
    padding: '7px 10px',
    fontSize: 13,
    color: settingsTheme.text,
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  },
  editActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  },
  saveBtn: {
    width: 30,
    height: 30,
    border: 'none',
    borderRadius: 8,
    background: settingsTheme.primarySoft,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  cancelBtn: {
    width: 30,
    height: 30,
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 8,
    background: '#f8faf8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
}

