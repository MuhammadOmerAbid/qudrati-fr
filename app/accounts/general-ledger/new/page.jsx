'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle } from 'lucide-react'
import AccountEntryPage, { accountEntryStyles as es } from '@/components/accounts/AccountEntryPage'
import {
  getLedgerAccountDropdownGroups,
  getNextVoucherNumber,
  loadChartAccountsFromStorage,
  postJournalRows,
} from '@/application/services/accounts/accountsWorkflow'

const todayISO = () => new Date().toISOString().slice(0, 10)
const blankRow = () => ({ accountCode: '', debit: '', credit: '' })

export default function GeneralLedgerNewPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const [voucherNo, setVoucherNo] = useState('JV-001')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [rows, setRows] = useState([blankRow(), blankRow()])
  const [accounts, setAccounts] = useState([])

  useEffect(() => {
    const loadedAccounts = loadChartAccountsFromStorage()
    setAccounts(loadedAccounts)
    setVoucherNo(getNextVoucherNumber())
  }, [])

  const accountGroups = useMemo(() => getLedgerAccountDropdownGroups(accounts), [accounts])

  const normalizedRows = useMemo(() => (
    rows
      .map((row) => ({ accountCode: String(row.accountCode || '').trim(), debit: Number(row.debit) || 0, credit: Number(row.credit) || 0 }))
      .filter((row) => row.accountCode && (row.debit > 0 || row.credit > 0))
  ), [rows])

  const totalDebit = useMemo(() => normalizedRows.reduce((sum, row) => sum + row.debit, 0), [normalizedRows])
  const totalCredit = useMemo(() => normalizedRows.reduce((sum, row) => sum + row.credit, 0), [normalizedRows])
  const balanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.0001

  const setRow = (index, key, value) => {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [key]: value } : row)))
    setErrors((prev) => ({ ...prev, rows: undefined }))
  }

  const addRow = () => setRows((prev) => [...prev, blankRow()])

  const validate = () => {
    const next = {}
    if (!date) next.date = 'Date is required'
    if (!description.trim()) next.description = 'Description is required'
    if (normalizedRows.length < 2) next.rows = 'Enter at least two account rows'
    if (!balanced) next.balance = 'Debit and credit totals must match'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    setFormError('')

    try {
      postJournalRows({
        date,
        description: description.trim(),
        reference: reference.trim(),
        rows: normalizedRows,
      })

      router.push('/accounts/general-ledger')
    } catch (error) {
      setFormError(error?.message || 'Unable to post entry')
      setSaving(false)
    }
  }

  return (
    <AccountEntryPage
      title="New Journal Entry"
      subtitle="General Ledger posting with hierarchical account selection"
      backHref="/accounts/general-ledger"
      onSave={handleSave}
      saveLabel="Post Entry"
      saveDisabled={!balanced}
      saving={saving}
    >
      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Date *</label>
          <input type="date" style={{ ...es.input, ...(errors.date ? es.inputError : {}) }} value={date} onChange={(e) => setDate(e.target.value)} />
          {errors.date ? <span style={es.errorText}>{errors.date}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Voucher No</label>
          <input style={{ ...es.input, background: '#f8faf8', color: '#415443' }} value={voucherNo} readOnly />
        </div>
      </div>

      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Description *</label>
          <input style={{ ...es.input, ...(errors.description ? es.inputError : {}) }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this journal entry" />
          {errors.description ? <span style={es.errorText}>{errors.description}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Reference</label>
          <input style={es.input} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional reference" />
        </div>
      </div>

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
            {rows.map((row, index) => (
              <tr key={index}>
                <td style={s.td}>
                  <select style={es.input} value={row.accountCode} onChange={(e) => setRow(index, 'accountCode', e.target.value)}>
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
                  <input type="number" min="0" step="0.01" style={{ ...es.input, textAlign: 'right' }} value={row.debit} onChange={(e) => setRow(index, 'debit', e.target.value)} placeholder="0" />
                </td>
                <td style={s.td}>
                  <input type="number" min="0" step="0.01" style={{ ...es.input, textAlign: 'right' }} value={row.credit} onChange={(e) => setRow(index, 'credit', e.target.value)} placeholder="0" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...s.td, fontWeight: 700 }}>Total</td>
              <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{totalDebit.toLocaleString()}</td>
              <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{totalCredit.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button type="button" style={s.addRowBtn} onClick={addRow}>+ Add Row</button>

      <div style={{ ...s.balanceBar, ...(balanced ? s.okBar : s.badBar) }}>
        {balanced ? <CheckCircle size={16} color="#16a34a" /> : <AlertCircle size={16} color="#dc2626" />}
        <span style={{ ...s.balanceText, color: balanced ? '#166534' : '#b91c1c' }}>
          {balanced ? 'Balanced and ready to post' : 'Unbalanced: debit must equal credit'}
        </span>
      </div>

      {errors.rows ? <p style={es.errorText}>{errors.rows}</p> : null}
      {errors.balance ? <p style={es.errorText}>{errors.balance}</p> : null}
      {formError ? <p style={es.errorText}>{formError}</p> : null}
    </AccountEntryPage>
  )
}

const s = {
  tableWrap: {
    border: '1px solid #e2e8e2',
    borderRadius: 14,
    overflow: 'hidden',
    background: '#ffffff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '10px 12px',
    background: '#e8eee8',
    color: '#415443',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    textAlign: 'left',
  },
  td: {
    padding: '8px 10px',
    borderTop: '1px solid #e2e8e2',
  },
  addRowBtn: {
    marginTop: 10,
    border: '1px dashed #c5d4c5',
    borderRadius: 999,
    background: '#ffffff',
    color: '#2d7a33',
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  balanceBar: {
    marginTop: 12,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    border: '1px solid',
  },
  okBar: {
    background: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  badBar: {
    background: '#fef2f2',
    borderColor: '#fecaca',
  },
  balanceText: {
    fontSize: 13,
    fontWeight: 600,
  },
}

