'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { incrementStoreEntries } from '@/application/services/store/storeEntryTracker'
import { ArrowLeft, Save, Plus, X } from 'lucide-react'
import { StoreThemeDatePicker } from '@/components/store/shared/StoreThemeControls'
import { dailyProductionApi } from '@/infrastructure/api/endpoints'
import { useAuthStore } from '@/application/state/auth/useAuthStore'

const todayISO = () => new Date().toISOString().split('T')[0]

const blankEntry = () => ({
  key: Date.now() + Math.random(),
  product: '',
  startTime: '',
  endTime: '',
  noOfLabour: '',
  note: '',
})

function calcHours(start, end) {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return null
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function DailyProductionNewPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [date, setDate]       = useState(todayISO())
  const [entries, setEntries] = useState([blankEntry()])
  const [saving, setSaving]   = useState(false)
  const [errors, setErrors]   = useState({})
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mobileQuery = window.matchMedia('(max-width: 640px)')
    const apply = () => setIsMobile(mobileQuery.matches)
    apply()
    mobileQuery.addEventListener('change', apply)
    return () => mobileQuery.removeEventListener('change', apply)
  }, [])

  const updateEntry = (key, field, value) => {
    setEntries(prev => prev.map(e => e.key === key ? { ...e, [field]: value } : e))
    setErrors(er => ({ ...er, entries: undefined }))
  }
  const addEntry    = () => setEntries(prev => [...prev, blankEntry()])
  const removeEntry = (key) => setEntries(prev => prev.filter(e => e.key !== key))

  const validate = () => {
    const e = {}
    const incomplete = entries.some(en => !en.product.trim() || !en.startTime || !en.endTime || !en.noOfLabour)
    if (incomplete) e.entries = 'Please complete all fields in every entry row'
    const timeError = entries.some(en => {
      if (!en.startTime || !en.endTime) return false
      const [sh, sm] = en.startTime.split(':').map(Number)
      const [eh, em] = en.endTime.split(':').map(Number)
      return (eh * 60 + em) <= (sh * 60 + sm)
    })
    if (timeError) e.time = 'End time must be after start time'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await dailyProductionApi.create({
        date,
        note: '',
        entries: entries.map((entry) => ({
          product: String(entry.product || '').trim(),
          startTime: entry.startTime,
          endTime: entry.endTime,
          noOfLabour: Number(entry.noOfLabour) || 0,
          note: String(entry.note || '').trim(),
          entryBy: user?.username || '',
        })),
      })
      incrementStoreEntries('daily-production', entries.length)
      router.push('/daily-production')
    } catch (err) {
      setErrors((prev) => ({ ...prev, form: err?.message || 'Unable to save daily production entry' }))
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div style={{ ...s.wrapper, maxWidth: isMobile ? '100%' : 860 }}>

        {/* Page Header */}
        <div style={s.pageHeader}>
          <div style={{ ...s.headerLeft, width: isMobile ? '100%' : 'auto' }}>
            <button style={s.backBtn} onClick={() => router.push('/daily-production')}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ ...s.pageTitle, fontSize: isMobile ? 20 : 30 }}>Add Production Entry</h1>
              <p style={{ ...s.pageSubtitle, fontSize: isMobile ? 12 : 13.5 }}>Record daily production activity</p>
            </div>
          </div>
          <button style={{ ...(saving ? s.saveBtnDis : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'SAVE'}
          </button>
        </div>

        <div style={{ ...s.card, borderRadius: isMobile ? 14 : 20, padding: isMobile ? 14 : 24 }}>

          {/* Date — top full width */}
          <div style={{ ...s.dateRow, maxWidth: isMobile ? '100%' : 280 }}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Date</label>
              <StoreThemeDatePicker value={date} onChange={setDate} placeholder="Select date" variant="input" />
            </div>
          </div>

          {/* Error banners */}
          {errors.entries && <div style={s.errBanner}>{errors.entries}</div>}
          {errors.time    && <div style={s.errBanner}>{errors.time}</div>}
          {errors.form    && <div style={s.errBanner}>{errors.form}</div>}

          {/* Entry Rows */}
          <div style={s.entriesHeader}>
            <p style={s.entriesTitle}>Production Entries</p>
            <button style={s.addEntryBtn} onClick={addEntry}><Plus size={14} /> Add Entry</button>
          </div>

          {entries.map((entry, idx) => {
            const hours = calcHours(entry.startTime, entry.endTime)
            return (
              <div key={entry.key} style={s.entryBlock}>
                {/* Entry number tag */}
                <div style={s.entryTag}>#{idx + 1}</div>

                <div style={{ ...s.entryFields, gridTemplateColumns: isMobile ? '1fr' : s.entryFields.gridTemplateColumns }}>
                  {/* Product - manual text input */}
                  <div style={{ ...s.fieldGroup, gridColumn: '1 / -1' }}>
                    <label style={s.label}>Product Name</label>
                    <input
                      style={s.input}
                      placeholder="Enter product name manually..."
                      value={entry.product}
                      onChange={e => updateEntry(entry.key, 'product', e.target.value)}
                    />
                  </div>

                  {/* Start Time */}
                  <div style={s.fieldGroup}>
                    <label style={s.label}>Start Time</label>
                    <input
                      type="time"
                      style={s.input}
                      value={entry.startTime}
                      onChange={e => updateEntry(entry.key, 'startTime', e.target.value)}
                    />
                  </div>

                  {/* End Time */}
                  <div style={s.fieldGroup}>
                    <label style={s.label}>End Time</label>
                    <input
                      type="time"
                      style={s.input}
                      value={entry.endTime}
                      onChange={e => updateEntry(entry.key, 'endTime', e.target.value)}
                    />
                  </div>

                  {/* Total Hours (auto) */}
                  <div style={s.fieldGroup}>
                    <label style={s.label}>Total Hours</label>
                    <div style={s.hoursDisplay}>
                      {hours
                        ? <span style={s.hoursBadge}>{hours}</span>
                        : <span style={s.hoursPlaceholder}>Auto-calculated</span>}
                    </div>
                  </div>

                  {/* No of Labour */}
                  <div style={s.fieldGroup}>
                    <label style={s.label}>No of Labour</label>
                    <input
                      style={s.input}
                      type="number"
                      min="1"
                      placeholder="0"
                      value={entry.noOfLabour}
                      onChange={e => updateEntry(entry.key, 'noOfLabour', e.target.value)}
                    />
                  </div>

                  <div style={{ ...s.fieldGroup, gridColumn: '1 / -1' }}>
                    <label style={s.label}>Comment</label>
                    <textarea
                      style={s.noteInput}
                      placeholder="Any additional notes for this entry..."
                      value={entry.note}
                      onChange={e => updateEntry(entry.key, 'note', e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>

                {/* Remove entry */}
                {entries.length > 1 && (
                  <button style={s.removeEntryBtn} onClick={() => removeEntry(entry.key)} title="Remove entry">
                    <X size={14} />
                  </button>
                )}
              </div>
            )
          })}

          {/* Add another (bottom dashed) */}
          <button style={s.addEntryDashed} onClick={addEntry}>
            <Plus size={14} /> Add Another Entry
          </button>

          {/* Footer */}
          <div style={s.formFooter}>
            <button style={{ ...s.cancelBtn, width: isMobile ? '100%' : 'auto' }} onClick={() => router.push('/daily-production')}>Cancel</button>
            <button style={{ ...(saving ? s.saveBtnDis : s.saveBtn), width: isMobile ? '100%' : 'auto' }} onClick={handleSave} disabled={saving}>
              <Save size={15} /> {saving ? 'Saving...' : 'SAVE'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

const s = {
  wrapper: { maxWidth: 860, margin: '0 auto' },
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 40,
    border: '1.5px solid #d4dfd4',
    background: '#ffffff',
    color: '#2d7a33',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  pageTitle: { fontSize: 30, fontWeight: 800, color: '#1a3d1f', margin: '0 0 4px', display: 'flex', alignItems: 'center', letterSpacing: '-0.6px', lineHeight: 1.2 },
  pageSubtitle: { fontSize: 13.5, color: '#7a8a7a', margin: 0, fontWeight: 500 },
  saveBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#54B45B', border: 'none', borderRadius: 40, padding: '11px 20px', fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'pointer' },
  saveBtnDis: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#b8dcbc', border: 'none', borderRadius: 40, padding: '11px 20px', fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'not-allowed' },
  cancelBtn: { border: '1.5px solid #d4dfd4', borderRadius: 40, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, color: '#2d7a33', background: '#ffffff', cursor: 'pointer' },
  card: { background: '#f2f4f2', borderRadius: 20, border: '1px solid #e2e8e2', padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  dateRow: { marginBottom: 18, maxWidth: 280 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 700, color: '#607062' },
  input: { background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#1f2f21', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
  errBanner: { background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: '#b91c1c', marginBottom: 12 },
  entriesHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' },
  entriesTitle: { fontSize: 14, fontWeight: 700, color: '#1f2f21', margin: 0 },
  addEntryBtn: { display: 'flex', alignItems: 'center', gap: 5, background: '#ffffff', border: '1.5px solid #d4dfd4', color: '#2d7a33', borderRadius: 40, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' },
  entryBlock: { position: 'relative', background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 12, padding: '18px 20px 16px', marginBottom: 10 },
  entryTag: { position: 'absolute', top: -10, left: 16, background: '#2d7a33', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 10px' },
  entryFields: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' },
  hoursDisplay: { height: 40, display: 'flex', alignItems: 'center' },
  hoursBadge: { background: '#e8f0e8', border: '1px solid #d4dfd4', borderRadius: 40, padding: '2px 10px', fontSize: 12.5, fontWeight: 700, color: '#2d7a33' },
  hoursPlaceholder: { fontSize: 12.5, color: '#b2c0b3', fontStyle: 'italic' },
  removeEntryBtn: { position: 'absolute', top: 12, right: 12, background: '#fff1f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '5px 7px', cursor: 'pointer', display: 'flex' },
  addEntryDashed: { display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1.5px dashed #d4dfd4', color: '#2d7a33', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center', marginBottom: 18 },
  noteSection: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 },
  noteInput: { background: '#ffffff', border: '1px solid #d4dfd4', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1f2f21', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.6 },
  formFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid #d4dfd4', flexWrap: 'wrap' },
}


