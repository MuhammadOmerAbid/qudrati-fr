'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { cbmProductsApi } from '@/infrastructure/api/endpoints'
import { ArrowLeft, Calculator, Edit2, Plus, Search, Trash2 } from 'lucide-react'
import { settingsTheme } from '@/components/settings/SettingsShared'

function toCM(value, unit) {
  const num = parseFloat(value) || 0
  if (unit === 'Inch') return num * 2.54
  if (unit === 'MM') return num / 10
  return num
}

function calcCBM(length, width, height, unit) {
  const l = toCM(length, unit) / 100
  const w = toCM(width, unit) / 100
  const h = toCM(height, unit) / 100
  return l * w * h
}

function toKg(value, unit) {
  const num = parseFloat(value) || 0
  if (unit === 'Gram') return num / 1000
  if (unit === 'Lb') return num * 0.453592
  return num
}

const toList = (value) => (Array.isArray(value) ? value : (value?.results || []))

const normalizeRow = (row = {}) => {
  const dimUnit = row.dimUnit || row.dim_unit || 'Inch'
  const weightUnit = row.weightUnit || row.weight_unit || 'Kg'
  const quantity = row.quantity ?? ''
  const cbmPerCarton = calcCBM(row.length, row.width, row.height, dimUnit)
  const totalCBM = cbmPerCarton * (parseFloat(quantity) || 0)
  const totalWeight = toKg(row.weightPerCarton ?? row.weight_per_carton, weightUnit) * (parseFloat(quantity) || 0)

  return {
    id: row.id,
    item: row.item || '',
    length: row.length ?? '',
    width: row.width ?? '',
    height: row.height ?? '',
    dimUnit,
    quantity,
    weightPerCarton: row.weightPerCarton ?? row.weight_per_carton ?? '',
    weightUnit,
    cbmPerCarton,
    totalCBM,
    totalWeight,
  }
}

