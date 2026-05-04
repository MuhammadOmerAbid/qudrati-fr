'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountLayout from '@/presentation/layouts/AccountLayout'
import { Download, Plus, Printer, RefreshCcw, Search, Stamp } from 'lucide-react'
import { loadVoucherSummariesFromLedger } from '@/application/services/accounts/accountsWorkflow'

const VOUCHER_TYPES = ['Payment Voucher', 'Receipt Voucher', 'Journal Voucher']
const todayISO = () => new Date().toISOString().slice(0, 10)
const monthStartISO = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}
const toMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100

function formatMoney(value) {
  return `Rs ${toMoney(value).toLocaleString()}`
}

function toKey(value) {
  return String(value || '').trim().toLowerCase()
}

function rowsToCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  rows.forEach((row) => {
    lines.push(headers.map((header) => {
      const raw = String(row[header] == null ? '' : row[header])
      if (!raw.includes(',') && !raw.includes('"') && !raw.includes('\n')) return raw
      return `"${raw.replace(/"/g, '""')}"`
    }).join(','))
  })
  return `${lines.join('\n')}\n`
}

function downloadCsv(fileName, rows) {
  const csv = rowsToCsv(rows)
  if (!csv) return false
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
  return true
}

export default function VouchersPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'

  const [fromDate, setFromDate] = useState(monthStartISO())
  const [toDate, setToDate] = useState(todayISO())
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [noticeText, setNoticeText] = useState('')
  const [errorText, setErrorText] = useState('')

  const refreshRows = () => {
    setRefreshing(true)
    try {
      setRows(loadVoucherSummariesFromLedger({ fromDate, toDate }))
      setErrorText('')
    } catch (error) {
      setErrorText(error?.message || 'Unable to load vouchers')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    refreshRows()
  }, [fromDate, toDate])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const interval = window.setInterval(refreshRows, 5000)
    const onFocus = () => refreshRows()
    const onStorage = () => refreshRows()
    const params = new URLSearchParams(window.location.search)
    const notice = toKey(params.get('notice'))
    if (notice === 'posted') {
      const voucher = String(params.get('voucher') || '').trim()
      setNoticeText(voucher ? `Voucher ${voucher} posted successfully.` : 'Voucher posted successfully.')
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const filtered = useMemo(() => {
    const typeKey = toKey(typeFilter)
    const needle = toKey(search)
    return rows.filter((item) => {
      if (typeKey !== 'all' && toKey(item.type) !== typeKey) return false
      if (!needle) return true
      const haystack = toKey([
        item.id,
        item.voucherNo,
        item.type,
        item.date,
        item.party,
        item.account,
        item.description,
        item.reference,
        item.source,
      ].join(' '))
      return haystack.includes(needle)
    })
  }, [rows, search, typeFilter])

  const summary = useMemo(() => {
    const map = new Map()
    VOUCHER_TYPES.forEach((type) => {
      map.set(type, { type, count: 0, amount: 0 })
    })
    rows.forEach((item) => {
      const key = VOUCHER_TYPES.includes(item.type) ? item.type : 'Journal Voucher'
      const current = map.get(key)
      current.count += 1
      current.amount = toMoney(current.amount + (Number(item.amount) || 0))
      map.set(key, current)
    })
    return Array.from(map.values())
  }, [rows])

  const handleDownload = () => {
    const ok = downloadCsv(
      `vouchers-${fromDate || 'start'}-${toDate || 'end'}.csv`,
      filtered.map((row) => ({
        voucherNo: row.voucherNo,
        type: row.type,
        date: row.date,
        party: row.party,
        account: row.account,
        description: row.description,
        reference: row.reference,
        source: row.source,
        totalDebit: row.totalDebit,
        totalCredit: row.totalCredit,
        amount: row.amount,
        status: row.status,
      })),
    )
    if (!ok) {
      setErrorText('No voucher rows available for download.')
      return
    }
    setNoticeText('Voucher CSV downloaded successfully.')
    setErrorText('')
  }

  return (
    <AccountLayout>
      <div style={s.page}>
        <section style={s.hero}>
          <div style={s.heroLeft}>
            <div style={s.heroIcon}><Stamp size={22} color="#166534" /></div>
            <div>
              <h1 style={s.title}>Voucher Management</h1>
              <p style={s.subtitle}>All posted vouchers from GL with live sync, print, and export.</p>
            </div>
          </div>
          <div style={s.heroActions}>
            <button style={s.actionBtn} onClick={refreshRows} disabled={refreshing}>
              <RefreshCcw size={14} /> {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button style={s.actionBtn} onClick={handleDownload}>
              <Download size={14} /> Download CSV
            </button>
            {isSuperuser ? (
              <button style={s.addBtn} onClick={() => router.push('/accounts/vouchers/new')}>
                <Plus size={15} /> New Voucher
              </button>
            ) : null}
          </div>
        </section>

        {noticeText ? <p style={s.noticeText}>{noticeText}</p> : null}
        {errorText ? <p style={s.errorText}>{errorText}</p> : null}

        <div style={s.summaryGrid}>
          {summary.map((item) => (
            <article key={item.type} style={s.summaryCard}>
              <p style={s.summaryLabel}>{item.type}</p>
              <p style={s.summaryValue}>{formatMoney(item.amount)}</p>
              <p style={s.summarySub}>{item.count} voucher(s)</p>
            </article>
          ))}
        </div>

        <section style={s.toolbar}>
          <div style={s.filters}>
            <div style={s.field}>
              <label style={s.label}>From</label>
              <input type="date" style={s.input} value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>To</label>
              <input type="date" style={s.input} value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Type</label>
              <select style={s.input} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">All Types</option>
                {VOUCHER_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={s.searchWrap}>
            <Search size={14} color="#6b7280" />
            <input
              style={s.searchInput}
              placeholder="Search voucher, party, source..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </section>

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Voucher No</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Date</th>
                <th style={s.th}>Party</th>
                <th style={s.th}>Account</th>
                <th style={s.th}>Narration</th>
                <th style={s.th}>Source</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Amount</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Print</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.voucherNo} style={s.tr}>
                  <td style={s.td}><span style={s.voucherTag}>{row.voucherNo}</span></td>
                  <td style={s.td}>{row.type}</td>
                  <td style={s.td}>{row.date || '-'}</td>
                  <td style={s.td}>{row.party || '-'}</td>
                  <td style={s.td}>{row.account || '-'}</td>
                  <td style={s.td}>{row.description || '-'}</td>
                  <td style={s.td}>{row.source || '-'}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{formatMoney(row.amount)}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <button
                      style={s.printBtn}
                      title="Print Voucher"
                      onClick={() => router.push(`/accounts/vouchers/print?id=${encodeURIComponent(row.voucherNo)}`)}
                    >
                      <Printer size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td style={s.emptyCell} colSpan={9}>No vouchers found for current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AccountLayout>
  )
}

const s = {
  page: { width: '100%', display: 'flex', flexDirection: 'column', gap: 14 },
  hero: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    border: '1px solid #d1fae5',
    background: 'linear-gradient(120deg, #f0fdf4 0%, #ecfeff 100%)',
    borderRadius: 16,
    padding: 'clamp(12px, 2.4vw, 16px) clamp(12px, 2.6vw, 18px)',
  },
  heroLeft: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 320px' },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: '#dcfce7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { margin: 0, fontSize: 'clamp(18px, 3.2vw, 22px)', color: '#14532d', fontWeight: 800 },
  subtitle: { margin: '4px 0 0', fontSize: 12.5, color: '#166534' },
  heroActions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#374151',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  addBtn: {
    border: '1px solid #14532d',
    background: '#14532d',
    color: '#ffffff',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  noticeText: {
    margin: 0,
    padding: '9px 11px',
    borderRadius: 9,
    border: '1px solid #a7f3d0',
    background: '#ecfdf5',
    color: '#065f46',
    fontSize: 12.5,
    fontWeight: 600,
  },
  errorText: {
    margin: 0,
    padding: '9px 11px',
    borderRadius: 9,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: 12.5,
    fontWeight: 600,
  },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 },
  summaryCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '10px 12px',
  },
  summaryLabel: { margin: 0, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 },
  summaryValue: { margin: '5px 0 0', fontSize: 18, fontWeight: 800, color: '#0f172a' },
  summarySub: { margin: '4px 0 0', fontSize: 12, color: '#475569' },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 10,
  },
  filters: { display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 11, color: '#6b7280', fontWeight: 700 },
  input: {
    border: '1px solid #d1d5db',
    borderRadius: 9,
    padding: '7px 9px',
    fontSize: 12.5,
    color: '#111827',
    background: '#ffffff',
    fontFamily: 'inherit',
  },
  searchWrap: {
    minWidth: 230,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #d1d5db',
    borderRadius: 999,
    padding: '8px 12px',
    background: '#ffffff',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    width: '100%',
    fontSize: 12.5,
    color: '#111827',
    fontFamily: 'inherit',
  },
  tableWrap: {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    overflow: 'auto',
    background: '#ffffff',
  },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 980 },
  th: {
    background: '#f1f5f9',
    color: '#475569',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    fontWeight: 700,
    textAlign: 'left',
    padding: '10px 10px',
  },
  tr: { borderTop: '1px solid #e5e7eb' },
  td: { padding: '9px 10px', fontSize: 12.5, color: '#111827', verticalAlign: 'top' },
  voucherTag: {
    border: '1px solid #bfdbfe',
    borderRadius: 8,
    background: '#eff6ff',
    color: '#1d4ed8',
    padding: '3px 7px',
    fontSize: 11.5,
    fontWeight: 700,
    display: 'inline-block',
  },
  printBtn: {
    border: '1px solid #d1d5db',
    borderRadius: 8,
    background: '#ffffff',
    color: '#374151',
    padding: '6px 8px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  },
  emptyCell: {
    padding: '18px 10px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 12.5,
  },
}

