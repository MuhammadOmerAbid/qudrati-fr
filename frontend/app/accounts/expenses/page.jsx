'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountLayout from '@/presentation/layouts/AccountLayout'
import { Receipt, Plus, Search, RefreshCcw } from 'lucide-react'
import {
  ACCOUNTS_EXPENSE_CATEGORY_OPTIONS,
  ACCOUNTS_EXPENSE_PAYMENT_MODES,
  getAccountsExpenseSummary,
  loadAccountsExpensesFromStorage,
} from '@/application/services/accounts/accountsWorkflow'

const toMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100
const toKey = (value) => String(value || '').trim().toLowerCase()

function formatMoney(value) {
  return `Rs ${toMoney(value).toLocaleString()}`
}

function getPaymentLabel(value) {
  const mode = ACCOUNTS_EXPENSE_PAYMENT_MODES.find((item) => item.value === value)
  return mode ? mode.label : value
}

export default function ExpensesPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'

  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    count: 0,
    totalsByMode: { petty_cash: 0, cash: 0, bank: 0, credit: 0 },
    totalsByCategory: [],
  })
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [noticeText, setNoticeText] = useState('')
  const [errorText, setErrorText] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const refreshState = () => {
    setRefreshing(true)
    try {
      setRecords(loadAccountsExpensesFromStorage())
      setSummary(getAccountsExpenseSummary())
      setErrorText('')
    } catch (error) {
      setErrorText(error?.message || 'Unable to load expenses')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    refreshState()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const refresh = () => refreshState()
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('accounts:storage-updated', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('accounts:storage-updated', refresh)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const notice = String(params.get('notice') || '').trim().toLowerCase()
    const expenseId = String(params.get('exp') || '').trim()
    if (notice === 'posted') {
      setNoticeText(expenseId ? `Expense ${expenseId} posted and synced with GL/COA.` : 'Expense posted and synced with GL/COA.')
    }
  }, [])

  const filtered = useMemo(() => {
    const needle = toKey(search)
    return records.filter((item) => {
      if (categoryFilter !== 'all' && toKey(item.category) !== toKey(categoryFilter)) return false
      if (paymentFilter !== 'all' && item.paymentMode !== paymentFilter) return false
      if (!needle) return true
      const haystack = toKey([
        item.id,
        item.date,
        item.category,
        item.itemName,
        item.description,
        item.expenseAccountName,
        item.paymentAccountName,
        item.payableAccountName,
        item.voucherNo,
      ].join(' '))
      return haystack.includes(needle)
    })
  }, [categoryFilter, paymentFilter, records, search])

  const categoriesForFilter = useMemo(() => {
    const seen = new Set()
    const ordered = []
    ACCOUNTS_EXPENSE_CATEGORY_OPTIONS.forEach((category) => {
      const key = toKey(category)
      if (seen.has(key)) return
      seen.add(key)
      ordered.push(category)
    })
    records.forEach((item) => {
      const category = String(item.category || '').trim()
      if (!category) return
      const key = toKey(category)
      if (seen.has(key)) return
      seen.add(key)
      ordered.push(category)
    })
    return ordered
  }, [records])

  return (
    <AccountLayout>
      <div style={s.page}>
        <section style={s.hero}>
          <div style={s.heroLeft}>
            <div style={s.heroIcon}><Receipt size={22} color="#b45309" /></div>
            <div>
              <h1 style={s.title}>Expense Module</h1>
              <p style={s.subtitle}>All expense records are managed here and synced to GL/COA and Cash-Bank flows.</p>
            </div>
          </div>
          <div style={s.heroActions}>
            <button style={s.refreshBtn} onClick={refreshState} disabled={refreshing}>
              <RefreshCcw size={14} /> {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            {isSuperuser ? (
              <button style={s.addBtn} onClick={() => router.push('/accounts/expenses/new')}>
                <Plus size={15} /> Record Expense
              </button>
            ) : null}
          </div>
        </section>

        {noticeText ? <p style={s.noticeText}>{noticeText}</p> : null}
        {errorText ? <p style={s.errorText}>{errorText}</p> : null}

        <div style={s.summaryGrid}>
          <div style={s.sumCard}>
            <p style={s.sumLabel}>Total Expense</p>
            <p style={s.sumVal}>{formatMoney(summary.total)}</p>
            <p style={s.sumSub}>{summary.count} posted entries</p>
          </div>
          <div style={{ ...s.sumCard, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <p style={{ ...s.sumLabel, color: '#b45309' }}>Petty Cash</p>
            <p style={{ ...s.sumVal, color: '#b45309' }}>{formatMoney(summary.totalsByMode.petty_cash)}</p>
            <p style={s.sumSub}>Synced to petty cash journal</p>
          </div>
          <div style={{ ...s.sumCard, background: '#f0fdfa', border: '1px solid #99f6e4' }}>
            <p style={{ ...s.sumLabel, color: '#0f766e' }}>Cash + Bank</p>
            <p style={{ ...s.sumVal, color: '#0f766e' }}>{formatMoney(summary.totalsByMode.cash + summary.totalsByMode.bank)}</p>
            <p style={s.sumSub}>Synced to cash/bank module</p>
          </div>
          <div style={{ ...s.sumCard, background: '#eef2ff', border: '1px solid #c7d2fe' }}>
            <p style={{ ...s.sumLabel, color: '#4338ca' }}>Credit Expense</p>
            <p style={{ ...s.sumVal, color: '#4338ca' }}>{formatMoney(summary.totalsByMode.credit)}</p>
            <p style={s.sumSub}>Posted against liabilities</p>
          </div>
        </div>

        <div style={s.catGrid}>
          {summary.totalsByCategory.slice(0, 8).map((row) => (
            <div key={row.category} style={s.catCard}>
              <p style={s.catName}>{row.category}</p>
              <p style={s.catAmt}>{formatMoney(row.amount)}</p>
            </div>
          ))}
        </div>

        <div style={s.toolbar}>
          <div style={s.searchWrap}>
            <Search size={14} color="#7a8a7a" />
            <input
              style={s.searchInput}
              placeholder="Search expense, account, voucher..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select style={s.filterInput} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {categoriesForFilter.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select style={s.filterInput} value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            <option value="all">All payment modes</option>
            {ACCOUNTS_EXPENSE_PAYMENT_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
        </div>

        <div style={s.tableCard}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>Expense #</th>
                <th style={s.th}>Date</th>
                <th style={s.th}>Item / Category</th>
                <th style={s.th}>Description</th>
                <th style={s.th}>Accounts</th>
                <th style={s.th}>Payment Mode</th>
                <th style={s.th}>Voucher</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isJournalInferred = item.origin === 'journal_inferred'
                return (
                <tr key={item.id} style={s.trow}>
                  <td style={s.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={s.expTag}>{item.id}</span>
                      {isJournalInferred ? <span style={s.muted}>Auto from Journal</span> : null}
                    </div>
                  </td>
                  <td style={{ ...s.td, color: '#64748b' }}>{item.date || '-'}</td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 700 }}>{item.itemName || '-'}</span>
                      <span style={s.muted}>{item.category}</span>
                    </div>
                  </td>
                  <td style={s.td}>{item.description || '-'}</td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={s.muted}>Expense: {item.expenseAccountName || item.expenseAccountCode || '-'}</span>
                      {item.paymentMode === 'credit'
                        ? <span style={s.muted}>Liability: {item.payableAccountName || item.payableAccountCode || '-'}</span>
                        : <span style={s.muted}>Payment: {item.paymentAccountName || item.paymentAccountCode || '-'}</span>}
                    </div>
                  </td>
                  <td style={s.td}>
                    <span style={s.modeTag}>{getPaymentLabel(item.paymentMode)}</span>
                  </td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{item.voucherNo || '-'}</span>
                      {item.cashBankTransactionId ? <span style={s.muted}>CB: {item.cashBankTransactionId}</span> : null}
                    </div>
                  </td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 800 }}>{formatMoney(item.amount)}</td>
                </tr>
              )})}
            </tbody>
          </table>
          {filtered.length === 0 ? <p style={s.empty}>No expenses found for current filters.</p> : null}
        </div>
      </div>
    </AccountLayout>
  )
}

