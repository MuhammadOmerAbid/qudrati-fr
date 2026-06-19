'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { cbmProductsApi } from '@/infrastructure/api/endpoints'
import { Plus, Trash2, Calculator, RotateCcw, Package, ArrowLeft, Save } from 'lucide-react'
import { SettingsSelect, settingsTheme } from '@/components/settings/SettingsShared'

const UNITS = ['Inch', 'CM', 'MM']
const WEIGHT_UNITS = ['Kg', 'Gram', 'Lb']
const CONTAINER_PRESETS = {
  '40ft': { capacity: '66', weight: '26500' },
  '20ft': { capacity: '33', weight: '13500' },
}

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

const emptyRow = () => ({
  id: `local-${Date.now()}-${Math.random()}`,
  item: '',
  length: '',
  width: '',
  height: '',
  dimUnit: 'Inch',
  quantity: '',
  weightPerCarton: '',
  weightUnit: 'Kg',
})

const SAMPLE_ROWS = [
  { id: 1, item: '12 PC Big Round Jar', length: '12.4', width: '9.5', height: '6.6', dimUnit: 'Inch', quantity: '260', weightPerCarton: '', weightUnit: 'Kg' },
  { id: 2, item: '54 PC Small Round Jar', length: '17.5', width: '9.3', height: '12.2', dimUnit: 'Inch', quantity: '130', weightPerCarton: '', weightUnit: 'Kg' },
  { id: 3, item: '96 PC Carton', length: '16.3', width: '16.3', height: '12.3', dimUnit: 'Inch', quantity: '240', weightPerCarton: '', weightUnit: 'Kg' },
  { id: 4, item: '110 ML Oil', length: '18.4', width: '13.2', height: '6.5', dimUnit: 'Inch', quantity: '45', weightPerCarton: '', weightUnit: 'Kg' },
  { id: 5, item: '100 ML Oil', length: '17.1', width: '13.1', height: '7.5', dimUnit: 'Inch', quantity: '25', weightPerCarton: '', weightUnit: 'Kg' },
  { id: 6, item: 'Old Big Jar', length: '13.1', width: '9.7', height: '5.9', dimUnit: 'Inch', quantity: '100', weightPerCarton: '', weightUnit: 'Kg' },
  { id: 7, item: 'Milky Jar', length: '12.1', width: '9.0', height: '5.7', dimUnit: 'Inch', quantity: '80', weightPerCarton: '', weightUnit: 'Kg' },
]

