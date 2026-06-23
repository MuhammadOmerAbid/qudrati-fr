'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { customersApi } from '@/infrastructure/api/endpoints'
import {
  SettingsPageShell, SettingsTable, Toggle,
  ActionButtons, ConfirmDelete, Toast, settingsTheme,
} from '@/components/settings/SettingsShared'
import { X } from 'lucide-react'
import { limitPhoneNumber } from '@/lib/inputLimits'

function CustomerModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState({ name: '', contact: '', address: '' })
  useEffect(() => {
    if (open) setForm(initial || { name: '', contact: '', address: '' })
  }, [open, initial])
  if (!open) return null
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: settingsTheme.text }}>{initial?.id ? 'Edit Customer' : 'Add Customer'}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} color={settingsTheme.textMuted} /></button>
        </div>
        {[
          { label: 'Customer Name', key: 'name', placeholder: 'Enter name' },
          { label: 'Contact', key: 'contact', placeholder: 'Phone' },
          { label: 'Address', key: 'address', placeholder: 'Address' },
        ].map(({ label, key, placeholder }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={lbl}>{label}</label>
            <input
              value={form[key] || ''}
              onChange={(e) => set(key, key === 'contact' ? limitPhoneNumber(e.target.value) : e.target.value)}
              placeholder={placeholder}
              style={inp}
              maxLength={key === 'contact' ? 11 : undefined}
              inputMode={key === 'contact' ? 'numeric' : undefined}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          <button onClick={() => onSave(form)} style={saveBtn}>{initial?.id ? 'Update' : 'Add Customer'}</button>
        </div>
      </div>
    </div>
  )
}

export default function CustomersPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'
  const canEdit = isSuperuser || user?.permissions?.includes('customers_edit')
  const canDelete = isSuperuser || user?.permissions?.includes('customers_delete')

  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => setToast({ message, type })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await customersApi.list()
      setItems(Array.isArray(data) ? data : data?.results || [])
    } catch { showToast('Failed to load', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (form) => {
    try {
      if (modal?.id) {
        await customersApi.update(modal.id, form)
        showToast('Customer updated')
      } else {
        await customersApi.create(form)
        showToast('Customer added')
      }
      setModal(null); load()
    } catch { showToast('Failed to save', 'error') }
  }

  const handleDelete = async () => {
    try {
      await customersApi.delete(deleteTarget.id)
      setDeleteTarget(null); showToast('Customer deleted'); load()
    } catch { showToast('Failed to delete', 'error') }
  }

  const filtered = items.filter((c) => {
    if (filter === 'active') return !!c.status
    if (filter === 'inactive') return !c.status
    return true
  })

  const td = { padding: '12px 20px', textAlign: 'center', fontSize: 14, color: '#425343' }

  const rows = filtered.map((item) => (
    <tr key={item.id} style={{ borderBottom: `1px solid ${settingsTheme.borderSoft}` }}
    >
      <td style={td}>{item.name}</td>
      <td style={td}>
        <Toggle checked={!!item.status} disabled={!canEdit}
          onChange={async () => {
            try { await customersApi.update(item.id, { status: !item.status }); load() }
            catch { showToast('Failed to update', 'error') }
          }} />
      </td>
      <td style={td}>
        <ActionButtons canEdit={canEdit} canDelete={canDelete}
          onEdit={() => setModal(item)}
          onDelete={() => setDeleteTarget(item)} />
      </td>
    </tr>
  ))

  return (
    <DashboardLayout>
      <SettingsPageShell title="Customers" subtitle="Manage your customers"
        onAdd={() => router.push('/settings/customers/new')} onRefresh={load}
        filterValue={filter} onFilterChange={setFilter}
        addLabel="Add Customer" canEdit={canEdit}>
        {loading
          ? <div style={{ padding: 40, textAlign: 'center', color: settingsTheme.textSubtle }}>Loading...</div>
          : <SettingsTable columns={[
              { key: 'customer', label: 'Customer', align: 'center' },
              { key: 'status', label: 'Status', align: 'center' },
              { key: 'actions', label: 'Actions', align: 'center' },
            ]} rows={rows} emptyMsg="No customers found." />
        }
      </SettingsPageShell>
      <CustomerModal open={modal !== null} onClose={() => setModal(null)}
        onSave={handleSave} initial={modal} />
      <ConfirmDelete open={!!deleteTarget} name={deleteTarget?.name}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </DashboardLayout>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(26,46,27,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }
const modal = { background: '#fff', border: `1px solid ${settingsTheme.border}`, borderRadius: 16, padding: 28, width: 400, boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }
const lbl = { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#425343', marginBottom: 5 }
const inp = { width: '100%', border: `1px solid ${settingsTheme.border}`, borderRadius: 10, padding: '8px 12px', fontSize: 13.5, color: settingsTheme.text, outline: 'none', boxSizing: 'border-box' }
const cancelBtn = { padding: '8px 18px', border: `1px solid ${settingsTheme.border}`, borderRadius: 10, background: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: '#425343' }
const saveBtn = { padding: '8px 18px', border: 'none', borderRadius: 10, background: settingsTheme.primarySoft, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', color: '#fff' }

