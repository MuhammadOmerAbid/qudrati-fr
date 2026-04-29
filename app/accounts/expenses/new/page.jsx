'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountEntryPage, { accountEntryStyles as es } from '@/components/accounts/AccountEntryPage'
import {
  ACCOUNTS_EXPENSE_CATEGORY_OPTIONS,
  ACCOUNTS_EXPENSE_PAYMENT_MODES,
  createAccountsExpenseTransaction,
  isPostableAccount,
  loadCashBankAccountsFromChart,
  loadChartAccountsFromStorage,
} from '@/application/services/accounts/accountsWorkflow'

const todayISO = () => new Date().toISOString().slice(0, 10)
const toMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100

export default function ExpensesNewPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [accounts, setAccounts] = useState([])
  const [cashBankAccounts, setCashBankAccounts] = useState([])
  const [form, setForm] = useState({
    date: todayISO(),
    category: '',
    itemName: '',
    description: '',
    amount: '',
    expenseAccountCode: '',
    paymentMode: 'petty_cash',
    paymentAccountCode: '',
    payableAccountCode: '',
    reference: '',
  })

  useEffect(() => {
    const all = loadChartAccountsFromStorage()
    setAccounts(all)
    setCashBankAccounts(loadCashBankAccountsFromChart(all))
  }, [])

  const expenseAccountOptions = useMemo(() => (
    accounts
      .filter((account) => !account.deletedAt && account.active !== false && isPostableAccount(account, accounts) && account.type === 'Expenses')
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [accounts])

  const payableAccountOptions = useMemo(() => (
    accounts
      .filter((account) => !account.deletedAt && account.active !== false && isPostableAccount(account, accounts) && account.type === 'Liabilities')
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [accounts])

  const pettyCashOptions = useMemo(() => (
    cashBankAccounts
      .filter((account) => account.kind === 'petty-cash')
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [cashBankAccounts])

  const cashOptions = useMemo(() => (
    cashBankAccounts
      .filter((account) => account.kind === 'cash')
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [cashBankAccounts])

  const bankOptions = useMemo(() => (
    cashBankAccounts
      .filter((account) => account.kind === 'bank')
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [cashBankAccounts])

  const paymentAccountOptions = useMemo(() => {
    if (form.paymentMode === 'bank') return bankOptions
    if (form.paymentMode === 'cash') return cashOptions
    return pettyCashOptions
  }, [bankOptions, cashOptions, form.paymentMode, pettyCashOptions])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError('')
  }

  const validate = () => {
    const next = {}
    const amount = toMoney(Number(form.amount) || 0)

    if (!form.date) next.date = 'Date is required'
    if (amount <= 0) next.amount = 'Amount must be greater than zero'
    if (!form.expenseAccountCode) next.expenseAccountCode = 'Expense account is required'
    if (!String(form.category || '').trim()) next.category = 'Category is required'
    if (form.paymentMode === 'credit' && !form.payableAccountCode) next.payableAccountCode = 'Payable account is required'
    if (form.paymentMode !== 'credit' && !form.paymentAccountCode) next.paymentAccountCode = 'Payment account is required'

    setErrors(next)
    if (Object.keys(next).length > 0) return null

    return {
      date: form.date,
      category: String(form.category || '').trim(),
      itemName: form.itemName.trim(),
      description: form.description.trim(),
      amount,
      expenseAccountCode: String(form.expenseAccountCode || '').trim(),
      paymentMode: form.paymentMode,
      paymentAccountCode: String(form.paymentAccountCode || '').trim(),
      payableAccountCode: String(form.payableAccountCode || '').trim(),
      reference: form.reference.trim(),
    }
  }

  const handleSave = async () => {
    if (saving) return
    const payload = validate()
    if (!payload) return

    setSaving(true)
    try {
      const actor = user?.name || user?.username || 'system'
      const result = createAccountsExpenseTransaction({
        ...payload,
        user: actor,
      })
      router.push(`/accounts/expenses?notice=posted&exp=${encodeURIComponent(result.expense.id)}`)
    } catch (error) {
      setFormError(error?.message || 'Unable to post expense')
      setSaving(false)
    }
  }

  return (
    <AccountEntryPage
      title="Record Expense"
      subtitle="Expense module entry (auto-sync to GL, COA, and Cash/Bank where applicable)"
      backHref="/accounts/expenses"
      onSave={handleSave}
      saveLabel="Post Expense"
      saving={saving}
      footer={formError ? <p style={es.errorText}>{formError}</p> : null}
    >
      <div style={es.row3}>
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
          <label style={es.label}>Category *</label>
          <input
            list="expense-category-suggestions"
            style={{ ...es.input, ...(errors.category ? es.inputError : {}) }}
            value={form.category}
            onChange={(event) => setField('category', event.target.value)}
            placeholder="Type category (e.g. Office Supplies)"
          />
          <datalist id="expense-category-suggestions">
            {ACCOUNTS_EXPENSE_CATEGORY_OPTIONS.map((entry) => (
              <option key={entry} value={entry} />
            ))}
          </datalist>
          {errors.category ? <span style={es.errorText}>{errors.category}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Amount *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={{ ...es.input, ...(errors.amount ? es.inputError : {}) }}
            value={form.amount}
            onChange={(event) => setField('amount', event.target.value)}
            placeholder="0"
          />
          {errors.amount ? <span style={es.errorText}>{errors.amount}</span> : null}
        </div>
      </div>

      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Expense Account *</label>
          <select
            style={{ ...es.input, ...(errors.expenseAccountCode ? es.inputError : {}) }}
            value={form.expenseAccountCode}
            onChange={(event) => setField('expenseAccountCode', event.target.value)}
          >
            <option value="">Select expense account</option>
            {expenseAccountOptions.map((account) => (
              <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
            ))}
          </select>
          {errors.expenseAccountCode ? <span style={es.errorText}>{errors.expenseAccountCode}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Payment Mode *</label>
          <select
            style={es.input}
            value={form.paymentMode}
            onChange={(event) => {
              setField('paymentMode', event.target.value)
              setField('paymentAccountCode', '')
              setField('payableAccountCode', '')
            }}
          >
            {ACCOUNTS_EXPENSE_PAYMENT_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
        </div>
      </div>

      {form.paymentMode === 'credit' ? (
        <div style={es.fieldWrap}>
          <label style={es.label}>Payable Account *</label>
          <select
            style={{ ...es.input, ...(errors.payableAccountCode ? es.inputError : {}) }}
            value={form.payableAccountCode}
            onChange={(event) => setField('payableAccountCode', event.target.value)}
          >
            <option value="">Select payable account</option>
            {payableAccountOptions.map((account) => (
              <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
            ))}
          </select>
          {errors.payableAccountCode ? <span style={es.errorText}>{errors.payableAccountCode}</span> : null}
        </div>
      ) : (
        <div style={es.fieldWrap}>
          <label style={es.label}>Payment Account *</label>
          <select
            style={{ ...es.input, ...(errors.paymentAccountCode ? es.inputError : {}) }}
            value={form.paymentAccountCode}
            onChange={(event) => setField('paymentAccountCode', event.target.value)}
          >
            <option value="">Select payment account</option>
            {paymentAccountOptions.map((account) => (
              <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
            ))}
          </select>
          {errors.paymentAccountCode ? <span style={es.errorText}>{errors.paymentAccountCode}</span> : null}
        </div>
      )}

      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Item</label>
          <input
            style={es.input}
            value={form.itemName}
            onChange={(event) => setField('itemName', event.target.value)}
            placeholder="e.g. Stationery, Fuel, Tea"
          />
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Reference</label>
          <input
            style={es.input}
            value={form.reference}
            onChange={(event) => setField('reference', event.target.value)}
            placeholder="Bill No / Slip No"
          />
        </div>
      </div>

      <div style={es.fieldWrap}>
        <label style={es.label}>Description</label>
        <textarea
          style={{ ...es.input, minHeight: 90, resize: 'vertical' }}
          value={form.description}
          onChange={(event) => setField('description', event.target.value)}
          placeholder="Optional details for this expense"
        />
      </div>
    </AccountEntryPage>
  )
}

