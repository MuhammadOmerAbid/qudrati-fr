'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountEntryPage, { accountEntryStyles as es } from '@/components/accounts/AccountEntryPage'
import {
  CASH_BANK_TRANSACTION_TYPES,
  createCashBankTransaction,
  getCashBankAccountsSummary,
  isPostableAccount,
  loadCashBankAccountsFromChart,
  loadChartAccountsFromStorage,
} from '@/application/services/accounts/accountsWorkflow'

const todayISO = () => new Date().toISOString().slice(0, 10)
const toMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100
const toKey = (value) => String(value || '').trim().toLowerCase()

function inferTypeFromQuery(rawType) {
  const key = toKey(rawType)
  if (key === 'payment') return 'cash_payment'
  if (key === 'receipt') return 'cash_receipt'
  if (key === 'petty-balance' || key === 'petty_balance' || key === 'petty' || key === 'petty_cash_fund') return 'petty_cash_fund'
  if (key === 'petty-expense' || key === 'petty_expense' || key === 'petty_cash_expense') return 'petty_cash_expense'
  if (key === 'bank_deposit') return 'bank_deposit'
  if (key === 'bank_withdrawal') return 'bank_withdrawal'
  return ''
}

// Transaction type hints: what each type does in double-entry terms
const TRANSACTION_HINTS = {
  cash_receipt: 'DR Cash/Bank  |  CR Counter Account (Revenue / Receivable / Equity)',
  cash_payment: 'DR Counter Account  |  CR Cash/Bank (Liability / Asset transfer)',
  bank_deposit: 'DR Bank Account  |  CR Cash Account (cash-to-bank transfer)',
  bank_withdrawal: 'DR Cash Account  |  CR Bank Account (bank-to-cash transfer)',
  petty_cash_fund: 'DR Petty Cash Account  |  CR Funding Account (Cash or Bank)',
  petty_cash_expense: 'DR Expense Account  |  CR Petty Cash Account (expense posted to GL & Expenses module)',
}