const isLocalRow = (id) => String(id || '').startsWith('local-')
const cleanNumber = (value) => {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

const normalizeRow = (row) => ({
  ...emptyRow(),
  ...row,
  item: row.item || '',
  length: row.length ?? '',
  width: row.width ?? '',
  height: row.height ?? '',
  dimUnit: row.dimUnit || row.dim_unit || 'Inch',
  quantity: row.quantity ?? '',
  weightPerCarton: row.weightPerCarton ?? row.weight_per_carton ?? '',
  weightUnit: row.weightUnit || row.weight_unit || 'Kg',
})

const rowPayload = (row) => {
  const item = String(row.item || '').trim()
  if (!item) return null
  return {
    item,
    length: cleanNumber(row.length),
    width: cleanNumber(row.width),
    height: cleanNumber(row.height),
    dimUnit: row.dimUnit || 'Inch',
    quantity: cleanNumber(row.quantity),
    weightPerCarton: cleanNumber(row.weightPerCarton),
    weightUnit: row.weightUnit || 'Kg',
  }
}

export default function CBMCalculatorPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'
  const [rows, setRows] = useState([emptyRow()])
  const [containerType, setContainerType] = useState('40ft')
  const [containerCapacity, setContainerCapacity] = useState(CONTAINER_PRESETS['40ft'].capacity)
  const [containerMaxWeight, setContainerMaxWeight] = useState(CONTAINER_PRESETS['40ft'].weight)
  const [isMobile, setIsMobile] = useState(false)
  const [loadingRows, setLoadingRows] = useState(false)

  const containerCBM = parseFloat(containerCapacity) || 0
  const containerWeight = parseFloat(containerMaxWeight) || 0

  const saveRow = async (id, rowOverride = null) => {
    const target = rowOverride || rows.find((row) => row.id === id)
    const payload = target ? rowPayload(target) : null
    if (!payload) return null

    try {
      const saved = isLocalRow(id)
        ? await cbmProductsApi.create(payload)
        : await cbmProductsApi.update(id, payload)
      setRows((prev) => prev.map((row) => row.id === id ? normalizeRow(saved) : row))
      return saved
    } catch {
      // Keep the local row editable if the network/API call fails.
      return null
    }
  }
  const isEditing = (id) => isLocalRow(id)
  const updateRow = (id, field, value, shouldSave = false) => {
    let nextTarget = null
    setRows((prev) => prev.map((row) => {
      if (row.id !== id) return row
      nextTarget = { ...row, [field]: value }
      return nextTarget
    }))
    if (shouldSave && nextTarget) {
      window.setTimeout(() => saveRow(id, nextTarget), 0)
    }
  }

  const addRow = () => {
    const row = emptyRow()
    setRows((prev) => [...prev, row])
  }
  const removeRow = async (id) => {
    if (!isSuperuser) return
    if (!isLocalRow(id)) {
      try {
        await cbmProductsApi.delete(id)
      } catch {
        return
      }
    }
    setRows((prev) => {
      const nextRows = prev.filter((row) => row.id !== id)
      return nextRows.length ? nextRows : [emptyRow()]
    })
  }
  const resetRows = async () => {
    if (!isSuperuser) return
    const nextRows = rows.map((row) => ({ ...row, quantity: '' }))
    const persistedRows = nextRows.filter((row) => !isLocalRow(row.id))
    try {
      await Promise.all(
        persistedRows
          .map((row) => ({ id: row.id, payload: rowPayload(row) }))
          .filter((row) => row.payload)
          .map((row) => cbmProductsApi.update(row.id, row.payload))
      )
    } catch {
      return
    }
    setRows(nextRows)
  }
  const loadSample = async () => {
    const existingItems = new Set(rows.map((row) => String(row.item || '').trim().toLowerCase()).filter(Boolean))
    const nextSamples = SAMPLE_ROWS.filter((row) => !existingItems.has(String(row.item || '').trim().toLowerCase()))
    if (!nextSamples.length) return

    try {
      const savedRows = await Promise.all(nextSamples.map((row) => cbmProductsApi.create(rowPayload(row))))
      setRows((prev) => [...prev, ...savedRows.map(normalizeRow)])
    } catch {
      setRows((prev) => [...prev, ...nextSamples.map((row) => ({ ...row, id: `local-${Date.now()}-${Math.random()}` }))])
    }
  }

  const computed = rows.map((row) => {
    const qty = parseFloat(row.quantity) || 0
    const cbmPerCarton = calcCBM(row.length, row.width, row.height, row.dimUnit)
    const totalCBM = cbmPerCarton * qty
    const totalWeight = toKg(row.weightPerCarton, row.weightUnit) * qty
    return { ...row, cbmPerCarton, totalCBM, totalWeight }
  })

  const totalCBMUsed = computed.reduce((sum, row) => sum + row.totalCBM, 0)
  const totalWeightUsed = computed.reduce((sum, row) => sum + row.totalWeight, 0)
  const hasWeightInput = rows.some((row) => String(row.weightPerCarton || '').trim() !== '')
  const cbmRemaining = containerCBM - totalCBMUsed
  const cbmPct = containerCBM > 0 ? Math.min((totalCBMUsed / containerCBM) * 100, 100) : 0
  const weightPct = totalWeightUsed > 0 && containerWeight > 0 ? Math.min((totalWeightUsed / containerWeight) * 100, 100) : 0

  const summaryCards = [
    {
      label: 'Total CBM Used',
      value: totalCBMUsed.toFixed(4),
      unit: 'm3',
      color: totalCBMUsed > containerCBM ? settingsTheme.danger : settingsTheme.primarySoft,
      bg: totalCBMUsed > containerCBM ? '#fff3f3' : '#edf8ef',
      border: totalCBMUsed > containerCBM ? '#fecaca' : settingsTheme.border,
    },
    {
      label: 'CBM Available',
      value: cbmRemaining.toFixed(4),
      unit: 'm3',
      color: cbmRemaining < 0 ? settingsTheme.danger : settingsTheme.primary,
      bg: '#f6f9f6',
      border: settingsTheme.border,
    },
    {
      label: 'Capacity',
      value: containerCapacity,
      unit: 'm3',
      color: settingsTheme.textMuted,
      bg: '#f6f9f6',
      border: settingsTheme.border,
      editable: true,
      onChange: setContainerCapacity,
      inputWidth: 86,
    },
    {
      label: 'Weight Available',
      value: containerMaxWeight,
      unit: 'Kg',
      color: settingsTheme.textMuted,
      bg: '#f6f9f6',
      border: settingsTheme.border,
      editable: true,
      onChange: setContainerMaxWeight,
      inputWidth: 110,
    },
    ...(isMobile && !hasWeightInput ? [] : [{
      label: 'Total Weight',
      value: totalWeightUsed > 0 ? totalWeightUsed.toFixed(2) : '-',
      unit: totalWeightUsed > 0 ? 'Kg' : '',
      color: totalWeightUsed > containerWeight ? settingsTheme.danger : settingsTheme.primary,
      bg: '#f6f9f6',
      border: settingsTheme.border,
    }]),
  ]

  const progressCards = [
    {
      label: `CBM Used: ${totalCBMUsed.toFixed(3)} / ${containerCBM || 0} m3`,
      pct: cbmPct,
      color: cbmPct > 90 ? settingsTheme.danger : settingsTheme.primarySoft,
    },
    ...(hasWeightInput ? [{
      label: `Weight: ${totalWeightUsed > 0 ? `${totalWeightUsed.toFixed(1)} / ${containerWeight || 0} Kg` : 'Enter weight per carton'}`,
      pct: weightPct,
      color: weightPct > 90 ? settingsTheme.danger : settingsTheme.primary,
    }] : []),
  ]

  const input = (style = {}) => ({
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: settingsTheme.border,
    borderRadius: 8,
    padding: '6px 8px',
    fontSize: 12.5,
    color: settingsTheme.text,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    ...style,
  })

  const select = (style = {}) => ({
    ...input({ padding: '6px 28px 6px 8px', fontSize: 12, color: settingsTheme.text }),
    ...style,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mobileQuery = window.matchMedia('(max-width: 640px)')
    const apply = () => setIsMobile(mobileQuery.matches)
    apply()
    mobileQuery.addEventListener('change', apply)
    return () => mobileQuery.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    let active = true
    const loadRows = async () => {
      setLoadingRows(true)
      try {
        const data = await cbmProductsApi.list()
        const savedRows = Array.isArray(data) ? data : data?.results || []
        if (active) setRows(savedRows.length ? savedRows.map(normalizeRow) : [emptyRow()])
      } catch {
        if (active) setRows([emptyRow()])
      } finally {
        if (active) setLoadingRows(false)
      }
    }
    loadRows()
    return () => { active = false }
  }, [])

  return (
    <DashboardLayout>
      <div style={{ ...pageShell, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 12 : 22 }}>
        <div style={{ ...header, marginBottom: isMobile ? 14 : 20, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <div style={{ ...headerLeft, width: isMobile ? '100%' : 'auto', minWidth: 0 }}>
            <button type="button" style={backBtn} onClick={() => router.push('/settings')} title="Back to settings">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...title, fontSize: isMobile ? 18 : 22 }}>
                <Calculator size={22} color={settingsTheme.primarySoft} />
                CBM + Weight Calculator
              </h1>
              <p style={{ ...subtitle, fontSize: isMobile ? 12 : 13 }}>Calculate cubic meters and shipping weight for container loading.</p>
            </div>
          </div>
          <SettingsSelect
            value={containerType}
            onChange={(e) => {
              const nextType = e.target.value
              const preset = CONTAINER_PRESETS[nextType]
              setContainerType(nextType)
              if (preset) {
                setContainerCapacity(preset.capacity)
                setContainerMaxWeight(preset.weight)
              }
            }}
            wrapperStyle={{
              minWidth: isMobile ? 0 : 180,
              width: isMobile ? '100%' : 'auto',
              maxWidth: '100%',
              flex: isMobile ? '1 1 100%' : '0 0 auto',
            }}
            selectStyle={{
              ...select({ padding: '7px 30px 7px 12px', fontSize: 13, fontWeight: 600 }),
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <option value="40ft">{isMobile ? '40 ft Container' : '40 Feet Container'}</option>
            <option value="20ft">{isMobile ? '20 ft Container' : '20 Feet Container'}</option>
          </SettingsSelect>
        </div>

        <div style={{ ...summaryGrid, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : summaryGrid.gridTemplateColumns }}>
          {summaryCards.map(({ label, value, unit, color, bg, border, editable, onChange, inputWidth }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 18px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: settingsTheme.textMuted }}>{label}</p>
              {editable ? (
                <div style={editableSummaryValue}>
                  <input
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    style={{ ...summaryInput, width: inputWidth }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color }}>{unit}</span>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color }}>
                  {value} <span style={{ fontSize: 13, fontWeight: 500 }}>{unit}</span>
                </p>
              )}
            </div>
          ))}
        </div>

        <div style={{ ...progressGrid, gridTemplateColumns: isMobile ? '1fr' : progressGrid.gridTemplateColumns }}>
          {progressCards.map(({ label, pct, color }) => (
            <div key={label} style={progressCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, color: settingsTheme.textMuted, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color }}>{pct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 8, background: '#eef2ee', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={addRow} style={addBtn} type="button">
            <Plus size={14} /> Add Row
          </button>
          {!isMobile ? (
            <button onClick={loadSample} style={outlineBtn} type="button">
              <Package size={14} /> Load Sample Data
            </button>
          ) : null}
          {isSuperuser ? (
            <button onClick={resetRows} style={{ ...outlineBtn, color: settingsTheme.danger, borderColor: '#fecaca' }} type="button">
              <RotateCcw size={14} /> Reset
            </button>
          ) : null}
        </div>
        {loadingRows ? (
          <div style={{ marginBottom: 12, fontSize: 12.5, fontWeight: 600, color: settingsTheme.textMuted }}>
            Loading CBM products...
          </div>
        ) : null}

        {isMobile ? (
          <div style={mobileRowsWrap}>
            {computed.map((row, idx) => (
              <div key={row.id} style={mobileRowCard}>
                <div style={mobileRowHead}>
                  <span style={mobileRowIndex}>Row {idx + 1}</span>
                  <div style={actionGroup}>
                    {isEditing(row.id) ? (
                      <button onClick={() => saveRow(row.id)} style={saveIconBtn} type="button" title="Save">
                        <Save size={13} />
                      </button>
                    ) : null}
                    {isSuperuser ? (
                      <button onClick={() => removeRow(row.id)} style={deleteIconBtn} type="button" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div style={mobileFieldsGrid}>
                  <div style={mobileFieldFull}>
                    <label style={mobileLabel}>Item</label>
                    {isEditing(row.id) ? (
                      <input value={row.item} onChange={(e) => updateRow(row.id, 'item', e.target.value)} placeholder="Item name" style={input()} />
                    ) : (
                      <span style={mobileReadCell}>{row.item || '-'}</span>
                    )}
                  </div>

                  <div>
                    <label style={mobileLabel}>Length</label>
                    {isEditing(row.id) ? (
                      <input value={row.length} onChange={(e) => updateRow(row.id, 'length', e.target.value)} placeholder="L" type="number" style={input()} />
                    ) : (
                      <span style={mobileReadCell}>{row.length || '-'}</span>
                    )}
                  </div>
                  <div>
                    <label style={mobileLabel}>Width</label>
                    {isEditing(row.id) ? (
                      <input value={row.width} onChange={(e) => updateRow(row.id, 'width', e.target.value)} placeholder="W" type="number" style={input()} />
                    ) : (
                      <span style={mobileReadCell}>{row.width || '-'}</span>
                    )}
                  </div>
                  <div>
                    <label style={mobileLabel}>Height</label>
                    {isEditing(row.id) ? (
                      <input value={row.height} onChange={(e) => updateRow(row.id, 'height', e.target.value)} placeholder="H" type="number" style={input()} />
                    ) : (
                      <span style={mobileReadCell}>{row.height || '-'}</span>
                    )}
                  </div>
                  <div>
                    <label style={mobileLabel}>Unit</label>
                    {isEditing(row.id) ? (
                      <SettingsSelect
                        value={row.dimUnit}
                        onChange={(e) => updateRow(row.id, 'dimUnit', e.target.value)}
                        wrapperStyle={{ width: '100%', minWidth: 0, maxWidth: '100%' }}
                        selectStyle={select({ width: '100%' })}
                      >
                        {UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                      </SettingsSelect>
                    ) : (
                      <span style={mobileReadCell}>{row.dimUnit}</span>
                    )}
                  </div>
                  <div>
                    <label style={mobileLabel}>Quantity</label>
                    <input
                      value={row.quantity}
                      onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                      onBlur={() => !isLocalRow(row.id) && saveRow(row.id)}
                      placeholder="0"
                      type="number"
                      style={input()}
                    />
                  </div>
                  <div>
                    <label style={mobileLabel}>Wt/Carton</label>
                    {isEditing(row.id) ? (
                      <input value={row.weightPerCarton} onChange={(e) => updateRow(row.id, 'weightPerCarton', e.target.value)} placeholder="Optional" type="number" style={input()} />
                    ) : (
                      <span style={mobileReadCell}>{row.weightPerCarton || '-'}</span>
                    )}
                  </div>
                  <div>
                    <label style={mobileLabel}>Wt Unit</label>
                    {isEditing(row.id) ? (
                      <SettingsSelect
                        value={row.weightUnit}
                        onChange={(e) => updateRow(row.id, 'weightUnit', e.target.value)}
                        wrapperStyle={{ width: '100%', minWidth: 0, maxWidth: '100%' }}
                        selectStyle={select({ width: '100%' })}
                      >
                        {WEIGHT_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                      </SettingsSelect>
                    ) : (
                      <span style={mobileReadCell}>{row.weightUnit}</span>
                    )}
                  </div>
                </div>

                <div style={mobileStatsGrid}>
                  <div style={mobileStatBox}>
                    <span style={mobileStatLabel}>CBM/Carton</span>
                    <span style={mobileStatValue}>{row.cbmPerCarton > 0 ? row.cbmPerCarton.toFixed(6) : '-'}</span>
                  </div>
                  <div style={mobileStatBox}>
                    <span style={mobileStatLabel}>Total CBM</span>
                    <span style={{ ...mobileStatValue, color: settingsTheme.primarySoft }}>{row.totalCBM > 0 ? row.totalCBM.toFixed(6) : '-'}</span>
                  </div>
                  {hasWeightInput ? (
                    <div style={mobileStatBox}>
                      <span style={mobileStatLabel}>Total Wt</span>
                      <span style={{ ...mobileStatValue, color: settingsTheme.primary }}>{row.totalWeight > 0 ? row.totalWeight.toFixed(2) : '-'}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#eef2ee', borderBottom: `1px solid ${settingsTheme.border}` }}>
                <th style={th}>SR.NO</th>
                <th style={{ ...th, textAlign: 'left' }}>Item</th>
                <th style={th} colSpan={3}>Carton Dimensions</th>
                <th style={th}>Unit</th>
                <th style={th}>Quantity</th>
                <th style={th}>Wt/Carton</th>
                <th style={th}>Wt Unit</th>
                <th style={th}>CBM/Carton</th>
                <th style={{ ...th, color: settingsTheme.primarySoft }}>Total CBM</th>
                <th style={{ ...th, color: settingsTheme.primary }}>Total Wt (Kg)</th>
                <th style={th}>Action</th>
              </tr>
              <tr style={{ background: '#f6f9f6', borderBottom: `1px solid ${settingsTheme.border}` }}>
                <th style={subTh} />
                <th style={subTh} />
                <th style={subTh}>L</th>
                <th style={subTh}>W</th>
                <th style={subTh}>H</th>
                <th style={subTh} />
                <th style={subTh} />
                <th style={subTh} />
                <th style={subTh} />
                <th style={subTh} />
                <th style={subTh} />
                <th style={subTh} />
                <th style={subTh} />
              </tr>
            </thead>
            <tbody>
              {computed.map((row, idx) => {
                const editing = isEditing(row.id)
                return (
                  <tr
                    key={row.id}
                    style={{ borderBottom: `1px solid ${settingsTheme.borderSoft}` }}
                  >
                    <td style={{ ...td, color: settingsTheme.textSubtle, fontWeight: 700 }}>{idx + 1}</td>
                    <td style={{ ...td, minWidth: 180, textAlign: 'left' }}>
                      {editing ? (
                        <input value={row.item} onChange={(e) => updateRow(row.id, 'item', e.target.value)} placeholder="Item name" style={input()} />
                      ) : (
                        <span style={readCell}>{row.item || '-'}</span>
                      )}
                    </td>
                    <td style={td}>
                      {editing ? <input value={row.length} onChange={(e) => updateRow(row.id, 'length', e.target.value)} placeholder="L" type="number" style={input({ width: 68 })} /> : <span style={readCell}>{row.length || '-'}</span>}
                    </td>
                    <td style={td}>
                      {editing ? <input value={row.width} onChange={(e) => updateRow(row.id, 'width', e.target.value)} placeholder="W" type="number" style={input({ width: 68 })} /> : <span style={readCell}>{row.width || '-'}</span>}
                    </td>
                    <td style={td}>
                      {editing ? <input value={row.height} onChange={(e) => updateRow(row.id, 'height', e.target.value)} placeholder="H" type="number" style={input({ width: 68 })} /> : <span style={readCell}>{row.height || '-'}</span>}
                    </td>
                    <td style={td}>
                      {editing ? (
                        <SettingsSelect
                          value={row.dimUnit}
                          onChange={(e) => updateRow(row.id, 'dimUnit', e.target.value)}
                          wrapperStyle={{ width: 72 }}
                          selectStyle={select({ width: '100%' })}
                        >
                          {UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                        </SettingsSelect>
                      ) : (
                        <span style={readCell}>{row.dimUnit}</span>
                      )}
                    </td>
                    <td style={td}>
                      <input
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                        onBlur={() => !isLocalRow(row.id) && saveRow(row.id)}
                        placeholder="0"
                        type="number"
                        style={input({ width: 72 })}
                      />
                    </td>
                    <td style={td}>
                      {editing ? <input value={row.weightPerCarton} onChange={(e) => updateRow(row.id, 'weightPerCarton', e.target.value)} placeholder="0" type="number" style={input({ width: 72 })} /> : <span style={readCell}>{row.weightPerCarton || '-'}</span>}
                    </td>
                    <td style={td}>
                      {editing ? (
                        <SettingsSelect
                          value={row.weightUnit}
                          onChange={(e) => updateRow(row.id, 'weightUnit', e.target.value)}
                          wrapperStyle={{ width: 72 }}
                          selectStyle={select({ width: '100%' })}
                        >
                          {WEIGHT_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                        </SettingsSelect>
                      ) : (
                        <span style={readCell}>{row.weightUnit}</span>
                      )}
                    </td>
                    <td style={{ ...td, color: settingsTheme.textMuted, fontFamily: 'monospace', fontSize: 12 }}>
                      {row.cbmPerCarton > 0 ? row.cbmPerCarton.toFixed(6) : '-'}
                    </td>
                    <td style={{ ...td, fontWeight: 700, color: settingsTheme.primarySoft, fontFamily: 'monospace' }}>
                      {row.totalCBM > 0 ? row.totalCBM.toFixed(6) : '-'}
                    </td>
                    <td style={{ ...td, fontWeight: 700, color: settingsTheme.primary, fontFamily: 'monospace' }}>
                      {row.totalWeight > 0 ? row.totalWeight.toFixed(2) : '-'}
                    </td>
                    <td style={td}>
                      <div style={actionGroup}>
                        {editing ? (
                          <button onClick={() => saveRow(row.id)} style={saveIconBtn} type="button" title="Save">
                            <Save size={13} />
                          </button>
                        ) : null}
                        {isSuperuser ? (
                          <button
                            onClick={() => removeRow(row.id)}
                            style={deleteIconBtn}
                            type="button"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#edf8ef', borderTop: `2px solid ${settingsTheme.border}` }}>
                <td colSpan={10} style={{ padding: '11px 20px', fontSize: 13, fontWeight: 700, color: settingsTheme.primary, textAlign: 'right' }}>
                  TOTAL:
                </td>
                <td style={{ padding: '11px 12px', fontWeight: 800, color: totalCBMUsed > containerCBM ? settingsTheme.danger : settingsTheme.primarySoft, fontSize: 14, fontFamily: 'monospace' }}>
                  {totalCBMUsed.toFixed(6)}
                </td>
                <td style={{ padding: '11px 12px', fontWeight: 800, color: settingsTheme.primary, fontSize: 14, fontFamily: 'monospace' }}>
                  {totalWeightUsed > 0 ? totalWeightUsed.toFixed(2) : '-'}
                </td>
                <td />
              </tr>
              <tr style={{ background: '#f6f9f6', borderTop: `1px solid ${settingsTheme.border}` }}>
                <td colSpan={10} style={{ padding: '9px 20px', fontSize: 12.5, fontWeight: 700, color: settingsTheme.primary, textAlign: 'right' }}>
                  CBM REMAINING ({containerType.toUpperCase()} - {containerCBM} m3):
                </td>
                <td style={{ padding: '9px 12px', fontWeight: 800, color: cbmRemaining < 0 ? settingsTheme.danger : settingsTheme.primary, fontSize: 14, fontFamily: 'monospace' }}>
                  {cbmRemaining.toFixed(6)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        )}

        <div style={{ ...formulaNote, marginTop: isMobile ? 10 : 14 }}>
          <p style={{ margin: 0, fontSize: 12, color: settingsTheme.textMuted }}>
            <strong>Formula:</strong> CBM/carton = (L x W x H) in meters. {isMobile ? '1 inch = 2.54 cm.' : 'Supports Inch, CM, MM. 1 Inch = 2.54 CM. Total CBM = CBM/carton x Quantity. 40ft is about 66 m3, 20ft is about 33 m3.'}
          </p>
        </div>
      </div>
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

const header = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: 20,
  gap: 12,
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

const title = {
  margin: 0,
  fontSize: 22,
  fontWeight: 800,
  color: settingsTheme.text,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}

const subtitle = {
  margin: '4px 0 0',
  fontSize: 13,
  color: settingsTheme.textMuted,
}

const summaryGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
  marginBottom: 20,
}

const progressGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  marginBottom: 20,
}

const progressCard = {
  background: '#fff',
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 10,
  padding: '12px 16px',
}

const editableSummaryValue = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 6,
}

const summaryInput = {
  border: 'none',
  borderBottom: `1px solid ${settingsTheme.border}`,
  background: 'transparent',
  color: settingsTheme.text,
  fontSize: 22,
  fontWeight: 800,
  outline: 'none',
  padding: '0 0 2px',
  fontFamily: 'inherit',
}

const tableWrap = {
  background: '#fff',
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 12,
  overflow: 'auto',
}

const mobileRowsWrap = {
  display: 'grid',
  gap: 10,
}

const mobileRowCard = {
  background: '#fff',
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 12,
  padding: 10,
}

const mobileRowHead = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
}

const mobileRowIndex = {
  fontSize: 12,
  fontWeight: 700,
  color: settingsTheme.textSubtle,
}

const mobileFieldsGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
}

const mobileFieldFull = {
  gridColumn: '1 / -1',
}

const mobileLabel = {
  display: 'block',
  marginBottom: 4,
  fontSize: 11.5,
  fontWeight: 700,
  color: settingsTheme.textMuted,
}

const mobileReadCell = {
  display: 'flex',
  minHeight: 33,
  alignItems: 'center',
  border: `1px solid ${settingsTheme.borderSoft}`,
  borderRadius: 8,
  background: '#f8faf8',
  padding: '6px 8px',
  fontSize: 12.5,
  fontWeight: 600,
  color: settingsTheme.text,
  boxSizing: 'border-box',
  overflowWrap: 'anywhere',
}

const mobileStatsGrid = {
  marginTop: 10,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
}

const mobileStatBox = {
  border: `1px solid ${settingsTheme.borderSoft}`,
  borderRadius: 10,
  padding: '8px 10px',
  background: '#f8faf8',
}

const mobileStatLabel = {
  display: 'block',
  fontSize: 11,
  color: settingsTheme.textSubtle,
  marginBottom: 4,
}

const mobileStatValue = {
  fontFamily: 'monospace',
  fontSize: 12.5,
  fontWeight: 700,
  color: settingsTheme.text,
}

const th = {
  padding: '11px 10px',
  fontSize: 12,
  fontWeight: 700,
  color: '#455645',
  textAlign: 'center',
  whiteSpace: 'nowrap',
}

const subTh = {
  padding: '5px 10px',
  fontSize: 11,
  fontWeight: 600,
  color: settingsTheme.textSubtle,
  textAlign: 'center',
}

const td = {
  padding: '8px 10px',
  textAlign: 'center',
  verticalAlign: 'middle',
}

const readCell = {
  display: 'inline-block',
  fontSize: 12.5,
  fontWeight: 600,
  color: settingsTheme.text,
  lineHeight: 1.4,
}

const actionGroup = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
}

const iconBtnBase = {
  borderRadius: 8,
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}

const saveIconBtn = {
  ...iconBtnBase,
  border: `1px solid ${settingsTheme.border}`,
  background: '#edf8ef',
  color: settingsTheme.primarySoft,
}

const deleteIconBtn = {
  ...iconBtnBase,
  border: '1px solid #fecaca',
  background: settingsTheme.dangerBg,
  color: settingsTheme.danger,
}

const primaryBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: settingsTheme.primarySoft,
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '8px 14px',
  fontSize: 13,
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

const outlineBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: '#fff',
  color: '#425343',
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 10,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const formulaNote = {
  marginTop: 14,
  padding: '10px 16px',
  background: '#f6f9f6',
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 10,
}

