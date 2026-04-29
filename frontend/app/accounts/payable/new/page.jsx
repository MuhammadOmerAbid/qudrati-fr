'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountEntryPage, { accountEntryStyles as es } from '@/components/accounts/AccountEntryPage'
import {
  createAccountsPayableTransaction,
  isAccountsPayableLocked,
  isPostableAccount,
  loadAccountsPayableFromStorage,
  loadChartAccountsFromStorage,
  updateAccountsPayableTransaction,
} from '@/application/services/accounts/accountsWorkflow'

const todayISO = () => new Date().toISOString().slice(0, 10)
const toMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100
const toKey = (value) => String(value || '').trim().toLowerCase()

function isCashOrBankName(value) {
  const key = toKey(value)
  return key.includes('cash') || key.includes('bank')
}

function getSplitPreview({ splitMode, totalCost, advancePaid, currentLiability, currentPercentage, nonCurrentPercentage }) {
  const total = toMoney(Math.max(0, Number(totalCost) || 0))
  const advance = toMoney(Math.max(0, Number(advancePaid) || 0))
  const remaining = toMoney(Math.max(0, total - advance))
  const mode = String(splitMode || 'equal').trim().toLowerCase()

  if (remaining <= 0) {
    return {
      mode,
      remaining,
      currentLiability: 0,
      nonCurrentLiability: 0,
      currentPercentage: mode === 'percentage' ? 0 : null,
      nonCurrentPercentage: mode === 'percentage' ? 0 : null,
      valid: true,
    }
  }

  if (mode === 'manual') {
    const current = toMoney(Number(currentLiability) || 0)
    return {
      mode,
      remaining,
      currentLiability: current,
      nonCurrentLiability: toMoney(Math.max(0, remaining - current)),
      currentPercentage: null,
      nonCurrentPercentage: null,
      valid: current >= 0 && current <= remaining,
    }
  }

  if (mode === 'percentage') {
    const hasCurrent = String(currentPercentage || '').trim() !== ''
    const hasNonCurrent = String(nonCurrentPercentage || '').trim() !== ''
    const currentPctRaw = Number(currentPercentage)
    const nonCurrentPctRaw = Number(nonCurrentPercentage)

    let currentPct = Number.isFinite(currentPctRaw) ? currentPctRaw : NaN
    let nonCurrentPct = Number.isFinite(nonCurrentPctRaw) ? nonCurrentPctRaw : NaN

    if (!Number.isFinite(currentPct) && Number.isFinite(nonCurrentPct)) currentPct = 100 - nonCurrentPct
    if (Number.isFinite(currentPct) && !Number.isFinite(nonCurrentPct)) nonCurrentPct = 100 - currentPct

    const valid = hasCurrent && hasNonCurrent
      && Number.isFinite(currentPct)
      && Number.isFinite(nonCurrentPct)
      && currentPct >= 0
      && nonCurrentPct >= 0
      && currentPct <= 100
      && nonCurrentPct <= 100
      && Math.abs((currentPct + nonCurrentPct) - 100) <= 0.0001

    const current = valid ? toMoney((remaining * currentPct) / 100) : 0
    const nonCurrent = valid ? toMoney(Math.max(0, remaining - current)) : 0

    return {
      mode,
      remaining,
      currentLiability: current,
      nonCurrentLiability: nonCurrent,
      currentPercentage: Number.isFinite(currentPct) ? currentPct : null,
      nonCurrentPercentage: Number.isFinite(nonCurrentPct) ? nonCurrentPct : null,
      valid,
    }
  }

  const current = toMoney(remaining / 2)
  return {
    mode: 'equal',
    remaining,
    currentLiability: current,
    nonCurrentLiability: toMoney(Math.max(0, remaining - current)),
    currentPercentage: null,
    nonCurrentPercentage: null,
    valid: true,
  }
}

function PayableNewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = String(searchParams.get('edit') || '').trim()
  const isEditMode = !!editId
  const { user } = useAuthStore()

  const [accounts, setAccounts] = useState([])
  const [loadingEdit, setLoadingEdit] = useState(isEditMode)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [errors, setErrors] = useState({})
  const [isLocked, setIsLocked] = useState(false)
  const [form, setForm] = useState({
    supplierName: '',
    itemType: '',
    date: todayISO(),
    payableDate: todayISO(),
    purchaseAccountCode: '',
    totalCost: '',
    advancePaid: '',
    paymentAccountCode: '',
    splitMode: 'equal',
    currentLiability: '',
    currentPercentage: '50',
    nonCurrentPercentage: '50',
    description: '',
    reference: '',
  })

  useEffect(() => {
    setAccounts(loadChartAccountsFromStorage())
  }, [])

  useEffect(() => {
    if (!isEditMode) {
      setLoadingEdit(false)
      return
    }

    const existing = loadAccountsPayableFromStorage().find((item) => item.id === editId && !item.deletedAt)
    if (!existing) {
      setFormError('Payable transaction not found.')
      setLoadingEdit(false)
      return
    }
    if (existing.origin === 'journal_inferred') {
      setFormError('This row is auto-synced from Journal Entry and cannot be edited from Payables.')
      setIsLocked(true)
      setLoadingEdit(false)
      return
    }

    setIsLocked(isAccountsPayableLocked(existing))
    setForm({
      supplierName: existing.supplierName,
      itemType: existing.itemType || '',
      date: existing.date || todayISO(),
      payableDate: existing.payableDate || existing.date || todayISO(),
      purchaseAccountCode: existing.purchaseAccountCode,
      totalCost: String(existing.totalCost || ''),
      advancePaid: String(existing.advancePaid || ''),
      paymentAccountCode: existing.paymentAccountCode || '',
      splitMode: existing.splitMode || 'equal',
      currentLiability: String(existing.currentLiability || ''),
      currentPercentage: existing.currentPercentage == null ? '50' : String(existing.currentPercentage),
      nonCurrentPercentage: existing.nonCurrentPercentage == null ? '50' : String(existing.nonCurrentPercentage),
      description: existing.description || '',
      reference: existing.reference || '',
    })
    setLoadingEdit(false)
  }, [editId, isEditMode])

  const purchaseAccountOptions = useMemo(() => (
    accounts
      .filter((account) => (
        !account.deletedAt
        && account.active !== false
        && isPostableAccount(account, accounts)
        && (account.type === 'Assets' || account.type === 'Expenses')
      ))
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [accounts])

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

  const splitPreview = useMemo(() => getSplitPreview(form), [form])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError('')
  }

  const validate = () => {
    const nextErrors = {}
    const totalCost = toMoney(Number(form.totalCost) || 0)
    const advancePaid = toMoney(Number(form.advancePaid) || 0)
    const split = getSplitPreview(form)

    if (!form.supplierName.trim()) nextErrors.supplierName = 'Supplier is required'
    if (!form.itemType.trim()) nextErrors.itemType = 'Item type is required'
    if (!form.date) nextErrors.date = 'Date is required'
    if (!form.payableDate) nextErrors.payableDate = 'Payable date is required'
    if (!form.purchaseAccountCode) nextErrors.purchaseAccountCode = 'Purchase account is required'
    if (totalCost <= 0) nextErrors.totalCost = 'Total cost must be greater than zero'
    if (advancePaid < 0) nextErrors.advancePaid = 'Advance paid cannot be negative'
    if (advancePaid > totalCost) nextErrors.advancePaid = 'Advance paid cannot exceed total cost'
    if (advancePaid > 0 && !form.paymentAccountCode) nextErrors.paymentAccountCode = 'Payment account is required for advance'

    if (form.splitMode === 'manual') {
      const current = toMoney(Number(form.currentLiability) || 0)
      if (current < 0) nextErrors.currentLiability = 'Current liability cannot be negative'
      if (current > split.remaining) nextErrors.currentLiability = 'Current liability cannot exceed remaining payable'
    }

    if (form.splitMode === 'percentage') {
      const currentPct = Number(form.currentPercentage)
      const nonCurrentPct = Number(form.nonCurrentPercentage)
      if (!Number.isFinite(currentPct)) nextErrors.currentPercentage = 'Current percentage is required'
      if (!Number.isFinite(nonCurrentPct)) nextErrors.nonCurrentPercentage = 'Non-current percentage is required'
      if (Number.isFinite(currentPct) && (currentPct < 0 || currentPct > 100)) nextErrors.currentPercentage = 'Current percentage must be between 0 and 100'
      if (Number.isFinite(nonCurrentPct) && (nonCurrentPct < 0 || nonCurrentPct > 100)) nextErrors.nonCurrentPercentage = 'Non-current percentage must be between 0 and 100'
      if (Number.isFinite(currentPct) && Number.isFinite(nonCurrentPct) && Math.abs((currentPct + nonCurrentPct) - 100) > 0.0001) {
        nextErrors.nonCurrentPercentage = 'Current + Non-current percentages must equal 100'
      }
    }

    if (!split.valid) {
      if (form.splitMode === 'manual' && !nextErrors.currentLiability) nextErrors.currentLiability = 'Invalid manual split'
      if (form.splitMode === 'percentage' && !nextErrors.nonCurrentPercentage) nextErrors.nonCurrentPercentage = 'Invalid percentage split'
    }

    const checkTotal = toMoney(split.currentLiability + split.nonCurrentLiability + advancePaid)
    if (Math.abs(checkTotal - totalCost) > 0.01) {
      nextErrors.totalCost = 'Current + Non-current + Advance must equal total cost'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return null

    return {
      supplierName: form.supplierName.trim(),
      itemType: form.itemType.trim(),
      date: form.date,
      payableDate: form.payableDate,
      purchaseAccountCode: form.purchaseAccountCode,
      totalCost,
      advancePaid,
      paymentAccountCode: advancePaid > 0 ? String(form.paymentAccountCode || '').trim() : '',
      splitMode: form.splitMode,
      currentLiability: split.currentLiability,
      currentPercentage: split.currentPercentage,
      nonCurrentPercentage: split.nonCurrentPercentage,
      description: form.description.trim(),
      reference: form.reference.trim(),
    }
  }

  const handleSave = async () => {
    if (saving || loadingEdit || (isEditMode && isLocked)) return

    const payload = validate()
    if (!payload) return

    setSaving(true)
    setFormError('')
    const actor = user?.name || user?.username || 'system'

    try {
      if (isEditMode) {
        const result = updateAccountsPayableTransaction({
          payableId: editId,
          ...payload,
          user: actor,
        })
        router.push(`/accounts/payable?notice=updated&ap=${encodeURIComponent(result.transaction.id)}`)
        return
      }

      const result = createAccountsPayableTransaction({
        ...payload,
        user: actor,
      })
      router.push(`/accounts/payable?notice=created&ap=${encodeURIComponent(result.transaction.id)}`)
    } catch (error) {
      setFormError(error?.message || 'Unable to save accounts payable transaction')
      setSaving(false)
    }
  }

  if (loadingEdit) {
    return (
      <AccountEntryPage
        title="Edit Accounts Payable"
        subtitle="Loading payable transaction details"
        backHref="/accounts/payable"
        onSave={() => {}}
        saveLabel="Save Changes"
        saving
      >
        <p style={es.mutedText}>Loading...</p>
      </AccountEntryPage>
    )
  }

  return (
    <AccountEntryPage
      title={isEditMode ? 'Edit Accounts Payable' : 'Record Accounts Payable'}
      subtitle="Recognize full purchase cost, advance payment, and current/non-current payable split"
      backHref="/accounts/payable"
      onSave={handleSave}
      saveLabel={isEditMode ? 'Save Changes' : 'Save Payable'}
      saving={saving}
      saveDisabled={isEditMode && isLocked}
      footer={(
        <div style={s.footerWrap}>
          <p style={es.mutedText}>Validation rule: `Advance + Current Liability + Non-Current Liability = Total Cost`</p>
          {isEditMode && isLocked ? <p style={s.lockedText}>This entry is locked after 24 hours and cannot be edited.</p> : null}
          {formError ? <p style={s.errorText}>{formError}</p> : null}
        </div>
      )}
    >
      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Supplier Name *</label>
          <input
            style={{ ...es.input, ...(errors.supplierName ? es.inputError : {}) }}
            value={form.supplierName}
            onChange={(event) => setField('supplierName', event.target.value)}
            placeholder="Enter supplier name"
          />
          {errors.supplierName ? <span style={es.errorText}>{errors.supplierName}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Item Type *</label>
          <input
            style={{ ...es.input, ...(errors.itemType ? es.inputError : {}) }}
            value={form.itemType}
            onChange={(event) => setField('itemType', event.target.value)}
            placeholder="e.g. Raw Material, Packaging, Machinery"
          />
          {errors.itemType ? <span style={es.errorText}>{errors.itemType}</span> : null}
        </div>
      </div>

      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Purchase Account *</label>
          <select
            style={{ ...es.input, ...(errors.purchaseAccountCode ? es.inputError : {}) }}
            value={form.purchaseAccountCode}
            onChange={(event) => setField('purchaseAccountCode', event.target.value)}
          >
            <option value="">Select purchase account</option>
            {purchaseAccountOptions.map((account) => (
              <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
            ))}
          </select>
          {errors.purchaseAccountCode ? <span style={es.errorText}>{errors.purchaseAccountCode}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Payment Account (Cash/Bank)</label>
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
      </div>

      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Total Cost *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={{ ...es.input, ...(errors.totalCost ? es.inputError : {}) }}
            value={form.totalCost}
            onChange={(event) => setField('totalCost', event.target.value)}
            placeholder="0"
          />
          {errors.totalCost ? <span style={es.errorText}>{errors.totalCost}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Advance Paid</label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={{ ...es.input, ...(errors.advancePaid ? es.inputError : {}) }}
            value={form.advancePaid}
            onChange={(event) => setField('advancePaid', event.target.value)}
            placeholder="0"
          />
          {errors.advancePaid ? <span style={es.errorText}>{errors.advancePaid}</span> : null}
        </div>
      </div>

      <div style={es.row3}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Transaction Date *</label>
          <input type="date" style={{ ...es.input, ...(errors.date ? es.inputError : {}) }} value={form.date} onChange={(event) => setField('date', event.target.value)} />
          {errors.date ? <span style={es.errorText}>{errors.date}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Payable Date *</label>
          <input type="date" style={{ ...es.input, ...(errors.payableDate ? es.inputError : {}) }} value={form.payableDate} onChange={(event) => setField('payableDate', event.target.value)} />
          {errors.payableDate ? <span style={es.errorText}>{errors.payableDate}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Split Mode *</label>
          <select style={es.input} value={form.splitMode} onChange={(event) => setField('splitMode', event.target.value)}>
            <option value="equal">Equal Split</option>
            <option value="manual">Manual Split</option>
            <option value="percentage">Percentage Split</option>
          </select>
        </div>
      </div>

      {form.splitMode === 'manual' ? (
        <div style={es.row2}>
          <div style={es.fieldWrap}>
            <label style={es.label}>Current Liability *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              style={{ ...es.input, ...(errors.currentLiability ? es.inputError : {}) }}
              value={form.currentLiability}
              onChange={(event) => setField('currentLiability', event.target.value)}
              placeholder="0"
            />
            {errors.currentLiability ? <span style={es.errorText}>{errors.currentLiability}</span> : null}
          </div>

          <div style={es.fieldWrap}>
            <label style={es.label}>Non-Current Liability</label>
            <input
              type="text"
              style={{ ...es.input, background: '#f8faf8', color: '#415443' }}
              value={splitPreview.nonCurrentLiability.toLocaleString()}
              readOnly
            />
          </div>
        </div>
      ) : null}

      {form.splitMode === 'percentage' ? (
        <div style={es.row2}>
          <div style={es.fieldWrap}>
            <label style={es.label}>Current Liability % *</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              style={{ ...es.input, ...(errors.currentPercentage ? es.inputError : {}) }}
              value={form.currentPercentage}
              onChange={(event) => setField('currentPercentage', event.target.value)}
              placeholder="0"
            />
            {errors.currentPercentage ? <span style={es.errorText}>{errors.currentPercentage}</span> : null}
          </div>

          <div style={es.fieldWrap}>
            <label style={es.label}>Non-Current Liability % *</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              style={{ ...es.input, ...(errors.nonCurrentPercentage ? es.inputError : {}) }}
              value={form.nonCurrentPercentage}
              onChange={(event) => setField('nonCurrentPercentage', event.target.value)}
              placeholder="0"
            />
            {errors.nonCurrentPercentage ? <span style={es.errorText}>{errors.nonCurrentPercentage}</span> : null}
          </div>
        </div>
      ) : null}

      <div style={s.previewGrid}>
        <div style={s.previewCard}>
          <p style={s.previewLabel}>Remaining Payable</p>
          <p style={s.previewValue}>Rs {splitPreview.remaining.toLocaleString()}</p>
        </div>
        <div style={s.previewCard}>
          <p style={s.previewLabel}>Current Liability</p>
          <p style={s.previewValue}>Rs {splitPreview.currentLiability.toLocaleString()}</p>
        </div>
        <div style={s.previewCard}>
          <p style={s.previewLabel}>Non-Current Liability</p>
          <p style={s.previewValue}>Rs {splitPreview.nonCurrentLiability.toLocaleString()}</p>
        </div>
      </div>

      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Description</label>
          <input
            style={es.input}
            value={form.description}
            onChange={(event) => setField('description', event.target.value)}
            placeholder="Purchase from supplier"
          />
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Reference</label>
          <input
            style={es.input}
            value={form.reference}
            onChange={(event) => setField('reference', event.target.value)}
            placeholder="Invoice No / PO No"
          />
        </div>
      </div>
    </AccountEntryPage>
  )
}

function PayableNewPageLoading() {
  return (
    <AccountEntryPage
      title="Accounts Payable"
      subtitle="Preparing payable form"
      backHref="/accounts/payable"
      onSave={() => {}}
      saveLabel="Save"
      hideSave
    >
      <p style={es.mutedText}>Loading form...</p>
    </AccountEntryPage>
  )
}

export default function PayableNewPage() {
  return (
    <Suspense fallback={<PayableNewPageLoading />}>
      <PayableNewPageContent />
    </Suspense>
  )
}

const s = {
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
    marginBottom: 14,
  },
  previewCard: {
    background: '#f8faf8',
    border: '1px solid #dce7dc',
    borderRadius: 12,
    padding: '12px 14px',
  },
  previewLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  previewValue: {
    margin: '6px 0 0',
    fontSize: 18,
    fontWeight: 800,
    color: '#1a3d1f',
  },
  footerWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  errorText: {
    margin: 0,
    fontSize: 12.5,
    fontWeight: 600,
    color: '#b91c1c',
  },
  lockedText: {
    margin: 0,
    fontSize: 12.5,
    fontWeight: 600,
    color: '#92400e',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 8,
    padding: '6px 10px',
    width: 'fit-content',
  },
}