export default function CashBankNewPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [accounts, setAccounts] = useState([])
  const [cashBankAccounts, setCashBankAccounts] = useState([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [isPettyFlow, setIsPettyFlow] = useState(false)
  const [form, setForm] = useState({
    transactionType: 'cash_receipt',
    date: todayISO(),
    amount: '',
    reference: '',
    description: '',
    accountCode: '',
    counterAccountCode: '',
    cashAccountCode: '',
    bankAccountCode: '',
    pettyCashAccountCode: '',
    expenseAccountCode: '',
  })

  useEffect(() => {
    const all = loadChartAccountsFromStorage()
    setAccounts(all)
    setCashBankAccounts(loadCashBankAccountsFromChart(all))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const mode = toKey(params.get('mode'))
    const queryType = inferTypeFromQuery(params.get('type'))
    const pettyFlowRequested = mode === 'petty' || queryType === 'petty_cash_fund' || queryType === 'petty_cash_expense'
    setIsPettyFlow(pettyFlowRequested)

    setForm((prev) => ({
      ...prev,
      transactionType: queryType || (pettyFlowRequested ? 'petty_cash_fund' : prev.transactionType),
    }))
  }, [])

  // ── Account filter options ──────────────────────────────────────────────────

  // All counter accounts (excluding deleted/inactive), for generic cash_receipt / cash_payment
  const counterAccountOptions = useMemo(() => (
    accounts
      .filter((account) => !account.deletedAt && account.active !== false && isPostableAccount(account, accounts))
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [accounts])

  // Expense accounts only — for petty_cash_expense
  const expenseAccountOptions = useMemo(() => (
    accounts
      .filter((account) => (
        !account.deletedAt
        && account.active !== false
        && isPostableAccount(account, accounts)
        && account.type === 'Expenses'
      ))
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [accounts])

  // Cash + petty-cash accounts
  const cashOptions = useMemo(() => (
    cashBankAccounts
      .filter((account) => account.kind === 'cash' || account.kind === 'petty-cash')
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [cashBankAccounts])

  // Bank accounts only
  const bankOptions = useMemo(() => (
    cashBankAccounts
      .filter((account) => account.kind === 'bank')
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [cashBankAccounts])

  // Petty cash accounts only (kind=petty-cash OR name contains "petty")
  const pettyCashOptions = useMemo(() => (
    cashBankAccounts
      .filter((account) => account.kind === 'petty-cash' || toKey(account.name).includes('petty'))
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [cashBankAccounts])

  // Cash + Bank combined (for generic cash/bank account selector and funding source)
  const cashBankOptions = useMemo(() => (
    cashBankAccounts
      .filter((account) => account.kind === 'cash' || account.kind === 'bank')
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [cashBankAccounts])

  // All cash/bank/petty accounts (for generic cash/bank receiver on receipts/payments)
  const allCashBankOptions = useMemo(() => (
    cashBankAccounts
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [cashBankAccounts])

  const summary = useMemo(() => getCashBankAccountsSummary(), [cashBankAccounts])

  // Transaction type options: petty flow shows fund+expense only; regular flow shows all
  const transactionTypeOptions = useMemo(() => {
    if (isPettyFlow) {
      return CASH_BANK_TRANSACTION_TYPES.filter((item) =>
        item.value === 'petty_cash_fund' || item.value === 'petty_cash_expense'
      )
    }
    return CASH_BANK_TRANSACTION_TYPES
  }, [isPettyFlow])

  const currentHint = TRANSACTION_HINTS[form.transactionType] || ''

  const pageTitle = useMemo(() => {
    const selected = transactionTypeOptions.find((item) => item.value === form.transactionType)
    return selected ? `New ${selected.label}` : 'New Cash/Bank Transaction'
  }, [form.transactionType, transactionTypeOptions])

  const saveLabel = useMemo(() => {
    const selected = transactionTypeOptions.find((item) => item.value === form.transactionType)
    return selected ? `Post ${selected.label}` : 'Post Transaction'
  }, [form.transactionType, transactionTypeOptions])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError('')
  }

  const clearAccountFields = () => {
    setField('accountCode', '')
    setField('counterAccountCode', '')
    setField('cashAccountCode', '')
    setField('bankAccountCode', '')
    setField('pettyCashAccountCode', '')
    setField('expenseAccountCode', '')
  }

  const validate = () => {
    const next = {}
    const amount = toMoney(Number(form.amount) || 0)

    if (!form.transactionType) next.transactionType = 'Transaction type is required'
    if (!form.date) next.date = 'Date is required'
    if (amount <= 0) next.amount = 'Amount must be greater than zero'

    if (form.transactionType === 'cash_receipt' || form.transactionType === 'cash_payment') {
      if (!form.accountCode) next.accountCode = 'Cash/Bank account is required'
      if (!form.counterAccountCode) next.counterAccountCode = 'Counter account is required'
      if (form.accountCode && form.counterAccountCode && form.accountCode === form.counterAccountCode) {
        next.counterAccountCode = 'Counter account must be different from the cash/bank account'
      }
    }

    if (form.transactionType === 'bank_deposit' || form.transactionType === 'bank_withdrawal') {
      if (!form.bankAccountCode) next.bankAccountCode = 'Bank account is required'
      if (!form.cashAccountCode) next.cashAccountCode = 'Cash account is required'
      if (form.bankAccountCode && form.cashAccountCode && form.bankAccountCode === form.cashAccountCode) {
        next.cashAccountCode = 'Cash and bank account must be different'
      }
    }

    if (form.transactionType === 'petty_cash_fund') {
      if (!form.pettyCashAccountCode) next.pettyCashAccountCode = 'Petty cash account is required'
      if (!form.accountCode) next.accountCode = 'Funding source account (Cash or Bank) is required'
      if (form.pettyCashAccountCode && form.accountCode && form.pettyCashAccountCode === form.accountCode) {
        next.accountCode = 'Funding account must be different from petty cash account'
      }
    }

    if (form.transactionType === 'petty_cash_expense') {
      if (!form.pettyCashAccountCode) next.pettyCashAccountCode = 'Petty cash account is required'
      if (!form.expenseAccountCode) next.expenseAccountCode = 'Expense account is required'
      if (form.pettyCashAccountCode && form.expenseAccountCode && form.pettyCashAccountCode === form.expenseAccountCode) {
        next.expenseAccountCode = 'Expense account must be different from petty cash account'
      }
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return null

    return {
      transactionType: form.transactionType,
      date: form.date,
      amount,
      reference: form.reference.trim(),
      description: form.description.trim(),
      accountCode: String(form.accountCode || '').trim(),
      counterAccountCode: String(form.counterAccountCode || '').trim(),
      cashAccountCode: String(form.cashAccountCode || '').trim(),
      bankAccountCode: String(form.bankAccountCode || '').trim(),
      pettyCashAccountCode: String(form.pettyCashAccountCode || '').trim(),
      expenseAccountCode: String(form.expenseAccountCode || '').trim(),
    }
  }

  const handleSave = async () => {
    if (saving) return
    const payload = validate()
    if (!payload) return

    setSaving(true)
    try {
      const actor = user?.name || user?.username || 'system'
      const result = createCashBankTransaction({
        ...payload,
        user: actor,
      })
      router.push(`/accounts/cash-bank?notice=posted&cb=${encodeURIComponent(result.transaction.id)}`)
    } catch (error) {
      setFormError(error?.message || 'Unable to post cash/bank transaction')
      setSaving(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const kindBadge = (kind) => {
    if (kind === 'bank') return <span style={s.kindBadge.bank}>Bank</span>
    if (kind === 'petty-cash') return <span style={s.kindBadge.petty}>Petty</span>
    return <span style={s.kindBadge.cash}>Cash</span>
  }

  const renderSelect = (opts, value, onChange, placeholder, errorKey) => (
    <select
      style={{ ...es.input, ...(errors[errorKey] ? es.inputError : {}) }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {opts.map((account) => (
        <option key={account.code} value={account.code}>
          {account.code} — {account.name}
          {account.kind ? ` (${account.kind === 'petty-cash' ? 'Petty Cash' : account.kind.charAt(0).toUpperCase() + account.kind.slice(1)})` : ''}
          {' | Bal: Rs ' + (Number(account.balance) || 0).toLocaleString()}
        </option>
      ))}
    </select>
  )

  return (
    <AccountEntryPage
      title={pageTitle}
      subtitle={
        isPettyFlow
          ? 'Petty cash fund transfer and expense entry — auto-synced to Expense module and General Ledger.'
          : 'Post cash & bank receipts, payments, transfers, and petty cash transactions with proper double-entry.'
      }
      backHref="/accounts/cash-bank"
      onSave={handleSave}
      saveLabel={saveLabel}
      saving={saving}
      footer={(
        <div style={s.footerWrap}>
          {/* Live account balance summary */}
          <div style={s.summaryBar}>
            <div style={s.summaryItem}>
              <span style={s.summaryLabel}>Cash</span>
              <span style={{ ...s.summaryVal, color: '#0f766e' }}>Rs {summary.totalCash.toLocaleString()}</span>
            </div>
            <div style={s.summaryDivider} />
            <div style={s.summaryItem}>
              <span style={s.summaryLabel}>Bank</span>
              <span style={{ ...s.summaryVal, color: '#2d7a33' }}>Rs {summary.totalBank.toLocaleString()}</span>
            </div>
            <div style={s.summaryDivider} />
            <div style={s.summaryItem}>
              <span style={s.summaryLabel}>Petty Cash</span>
              <span style={{ ...s.summaryVal, color: '#b45309' }}>Rs {summary.pettyCash.toLocaleString()}</span>
            </div>
          </div>
          {formError ? <p style={s.errorText}>{formError}</p> : null}
        </div>
      )}
    >
      {/* ── Row 1: Transaction Type, Date, Amount ── */}
      <div style={es.row3}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Transaction Type *</label>
          <select
            style={{ ...es.input, ...(errors.transactionType ? es.inputError : {}) }}
            value={form.transactionType}
            onChange={(event) => {
              setField('transactionType', event.target.value)
              clearAccountFields()
            }}
          >
            {transactionTypeOptions.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          {errors.transactionType ? <span style={es.errorText}>{errors.transactionType}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Date *</label>
          <input
            type="date"
            style={{ ...es.input, ...(errors.date ? es.inputError : {}) }}
            value={form.date}
            onChange={(event) => setField('date', event.target.value)}
          />
          {errors.date ? <span style={es.errorText}>{errors.date}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Amount (Rs) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={{ ...es.input, ...(errors.amount ? es.inputError : {}) }}
            value={form.amount}
            onChange={(event) => setField('amount', event.target.value)}
            placeholder="0.00"
          />
          {errors.amount ? <span style={es.errorText}>{errors.amount}</span> : null}
        </div>
      </div>

      {/* ── Double-entry hint ── */}
      {currentHint ? (
        <div style={s.hintBox}>
          <span style={s.hintIcon}>⇄</span>
          <span style={s.hintText}>{currentHint}</span>
        </div>
      ) : null}

      {/* ── Cash Receipt / Payment: Cash/Bank + Counter account ── */}
      {(form.transactionType === 'cash_receipt' || form.transactionType === 'cash_payment') ? (
        <div style={es.row2}>
          <div style={es.fieldWrap}>
            <label style={es.label}>Cash / Bank Account *</label>
            {renderSelect(allCashBankOptions, form.accountCode, (v) => setField('accountCode', v), 'Select cash or bank account…', 'accountCode')}
            {errors.accountCode ? <span style={es.errorText}>{errors.accountCode}</span> : null}
          </div>

          <div style={es.fieldWrap}>
            <label style={es.label}>Counter Account *</label>
            {renderSelect(counterAccountOptions, form.counterAccountCode, (v) => setField('counterAccountCode', v), 'Select counter account…', 'counterAccountCode')}
            {errors.counterAccountCode ? <span style={es.errorText}>{errors.counterAccountCode}</span> : null}
          </div>
        </div>
      ) : null}

      {/* ── Bank Deposit / Withdrawal: Bank ↔ Cash ── */}
      {(form.transactionType === 'bank_deposit' || form.transactionType === 'bank_withdrawal') ? (
        <div style={es.row2}>
          <div style={es.fieldWrap}>
            <label style={es.label}>Bank Account *</label>
            {bankOptions.length === 0 ? (
              <p style={s.emptyHint}>No bank accounts found. Add one from Chart of Accounts.</p>
            ) : (
              renderSelect(bankOptions, form.bankAccountCode, (v) => setField('bankAccountCode', v), 'Select bank account…', 'bankAccountCode')
            )}
            {errors.bankAccountCode ? <span style={es.errorText}>{errors.bankAccountCode}</span> : null}
          </div>

          <div style={es.fieldWrap}>
            <label style={es.label}>Cash Account *</label>
            {cashOptions.length === 0 ? (
              <p style={s.emptyHint}>No cash accounts found. Add one from Chart of Accounts.</p>
            ) : (
              renderSelect(cashOptions, form.cashAccountCode, (v) => setField('cashAccountCode', v), 'Select cash account…', 'cashAccountCode')
            )}
            {errors.cashAccountCode ? <span style={es.errorText}>{errors.cashAccountCode}</span> : null}
          </div>
        </div>
      ) : null}

      {/* ── Petty Cash Fund: Petty Cash Account ← Funding source ── */}
      {form.transactionType === 'petty_cash_fund' ? (
        <>
          {pettyCashOptions.length === 0 ? (
            <div style={s.warnBox}>
              <strong>⚠ No petty cash account found.</strong> Please create one first from{' '}
              <a href="/accounts/chart-of-accounts/new?preset=petty-cash" style={s.warnLink}>Chart of Accounts → Add Account (Petty Cash preset)</a>.
            </div>
          ) : null}
          <div style={es.row2}>
            <div style={es.fieldWrap}>
              <label style={es.label}>Petty Cash Account * <span style={s.acctKindTag}>DR — receives funds</span></label>
              {renderSelect(pettyCashOptions, form.pettyCashAccountCode, (v) => setField('pettyCashAccountCode', v), 'Select petty cash account…', 'pettyCashAccountCode')}
              {errors.pettyCashAccountCode ? <span style={es.errorText}>{errors.pettyCashAccountCode}</span> : null}
            </div>

            <div style={es.fieldWrap}>
              <label style={es.label}>Funding Account (Cash / Bank) * <span style={s.acctKindTag}>CR — source of funds</span></label>
              {cashBankOptions.length === 0 ? (
                <p style={s.emptyHint}>No cash/bank accounts found.</p>
              ) : (
                renderSelect(cashBankOptions, form.accountCode, (v) => setField('accountCode', v), 'Select funding account…', 'accountCode')
              )}
              {errors.accountCode ? <span style={es.errorText}>{errors.accountCode}</span> : null}
            </div>
          </div>
        </>
      ) : null}

      {/* ── Petty Cash Expense: Petty Cash → Expense ── */}
      {form.transactionType === 'petty_cash_expense' ? (
        <>
          {pettyCashOptions.length === 0 ? (
            <div style={s.warnBox}>
              <strong>⚠ No petty cash account found.</strong> Fund petty cash first before posting expenses.
            </div>
          ) : null}
          <div style={es.row2}>
            <div style={es.fieldWrap}>
              <label style={es.label}>Petty Cash Account * <span style={s.acctKindTag}>CR — cash goes out</span></label>
              {renderSelect(pettyCashOptions, form.pettyCashAccountCode, (v) => setField('pettyCashAccountCode', v), 'Select petty cash account…', 'pettyCashAccountCode')}
              {errors.pettyCashAccountCode ? <span style={es.errorText}>{errors.pettyCashAccountCode}</span> : null}
            </div>

            <div style={es.fieldWrap}>
              <label style={es.label}>Expense Account * <span style={s.acctKindTag}>DR — expense recorded</span></label>
              {expenseAccountOptions.length === 0 ? (
                <p style={s.emptyHint}>No expense accounts found. Add one from Chart of Accounts.</p>
              ) : (
                renderSelect(expenseAccountOptions, form.expenseAccountCode, (v) => setField('expenseAccountCode', v), 'Select expense account…', 'expenseAccountCode')
              )}
              {errors.expenseAccountCode ? <span style={es.errorText}>{errors.expenseAccountCode}</span> : null}
            </div>
          </div>
          <p style={s.infoText}>
            ✓ This entry will automatically sync to the <strong>Expenses module</strong> and post a journal voucher in <strong>General Ledger</strong>.
          </p>
        </>
      ) : null}

      {/* ── Reference & Description ── */}
      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Reference</label>
          <input
            style={es.input}
            value={form.reference}
            onChange={(event) => setField('reference', event.target.value)}
            placeholder="Voucher ref / bank slip / cheque no"
          />
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Narration / Description</label>
          <input
            style={es.input}
            value={form.description}
            onChange={(event) => setField('description', event.target.value)}
            placeholder="Brief description of this transaction"
          />
        </div>
      </div>

      {/* ── Selected account balance preview ── */}
      {(form.pettyCashAccountCode || form.accountCode || form.bankAccountCode || form.cashAccountCode) ? (
        <div style={s.acctPreviewGrid}>
          {[
            { code: form.pettyCashAccountCode, label: 'Petty Cash Balance' },
            { code: form.accountCode, label: 'Funding/Counter Account Balance' },
            { code: form.bankAccountCode, label: 'Bank Balance' },
            { code: form.cashAccountCode, label: 'Cash Balance' },
          ]
            .filter((item) => item.code)
            .map((item) => {
              const found = allCashBankOptions.find((a) => a.code === item.code)
                || counterAccountOptions.find((a) => a.code === item.code)
                || expenseAccountOptions.find((a) => a.code === item.code)
              if (!found) return null
              return (
                <div key={item.code} style={s.acctPreviewCard}>
                  <p style={s.acctPreviewLabel}>{item.label}</p>
                  <p style={s.acctPreviewName}>{found.code} — {found.name}</p>
                  <p style={s.acctPreviewBal}>Rs {(Number(found.balance) || 0).toLocaleString()}</p>
                </div>
              )
            })}
        </div>
      ) : null}
    </AccountEntryPage>
  )
}

const s = {
  footerWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  summaryBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    background: '#f2f4f2',
    border: '1px solid #dde7dd',
    borderRadius: 10,
    overflow: 'hidden',
  },
  summaryItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 12px',
    gap: 2,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    background: '#dde7dd',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#7a8a7a',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: 800,
    color: '#1a3d1f',
  },
  hintBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 10,
    padding: '9px 14px',
  },
  hintIcon: {
    fontSize: 16,
    color: '#15803d',
    fontWeight: 700,
    flexShrink: 0,
  },
  hintText: {
    fontSize: 12,
    fontWeight: 600,
    color: '#166534',
    fontFamily: 'monospace',
    letterSpacing: '0.2px',
  },
  warnBox: {
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12.5,
    color: '#92400e',
    fontWeight: 500,
  },
  warnLink: {
    color: '#b45309',
    fontWeight: 700,
  },
  infoText: {
    margin: 0,
    fontSize: 12.5,
    color: '#065f46',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: 10,
    padding: '9px 14px',
  },
  emptyHint: {
    margin: 0,
    fontSize: 12,
    color: '#b45309',
    background: '#fffbeb',
    border: '1px dashed #fcd34d',
    borderRadius: 8,
    padding: '8px 10px',
  },
  errorText: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    color: '#b91c1c',
  },
  acctKindTag: {
    fontSize: 10,
    fontWeight: 600,
    color: '#6b7280',
    background: '#f1f5f9',
    borderRadius: 4,
    padding: '1px 5px',
    marginLeft: 4,
  },
  kindBadge: {
    bank: { fontSize: 10, fontWeight: 700, background: '#e0f2fe', color: '#0369a1', borderRadius: 4, padding: '1px 5px' },
    petty: { fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 5px' },
    cash: { fontSize: 10, fontWeight: 700, background: '#d1fae5', color: '#065f46', borderRadius: 4, padding: '1px 5px' },
  },
  acctPreviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 8,
  },
  acctPreviewCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '10px 12px',
  },
  acctPreviewLabel: {
    margin: 0,
    fontSize: 10,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  acctPreviewName: {
    margin: '4px 0 2px',
    fontSize: 12,
    fontWeight: 600,
    color: '#334155',
  },
  acctPreviewBal: {
    margin: 0,
    fontSize: 15,
    fontWeight: 800,
    color: '#1a3d1f',
  },
}