export default function CBMCalculatorListPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'

  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    const loadRows = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const data = await cbmProductsApi.list()
        if (!active) return
        setRows(toList(data).map(normalizeRow))
      } catch (err) {
        if (active) setLoadError(err?.message || 'Unable to load CBM entries')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadRows()
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => [
      row.item,
      row.length,
      row.width,
      row.height,
      row.dimUnit,
      row.quantity,
      row.weightPerCarton,
      row.weightUnit,
      row.cbmPerCarton.toFixed(6),
      row.totalCBM.toFixed(6),
      row.totalWeight.toFixed(2),
    ].join(' ').toLowerCase().includes(q))
  }, [rows, search])

  const totals = useMemo(() => ({
    cbm: filtered.reduce((sum, row) => sum + row.totalCBM, 0),
    weight: filtered.reduce((sum, row) => sum + row.totalWeight, 0),
  }), [filtered])

  const handleDelete = async (id) => {
    if (!isSuperuser || !window.confirm('Delete this CBM entry?')) return
    try {
      await cbmProductsApi.delete(id)
      setRows((prev) => prev.filter((row) => row.id !== id))
      setLoadError('')
    } catch (err) {
      setLoadError(err?.message || 'Unable to delete CBM entry')
    }
  }

  return (
    <DashboardLayout>
      <div style={s.wrapper}>
        <div style={s.pageHeader}>
          <div style={s.headerLeft}>
            <button type="button" style={s.backBtn} onClick={() => router.push('/settings')} title="Back to settings">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={s.pageTitle}><Calculator size={22} color={settingsTheme.primarySoft} /> CBM Calculator</h1>
              <p style={s.pageSubtitle}>View saved carton dimensions, CBM, and weight calculations.</p>
            </div>
          </div>
          <button type="button" style={s.addBtn} onClick={() => router.push('/settings/cbm-calculator/new')}>
            <Plus size={16} /> New Entry
          </button>
        </div>

        <div style={s.summaryGrid}>
          <div style={s.summaryCard}>
            <span style={s.summaryLabel}>Entries</span>
            <strong style={s.summaryValue}>{filtered.length}</strong>
          </div>
          <div style={s.summaryCard}>
            <span style={s.summaryLabel}>Total CBM</span>
            <strong style={{ ...s.summaryValue, color: settingsTheme.primarySoft }}>{totals.cbm.toFixed(6)}</strong>
          </div>
          <div style={s.summaryCard}>
            <span style={s.summaryLabel}>Total Weight</span>
            <strong style={s.summaryValue}>{totals.weight > 0 ? `${totals.weight.toFixed(2)} Kg` : '-'}</strong>
          </div>
        </div>

        <div style={s.controlsCard}>
          <div style={s.searchWrap}>
            <Search size={15} color="#7a8a7a" />
            <input
              style={s.searchInput}
              placeholder="Search item, dimensions, unit, CBM, or weight..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {loadError ? <div style={s.errorBanner}>{loadError}</div> : null}

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>SR.NO</th>
                <th style={s.thLeft}>Item</th>
                <th style={s.th}>Length</th>
                <th style={s.th}>Width</th>
                <th style={s.th}>Height</th>
                <th style={s.th}>Dim Unit</th>
                <th style={s.th}>Quantity</th>
                <th style={s.th}>Wt/Carton</th>
                <th style={s.th}>Wt Unit</th>
                <th style={s.th}>CBM/Carton</th>
                <th style={s.th}>Total CBM</th>
                <th style={s.th}>Total Wt (Kg)</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} style={s.emptyCell}>Loading CBM entries...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={13} style={s.emptyCell}>No CBM entries found.</td></tr>
              ) : filtered.map((row, index) => (
                <tr key={row.id} style={s.tr}>
                  <td style={s.td}>{index + 1}</td>
                  <td style={s.tdLeft}>{row.item || '-'}</td>
                  <td style={s.td}>{row.length || '-'}</td>
                  <td style={s.td}>{row.width || '-'}</td>
                  <td style={s.td}>{row.height || '-'}</td>
                  <td style={s.td}>{row.dimUnit}</td>
                  <td style={s.td}>{row.quantity || '-'}</td>
                  <td style={s.td}>{row.weightPerCarton || '-'}</td>
                  <td style={s.td}>{row.weightUnit}</td>
                  <td style={s.monoTd}>{row.cbmPerCarton > 0 ? row.cbmPerCarton.toFixed(6) : '-'}</td>
                  <td style={{ ...s.monoTd, color: settingsTheme.primarySoft, fontWeight: 800 }}>{row.totalCBM > 0 ? row.totalCBM.toFixed(6) : '-'}</td>
                  <td style={{ ...s.monoTd, color: settingsTheme.primary, fontWeight: 800 }}>{row.totalWeight > 0 ? row.totalWeight.toFixed(2) : '-'}</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <div style={s.actionBtns}>
                      <button type="button" style={s.editBtn} title="Edit entries" onClick={() => router.push('/settings/cbm-calculator/new')}>
                        <Edit2 size={14} />
                      </button>
                      {isSuperuser ? (
                        <button type="button" style={s.deleteBtn} title="Delete" onClick={() => handleDelete(row.id)}>
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={s.tfoot}>
                <td colSpan={10} style={s.totalLabel}>TOTAL</td>
                <td style={s.totalValue}>{totals.cbm.toFixed(6)}</td>
                <td style={s.totalValue}>{totals.weight > 0 ? totals.weight.toFixed(2) : '-'}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}

const RADIUS = 20

const s = {
  wrapper: { width: '100%' },
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 40, border: '1.5px solid #d4dfd4', background: '#fff', color: '#2d7a33', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  pageTitle: { margin: '0 0 4px', fontSize: 30, fontWeight: 800, color: '#1a3d1f', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.6px' },
  pageSubtitle: { margin: 0, fontSize: 13.5, color: '#7a8a7a' },
  addBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '11px 20px', borderRadius: 40, border: 'none', background: 'linear-gradient(90deg, #1B5E20 0%, #2E7D32 45%, #4CAF50 100%)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 },
  summaryCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: RADIUS, padding: '14px 16px' },
  summaryLabel: { display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 700, color: '#607062' },
  summaryValue: { fontSize: 20, color: '#1a3d1f' },
  controlsCard: { background: '#f2f4f2', borderRadius: RADIUS, padding: '14px 16px', border: '1px solid #e2e8e2', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)', marginBottom: 14 },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #d4dfd4', borderRadius: 40, padding: '10px 14px' },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: 13.5, color: '#1f2f21', background: 'transparent' },
  errorBanner: { background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 12px', marginBottom: 12, color: '#b91c1c', fontSize: 13, fontWeight: 600 },
  tableWrap: { background: '#f2f4f2', borderRadius: RADIUS, border: '1px solid #e2e8e2', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' },
  table: { width: '100%', minWidth: 1180, borderCollapse: 'collapse' },
  thead: { background: '#e8eee8' },
  th: { padding: '12px 12px', fontSize: 12, fontWeight: 700, color: '#29472d', textAlign: 'center', borderBottom: '1px solid #d4dfd4', whiteSpace: 'nowrap' },
  thLeft: { padding: '12px 12px', fontSize: 12, fontWeight: 700, color: '#29472d', textAlign: 'left', borderBottom: '1px solid #d4dfd4', whiteSpace: 'nowrap' },
  tr: { background: '#fff' },
  td: { padding: '11px 12px', fontSize: 13, color: '#415443', borderBottom: '1px solid #e2e8e2', textAlign: 'center' },
  tdLeft: { padding: '11px 12px', fontSize: 13, color: '#1f2f21', fontWeight: 700, borderBottom: '1px solid #e2e8e2', textAlign: 'left' },
  monoTd: { padding: '11px 12px', fontSize: 12.5, color: '#607062', borderBottom: '1px solid #e2e8e2', textAlign: 'center', fontFamily: 'monospace' },
  emptyCell: { textAlign: 'center', padding: '52px 0', background: '#fff', color: '#9ca3af', fontSize: 14 },
  actionBtns: { display: 'flex', gap: 6, justifyContent: 'flex-end' },
  editBtn: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' },
  deleteBtn: { background: '#fff5f5', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' },
  tfoot: { background: '#edf8ef', borderTop: '2px solid #d4dfd4' },
  totalLabel: { padding: '12px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#1a3d1f' },
  totalValue: { padding: '12px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#1a3d1f', fontFamily: 'monospace' },
}
