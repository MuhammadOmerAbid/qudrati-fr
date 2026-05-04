'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountLayout from '@/presentation/layouts/AccountLayout'
import {
  CASH_BANK_RECON_SOURCE_TYPES,
  CASH_BANK_TRANSACTION_TYPES,
  PETTY_CASH_REPLENISHMENT_CYCLES,
  createBankReconciliation,
  getCashBankAccountsSummary,
  loadCashBankAccountsFromChart,
  loadCashBankActivityFeed,
  loadCashBankReconciliationsFromStorage,
  loadPettyCashSetupsWithBalances,
  replenishPettyCashSetup,
  runAutoPettyCashReplenishment,
  upsertPettyCashSetup,
} from '@/application/services/accounts/accountsWorkflow'
import { Banknote, Search, RefreshCcw, Wallet, Landmark, FileSpreadsheet, Settings2 } from 'lucide-react'

const todayISO = () => new Date().toISOString().slice(0, 10)
const toMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100
const toKey = (value) => String(value || '').trim().toLowerCase()

function parseCsvLine(line) {
  const output = []
  let current = ''
  let quoted = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      output.push(current)
      current = ''
    } else {
      current += char
    }
  }

  output.push(current)
  return output.map((item) => String(item || '').trim())
}

function normalizeCsvDate(value) {
  const clean = String(value || '').trim()
  if (!clean) return ''
  const parsed = new Date(clean)
  if (!Number.isFinite(parsed.getTime())) return clean
  return parsed.toISOString().slice(0, 10)
}

function parseStatementCsv(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('CSV must include header and at least one row')

  const headers = parseCsvLine(lines[0]).map((item) => toKey(item))
  const dateIndex = headers.findIndex((item) => item.includes('date'))
  const amountIndex = headers.findIndex((item) => item.includes('amount') || item.includes('debit') || item.includes('credit'))
  const descriptionIndex = headers.findIndex((item) => item.includes('description') || item.includes('narration') || item.includes('detail'))
  const referenceIndex = headers.findIndex((item) => item.includes('reference') || item.includes('ref') || item.includes('cheque'))

  if (dateIndex < 0 || amountIndex < 0) {
    throw new Error('CSV must have date and amount columns')
  }

  const rows = []
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i])
    const rawAmount = String(cols[amountIndex] || '').replace(/[, ]/g, '').replace(/[^0-9.-]/g, '')
    const amount = Number(rawAmount)
    if (!Number.isFinite(amount) || Math.abs(amount) <= 0) continue

    rows.push({
      id: `CSV-${i}`,
      date: normalizeCsvDate(cols[dateIndex]),
      amount: toMoney(amount),
      description: descriptionIndex >= 0 ? String(cols[descriptionIndex] || '').trim() : '',
      reference: referenceIndex >= 0 ? String(cols[referenceIndex] || '').trim() : '',
    })
  }

  if (rows.length === 0) throw new Error('No valid amount rows found in CSV')
  return rows
}

function formatMoney(value) {
  return `Rs ${toMoney(value).toLocaleString()}`
}

