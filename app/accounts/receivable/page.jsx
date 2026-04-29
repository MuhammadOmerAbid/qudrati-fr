'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountLayout from '@/presentation/layouts/AccountLayout'
import { UserCheck, Plus, Search, Pencil, Trash2, Wallet, Users } from 'lucide-react'
import {
  deleteAccountsReceivableTransaction,
  isAccountsReceivableLocked,
  isPostableAccount,
  loadAccountsReceivableFromStorage,
  loadChartAccountsFromStorage,
  loadReceivableCustomersFromStorage,
  postAccountsReceivablePayment,
  upsertReceivableCustomerMaster,
} from '@/application/services/accounts/accountsWorkflow'

const toMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100
const toKey = (value) => String(value || '').trim().toLowerCase()
const DAY_MS = 24 * 60 * 60 * 1000
const AGING_BUCKETS = ['Current', '1-30', '31-60', '61-90', '90+']
const AGING_COLORS = {
  Current: { color: '#166534', bg: '#f0fdf4' },
  '1-30': { color: '#2d7a33', bg: '#ecfdf5' },
  '31-60': { color: '#b45309', bg: '#fffbeb' },
  '61-90': { color: '#c2410c', bg: '#fff7ed' },
  '90+': { color: '#b91c1c', bg: '#fef2f2' },
  Clear: { color: '#64748b', bg: '#f1f5f9' },
}
const AGING_RANK = { Clear: 0, Current: 1, '1-30': 2, '31-60': 3, '61-90': 4, '90+': 5 }

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

function getAgingMeta(item, nowMs = Date.now()) {
  const outstanding = toMoney(item?.outstandingAmount)
  if (outstanding <= 0) return { bucket: 'Clear', overdueDays: 0 }

  const dueMs = Date.parse(String(item?.dueDate || item?.date || ''))
  if (!Number.isFinite(dueMs)) return { bucket: 'Current', overdueDays: 0 }

  const diffMs = nowMs - dueMs
  const days = Math.floor(diffMs / DAY_MS)
  if (days <= 0) return { bucket: 'Current', overdueDays: 0 }
  if (days <= 30) return { bucket: '1-30', overdueDays: days }
  if (days <= 60) return { bucket: '31-60', overdueDays: days }
  if (days <= 90) return { bucket: '61-90', overdueDays: days }
  return { bucket: '90+', overdueDays: days }
}

function AccountsReceivablePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'

  const [transactions, setTransactions] = useState([])
  const [customers, setCustomers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [panelTab, setPanelTab] = useState('invoices')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [notice, setNotice] = useState('')
  const [errorText, setErrorText] = useState('')
  const [statementCustomer, setStatementCustomer] = useState('')

  const [paymentTarget, setPaymentTarget] = useState(null)
  const [paymentForm, setPaymentForm] = useState({
    portion: 'current',
    date: new Date().toISOString().slice(0, 10),
    paymentAccountCode: '',
    amount: '',
    description: '',
    reference: '',
  })

  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerForm, setCustomerForm] = useState({
    name: '',
    contact: '',
    creditLimit: '',
    notes: '',
  })
  const [customerErrors, setCustomerErrors] = useState({})

  const refreshState = () => {
    const list = loadAccountsReceivableFromStorage()
      .filter((item) => !item.deletedAt)
      .sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')))
    setTransactions(list)
    setCustomers(loadReceivableCustomersFromStorage())
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
    const receivableId = String(searchParams.get('ar') || '').trim()
    if (!noticeMode) return

    if (noticeMode === 'created') {
      setNotice(receivableId ? `Accounts Receivable ${receivableId} created and posted to GL.` : 'Accounts Receivable created and posted to GL.')
      return
    }
    if (noticeMode === 'updated') {
      setNotice(receivableId ? `Accounts Receivable ${receivableId} updated and GL voucher refreshed.` : 'Accounts Receivable updated and GL voucher refreshed.')
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

  const filteredInvoices = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return transactions
      .filter((item) => {
        if (statusFilter === 'all') return true
        return String(item.status || '').toLowerCase() === statusFilter
      })
      .filter((item) => {
        if (!needle) return true
        const haystack = `${item.id} ${item.voucherNo} ${item.customerName} ${item.itemType} ${item.salesAccountName} ${item.currentReceivableAccountName} ${item.nonCurrentReceivableAccountName} ${item.status}`.toLowerCase()
        return haystack.includes(needle)
      })
  }, [transactions, search, statusFilter])

  const summary = useMemo(() => {
    const totalSale = toMoney(transactions.reduce((sum, item) => toMoney(sum + toMoney(item.totalSale)), 0))
    const totalCollected = toMoney(transactions.reduce((sum, item) => toMoney(sum + toMoney(item.advanceReceived) + toMoney(item.receivedAmount)), 0))
    const totalOutstanding = toMoney(transactions.reduce((sum, item) => toMoney(sum + toMoney(item.outstandingAmount)), 0))
    const currentOutstanding = toMoney(transactions.reduce((sum, item) => toMoney(sum + toMoney(item.currentOutstanding)), 0))
    const nonCurrentOutstanding = toMoney(transactions.reduce((sum, item) => toMoney(sum + toMoney(item.nonCurrentOutstanding)), 0))
    const overdueOutstanding = toMoney(transactions.reduce((sum, item) => {
      const aging = getAgingMeta(item)
      if (aging.overdueDays <= 0) return sum
      return toMoney(sum + toMoney(item.outstandingAmount))
    }, 0))

    return {
      totalSale,
      totalCollected,
      totalOutstanding,
      currentOutstanding,
      nonCurrentOutstanding,
      overdueOutstanding,
    }
  }, [transactions])

  const customerStats = useMemo(() => {
    const map = new Map()

    customers.forEach((customer) => {
      map.set(toKey(customer.name), {
        id: customer.id,
        name: customer.name,
        contact: customer.contact || '-',
        notes: customer.notes || '',
        creditLimit: toMoney(customer.creditLimit || 0),
        totalInvoices: 0,
        totalSale: 0,
        collected: 0,
        outstanding: 0,
        worstBucket: 'Clear',
      })
    })

    transactions.forEach((item) => {
      const key = toKey(item.customerName)
      if (!key) return

      if (!map.has(key)) {
        map.set(key, {
          id: `derived-${key}`,
          name: item.customerName,
          contact: '-',
          notes: '',
          creditLimit: toMoney(item.creditLimit || 0),
          totalInvoices: 0,
          totalSale: 0,
          collected: 0,
          outstanding: 0,
          worstBucket: 'Clear',
        })
      }

      const entry = map.get(key)
      entry.totalInvoices += 1
      entry.totalSale = toMoney(entry.totalSale + toMoney(item.totalSale))
      entry.collected = toMoney(entry.collected + toMoney(item.advanceReceived) + toMoney(item.receivedAmount))
      entry.outstanding = toMoney(entry.outstanding + toMoney(item.outstandingAmount))
      if (!entry.creditLimit && item.creditLimit) entry.creditLimit = toMoney(item.creditLimit)

      const aging = getAgingMeta(item)
      if (AGING_RANK[aging.bucket] > AGING_RANK[entry.worstBucket]) entry.worstBucket = aging.bucket
    })

    return Array.from(map.values())
      .map((item) => {
        const availableCredit = item.creditLimit > 0 ? toMoney(item.creditLimit - item.outstanding) : null
        return {
          ...item,
          availableCredit,
          overLimit: availableCredit != null && availableCredit < 0,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [customers, transactions])

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return customerStats
    return customerStats.filter((item) => {
      const haystack = `${item.name} ${item.contact} ${item.notes}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [customerStats, search])

  const agingRows = useMemo(() => (
    transactions
      .map((item) => {
        const aging = getAgingMeta(item)
        return {
          ...item,
          bucket: aging.bucket,
          overdueDays: aging.overdueDays,
        }
      })
      .filter((item) => item.outstandingAmount > 0)
      .filter((item) => {
        const needle = search.trim().toLowerCase()
        if (!needle) return true
        const haystack = `${item.id} ${item.customerName} ${item.bucket}`.toLowerCase()
        return haystack.includes(needle)
      })
      .sort((a, b) => b.overdueDays - a.overdueDays)
  ), [transactions, search])

  const agingSummary = useMemo(() => {
    const start = {
      Current: { amount: 0, count: 0 },
      '1-30': { amount: 0, count: 0 },
      '31-60': { amount: 0, count: 0 },
      '61-90': { amount: 0, count: 0 },
      '90+': { amount: 0, count: 0 },
    }

    agingRows.forEach((item) => {
      const bucket = AGING_BUCKETS.includes(item.bucket) ? item.bucket : 'Current'
      start[bucket].amount = toMoney(start[bucket].amount + toMoney(item.outstandingAmount))
      start[bucket].count += 1
    })

    return start
  }, [agingRows])

  const statementCustomers = useMemo(() => customerStats.map((item) => item.name), [customerStats])

  useEffect(() => {
    if (statementCustomers.length === 0) {
      setStatementCustomer('')
      return
    }

    const exists = statementCustomers.some((name) => toKey(name) === toKey(statementCustomer))
    if (!exists) setStatementCustomer(statementCustomers[0])
  }, [statementCustomers, statementCustomer])

  const statementData = useMemo(() => {
    const selected = String(statementCustomer || '').trim()
    if (!selected) return null

    const list = transactions
      .filter((item) => toKey(item.customerName) === toKey(selected))
      .sort((a, b) => Date.parse(String(a.date || a.createdAt || '')) - Date.parse(String(b.date || b.createdAt || '')))

    const rows = []
    let balance = 0
    let totalSale = 0
    let totalAdvance = 0
    let totalNetInvoiced = 0
    let totalPayments = 0

    list.forEach((item) => {
      totalSale = toMoney(totalSale + toMoney(item.totalSale))
      totalAdvance = toMoney(totalAdvance + toMoney(item.advanceReceived))

      const netReceivable = toMoney(item.netReceivable)
      if (netReceivable > 0) {
        balance = toMoney(balance + netReceivable)
        totalNetInvoiced = toMoney(totalNetInvoiced + netReceivable)
        rows.push({
          rowId: `${item.id}-invoice`,
          date: item.date,
          reference: item.id,
          narration: `Sales invoice (${item.itemType || 'Item'})`,
          debit: netReceivable,
          credit: 0,
          balance,
        })
      }

      const payments = Array.isArray(item.payments)
        ? [...item.payments]
          .filter((payment) => !payment.deletedAt)
          .sort((a, b) => Date.parse(String(a.date || a.createdAt || '')) - Date.parse(String(b.date || b.createdAt || '')))
        : []

      payments.forEach((payment) => {
        const amount = toMoney(payment.amount)
        totalPayments = toMoney(totalPayments + amount)
        balance = toMoney(balance - amount)
        const paymentPortion = String(payment.portion || 'current').trim().toLowerCase() === 'non-current' ? 'Non-current' : 'Current'
        rows.push({
          rowId: payment.id,
          date: payment.date,
          reference: payment.voucherNo || payment.id,
          narration: payment.description || `${paymentPortion} AR payment received`,
          debit: 0,
          credit: amount,
          balance,
        })
      })
    })

    return {
      rows,
      totalSale,
      totalAdvance,
      totalNetInvoiced,
      totalPayments,
      outstanding: Math.max(0, toMoney(totalNetInvoiced - totalPayments)),
    }
  }, [transactions, statementCustomer])

  const openPaymentModal = (item, defaultPortion = 'auto') => {
    if (!item) return
    const preferredPortion = defaultPortion === 'non-current'
      ? 'non-current'
      : (item.currentOutstanding > 0 ? 'current' : 'non-current')
    setPaymentTarget(item)
    setPaymentForm({
      portion: preferredPortion,
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
      setErrorText('Payment amount cannot exceed selected receivable outstanding.')
      return
    }

    const actor = user?.name || user?.username || 'system'
    try {
      const result = postAccountsReceivablePayment({
        receivableId: paymentTarget.id,
        portion: paymentForm.portion,
        date: paymentForm.date,
        amount,
        paymentAccountCode: paymentForm.paymentAccountCode,
        description: paymentForm.description,
        reference: paymentForm.reference,
        user: actor,
      })
      setNotice(`Customer ${paymentForm.portion === 'non-current' ? 'non-current' : 'current'} AR payment posted (${result.voucherId}) for ${paymentTarget.id}.`)
      refreshState()
      closePaymentModal()
    } catch (error) {
      setErrorText(error?.message || 'Unable to post customer payment')
    }
  }

  const removeTransaction = (item) => {
    if (!item) return
    if (!window.confirm(`Delete ${item.id}? This removes linked GL vouchers.`)) return

    const actor = user?.name || user?.username || 'system'
    try {
      deleteAccountsReceivableTransaction(item.id, actor)
      setNotice(`Accounts Receivable ${item.id} deleted.`)
      refreshState()
    } catch (error) {
      setErrorText(error?.message || 'Unable to delete accounts receivable entry')
    }
  }

  const openCustomerModal = (customer = null) => {
    setCustomerForm({
      name: customer?.name || '',
      contact: customer?.contact || '',
      creditLimit: customer?.creditLimit ? String(customer.creditLimit) : '',
      notes: customer?.notes || '',
    })
    setCustomerErrors({})
    setErrorText('')
    setCustomerModalOpen(true)
  }

  const closeCustomerModal = () => {
    setCustomerModalOpen(false)
    setCustomerErrors({})
  }

  const saveCustomer = () => {
    const nextErrors = {}
    const name = String(customerForm.name || '').trim()
    const creditValue = toMoney(Number(customerForm.creditLimit) || 0)

    if (!name) nextErrors.name = 'Customer name is required'
    if (creditValue < 0) nextErrors.creditLimit = 'Credit limit cannot be negative'

    setCustomerErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const actor = user?.name || user?.username || 'system'
    try {
      const record = upsertReceivableCustomerMaster({
        name,
        contact: String(customerForm.contact || '').trim() || '-',
        creditLimit: creditValue,
        notes: String(customerForm.notes || '').trim(),
        user: actor,
      })
      setNotice(`Customer master saved: ${record.name}.`)
      refreshState()
      setStatementCustomer(record.name)
      closeCustomerModal()
    } catch (error) {
      setErrorText(error?.message || 'Unable to save customer master')
    }
  }

  const searchPlaceholder = panelTab === 'customers'
    ? 'Search customer/contact...'
    : 'Search invoice/customer...'

  return (
    <AccountLayout>
      <div style={s.page}>
        <section style={s.hero}>
          <div style={s.heroLeft}>
            <div style={s.heroIcon}><UserCheck size={22} color="#2a6f31" /></div>
            <div>
              <h1 style={s.title}>Accounts Receivable</h1>
              <p style={s.subtitle}>Customer invoices, receipts, and outstanding balances</p>
            </div>
          </div>

          {isSuperuser ? (
            <div style={s.heroActions}>
              <button style={s.secondaryBtn} onClick={() => openCustomerModal()}>
                <Users size={14} /> Customer Master
              </button>
              <button style={s.addBtn} onClick={() => router.push('/accounts/receivable/new')}>
                <Plus size={15} /> New Receivable Entry
              </button>
            </div>
          ) : null}
        </section>

        <div style={s.summaryGrid}>
          <div style={s.sumCard}>
            <p style={s.sumLabel}>Total Sales</p>
            <p style={s.sumVal}>Rs {formatMoney(summary.totalSale)}</p>
          </div>
          <div style={{ ...s.sumCard, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <p style={{ ...s.sumLabel, color: '#166534' }}>Collected (Advance + Receipts)</p>
            <p style={{ ...s.sumVal, color: '#166534' }}>Rs {formatMoney(summary.totalCollected)}</p>
          </div>
          <div style={{ ...s.sumCard, background: '#fef2f2', border: '1px solid #fecaca' }}>
            <p style={{ ...s.sumLabel, color: '#b91c1c' }}>Outstanding Receivable</p>
            <p style={{ ...s.sumVal, color: '#b91c1c' }}>Rs {formatMoney(summary.totalOutstanding)}</p>
          </div>
          <div style={s.sumCard}>
            <p style={s.sumLabel}>Current / Non-Current Out.</p>
            <p style={{ ...s.sumVal, fontSize: 18 }}>
              Rs {formatMoney(summary.currentOutstanding)} / {formatMoney(summary.nonCurrentOutstanding)}
            </p>
          </div>
        </div>

        <div style={s.toolbar}>
          <div style={s.tabs}>
            <button style={{ ...s.tab, ...(panelTab === 'invoices' ? s.tabActive : {}) }} onClick={() => setPanelTab('invoices')}>Invoices</button>
            <button style={{ ...s.tab, ...(panelTab === 'customers' ? s.tabActive : {}) }} onClick={() => setPanelTab('customers')}>Customer Master</button>
          </div>

          <div style={s.toolbarRight}>
            {panelTab === 'invoices' ? (
              <select style={s.filterSelect} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="unpaid">Unpaid</option>
                <option value="partially received">Partially Received</option>
                <option value="paid">Paid</option>
              </select>
            ) : null}
            <div style={s.searchWrap}>
              <Search size={14} color="#7a8a7a" />
              <input
                style={s.searchInput}
                placeholder={searchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </div>

        {panelTab === 'invoices' ? (
          <>
            <div style={s.tableCard}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>Invoice</th>
                    <th style={s.th}>Customer</th>
                    <th style={s.th}>Invoice / Due</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Net AR (C / N)</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Received</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Outstanding</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Status</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((item) => {
                    const locked = isAccountsReceivableLocked(item)
                    const isJournalInferred = item.origin === 'journal_inferred'
                    const statusColor = item.status === 'Paid'
                      ? { color: '#16a34a', bg: '#f0fdf4' }
                      : item.status === 'Partially Received'
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
                        <td style={{ ...s.td, fontWeight: 700 }}>{item.customerName}</td>
                        <td style={s.td}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span>{item.date || '-'}</span>
                            <span style={s.mutedText}>Due: {item.dueDate || '-'}</span>
                          </div>
                        </td>
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                            <span style={{ fontWeight: 700 }}>Rs {formatMoney(item.netReceivable)}</span>
                            <span style={s.mutedText}>{formatMoney(item.currentReceivable)} / {formatMoney(item.nonCurrentReceivable)}</span>
                          </div>
                        </td>
                        <td style={{ ...s.td, textAlign: 'right', color: '#2563eb', fontWeight: 700 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                            <span>Rs {formatMoney(item.receivedAmount)}</span>
                            <span style={s.mutedText}>{formatMoney(item.currentReceived)} / {formatMoney(item.nonCurrentReceived)}</span>
                          </div>
                        </td>
                        <td style={{ ...s.td, textAlign: 'right', color: item.outstandingAmount > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>Rs {formatMoney(item.outstandingAmount)}</td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                            <span style={{ ...s.statusTag, color: statusColor.color, background: statusColor.bg }}>{item.status}</span>
                            <span style={locked ? s.lockedNote : s.editableNote}>{getLockText(item)}</span>
                          </div>
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <div style={s.actions}>
                            {!isJournalInferred && item.outstandingAmount > 0 ? (
                              <button style={s.payBtn} onClick={() => openPaymentModal(item, 'auto')} title="Receive Payment">
                                <Wallet size={12} /> Receive
                              </button>
                            ) : null}
                            {isSuperuser && !isJournalInferred ? (
                              <button style={s.iconBtn} onClick={() => router.push(`/accounts/receivable/new?edit=${encodeURIComponent(item.id)}`)} disabled={locked} title="Edit">
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
              {filteredInvoices.length === 0 ? <p style={s.empty}>No receivable transactions found.</p> : null}
            </div>
          </>
        ) : null}

        {panelTab === 'customers' ? (
          <div style={s.tableCard}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={s.th}>Customer</th>
                  <th style={s.th}>Contact</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Invoices</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Total Sales</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Outstanding</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Credit Limit</th>
                  {isSuperuser ? <th style={{ ...s.th, textAlign: 'center' }}>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => {
                  return (
                    <tr key={customer.id} style={s.trow}>
                      <td style={{ ...s.td, fontWeight: 700 }}>{customer.name}</td>
                      <td style={{ ...s.td, color: '#64748b' }}>{customer.contact || '-'}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{customer.totalInvoices}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>Rs {formatMoney(customer.totalSale)}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: customer.outstanding > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>Rs {formatMoney(customer.outstanding)}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: customer.overLimit ? '#b91c1c' : '#1a3d1f' }}>
                        {customer.creditLimit > 0 ? `Rs ${formatMoney(customer.creditLimit)}` : '-'}
                      </td>
                      {isSuperuser ? (
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <button style={s.iconBtn} onClick={() => openCustomerModal(customer)} title="Edit Customer">
                            <Pencil size={13} />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredCustomers.length === 0 ? <p style={s.empty}>No customers found.</p> : null}
          </div>
        ) : null}

        {panelTab === 'aging' ? (
          <>
            <div style={s.summaryGrid}>
              {AGING_BUCKETS.map((bucket) => {
                const tone = AGING_COLORS[bucket]
                return (
                  <div key={bucket} style={{ ...s.sumCard, background: tone.bg }}>
                    <p style={{ ...s.sumLabel, color: tone.color }}>{bucket} Days</p>
                    <p style={{ ...s.sumVal, color: tone.color, fontSize: 18 }}>Rs {formatMoney(agingSummary[bucket].amount)}</p>
                    <p style={s.mutedText}>{agingSummary[bucket].count} invoice(s)</p>
                  </div>
                )
              })}
            </div>

            <div style={s.tableCard}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>Invoice</th>
                    <th style={s.th}>Customer</th>
                    <th style={s.th}>Due Date</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Overdue Days</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Aging Bucket</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {agingRows.map((item) => {
                    const tone = AGING_COLORS[item.bucket] || AGING_COLORS.Current
                    return (
                      <tr key={item.id} style={s.trow}>
                        <td style={s.td}><span style={s.voucherTag}>{item.id}</span></td>
                        <td style={s.td}>{item.customerName}</td>
                        <td style={s.td}>{item.dueDate || item.date || '-'}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{item.overdueDays}</td>
                        <td style={{ ...s.td, textAlign: 'center' }}><span style={{ ...s.statusTag, color: tone.color, background: tone.bg }}>{item.bucket}</span></td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#b91c1c' }}>Rs {formatMoney(item.outstandingAmount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {agingRows.length === 0 ? <p style={s.empty}>No outstanding receivables for aging report.</p> : null}
            </div>
          </>
        ) : null}

        {panelTab === 'statements' ? (
          <div style={s.statementWrap}>
            <div style={s.statementTop}>
              <div style={s.field}>
                <label style={s.label}>Customer Statement</label>
                <select style={s.input} value={statementCustomer} onChange={(event) => setStatementCustomer(event.target.value)}>
                  {statementCustomers.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              {isSuperuser ? (
                <button style={s.secondaryBtn} onClick={() => openCustomerModal(customerStats.find((item) => toKey(item.name) === toKey(statementCustomer)) || null)}>
                  <Pencil size={13} /> Edit Customer
                </button>
              ) : null}
            </div>

            {statementData ? (
              <>
                <div style={s.summaryGrid}>
                  <div style={s.sumCard}>
                    <p style={s.sumLabel}>Total Sale</p>
                    <p style={s.sumVal}>Rs {formatMoney(statementData.totalSale)}</p>
                  </div>
                  <div style={s.sumCard}>
                    <p style={s.sumLabel}>Advance Received</p>
                    <p style={s.sumVal}>Rs {formatMoney(statementData.totalAdvance)}</p>
                  </div>
                  <div style={s.sumCard}>
                    <p style={s.sumLabel}>Net Invoiced to AR</p>
                    <p style={s.sumVal}>Rs {formatMoney(statementData.totalNetInvoiced)}</p>
                  </div>
                  <div style={{ ...s.sumCard, background: '#fef2f2', border: '1px solid #fecaca' }}>
                    <p style={{ ...s.sumLabel, color: '#b91c1c' }}>Outstanding</p>
                    <p style={{ ...s.sumVal, color: '#b91c1c' }}>Rs {formatMoney(statementData.outstanding)}</p>
                  </div>
                </div>

                <p style={s.mutedText}>Statement is based on net receivable posting (total sale minus advance) split across current and non-current AR ledgers.</p>

                <div style={s.tableCard}>
                  <table style={s.table}>
                    <thead>
                      <tr style={s.thead}>
                        <th style={s.th}>Date</th>
                        <th style={s.th}>Reference</th>
                        <th style={s.th}>Narration</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Debit (AR)</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Credit</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Running Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementData.rows.map((row) => (
                        <tr key={row.rowId} style={s.trow}>
                          <td style={s.td}>{row.date || '-'}</td>
                          <td style={s.td}>{row.reference}</td>
                          <td style={s.td}>{row.narration}</td>
                          <td style={{ ...s.td, textAlign: 'right', color: '#166534' }}>{row.debit > 0 ? formatMoney(row.debit) : '-'}</td>
                          <td style={{ ...s.td, textAlign: 'right', color: '#2563eb' }}>{row.credit > 0 ? formatMoney(row.credit) : '-'}</td>
                          <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{formatMoney(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {statementData.rows.length === 0 ? <p style={s.empty}>No statement rows for this customer.</p> : null}
                </div>
              </>
            ) : (
              <p style={s.empty}>No customer data found for statements.</p>
            )}
          </div>
        ) : null}

        {notice ? <p style={s.noticeText}>{notice}</p> : null}
        {errorText && !paymentTarget ? <p style={s.errorText}>{errorText}</p> : null}

        {paymentTarget ? (
          <div style={s.modalOverlay} onClick={closePaymentModal}>
            <div style={s.modal} onClick={(event) => event.stopPropagation()}>
              <h3 style={s.modalTitle}>Receive Customer Payment</h3>
              <p style={s.modalSub}>{paymentTarget.id} | {paymentTarget.customerName}</p>

              <div style={s.formGrid}>
                <div style={s.field}>
                  <label style={s.label}>Portion</label>
                  <select
                    style={s.input}
                    value={paymentForm.portion}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, portion: event.target.value }))}
                  >
                    <option value="current" disabled={paymentTarget.currentOutstanding <= 0}>Current Receivable</option>
                    <option value="non-current" disabled={paymentTarget.nonCurrentOutstanding <= 0}>Non-Current Receivable</option>
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
                  <label style={s.label}>Receipt Account *</label>
                  <select
                    style={s.input}
                    value={paymentForm.paymentAccountCode}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, paymentAccountCode: event.target.value }))}
                  >
                    <option value="">Select receipt account</option>
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

                <div style={s.field}>
                  <label style={s.label}>Reference</label>
                  <input
                    style={s.input}
                    value={paymentForm.reference}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, reference: event.target.value }))}
                    placeholder="Cheque No / Bank Ref"
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
              </div>

              <p style={s.helperText}>
                Selected outstanding: Rs {formatMoney(paymentForm.portion === 'non-current' ? paymentTarget.nonCurrentOutstanding : paymentTarget.currentOutstanding)}
              </p>
              {errorText ? <p style={s.errorText}>{errorText}</p> : null}

              <div style={s.modalActions}>
                <button style={s.cancelBtn} onClick={closePaymentModal}>Cancel</button>
                <button style={s.saveBtn} onClick={savePayment}>Post Receipt</button>
              </div>
            </div>
          </div>
        ) : null}

        {customerModalOpen ? (
          <div style={s.modalOverlay} onClick={closeCustomerModal}>
            <div style={s.modal} onClick={(event) => event.stopPropagation()}>
              <h3 style={s.modalTitle}>Customer Master</h3>
              <p style={s.modalSub}>Create or update customer credit profile</p>

              <div style={s.formGrid}>
                <div style={s.field}>
                  <label style={s.label}>Customer Name *</label>
                  <input
                    style={{ ...s.input, ...(customerErrors.name ? s.inputError : {}) }}
                    value={customerForm.name}
                    onChange={(event) => {
                      setCustomerForm((prev) => ({ ...prev, name: event.target.value }))
                      setCustomerErrors((prev) => ({ ...prev, name: undefined }))
                    }}
                    placeholder="Enter customer name"
                  />
                  {customerErrors.name ? <span style={s.fieldError}>{customerErrors.name}</span> : null}
                </div>

                <div style={s.field}>
                  <label style={s.label}>Contact</label>
                  <input
                    style={s.input}
                    value={customerForm.contact}
                    onChange={(event) => setCustomerForm((prev) => ({ ...prev, contact: event.target.value }))}
                    placeholder="Phone / Email"
                  />
                </div>

                <div style={s.field}>
                  <label style={s.label}>Credit Limit</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={{ ...s.input, ...(customerErrors.creditLimit ? s.inputError : {}) }}
                    value={customerForm.creditLimit}
                    onChange={(event) => {
                      setCustomerForm((prev) => ({ ...prev, creditLimit: event.target.value }))
                      setCustomerErrors((prev) => ({ ...prev, creditLimit: undefined }))
                    }}
                    placeholder="0"
                  />
                  {customerErrors.creditLimit ? <span style={s.fieldError}>{customerErrors.creditLimit}</span> : null}
                </div>

                <div style={s.field}>
                  <label style={s.label}>Notes</label>
                  <input
                    style={s.input}
                    value={customerForm.notes}
                    onChange={(event) => setCustomerForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Optional notes"
                  />
                </div>
              </div>

              <div style={s.modalActions}>
                <button style={s.cancelBtn} onClick={closeCustomerModal}>Cancel</button>
                <button style={s.saveBtn} onClick={saveCustomer}>Save Customer</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AccountLayout>
  )
}

function AccountsReceivablePageLoading() {
  return (
    <AccountLayout>
      <div style={{ padding: 20, color: '#64748b', fontSize: 14 }}>Loading accounts receivable...</div>
    </AccountLayout>
  )
}

export default function AccountsReceivablePage() {
  return (
    <Suspense fallback={<AccountsReceivablePageLoading />}>
      <AccountsReceivablePageContent />
    </Suspense>
  )
}

const s = {
  page: { width: '100%', display: 'flex', flexDirection: 'column', gap: 20 },
  hero: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'linear-gradient(135deg, rgb(26, 61, 31) 0%, rgb(45, 122, 51) 100%)', borderRadius: 28, padding: '24px 28px' },
  heroLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  heroActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#d4dfd4' },
  addBtn: { display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', color: '#2a6f31', border: 'none', borderRadius: '999px', padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  secondaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '999px', padding: '9px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  sumCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 20, padding: '16px 20px' },
  sumLabel: { margin: 0, fontSize: 11, fontWeight: 700, color: '#7a8a7a', textTransform: 'uppercase', letterSpacing: '0.5px' },
  sumVal: { margin: '6px 0 0', fontSize: 22, fontWeight: 800, color: '#1a3d1f' },
  toolbar: { display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  tabs: { display: 'flex', gap: 0, background: '#e8eee8', borderRadius: 40, padding: 4, flexWrap: 'nowrap', overflowX: 'auto' },
  tab: { padding: '8px 18px', borderRadius: 999, border: 'none', background: 'transparent', color: '#7a8a7a', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  tabActive: { background: '#2d7a33', color: '#fff' },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap', minWidth: 0 },
  filterSelect: {
    border: '1px solid #d4dfd4',
    background: '#ffffff',
    color: '#1a3d1f',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 12.5,
    fontWeight: 700,
    outline: 'none',
    fontFamily: 'inherit',
    minWidth: 160,
    cursor: 'pointer',
  },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 40, padding: '8px 16px', flex: '0 1 280px' },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#1a3d1f', flex: 1, fontFamily: 'inherit' },
  tableCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 24, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#e8eee8' },
  th: { padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#415443', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' },
  trow: { borderTop: '1px solid #e2e8e2' },
  td: { padding: '11px 14px', fontSize: 13, color: '#1a3d1f', verticalAlign: 'top' },
  voucherTag: { background: '#eef2ee', color: '#2a6f31', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, display: 'inline-block' },
  mutedText: { margin: 0, fontSize: 11, color: '#64748b' },
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
  inputError: { borderColor: '#fca5a5', background: '#fff1f2' },
  fieldError: { fontSize: 12, color: '#b91c1c' },
  helperText: { margin: '10px 0 0', fontSize: 12.5, fontWeight: 600, color: '#2d7a33' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  cancelBtn: { padding: '9px 18px', borderRadius: 999, border: '1px solid #d4dfd4', background: '#f8faf8', color: '#415443', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  saveBtn: { padding: '9px 18px', borderRadius: 999, border: 'none', background: '#2d7a33', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  statementWrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  statementTop: { display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap' },
}

