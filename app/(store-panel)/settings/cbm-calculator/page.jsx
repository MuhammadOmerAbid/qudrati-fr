'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { Plus, Trash2, Calculator, RotateCcw, Package, ArrowLeft } from 'lucide-react'
import { SettingsSelect, settingsTheme } from '@/components/settings/SettingsShared'

const UNITS = ['Inch', 'CM', 'MM']
const WEIGHT_UNITS = ['Kg', 'Gram', 'Lb']

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
  id: Date.now() + Math.random(),
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

export default function CBMCalculatorPage() {
  const router = useRouter()
  const [rows, setRows] = useState([emptyRow()])
  const [containerType, setContainerType] = useState('40ft')

  const containerCBM = containerType === '40ft' ? 66 : 33
  const containerWeight = containerType === '40ft' ? 26500 : 13500

  const updateRow = (id, field, value) => {
    setRows((prev) => prev.map((row) => row.id === id ? { ...row, [field]: value } : row))
  }

  const addRow = () => setRows((prev) => [...prev, emptyRow()])
  const removeRow = (id) => setRows((prev) => prev.filter((row) => row.id !== id))
  const resetRows = () => setRows([emptyRow()])
  const loadSample = () => setRows(SAMPLE_ROWS.map((row) => ({ ...row, id: Date.now() + Math.random() })))

  const computed = rows.map((row) => {
    const qty = parseFloat(row.quantity) || 0
    const cbmPerCarton = calcCBM(row.length, row.width, row.height, row.dimUnit)
    const totalCBM = cbmPerCarton * qty
    const totalWeight = toKg(row.weightPerCarton, row.weightUnit) * qty
    return { ...row, cbmPerCarton, totalCBM, totalWeight }
  })

  const totalCBMUsed = computed.reduce((sum, row) => sum + row.totalCBM, 0)
  const totalWeightUsed = computed.reduce((sum, row) => sum + row.totalWeight, 0)
  const cbmRemaining = containerCBM - totalCBMUsed
  const cbmPct = Math.min((totalCBMUsed / containerCBM) * 100, 100)
  const weightPct = totalWeightUsed > 0 ? Math.min((totalWeightUsed / containerWeight) * 100, 100) : 0

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

  return (
    <DashboardLayout>
      <div style={pageShell}>
        <div style={header}>
          <div style={headerLeft}>
            <button type="button" style={backBtn} onClick={() => router.push('/settings')} title="Back to settings">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={title}>
                <Calculator size={22} color={settingsTheme.primarySoft} />
                CBM + Weight Calculator
              </h1>
              <p style={subtitle}>Calculate cubic meters and shipping weight for container loading.</p>
            </div>
          </div>
          <SettingsSelect
            value={containerType}
            onChange={(e) => setContainerType(e.target.value)}
            wrapperStyle={{ minWidth: 180 }}
            selectStyle={{ ...select({ padding: '7px 30px 7px 12px', fontSize: 13, fontWeight: 600 }) }}
          >
            <option value="40ft">40 Feet Container</option>
            <option value="20ft">20 Feet Container</option>
          </SettingsSelect>
        </div>

        <div style={summaryGrid}>
          {[
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
              label: 'Container Capacity',
              value: containerCBM.toFixed(2),
              unit: 'm3',
              color: settingsTheme.textMuted,
              bg: '#f6f9f6',
              border: settingsTheme.border,
            },
            {
              label: 'Total Weight',
              value: totalWeightUsed > 0 ? totalWeightUsed.toFixed(2) : '-',
              unit: totalWeightUsed > 0 ? 'Kg' : '',
              color: totalWeightUsed > containerWeight ? settingsTheme.danger : settingsTheme.primary,
              bg: '#f6f9f6',
              border: settingsTheme.border,
            },
          ].map(({ label, value, unit, color, bg, border }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 18px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: settingsTheme.textMuted }}>{label}</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color }}>
                {value} <span style={{ fontSize: 13, fontWeight: 500 }}>{unit}</span>
              </p>
            </div>
          ))}
        </div>

        <div style={progressGrid}>
          {[
            {
              label: `CBM Used: ${totalCBMUsed.toFixed(3)} / ${containerCBM} m3`,
              pct: cbmPct,
              color: cbmPct > 90 ? settingsTheme.danger : settingsTheme.primarySoft,
            },
            {
              label: `Weight: ${totalWeightUsed > 0 ? `${totalWeightUsed.toFixed(1)} / ${containerWeight} Kg` : 'Enter weight per carton'}`,
              pct: weightPct,
              color: weightPct > 90 ? settingsTheme.danger : settingsTheme.primary,
            },
          ].map(({ label, pct, color }) => (
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
          <button onClick={loadSample} style={outlineBtn} type="button">
            <Package size={14} /> Load Sample Data
          </button>
          <button onClick={resetRows} style={{ ...outlineBtn, color: settingsTheme.danger, borderColor: '#fecaca' }} type="button">
            <RotateCcw size={14} /> Reset
          </button>
        </div>

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
              {computed.map((row, idx) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: `1px solid ${settingsTheme.borderSoft}` }}
                >
                  <td style={{ ...td, color: settingsTheme.textSubtle, fontWeight: 700 }}>{idx + 1}</td>
                  <td style={{ ...td, minWidth: 160 }}>
                    <input value={row.item} onChange={(e) => updateRow(row.id, 'item', e.target.value)} placeholder="Item name" style={input()} />
                  </td>
                  <td style={td}>
                    <input value={row.length} onChange={(e) => updateRow(row.id, 'length', e.target.value)} placeholder="L" type="number" style={input({ width: 68 })} />
                  </td>
                  <td style={td}>
                    <input value={row.width} onChange={(e) => updateRow(row.id, 'width', e.target.value)} placeholder="W" type="number" style={input({ width: 68 })} />
                  </td>
                  <td style={td}>
                    <input value={row.height} onChange={(e) => updateRow(row.id, 'height', e.target.value)} placeholder="H" type="number" style={input({ width: 68 })} />
                  </td>
                  <td style={td}>
                    <SettingsSelect
                      value={row.dimUnit}
                      onChange={(e) => updateRow(row.id, 'dimUnit', e.target.value)}
                      wrapperStyle={{ width: 72 }}
                      selectStyle={select({ width: '100%' })}
                    >
                      {UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                    </SettingsSelect>
                  </td>
                  <td style={td}>
                    <input value={row.quantity} onChange={(e) => updateRow(row.id, 'quantity', e.target.value)} placeholder="0" type="number" style={input({ width: 72 })} />
                  </td>
                  <td style={td}>
                    <input value={row.weightPerCarton} onChange={(e) => updateRow(row.id, 'weightPerCarton', e.target.value)} placeholder="0" type="number" style={input({ width: 72 })} />
                  </td>
                  <td style={td}>
                    <SettingsSelect
                      value={row.weightUnit}
                      onChange={(e) => updateRow(row.id, 'weightUnit', e.target.value)}
                      wrapperStyle={{ width: 72 }}
                      selectStyle={select({ width: '100%' })}
                    >
                      {WEIGHT_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                    </SettingsSelect>
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
                    {computed.length > 1 && (
                      <button
                        onClick={() => removeRow(row.id)}
                        style={{ border: '1px solid #fecaca', background: settingsTheme.dangerBg, borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        type="button"
                      >
                        <Trash2 size={13} color={settingsTheme.danger} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
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

        <div style={formulaNote}>
          <p style={{ margin: 0, fontSize: 12, color: settingsTheme.textMuted }}>
            <strong>Formula:</strong> CBM per carton = (L x W x H converted to meters). Supports Inch, CM, and MM inputs.
            {' '}1 Inch = 2.54 CM. Total CBM = CBM per carton x Quantity. 40ft container is about 66 m3. 20ft container is about 33 m3.
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
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
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

const tableWrap = {
  background: '#fff',
  border: `1px solid ${settingsTheme.border}`,
  borderRadius: 12,
  overflow: 'auto',
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

