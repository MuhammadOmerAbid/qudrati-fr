'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountLayout from '@/presentation/layouts/AccountLayout'
import { Users, Plus, Search, Pencil, Trash2, Wallet } from 'lucide-react'
import {
  deleteAccountsPayableTransaction,
  isAccountsPayableLocked,
  isPostableAccount,
  loadAccountsPayableFromStorage,
  loadChartAccountsFromStorage,
  postAccountsPayablePayment,
} from '@/application/services/accounts/accountsWorkflow'

const toMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100
const toKey = (value) => String(value || '').trim().toLowerCase()

function isCashOrBankName(value) {
  const key = toKey(value)
  return key.includes('cash') || key.includes('bank')
}

function formatMoney(value) {
  const amount = toMoney(value)
  if (Number.isInteger(amount)) return amount.toLocaleString()
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getLockText(item) {
  const lockMs = Date.parse(String(item.lockedAt || ''))
  if (!Number.isFinite(lockMs)) return 'Editable'
  const left = lockMs - Date.now()
  if (left <= 0) return 'Locked'
  const hours = Math.max(1, Math.ceil(left / (60 * 60 * 1000)))
  return `Editable (${hours}h left)`
}

function AccountsPayablePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'

  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [notice, setNotice] = useState('')
  const [errorText, setErrorText] = useState('')
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [paymentForm, setPaymentForm] = useState({
    portion: 'current',
    date: new Date().toISOString().slice(0, 10),
    paymentAccountCode: '',
    amount: '',
    description: '',
    reference: '',
  })

  const refreshState = () => {
    const list = loadAccountsPayableFromStorage()
      .filter((item) => !item.deletedAt)
      .sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')))
    setTransactions(list)
    setAccounts(loadChartAccountsFromStorage())
  }

  useEffect(() => {
    refreshState()
  }, [])

  useEffect(() => {
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
    const noticeMode = String(searchParams.get('notice') || '').trim().toLowerCase()
    const payableId = String(searchParams.get('ap') || '').trim()
    if (!noticeMode) return

    if (noticeMode === 'created') {
      setNotice(payableId ? `Accounts Payable ${payableId} created and posted to GL.` : 'Accounts Payable created and posted to GL.')
      return
    }
    if (noticeMode === 'updated') {
      setNotice(payableId ? `Accounts Payable ${payableId} updated and GL voucher refreshed.` : 'Accounts Payable updated and GL voucher refreshed.')
      return
    }
  }, [searchParams])

  const paymentAccountOptions = useMemo(() => (
    accounts
      .filter((account) => (
        !account.deletedAt
        && account.active !== false
        && isPostableAccount(account, accounts)
        && account.type === 'Assets'
        && account.subcategory === 'Current Assets'
      ))
      .sort((a, b) => {
        const aPriority = isCashOrBankName(a.name) ? 0 : 1
        const bPriority = isCashOrBankName(b.name) ? 0 : 1
        if (aPriority !== bPriority) return aPriority - bPriority
        return String(a.code).localeCompare(String(b.code), undefined, { numeric: true })
      })
  ), [accounts])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return transactions
      .filter((item) => {
        if (statusFilter === 'all') return true
        return String(item.status || '').toLowerCase() === statusFilter
      })
      .filter((item) => {
        if (!needle) return true
        const haystack = `${item.id} ${item.voucherNo} ${item.supplierName} ${item.itemType} ${item.purchaseAccountName} ${item.status}`.toLowerCase()
        return haystack.includes(needle)
      })
  }, [transactions, search, statusFilter])

  const summary = useMemo(() => {
    const totalCost = toMoney(transactions.reduce((sum, item) => toMoney(sum + toMoney(item.totalCost)), 0))
    const totalAdvance = toMoney(transactions.reduce((sum, item) => toMoney(sum + toMoney(item.advancePaid)), 0))
    const totalOutstanding = toMoney(transactions.reduce((sum, item) => toMoney(sum + toMoney(item.outstandingAmount)), 0))
    const currentOutstanding = toMoney(transactions.reduce((sum, item) => toMoney(sum + toMoney(item.currentOutstanding)), 0))
    const nonCurrentOutstanding = toMoney(transactions.reduce((sum, item) => toMoney(sum + toMoney(item.nonCurrentOutstanding)), 0))

    return {
      totalCost,
      totalAdvance,
      totalOutstanding,
      currentOutstanding,
      nonCurrentOutstanding,
    }
  }, [transactions])

  const openPaymentModal = (item, defaultPortion = 'current') => {
    if (!item) return
    const portion = defaultPortion === 'non-current' ? 'non-current' : 'current'
    setPaymentTarget(item)
    setPaymentForm({
      portion,
      date: new Date().toISOString().slice(0, 10),
      paymentAccountCode: paymentAccountOptions[0]?.code || '',
      amount: '',
      description: '',
      reference: '',
    })
    setErrorText('')
  }

  const closePaymentModal = () => {
    setPaymentTarget(null)
    setErrorText('')
  }

  const savePayment = () => {
    if (!paymentTarget) return

    const amount = toMoney(paymentForm.amount)
    if (amount <= 0) {
      setErrorText('Payment amount must be greater than zero.')
      return
    }
    if (!paymentForm.paymentAccountCode) {
      setErrorText('Select a payment account.')
      return
    }

    const selectedOutstanding = paymentForm.portion === 'non-current'
      ? toMoney(paymentTarget.nonCurrentOutstanding)
      : toMoney(paymentTarget.currentOutstanding)

    if (amount > selectedOutstanding) {
      setErrorText('Payment amount cannot exceed selected liability outstanding.')
      return
    }

    const actor = user?.name || user?.username || 'system'
    try {
      const result = postAccountsPayablePayment({
        payableId: paymentTarget.id,
        portion: paymentForm.portion,
        date: paymentForm.date,
        amount,
        paymentAccountCode: paymentForm.paymentAccountCode,
        description: paymentForm.description,
        reference: paymentForm.reference,
        user: actor,
      })
      setNotice(`Payment posted (${result.voucherId}) for ${paymentTarget.id}.`)
      refreshState()
      closePaymentModal()
    } catch (error) {
      setErrorText(error?.message || 'Unable to post payable payment')
    }
  }

  const removeTransaction = (item) => {
    if (!item) return
    if (!window.confirm(`Delete ${item.id}? This removes linked GL vouchers.`)) return

    const actor = user?.name || user?.username || 'system'
    try {
      deleteAccountsPayableTransaction(item.id, actor)
      setNotice(`Accounts Payable ${item.id} deleted.`)
      refreshState()
    } catch (error) {
      setErrorText(error?.message || 'Unable to delete accounts payable entry')
    }
  }

  return (
    <AccountLayout>
      <div style={s.page}>
        <section style={s.hero}>
          <div style={s.heroLeft}>
            <div style={s.heroIcon}><Users size={22} color="#2a6f31" /></div>
            <div>
              <h1 style={s.title}>Accounts Payable</h1>
              <p style={s.subtitle}>Full-cost purchase recognition, advance handling, and current/non-current liability management</p>
            </div>
          </div>
          {isSuperuser ? (
            <button style={s.addBtn} onClick={() => router.push('/accounts/payable/new')}>
              <Plus size={15} /> New Payable Entry
            </button>
          ) : null}
        </section>

        <div style={s.summaryGrid}>
          <div style={s.sumCard}>
            <p style={s.sumLabel}>Total Cost</p>
            <p style={s.sumVal}>Rs {formatMoney(summary.totalCost)}</p>
          </div>
          <div style={{ ...s.sumCard, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <p style={{ ...s.sumLabel, color: '#16a34a' }}>Advance Paid</p>
            <p style={{ ...s.sumVal, color: '#16a34a' }}>Rs {formatMoney(summary.totalAdvance)}</p>
          </div>
          <div style={{ ...s.sumCard, background: '#fef2f2', border: '1px solid #fecaca' }}>
            <p style={{ ...s.sumLabel, color: '#dc2626' }}>Outstanding</p>
            <p style={{ ...s.sumVal, color: '#dc2626' }}>Rs {formatMoney(summary.totalOutstanding)}</p>
          </div>
          <div style={s.sumCard}>
            <p style={s.sumLabel}>Current / Non-Current</p>
            <p style={{ ...s.sumVal, fontSize: 16 }}>Rs {formatMoney(summary.currentOutstanding)} / {formatMoney(summary.nonCurrentOutstanding)}</p>
          </div>
        </div>

        <div style={s.toolbar}>
          <div style={s.tabs}>
            <button style={{ ...s.tab, ...(statusFilter === 'all' ? s.tabActive : {}) }} onClick={() => setStatusFilter('all')}>All</button>
            <button style={{ ...s.tab, ...(statusFilter === 'unpaid' ? s.tabActive : {}) }} onClick={() => setStatusFilter('unpaid')}>Unpaid</button>
            <button style={{ ...s.tab, ...(statusFilter === 'partially paid' ? s.tabActive : {}) }} onClick={() => setStatusFilter('partially paid')}>Partially Paid</button>
            <button style={{ ...s.tab, ...(statusFilter === 'paid' ? s.tabActive : {}) }} onClick={() => setStatusFilter('paid')}>Paid</button>
          </div>

          <div style={s.searchWrap}>
            <Search size={14} color="#7a8a7a" />
            <input
              style={s.searchInput}
              placeholder="Search voucher/supplier/account..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div style={s.tableCard}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>Voucher No</th>
                <th style={s.th}>Supplier</th>
                <th style={s.th}>Purchase Account</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Total Cost</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Advance Paid</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Current Liability</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Non-Current Liability</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Status</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Created Date</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const locked = isAccountsPayableLocked(item)
                const isJournalInferred = item.origin === 'journal_inferred'
                const statusColor = item.status === 'Paid'
                  ? { color: '#16a34a', bg: '#f0fdf4' }
                  : item.status === 'Partially Paid'
                    ? { color: '#b45309', bg: '#fffbeb' }
                    : { color: '#dc2626', bg: '#fef2f2' }

                return (
                  <tr key={item.id} style={s.trow}>
                    <td style={s.td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={s.voucherTag}>{item.id}</span>
                        <span style={s.mutedText}>GL: {item.voucherNo}</span>
                        {isJournalInferred ? <span style={s.mutedText}>Auto from Journal</span> : null}
                      </div>
                    </td>
                    <td style={{ ...s.td, fontWeight: 700 }}>{item.supplierName}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span>{item.purchaseAccountName || item.purchaseAccountCode}</span>
                        <span style={s.mutedText}>{item.itemType || '-'}</span>
                      </div>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>Rs {formatMoney(item.totalCost)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>Rs {formatMoney(item.advancePaid)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                        <span style={{ fontWeight: 700 }}>Rs {formatMoney(item.currentLiability)}</span>
                        <span style={s.mutedText}>Out: {formatMoney(item.currentOutstanding)}</span>
                      </div>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                        <span style={{ fontWeight: 700 }}>Rs {formatMoney(item.nonCurrentLiability)}</span>
                        <span style={s.mutedText}>Out: {formatMoney(item.nonCurrentOutstanding)}</span>
                      </div>
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      <span style={{ ...s.statusTag, color: statusColor.color, background: statusColor.bg }}>{item.status}</span>
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                        <span>{String(item.createdAt || '').slice(0, 10) || '-'}</span>
                        <span style={locked ? s.lockedNote : s.editableNote}>{getLockText(item)}</span>
                      </div>
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      <div style={s.actions}>
                        {!isJournalInferred && item.currentOutstanding > 0 ? (
                          <button style={s.payBtn} onClick={() => openPaymentModal(item, 'current')} title="Pay Current Liability">
                            <Wallet size={12} /> Pay C
                          </button>
                        ) : null}
                        {!isJournalInferred && item.nonCurrentOutstanding > 0 ? (
                          <button style={s.payBtn} onClick={() => openPaymentModal(item, 'non-current')} title="Pay Non-Current Liability">
                            <Wallet size={12} /> Pay N
                          </button>
                        ) : null}
                        {isSuperuser && !isJournalInferred ? (
                          <button style={s.iconBtn} onClick={() => router.push(`/accounts/payable/new?edit=${encodeURIComponent(item.id)}`)} disabled={locked} title="Edit">
                            <Pencil size={13} />
                          </button>
                        ) : null}
                        {isSuperuser && !isJournalInferred ? (
                          <button style={s.iconBtnDanger} onClick={() => removeTransaction(item)} disabled={locked} title="Delete">
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? <p style={s.empty}>No payable transactions found.</p> : null}
        </div>

        {notice ? <p style={s.noticeText}>{notice}</p> : null}
        {errorText && !paymentTarget ? <p style={s.errorText}>{errorText}</p> : null}

        {paymentTarget ? (
          <div style={s.modalOverlay} onClick={closePaymentModal}>
            <div style={s.modal} onClick={(event) => event.stopPropagation()}>
              <h3 style={s.modalTitle}>Post Liability Payment</h3>
              <p style={s.modalSub}>{paymentTarget.id} | {paymentTarget.supplierName}</p>

              <div style={s.formGrid}>
                <div style={s.field}>
                  <label style={s.label}>Portion</label>
                  <select
                    style={s.input}
                    value={paymentForm.portion}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, portion: event.target.value }))}
                  >
                    <option value="current">Current Liability</option>
                    <option value="non-current">Non-Current Liability</option>
                  </select>
                </div>

                <div style={s.field}>
                  <label style={s.label}>Payment Date</label>
                  <input
                    type="date"
                    style={s.input}
                    value={paymentForm.date}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </div>

                <div style={s.field}>
                  <label style={s.label}>Payment Account *</label>
                  <select
                    style={s.input}
                    value={paymentForm.paymentAccountCode}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, paymentAccountCode: event.target.value }))}
                  >
                    <option value="">Select payment account</option>
                    {paymentAccountOptions.map((account) => (
                      <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
                    ))}
                  </select>
                </div>

                <div style={s.field}>
                  <label style={s.label}>Amount *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={s.input}
                    value={paymentForm.amount}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))}
                    placeholder="0"
                  />
                </div>

                <div style={{ ...s.field, gridColumn: '1 / -1' }}>
                  <label style={s.label}>Description</label>
                  <input
                    style={s.input}
                    value={paymentForm.description}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Optional payment narration"
                  />
                </div>

                <div style={{ ...s.field, gridColumn: '1 / -1' }}>
                  <label style={s.label}>Reference</label>
                  <input
                    style={s.input}
                    value={paymentForm.reference}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, reference: event.target.value }))}
                    placeholder="Cheque No / Bank Ref"
                  />
                </div>
              </div>

              <p style={s.helperText}>
                Selected outstanding: Rs {formatMoney(paymentForm.portion === 'non-current' ? paymentTarget.nonCurrentOutstanding : paymentTarget.currentOutstanding)}
              </p>
              {errorText ? <p style={s.errorText}>{errorText}</p> : null}

              <div style={s.modalActions}>
                <button style={s.cancelBtn} onClick={closePaymentModal}>Cancel</button>
                <button style={s.saveBtn} onClick={savePayment}>Post Payment</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AccountLayout>
  )
}