const s = {
  page: { width: '100%', display: 'flex', flexDirection: 'column', gap: 20 },
  hero: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'linear-gradient(135deg, rgb(26, 61, 31) 0%, rgb(45, 122, 51) 100%)', borderRadius: 24, padding: '24px 28px' },
  heroLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  heroIcon: { width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#fde68a' },
  heroActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  refreshBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.14)', color: '#fff', borderRadius: 999, padding: '10px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#ffffff', color: '#92400e', border: 'none', borderRadius: 999, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  noticeText: { margin: 0, padding: '10px 12px', borderRadius: 10, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 12.5, fontWeight: 600 },
  errorText: { margin: 0, padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12.5, fontWeight: 600 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 },
  sumCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 16, padding: '14px 16px' },
  sumLabel: { margin: 0, fontSize: 11, fontWeight: 700, color: '#7a8a7a', textTransform: 'uppercase', letterSpacing: '0.5px' },
  sumVal: { margin: '6px 0 0', fontSize: 20, fontWeight: 800, color: '#1a3d1f' },
  sumSub: { margin: '4px 0 0', fontSize: 11, color: '#8aa88a' },
  catGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 },
  catCard: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 12 },
  catName: { margin: 0, fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.4px' },
  catAmt: { margin: '6px 0 0', fontSize: 16, fontWeight: 800, color: '#b45309' },
  toolbar: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #d4dfd4', borderRadius: 999, padding: '8px 12px' },
  searchInput: { border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 12.5, color: '#1a3d1f', fontFamily: 'inherit' },
  filterInput: { border: '1px solid #d4dfd4', borderRadius: 10, padding: '9px 10px', fontSize: 12.5, color: '#1a3d1f', fontFamily: 'inherit', background: '#fff' },
  tableCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 16, overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 940 },
  thead: { background: '#fffbeb' },
  th: { padding: '11px 12px', fontSize: 11, fontWeight: 700, color: '#415443', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.4px' },
  trow: { borderTop: '1px solid #dde7dd' },
  td: { padding: '11px 12px', fontSize: 12.5, color: '#1a3d1f', verticalAlign: 'top' },
  expTag: { background: '#fffbeb', color: '#92400e', borderRadius: 8, padding: '3px 8px', fontSize: 11.5, fontWeight: 700 },
  modeTag: { background: '#e8eee8', color: '#2d7a33', borderRadius: 999, padding: '3px 10px', fontSize: 11.5, fontWeight: 700, display: 'inline-block' },
  muted: { fontSize: 11.5, color: '#64748b' },
  empty: { margin: 0, padding: '12px 14px', color: '#6b7280', fontSize: 12.5 },
}

