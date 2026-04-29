'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountEntryPage, { accountEntryStyles as es } from '@/components/accounts/AccountEntryPage'
import {
  createAccountingVoucher,
  getLedgerAccountDropdownGroups,
  isPostableAccount,
  loadCashBankAccountsFromChart,
  loadChartAccountsFromStorage,
} from '@/application/services/accounts/accountsWorkflow'

const VOUCHER_TYPES = ['Payment Voucher', 'Receipt Voucher', 'Journal Voucher']
const todayISO = () => new Date().toISOString().slice(0, 10)
const toMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100
const blankRow = () => ({ accountCode: '', debit: '', credit: '' })

function typeToHint(type) {
  if (type === 'Payment Voucher') return 'Cash/Bank is credited; counter account is debited.'
  if (type === 'Receipt Voucher') return 'Cash/Bank is debited; counter account is credited.'
  return 'Enter balanced debit/credit rows manually.'
}

export default function VouchersNewPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [accounts, setAccounts] = useState([])
  const [cashAccounts, setCashAccounts] = useState([])
  const [form, setForm] = useState({
    type: 'Payment Voucher',
    date: todayISO(),
    amount: '',
    cashAccountCode: '',
    counterAccountCode: '',
    narration: '',
    reference: '',
  })
  const [journalRows, setJournalRows] = useState([blankRow(), blankRow()])

  useEffect(() => {
    const loaded = loadChartAccountsFromStorage()
    setAccounts(loaded)
    setCashAccounts(loadCashBankAccountsFromChart(loaded))
  }, [])

  const accountGroups = useMemo(() => getLedgerAccountDropdownGroups(accounts), [accounts])

  const counterAccounts = useMemo(() => (
    accounts
      .filter((account) => (
        !account.deletedAt
        && account.active !== false
        && isPostableAccount(account, accounts)
      ))
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [accounts])

  const normalizedJournalRows = useMemo(() => (
    journalRows
      .map((row) => ({
        accountCode: String(row.accountCode || '').trim(),
        debit: toMoney(Number(row.debit) || 0),
        credit: toMoney(Number(row.credit) || 0),
      }))
      .filter((row) => row.accountCode && (row.debit > 0 || row.credit > 0))
  ), [journalRows])

  const journalTotals = useMemo(() => ({
    debit: toMoney(normalizedJournalRows.reduce((sum, row) => sum + row.debit, 0)),
    credit: toMoney(normalizedJournalRows.reduce((sum, row) => sum + row.credit, 0)),
  }), [normalizedJournalRows])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError('')
  }

  const setJournalField = (index, key, value) => {
    setJournalRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [key]: value } : row)))
    setErrors((prev) => ({ ...prev, rows: undefined }))
    setFormError('')
  }

  const addJournalRow = () => {
    setJournalRows((prev) => [...prev, blankRow()])
  }

  const validate = () => {
    const next = {}
    if (!form.date) next.date = 'Date is required'
    if (!String(form.narration || '').trim()) next.narration = 'Narration is required'

    if (form.type === 'Journal Voucher') {
      if (normalizedJournalRows.length < 2) next.rows = 'Journal voucher requires at least two lines'
      if (journalTotals.debit <= 0 || Math.abs(journalTotals.debit - journalTotals.credit) > 0.0001) {
        next.rows = 'Journal voucher must be balanced'
      }
    } else {
      const amount = toMoney(Number(form.amount) || 0)
      if (amount <= 0) next.amount = 'Amount must be greater than zero'
      if (!form.cashAccountCode) next.cashAccountCode = 'Cash/Bank account is required'
      if (!form.counterAccountCode) next.counterAccountCode = 'Counter account is required'
      if (form.cashAccountCode && form.counterAccountCode && form.cashAccountCode === form.counterAccountCode) {
        next.counterAccountCode = 'Counter account must be different from cash/bank account'
      }
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (saving) return
    if (!validate()) return

    setSaving(true)
    setFormError('')
    const actor = user?.name || user?.username || 'system'

    try {
      const result = createAccountingVoucher({
        type: form.type,
        date: form.date,
        amount: form.type === 'Journal Voucher' ? 0 : toMoney(Number(form.amount) || 0),
        cashAccountCode: form.cashAccountCode,
        counterAccountCode: form.counterAccountCode,
        narration: form.narration.trim(),
        reference: form.reference.trim(),
        rows: normalizedJournalRows,
        user: actor,
      })
      router.push(`/accounts/vouchers?notice=posted&voucher=${encodeURIComponent(result.voucherId)}`)
    } catch (error) {
      setFormError(error?.message || 'Unable to post voucher')
      setSaving(false)
    }
  }

  return (
    <AccountEntryPage
      title="Create Voucher"
      subtitle="Post payment, receipt, or journal voucher directly to General Ledger"
      backHref="/accounts/vouchers"
      onSave={handleSave}
      saveLabel="Post Voucher"
      saving={saving}
    >
      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Voucher Type *</label>
          <select style={es.input} value={form.type} onChange={(event) => setField('type', event.target.value)}>
            {VOUCHER_TYPES.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
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
      </div>

      <div style={s.hintBox}>{typeToHint(form.type)}</div>

      {form.type !== 'Journal Voucher' ? (
        <>
          <div style={es.row2}>
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

            <div style={es.fieldWrap}>
              <label style={es.label}>Cash/Bank Account *</label>
              <select
                style={{ ...es.input, ...(errors.cashAccountCode ? es.inputError : {}) }}
                value={form.cashAccountCode}
                onChange={(event) => setField('cashAccountCode', event.target.value)}
              >
                <option value="">Select cash/bank account</option>
                {cashAccounts.map((account) => (
                  <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
                ))}
              </select>
              {errors.cashAccountCode ? <span style={es.errorText}>{errors.cashAccountCode}</span> : null}
            </div>
          </div>

          <div style={es.fieldWrap}>
            <label style={es.label}>Counter Account *</label>
            <select
              style={{ ...es.input, ...(errors.counterAccountCode ? es.inputError : {}) }}
              value={form.counterAccountCode}
              onChange={(event) => setField('counterAccountCode', event.target.value)}
            >
              <option value="">Select counter account</option>
              {counterAccounts.map((account) => (
                <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
              ))}
            </select>
            {errors.counterAccountCode ? <span style={es.errorText}>{errors.counterAccountCode}</span> : null}
          </div>
        </>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Account</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Debit</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {journalRows.map((row, index) => (
                <tr key={index}>
                  <td style={s.td}>
                    <select
                      style={es.input}
                      value={row.accountCode}
                      onChange={(event) => setJournalField(index, 'accountCode', event.target.value)}
                    >
                      <option value="">Select account</option>
                      {accountGroups.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.accounts.map((account) => (
                            <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td style={s.td}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      style={{ ...es.input, textAlign: 'right' }}
                      value={row.debit}
                      onChange={(event) => setJournalField(index, 'debit', event.target.value)}
                      placeholder="0"
                    />
                  </td>
                  <td style={s.td}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      style={{ ...es.input, textAlign: 'right' }}
                      value={row.credit}
                      onChange={(event) => setJournalField(index, 'credit', event.target.value)}
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...s.td, fontWeight: 700 }}>Total</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{journalTotals.debit.toLocaleString()}</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{journalTotals.credit.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
          <button type="button" style={s.addRowBtn} onClick={addJournalRow}>+ Add Row</button>
          {errors.rows ? <p style={es.errorText}>{errors.rows}</p> : null}
        </div>
      )}

      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Narration *</label>
          <input
            style={{ ...es.input, ...(errors.narration ? es.inputError : {}) }}
            value={form.narration}
            onChange={(event) => setField('narration', event.target.value)}
            placeholder="Voucher narration"
          />
          {errors.narration ? <span style={es.errorText}>{errors.narration}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Reference</label>
          <input
            style={es.input}
            value={form.reference}
            onChange={(event) => setField('reference', event.target.value)}
            placeholder="Optional reference"
          />
        </div>
      </div>

      {formError ? <p style={es.errorText}>{formError}</p> : null}
    </AccountEntryPage>
  )
}

const s = {
  hintBox: {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    background: '#f8fafc',
    color: '#334155',
    fontSize: 12.5,
    fontWeight: 600,
    padding: '10px 12px',
    marginBottom: 10,
  },
  tableWrap: {
    border: '1px solid #e2e8e2',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#ffffff',
    marginBottom: 10,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '10px 12px',
    background: '#f1f5f9',
    color: '#475569',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    textAlign: 'left',
  },
  td: {
    padding: '8px 10px',
    borderTop: '1px solid #e2e8e2',
    verticalAlign: 'top',
  },
  addRowBtn: {
    margin: '10px 0 0 10px',
    border: '1px dashed #94a3b8',
    borderRadius: 999,
    background: '#ffffff',
    color: '#1e293b',
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
}