export default function CashBankPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'

  const [tab, setTab] = useState('accounts')
  const [accounts, setAccounts] = useState([])
  const [summary, setSummary] = useState({
    totalCash: 0,
    totalBank: 0,
    pettyCash: 0,
    totalBalance: 0,
    cashAccountCount: 0,
    bankAccountCount: 0,
    pettyCashAccountCount: 0,
  })
  const [activities, setActivities] = useState([])
  const [reconciliations, setReconciliations] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [noticeText, setNoticeText] = useState('')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [reconForm, setReconForm] = useState({
    bankAccountCode: '',
    sourceType: 'manual',
    periodStart: '',
    periodEnd: '',
    statementDate: todayISO(),
    statementEndingBalance: '',
    notes: '',
  })
  const [csvRows, setCsvRows] = useState([])
  const [runningRecon, setRunningRecon] = useState(false)
  const [reconError, setReconError] = useState('')
  const [reconResult, setReconResult] = useState(null)
  const [pettySetups, setPettySetups] = useState([])
  const [savingPettySetup, setSavingPettySetup] = useState(false)
  const [runningAutoPetty, setRunningAutoPetty] = useState(false)
  const [pettyForm, setPettyForm] = useState({
    setupId: '',
    pettyCashAccountCode: '',
    fundingAccountCode: '',
    fixedAmount: '',
    replenishmentCycle: 'weekly',
    customCycleDays: '7',
    approvalRequired: false,
    autoReplenish: false,
    fundImmediately: false,
  })

  const refreshAll = () => {
    setRefreshing(true)
    try {
      const loadedAccounts = loadCashBankAccountsFromChart()
      setAccounts(loadedAccounts)
      setSummary(getCashBankAccountsSummary())
      setActivities(loadCashBankActivityFeed({
        search,
        accountCode: accountFilter,
        transactionType: typeFilter,
        fromDate,
        toDate,
      }))
      setReconciliations(loadCashBankReconciliationsFromStorage())
      setPettySetups(loadPettyCashSetupsWithBalances())
      setErrorText('')
    } catch (error) {
      setErrorText(error?.message || 'Unable to load cash/bank data')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    refreshAll()
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const notice = String(params.get('notice') || '').trim().toLowerCase()
    if (notice === 'posted') {
      setNoticeText('Cash/Bank transaction posted successfully.')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const refresh = () => refreshAll()
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('accounts:storage-updated', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('accounts:storage-updated', refresh)
    }
  }, [search, accountFilter, typeFilter, fromDate, toDate])

  useEffect(() => {
    setActivities(loadCashBankActivityFeed({
      search,
      accountCode: accountFilter,
      transactionType: typeFilter,
      fromDate,
      toDate,
    }))
  }, [search, accountFilter, typeFilter, fromDate, toDate])

  const bankAccounts = useMemo(() => (
    accounts.filter((account) => account.kind === 'bank')
  ), [accounts])

  const pettyCashAccounts = useMemo(() => (
    accounts.filter((account) => account.kind === 'petty-cash')
  ), [accounts])

  const accountNameByCode = useMemo(() => {
    const map = new Map()
    accounts.forEach((account) => {
      map.set(account.code, `${account.code} - ${account.name}`)
    })
    return map
  }, [accounts])

  const pettyCashActivities = useMemo(() => (
    activities.filter((item) => item.transactionType.startsWith('petty_')).slice(0, 5)
  ), [activities])

  const fundingAccounts = useMemo(() => (
    accounts
      .filter((account) => account.kind === 'cash' || account.kind === 'bank')
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [accounts])

  const setPettyField = (key, value) => {
    setPettyForm((prev) => ({ ...prev, [key]: value }))
  }

  const loadPettySetupIntoForm = (setup) => {
    if (!setup) return
    setPettyForm({
      setupId: setup.id,
      pettyCashAccountCode: setup.pettyCashAccountCode,
      fundingAccountCode: setup.fundingAccountCode,
      fixedAmount: String(setup.fixedAmount || ''),
      replenishmentCycle: setup.replenishmentCycle,
      customCycleDays: setup.customCycleDays > 0 ? String(setup.customCycleDays) : '7',
      approvalRequired: setup.approvalRequired === true,
      autoReplenish: setup.autoReplenish === true,
      fundImmediately: false,
    })
  }

  const resetPettyForm = () => {
    setPettyForm({
      setupId: '',
      pettyCashAccountCode: '',
      fundingAccountCode: '',
      fixedAmount: '',
      replenishmentCycle: 'weekly',
      customCycleDays: '7',
      approvalRequired: false,
      autoReplenish: false,
      fundImmediately: false,
    })
  }

  const savePettySetup = () => {
    if (savingPettySetup) return

    const fixedAmount = Number(pettyForm.fixedAmount)
    if (!pettyForm.pettyCashAccountCode || !pettyForm.fundingAccountCode || !Number.isFinite(fixedAmount) || fixedAmount <= 0) {
      setErrorText('Petty setup requires petty account, funding account, and fixed amount.')
      return
    }

    setSavingPettySetup(true)
    try {
      const actor = user?.name || user?.username || 'system'
      const result = upsertPettyCashSetup({
        setupId: pettyForm.setupId,
        pettyCashAccountCode: pettyForm.pettyCashAccountCode,
        fundingAccountCode: pettyForm.fundingAccountCode,
        fixedAmount,
        replenishmentCycle: pettyForm.replenishmentCycle,
        customCycleDays: Number(pettyForm.customCycleDays) || 0,
        approvalRequired: pettyForm.approvalRequired,
        autoReplenish: pettyForm.autoReplenish,
        fundImmediately: pettyForm.fundImmediately,
        date: todayISO(),
        user: actor,
      })
      setNoticeText(result.fundingVoucherNo ? `Petty cash setup saved and funded (${result.fundingVoucherNo}).` : 'Petty cash setup saved successfully.')
      setPettySetups(loadPettyCashSetupsWithBalances())
      resetPettyForm()
      setErrorText('')
      setSummary(getCashBankAccountsSummary())
      setActivities(loadCashBankActivityFeed({
        search,
        accountCode: accountFilter,
        transactionType: typeFilter,
        fromDate,
        toDate,
      }))
    } catch (error) {
      setErrorText(error?.message || 'Unable to save petty setup')
    } finally {
      setSavingPettySetup(false)
    }
  }

  const runPettyReplenishment = (setupId) => {
    if (!setupId) return
    try {
      const actor = user?.name || user?.username || 'system'
      const result = replenishPettyCashSetup({
        setupId,
        date: todayISO(),
        user: actor,
      })
      setNoticeText(`Petty cash replenished (${result.voucherNo}) for Rs ${toMoney(result.replenishmentAmount).toLocaleString()}.`)
      setPettySetups(loadPettyCashSetupsWithBalances())
      setSummary(getCashBankAccountsSummary())
      setActivities(loadCashBankActivityFeed({
        search,
        accountCode: accountFilter,
        transactionType: typeFilter,
        fromDate,
        toDate,
      }))
      setErrorText('')
    } catch (error) {
      setErrorText(error?.message || 'Unable to replenish petty cash')
    }
  }

  const runAutoPettyCycle = () => {
    if (runningAutoPetty) return
    setRunningAutoPetty(true)
    try {
      const actor = user?.name || user?.username || 'system'
      const result = runAutoPettyCashReplenishment({
        asOfDate: todayISO(),
        user: actor,
      })
      if (result.processed > 0) {
        setNoticeText(`Auto replenishment posted (${result.processed} voucher${result.processed > 1 ? 's' : ''}).`)
      } else {
        setNoticeText('Auto replenishment checked. No setup required funding right now.')
      }
      setPettySetups(loadPettyCashSetupsWithBalances())
      setSummary(getCashBankAccountsSummary())
      setActivities(loadCashBankActivityFeed({
        search,
        accountCode: accountFilter,
        transactionType: typeFilter,
        fromDate,
        toDate,
      }))
      setErrorText('')
    } catch (error) {
      setErrorText(error?.message || 'Unable to run auto replenishment')
    } finally {
      setRunningAutoPetty(false)
    }
  }

  const setReconField = (key, value) => {
    setReconForm((prev) => ({ ...prev, [key]: value }))
    setReconError('')
  }

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = parseStatementCsv(text)
      setCsvRows(parsed)
      setReconError('')
    } catch (error) {
      setCsvRows([])
      setReconError(error?.message || 'Unable to parse CSV file')
    }
  }

  const runReconciliation = async () => {
    if (runningRecon) return

    const endingBalance = Number(reconForm.statementEndingBalance)
    if (!reconForm.bankAccountCode) {
      setReconError('Bank account is required')
      return
    }
    if (!Number.isFinite(endingBalance)) {
      setReconError('Statement ending balance is required')
      return
    }
    if (reconForm.sourceType === 'csv' && csvRows.length === 0) {
      setReconError('Please upload a valid statement CSV before reconciling')
      return
    }

    setRunningRecon(true)
    setReconError('')
    try {
      const actor = user?.name || user?.username || 'system'
      const result = createBankReconciliation({
        bankAccountCode: reconForm.bankAccountCode,
        periodStart: reconForm.periodStart,
        periodEnd: reconForm.periodEnd,
        statementDate: reconForm.statementDate,
        statementEndingBalance: endingBalance,
        sourceType: reconForm.sourceType,
        statementEntries: reconForm.sourceType === 'csv' ? csvRows : [],
        notes: reconForm.notes,
        user: actor,
      })
      setReconResult(result.reconciliation)
      setReconciliations(loadCashBankReconciliationsFromStorage())
      setActivities(loadCashBankActivityFeed({
        search,
        accountCode: accountFilter,
        transactionType: typeFilter,
        fromDate,
        toDate,
      }))
      setNoticeText('Bank reconciliation saved successfully.')
    } catch (error) {
      setReconError(error?.message || 'Unable to complete reconciliation')
    } finally {
      setRunningRecon(false)
    }
  }

  return (
    <AccountLayout>
      <div style={s.page}>
        <section style={s.hero}>
          <div style={s.heroLeft}>
            <div style={s.heroIcon}><Banknote size={22} color="#0f766e" /></div>
            <div>
              <h1 style={s.title}>Cash & Bank Management</h1>
              <p style={s.subtitle}>Multi-account cash and bank operations with petty cash and reconciliation</p>
            </div>
          </div>
          <div style={s.heroActions}>
            <button style={s.addBtnGreen} onClick={() => router.push('/accounts/cash-bank/new')}>
              + Add Transaction
            </button>
            <button style={s.addBtnNeutral} onClick={() => router.push('/accounts/cash-bank/new?mode=petty&type=petty_cash_fund')}>
              + Fund Petty Cash
            </button>
            {isSuperuser ? (
              <button style={s.addBtnRed} onClick={() => router.push('/accounts/chart-of-accounts/new?preset=petty-cash')}>
                + New Petty Account
              </button>
            ) : null}
          </div>
        </section>

        {noticeText ? <p style={s.noticeText}>{noticeText}</p> : null}
        {errorText ? <p style={s.errorText}>{errorText}</p> : null}

        <div style={s.summaryGrid}>
          <div style={{ ...s.sumCard, background: '#f0fdfa', border: '1px solid #99f6e4' }}>
            <p style={{ ...s.sumLabel, color: '#0f766e' }}>Total Cash</p>
            <p style={{ ...s.sumVal, color: '#0f766e' }}>{formatMoney(summary.totalCash)}</p>
            <p style={s.sumSub}>{summary.cashAccountCount} cash accounts</p>
          </div>
          <div style={{ ...s.sumCard, background: '#e8eee8', border: '1px solid #d4dfd4' }}>
            <p style={{ ...s.sumLabel, color: '#2a6f31' }}>Total Bank</p>
            <p style={{ ...s.sumVal, color: '#2a6f31' }}>{formatMoney(summary.totalBank)}</p>
            <p style={s.sumSub}>{summary.bankAccountCount} bank accounts</p>
          </div>
          <div style={s.sumCard}>
            <p style={s.sumLabel}>Total Balance</p>
            <p style={s.sumVal}>{formatMoney(summary.totalBalance)}</p>
            <p style={s.sumSub}>Cash + Bank consolidated</p>
          </div>
          <div style={{ ...s.sumCard, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <p style={{ ...s.sumLabel, color: '#b45309' }}>Petty Cash</p>
            <p style={{ ...s.sumVal, color: '#b45309' }}>{formatMoney(summary.pettyCash)}</p>
            <p style={s.sumSub}>{summary.pettyCashAccountCount} petty cash account(s)</p>
          </div>
        </div>

        <div style={s.toolbar}>
          <div style={s.tabs}>
            <button style={{ ...s.tab, ...(tab === 'accounts' ? s.tabActive : {}) }} onClick={() => setTab('accounts')}>Accounts</button>
            <button style={{ ...s.tab, ...(tab === 'petty' ? s.tabActive : {}) }} onClick={() => setTab('petty')}>Petty Cash Control</button>
            <button style={{ ...s.tab, ...(tab === 'transactions' ? s.tabActive : {}) }} onClick={() => setTab('transactions')}>Transactions</button>
            <button style={{ ...s.tab, ...(tab === 'reconcile' ? s.tabActive : {}) }} onClick={() => setTab('reconcile')}>Reconciliation</button>
          </div>
        </div>

        {tab === 'accounts' ? (
          <>
            <div style={s.acctGrid}>
              {accounts.map((account) => (
                <div key={account.code} style={s.acctCard}>
                  <div style={s.acctTop}>
                    <span style={{ ...s.acctTypeBadge, ...(account.kind === 'bank' ? s.badgeBank : account.kind === 'petty-cash' ? s.badgePetty : s.badgeCash) }}>
                      {account.kind === 'petty-cash' ? 'Petty Cash' : account.kind === 'bank' ? 'Bank' : 'Cash'}
                    </span>
                    {account.kind === 'bank' ? <Landmark size={17} color="#2a6f31" /> : <Wallet size={17} color="#0f766e" />}
                  </div>
                  <p style={s.acctName}>{account.name}</p>
                  <p style={s.acctSub}>Code: {account.code}</p>
                  <p style={{ ...s.acctBalance, color: account.kind === 'bank' ? '#2a6f31' : '#0f766e' }}>{formatMoney(account.balance)}</p>
                  <button style={s.acctBtn} onClick={() => router.push(`/accounts/general-ledger?account=${encodeURIComponent(account.code)}`)}>View Ledger</button>
                </div>
              ))}
            </div>
            {accounts.length === 0 ? <p style={s.empty}>No cash/bank posting accounts found in current assets. Add account heads in Chart of Accounts first.</p> : null}

            <div style={s.pettyPanel}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={s.sectionTitle}>Petty Cash Handling</h3>
                  <p style={s.sectionSub}>Funding entries post DR Petty Cash / CR Bank. Expense entries auto-sync to Expenses module with full GL vouchers.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    style={{ ...s.smallBtnPrimary, padding: '7px 13px', fontSize: 12 }}
                    onClick={() => router.push('/accounts/cash-bank/new?mode=petty&type=petty_cash_fund')}
                  >
                    + Fund Petty Cash
                  </button>
                  <button
                    style={{ ...s.smallBtn, padding: '7px 13px', fontSize: 12, background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e' }}
                    onClick={() => router.push('/accounts/cash-bank/new?mode=petty&type=petty_cash_expense')}
                  >
                    + Post Petty Expense
                  </button>
                </div>
              </div>
              <div style={s.pettyGrid}>
                <div style={s.pettyCard}>
                  <p style={s.pettyLabel}>Petty Accounts</p>
                  <p style={s.pettyValue}>{pettyCashAccounts.length}</p>
                </div>
                <div style={s.pettyCard}>
                  <p style={s.pettyLabel}>Available Balance</p>
                  <p style={{ ...s.pettyValue, color: summary.pettyCash >= 0 ? '#78350f' : '#b91c1c' }}>{formatMoney(summary.pettyCash)}</p>
                </div>
                <div style={s.pettyCard}>
                  <p style={s.pettyLabel}>Recent Petty Txns</p>
                  <p style={s.pettyValue}>{pettyCashActivities.length}</p>
                </div>
              </div>
              {pettyCashAccounts.length > 0 ? (
                <div style={{ marginTop: 8 }}>
                  {pettyCashAccounts.map((account) => (
                    <div key={account.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#fff', borderRadius: 8, border: '1px solid #f3e8c9', marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#78350f' }}>{account.code} — {account.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>{formatMoney(account.balance)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#92400e' }}>
                  No petty cash accounts found.{' '}
                  {isSuperuser
                    ? <button style={{ background: 'none', border: 'none', color: '#b45309', fontWeight: 700, cursor: 'pointer', fontSize: 12.5, padding: 0 }} onClick={() => router.push('/accounts/chart-of-accounts/new?preset=petty-cash')}>Create one →</button>
                    : 'Ask your superuser to create one.'}
                </p>
              )}
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={s.expenseLinkBtn} onClick={() => router.push('/accounts/expenses')}>
                  Open Expense Module
                </button>
                <button style={{ ...s.expenseLinkBtn, borderColor: '#a7f3d0', background: '#ecfdf5', color: '#065f46' }} onClick={() => setTab('petty')}>
                  Petty Cash Control Panel
                </button>
              </div>
            </div>
          </>
        ) : null}

        {tab === 'petty' ? (
          <div style={s.pettyControlWrap}>
            <div style={s.pettyControlHeader}>
              <div style={s.pettyControlTitleWrap}>
                <Settings2 size={18} color="#92400e" />
                <div>
                  <h3 style={s.pettyControlTitle}>Petty Cash Setup & Replenishment</h3>
                  <p style={s.pettyControlSub}>Define fixed limits, replenishment cycle, and keep petty cash reconciled to policy level.</p>
                </div>
              </div>
              <div style={s.pettyControlActions}>
                <button style={s.secondaryBtn} onClick={resetPettyForm}>Reset Form</button>
                <button style={s.primaryBtn} onClick={savePettySetup} disabled={savingPettySetup}>
                  {savingPettySetup ? 'Saving...' : 'Save Setup'}
                </button>
                <button style={s.autoBtn} onClick={runAutoPettyCycle} disabled={runningAutoPetty}>
                  {runningAutoPetty ? 'Running...' : 'Run Auto Cycle'}
                </button>
              </div>
            </div>

            <div style={s.pettyFormGrid}>
              <div style={s.fieldWrap}>
                <label style={s.label}>Petty Cash Account *</label>
                <select style={s.input} value={pettyForm.pettyCashAccountCode} onChange={(event) => setPettyField('pettyCashAccountCode', event.target.value)}>
                  <option value="">Select petty cash account</option>
                  {pettyCashAccounts.map((account) => (
                    <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
                  ))}
                </select>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Funding Account *</label>
                <select style={s.input} value={pettyForm.fundingAccountCode} onChange={(event) => setPettyField('fundingAccountCode', event.target.value)}>
                  <option value="">Select cash/bank account</option>
                  {fundingAccounts.map((account) => (
                    <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
                  ))}
                </select>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Fixed Amount *</label>
                <input type="number" min="0" step="0.01" style={s.input} value={pettyForm.fixedAmount} onChange={(event) => setPettyField('fixedAmount', event.target.value)} placeholder="50000" />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Replenishment Cycle *</label>
                <select style={s.input} value={pettyForm.replenishmentCycle} onChange={(event) => setPettyField('replenishmentCycle', event.target.value)}>
                  {PETTY_CASH_REPLENISHMENT_CYCLES.map((cycle) => (
                    <option key={cycle.value} value={cycle.value}>{cycle.label}</option>
                  ))}
                </select>
              </div>

              {pettyForm.replenishmentCycle === 'custom' ? (
                <div style={s.fieldWrap}>
                  <label style={s.label}>Custom Days *</label>
                  <input type="number" min="1" step="1" style={s.input} value={pettyForm.customCycleDays} onChange={(event) => setPettyField('customCycleDays', event.target.value)} />
                </div>
              ) : null}
            </div>

            <div style={s.checkboxRow}>
              <label style={s.checkItem}>
                <input type="checkbox" checked={pettyForm.approvalRequired} onChange={(event) => setPettyField('approvalRequired', event.target.checked)} />
                <span>Approval required for petty expenses (policy flag)</span>
              </label>
              <label style={s.checkItem}>
                <input type="checkbox" checked={pettyForm.autoReplenish} onChange={(event) => setPettyField('autoReplenish', event.target.checked)} />
                <span>Auto replenish on cycle due</span>
              </label>
              <label style={s.checkItem}>
                <input type="checkbox" checked={pettyForm.fundImmediately} onChange={(event) => setPettyField('fundImmediately', event.target.checked)} />
                <span>Fund now to fixed amount on save</span>
              </label>
            </div>

            <p style={s.expenseSeparationText}>
              Expense records remain in <strong>Expenses Module</strong> to keep data ownership separate, while cash impact stays synced in Cash & Bank.
            </p>

            <div style={s.pettySetupTableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>Petty Account</th>
                    <th style={s.th}>Funding Account</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Fixed</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Current</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Replenish</th>
                    <th style={s.th}>Cycle</th>
                    <th style={s.th}>Flags</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pettySetups.map((setup) => (
                    <tr key={setup.id} style={s.trow}>
                      <td style={s.td}>{setup.pettyCashAccountName || setup.pettyCashAccountCode}</td>
                      <td style={s.td}>{setup.fundingAccountName || setup.fundingAccountCode}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{formatMoney(setup.fixedAmount)}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(setup.currentBalance)}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: setup.replenishmentAmount > 0 ? '#b45309' : '#15803d', fontWeight: 700 }}>
                        {formatMoney(setup.replenishmentAmount)}
                      </td>
                      <td style={s.td}>{setup.replenishmentCycle === 'custom' ? `Custom (${setup.customCycleDays}d)` : setup.replenishmentCycle}</td>
                      <td style={s.td}>
                        <div style={s.flagWrap}>
                          <span style={s.smallBadge}>{setup.approvalRequired ? 'Approval' : 'No Approval'}</span>
                          <span style={s.smallBadge}>{setup.autoReplenish ? 'Auto' : 'Manual'}</span>
                        </div>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <div style={s.rowActions}>
                          <button style={s.smallBtn} onClick={() => loadPettySetupIntoForm(setup)}>Edit</button>
                          <button style={s.smallBtnPrimary} onClick={() => runPettyReplenishment(setup.id)} disabled={setup.replenishmentAmount <= 0}>
                            Replenish
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pettySetups.length === 0 ? <p style={s.empty}>No petty cash setup found yet. Configure one above.</p> : null}
            </div>
          </div>
        ) : null}

        {tab === 'transactions' ? (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button style={s.addBtnGreen} onClick={() => router.push('/accounts/cash-bank/new')}>+ Add Transaction</button>
              <button style={{ ...s.addBtnNeutral, background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' }} onClick={() => router.push('/accounts/cash-bank/new?mode=petty&type=petty_cash_expense')}>+ Petty Expense</button>
              <button style={{ ...s.addBtnNeutral }} onClick={() => router.push('/accounts/cash-bank/new?mode=petty&type=petty_cash_fund')}>+ Fund Petty Cash</button>
            </div>
            <div style={s.filterGrid}>
              <div style={s.searchWrap}>
                <Search size={14} color="#7a8a7a" />
                <input style={s.searchInput} placeholder="Search voucher, source, description..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <select style={s.filterInput} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">All types</option>
                {CASH_BANK_TRANSACTION_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <select style={s.filterInput} value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
                <option value="">All cash/bank accounts</option>
                {accounts.map((account) => (
                  <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
                ))}
              </select>
              <input type="date" style={s.filterInput} value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              <input type="date" style={s.filterInput} value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>

            <div style={s.tableCard}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>Voucher</th>
                    <th style={s.th}>Date</th>
                    <th style={s.th}>Type</th>
                    <th style={s.th}>Description</th>
                    <th style={s.th}>Accounts</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Inflow</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Outflow</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Net</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Reconciliation</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((item) => (
                    <tr key={item.voucherNo} style={s.trow}>
                      <td style={s.td}><span style={s.txnTag}>{item.voucherNo}</span></td>
                      <td style={{ ...s.td, color: '#64748b' }}>{item.date}</td>
                      <td style={s.td}>{item.transactionType.replace(/_/g, ' ')}</td>
                      <td style={s.td}>{item.description || '-'}</td>
                      <td style={s.td}>{item.accountCodes.map((code) => accountNameByCode.get(code) || code).join(' | ')}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: '#15803d', fontWeight: 700 }}>{formatMoney(item.totalIn)}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: '#b91c1c', fontWeight: 700 }}>{formatMoney(item.totalOut)}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{formatMoney(item.signedAmount)}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <span style={{ ...s.reconBadge, ...(item.reconciliationStatus === 'reconciled' ? s.reconDone : s.reconPending) }}>
                          {item.reconciliationStatus === 'reconciled' ? 'Reconciled' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {activities.length === 0 ? <p style={s.empty}>No transactions found for current filters.</p> : null}
            </div>
          </>
        ) : null}

        {tab === 'reconcile' ? (
          <div style={s.reconcileCard}>
            <div style={s.reconcileHead}>
              <RefreshCcw size={20} color="#0f766e" />
              <h3 style={s.reconcileTitle}>Bank Reconciliation</h3>
            </div>
            <p style={s.reconcileSub}>Run manual or CSV-based reconciliation and keep a history trail per bank account.</p>

            <div style={s.reconcileGrid}>
              <div style={s.fieldWrap}>
                <label style={s.label}>Bank Account *</label>
                <select style={s.input} value={reconForm.bankAccountCode} onChange={(event) => setReconField('bankAccountCode', event.target.value)}>
                  <option value="">Select bank account</option>
                  {bankAccounts.map((account) => (
                    <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
                  ))}
                </select>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Source Type *</label>
                <select style={s.input} value={reconForm.sourceType} onChange={(event) => setReconField('sourceType', event.target.value)}>
                  {CASH_BANK_RECON_SOURCE_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Statement Ending Balance *</label>
                <input type="number" step="0.01" style={s.input} value={reconForm.statementEndingBalance} onChange={(event) => setReconField('statementEndingBalance', event.target.value)} placeholder="0" />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Statement Date</label>
                <input type="date" style={s.input} value={reconForm.statementDate} onChange={(event) => setReconField('statementDate', event.target.value)} />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Period Start</label>
                <input type="date" style={s.input} value={reconForm.periodStart} onChange={(event) => setReconField('periodStart', event.target.value)} />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Period End</label>
                <input type="date" style={s.input} value={reconForm.periodEnd} onChange={(event) => setReconField('periodEnd', event.target.value)} />
              </div>
            </div>

            {reconForm.sourceType === 'csv' ? (
              <div style={s.csvPanel}>
                <label style={s.label}>Statement CSV</label>
                <div style={s.csvRow}>
                  <label style={s.uploadBtn}>
                    <FileSpreadsheet size={14} /> Upload CSV
                    <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleCsvUpload} />
                  </label>
                  <span style={s.csvMeta}>{csvRows.length} parsed rows</span>
                </div>
                {csvRows.length > 0 ? (
                  <div style={s.csvPreview}>
                    {csvRows.slice(0, 4).map((row) => (
                      <p key={row.id} style={s.csvLine}>{row.date} | {formatMoney(row.amount)} | {row.description || row.reference || '-'}</p>
                    ))}
                    {csvRows.length > 4 ? <p style={s.csvLine}>...and {csvRows.length - 4} more rows</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={s.fieldWrap}>
              <label style={s.label}>Notes</label>
              <textarea style={s.textarea} value={reconForm.notes} onChange={(event) => setReconField('notes', event.target.value)} placeholder="Optional reconciliation notes" />
            </div>

            <div style={s.reconcileActions}>
              <button style={s.reconcileBtn} onClick={runReconciliation} disabled={runningRecon}>{runningRecon ? 'Reconciling...' : 'Run Reconciliation'}</button>
              {reconError ? <p style={s.errorText}>{reconError}</p> : null}
            </div>

            {reconResult ? (
              <div style={s.resultCard}>
                <p style={s.resultTitle}>Latest Result</p>
                <p style={s.resultLine}>Status: <strong>{reconResult.status}</strong></p>
                <p style={s.resultLine}>Book Balance: {formatMoney(reconResult.bookBalance)}</p>
                <p style={s.resultLine}>Statement Balance: {formatMoney(reconResult.statementEndingBalance)}</p>
                <p style={s.resultLine}>Difference: {formatMoney(reconResult.difference)}</p>
                <p style={s.resultLine}>Matched / Unmatched: {reconResult.matchedEntries} / {reconResult.unmatchedEntries}</p>
              </div>
            ) : null}

            <div style={s.historyCard}>
              <h4 style={s.historyTitle}>Reconciliation History</h4>
              {reconciliations.length === 0 ? <p style={s.empty}>No reconciliation history yet.</p> : null}
              {reconciliations.map((item) => (
                <div key={item.id} style={s.historyRow}>
                  <div>
                    <p style={s.historyMain}>{item.bankAccountName || item.bankAccountCode}</p>
                    <p style={s.historySub}>{item.statementDate} | {item.sourceType.toUpperCase()} | Diff: {formatMoney(item.difference)}</p>
                  </div>
                  <span style={{ ...s.reconBadge, ...(item.status === 'reconciled' ? s.reconDone : s.reconPending) }}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </AccountLayout>
  )
}

const s = {
  page: { width: '100%', display: 'flex', flexDirection: 'column', gap: 20 },
  hero: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'linear-gradient(135deg, rgb(26, 61, 31) 0%, rgb(45, 122, 51) 100%)', borderRadius: 24, padding: 'clamp(14px, 3vw, 24px)' },
  heroLeft: { display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: '1 1 320px' },
  heroIcon: { width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { margin: 0, fontSize: 'clamp(18px, 3.2vw, 22px)', fontWeight: 800, color: '#fff' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#ccfbf1' },
  heroActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  refreshBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 999, padding: '10px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  addBtnGreen: { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#ffffff', color: '#0f766e', border: 'none', borderRadius: 999, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  addBtnRed: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 999, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  addBtnNeutral: { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#e8eee8', color: '#1a3d1f', border: '1px solid #d4dfd4', borderRadius: 999, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  noticeText: { margin: 0, padding: '10px 12px', borderRadius: 10, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 12.5, fontWeight: 600 },
  errorText: { margin: 0, padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12.5, fontWeight: 600 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 },
  sumCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 16, padding: '14px 16px' },
  sumLabel: { margin: 0, fontSize: 11, fontWeight: 700, color: '#7a8a7a', textTransform: 'uppercase', letterSpacing: '0.5px' },
  sumVal: { margin: '6px 0 0', fontSize: 20, fontWeight: 800, color: '#1a3d1f' },
  sumSub: { margin: '4px 0 0', fontSize: 11, color: '#8aa88a' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  tabs: { display: 'inline-flex', background: '#e8eee8', borderRadius: 999, padding: 4 },
  tab: { padding: '8px 18px', border: 'none', borderRadius: 999, background: 'transparent', color: '#607060', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  tabActive: { background: '#0f766e', color: '#fff' },
  pettyControlWrap: { background: '#fffaf0', border: '1px solid #fde68a', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  pettyControlHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  pettyControlTitleWrap: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  pettyControlTitle: { margin: 0, fontSize: 16, fontWeight: 800, color: '#1a3d1f' },
  pettyControlSub: { margin: '4px 0 0', fontSize: 12.5, color: '#64748b' },
  pettyControlActions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  secondaryBtn: { border: '1px solid #d4dfd4', borderRadius: 999, background: '#fff', color: '#1a3d1f', padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  primaryBtn: { border: 'none', borderRadius: 999, background: '#0f766e', color: '#fff', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  autoBtn: { border: '1px solid #86efac', borderRadius: 999, background: '#f0fdf4', color: '#166534', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  pettyFormGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 },
  checkboxRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 },
  checkItem: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: '#334155', background: '#fff', border: '1px solid #f3e8c9', borderRadius: 10, padding: '8px 10px' },
  expenseSeparationText: { margin: 0, fontSize: 12.5, color: '#92400e', background: '#fffbeb', border: '1px dashed #fcd34d', borderRadius: 10, padding: '8px 10px' },
  pettySetupTableWrap: { background: '#fff', border: '1px solid #f3e8c9', borderRadius: 12, overflow: 'auto' },
  flagWrap: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  smallBadge: { background: '#f5f9f5', border: '1px solid #dce7dc', borderRadius: 999, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, color: '#415443' },
  rowActions: { display: 'inline-flex', gap: 6 },
  smallBtn: { border: '1px solid #d4dfd4', borderRadius: 8, background: '#fff', color: '#1a3d1f', padding: '5px 8px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' },
  smallBtnPrimary: { border: 'none', borderRadius: 8, background: '#15803d', color: '#fff', padding: '5px 8px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' },
  acctGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  acctCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  acctTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  acctTypeBadge: { borderRadius: 999, padding: '3px 10px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' },
  badgeCash: { background: '#f0fdfa', color: '#0f766e' },
  badgeBank: { background: '#e8eee8', color: '#2a6f31' },
  badgePetty: { background: '#fffbeb', color: '#b45309' },
  acctName: { margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1a3d1f' },
  acctSub: { margin: 0, fontSize: 12, color: '#6b7280' },
  acctBalance: { margin: '4px 0 0', fontSize: 20, fontWeight: 800 },
  acctBtn: { marginTop: 6, border: '1px solid #d4dfd4', borderRadius: 999, background: '#fff', color: '#1a3d1f', padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  pettyPanel: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: 16, marginTop: 6 },
  sectionTitle: { margin: 0, fontSize: 15, fontWeight: 800, color: '#1a3d1f' },
  sectionSub: { margin: '4px 0 0', fontSize: 12, color: '#7a8a7a' },
  pettyGrid: { marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 },
  pettyCard: { background: '#fff', border: '1px solid #f3e8c9', borderRadius: 12, padding: 12 },
  pettyLabel: { margin: 0, fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.4px' },
  pettyValue: { margin: '6px 0 0', fontSize: 18, fontWeight: 800, color: '#78350f' },
  expenseLinkBtn: { marginTop: 12, border: '1px solid #fcd34d', borderRadius: 999, background: '#fff7ed', color: '#92400e', padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #d4dfd4', borderRadius: 999, padding: '8px 12px' },
  searchInput: { border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 12.5, color: '#1a3d1f', fontFamily: 'inherit' },
  filterInput: { border: '1px solid #d4dfd4', borderRadius: 10, padding: '9px 10px', fontSize: 12.5, color: '#1a3d1f', fontFamily: 'inherit', background: '#fff' },
  tableCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 16, overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 980 },
  thead: { background: '#e8eee8' },
  th: { padding: '11px 12px', fontSize: 11, fontWeight: 700, color: '#415443', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.4px' },
  trow: { borderTop: '1px solid #dde7dd' },
  td: { padding: '11px 12px', fontSize: 12.5, color: '#1a3d1f', verticalAlign: 'top' },
  txnTag: { background: '#f0fdfa', color: '#0f766e', borderRadius: 8, padding: '3px 8px', fontSize: 11.5, fontWeight: 700 },
  reconBadge: { borderRadius: 999, padding: '4px 8px', fontSize: 10.5, fontWeight: 700, display: 'inline-block' },
  reconDone: { background: '#ecfdf5', color: '#15803d', border: '1px solid #a7f3d0' },
  reconPending: { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' },
  reconcileCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 },
  reconcileHead: { display: 'flex', alignItems: 'center', gap: 10 },
  reconcileTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: '#1a3d1f' },
  reconcileSub: { margin: 0, fontSize: 12.5, color: '#6b7280' },
  reconcileGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' },
  input: { border: '1px solid #d4dfd4', borderRadius: 10, padding: '9px 10px', fontSize: 12.5, color: '#1a3d1f', fontFamily: 'inherit', background: '#fff' },
  csvPanel: { background: '#eef6ef', border: '1px dashed #c4d9c4', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  csvRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  uploadBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #c4d9c4', borderRadius: 999, padding: '7px 12px', background: '#fff', color: '#2d7a33', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  csvMeta: { fontSize: 12, color: '#64748b' },
  csvPreview: { background: '#fff', border: '1px solid #dce7dc', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 4 },
  csvLine: { margin: 0, fontSize: 12, color: '#334155' },
  textarea: { border: '1px solid #d4dfd4', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, minHeight: 76, resize: 'vertical', color: '#1a3d1f', fontFamily: 'inherit', background: '#fff' },
  reconcileActions: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  reconcileBtn: { border: 'none', borderRadius: 999, padding: '10px 16px', background: '#0f766e', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  resultCard: { background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 12 },
  resultTitle: { margin: 0, fontSize: 13, fontWeight: 800, color: '#065f46' },
  resultLine: { margin: '4px 0 0', fontSize: 12.5, color: '#065f46' },
  historyCard: { background: '#fff', border: '1px solid #dde7dd', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  historyTitle: { margin: 0, fontSize: 13.5, fontWeight: 800, color: '#1a3d1f' },
  historyRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: '1px solid #ecf1ec', paddingTop: 8 },
  historyMain: { margin: 0, fontSize: 12.5, fontWeight: 700, color: '#1a3d1f' },
  historySub: { margin: '3px 0 0', fontSize: 11.5, color: '#64748b' },
  empty: { margin: 0, padding: '10px 0', color: '#6b7280', fontSize: 12.5 },
}