function AccountsPayablePageLoading() {
  return (
    <AccountLayout>
      <div style={{ padding: 20, color: '#64748b', fontSize: 14 }}>Loading accounts payable...</div>
    </AccountLayout>
  )
}

export default function AccountsPayablePage() {
  return (
    <Suspense fallback={<AccountsPayablePageLoading />}>
      <AccountsPayablePageContent />
    </Suspense>
  )
}

const s = {
  page: { width: '100%', display: 'flex', flexDirection: 'column', gap: 20 },
  hero: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'linear-gradient(135deg, rgb(26, 61, 31) 0%, rgb(45, 122, 51) 100%)', borderRadius: 24, padding: 'clamp(14px, 3vw, 24px)' },
  heroLeft: { display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: '1 1 320px' },
  heroIcon: { width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { margin: 0, fontSize: 'clamp(18px, 3.2vw, 22px)', fontWeight: 800, color: '#fff' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#d4dfd4' },
  addBtn: { display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', color: '#2a6f31', border: 'none', borderRadius: '999px', padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  sumCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 20, padding: '16px 20px' },
  sumLabel: { margin: 0, fontSize: 11, fontWeight: 700, color: '#7a8a7a', textTransform: 'uppercase', letterSpacing: '0.5px' },
  sumVal: { margin: '6px 0 0', fontSize: 22, fontWeight: 800, color: '#1a3d1f' },
  toolbar: { display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  tabs: { display: 'flex', gap: 0, background: '#e8eee8', borderRadius: 40, padding: 4, flexWrap: 'wrap' },
  tab: { padding: '8px 18px', borderRadius: 999, border: 'none', background: 'transparent', color: '#7a8a7a', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  tabActive: { background: '#2d7a33', color: '#fff' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 40, padding: '8px 16px', flex: '0 1 280px' },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#1a3d1f', flex: 1, fontFamily: 'inherit' },
  tableCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 24, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#e8eee8' },
  th: { padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#415443', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' },
  trow: { borderTop: '1px solid #e2e8e2' },
  td: { padding: '11px 14px', fontSize: 13, color: '#1a3d1f', verticalAlign: 'top' },
  voucherTag: { background: '#eef2ee', color: '#2a6f31', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, display: 'inline-block' },
  mutedText: { fontSize: 11, color: '#64748b' },
  statusTag: { borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 },
  lockedNote: { fontSize: 11, fontWeight: 700, color: '#b91c1c' },
  editableNote: { fontSize: 11, fontWeight: 700, color: '#166534' },
  actions: { display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  payBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', fontSize: 11, fontWeight: 700, padding: '5px 10px', cursor: 'pointer' },
  iconBtn: { width: 28, height: 28, borderRadius: 8, border: '1px solid #d4dfd4', background: '#fff', color: '#1a3d1f', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  iconBtnDanger: { width: 28, height: 28, borderRadius: 8, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  empty: { textAlign: 'center', padding: 24, color: '#8aa88a', fontSize: 14 },
  noticeText: { margin: 0, fontSize: 12.5, fontWeight: 600, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 12px' },
  errorText: { margin: 0, fontSize: 12.5, fontWeight: 600, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 12px' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: '#fff', borderRadius: 24, padding: 26, width: '100%', maxWidth: 560, boxShadow: '0 22px 56px rgba(0,0,0,0.2)' },
  modalTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: '#1a3d1f' },
  modalSub: { margin: '4px 0 14px', fontSize: 12, color: '#64748b' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { padding: '10px 12px', border: '1.5px solid #d4dfd4', borderRadius: 10, fontSize: 13, color: '#1a3d1f', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  helperText: { margin: '10px 0 0', fontSize: 12.5, fontWeight: 600, color: '#2d7a33' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  cancelBtn: { padding: '9px 18px', borderRadius: 999, border: '1px solid #d4dfd4', background: '#f8faf8', color: '#415443', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  saveBtn: { padding: '9px 18px', borderRadius: 999, border: 'none', background: '#2d7a33', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
}

