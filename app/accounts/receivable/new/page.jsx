'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountEntryPage, { accountEntryStyles as es } from '@/components/accounts/AccountEntryPage'
import {
  createAccountsReceivableTransaction,
  isAccountsReceivableLocked,
  isPostableAccount,
  loadAccountsReceivableFromStorage,
  loadChartAccountsFromStorage,
  loadReceivableCustomersFromStorage,
  updateAccountsReceivableTransaction,
} from '@/application/services/accounts/accountsWorkflow'

const todayISO = () => new Date().toISOString().slice(0, 10)
const toMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100
const toKey = (value) => String(value || '').trim().toLowerCase()

function isCashOrBankName(value) {
  const key = toKey(value)
  return key.includes('cash') || key.includes('bank')
}

function normalizeReceivableSplitMode(value) {
  const mode = String(value || '').trim().toLowerCase()
  if (mode === 'manual' || mode === 'percentage' || mode === 'equal') return mode
  if (mode === 'auto') return 'manual'
  return 'equal'
}

function inferReceivableSplitMode(record) {
  const explicit = normalizeReceivableSplitMode(record?.splitMode)
  if (record?.splitMode) return explicit

  const classificationMode = String(record?.classificationMode || '').trim().toLowerCase()
  const hasCurrentPct = Number.isFinite(Number(record?.currentPercentage))
  const hasNonCurrentPct = Number.isFinite(Number(record?.nonCurrentPercentage))
  if (classificationMode === 'manual' && hasCurrentPct && hasNonCurrentPct) return 'percentage'

  return 'manual'
}

function getSplitPreview({ splitMode, totalSale, advanceReceived, currentReceivable, currentPercentage, nonCurrentPercentage }) {
  const total = toMoney(Math.max(0, Number(totalSale) || 0))
  const advance = toMoney(Math.max(0, Number(advanceReceived) || 0))
  const remaining = toMoney(Math.max(0, total - advance))
  const mode = normalizeReceivableSplitMode(splitMode)

  if (remaining <= 0) {
    return {
      mode,
      remaining,
      currentReceivable: 0,
      nonCurrentReceivable: 0,
      currentPercentage: mode === 'percentage' ? 0 : null,
      nonCurrentPercentage: mode === 'percentage' ? 0 : null,
      valid: true,
    }
  }

  if (mode === 'manual') {
    const current = toMoney(Number(currentReceivable) || 0)
    return {
      mode,
      remaining,
      currentReceivable: current,
      nonCurrentReceivable: toMoney(Math.max(0, remaining - current)),
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
      currentReceivable: current,
      nonCurrentReceivable: nonCurrent,
      currentPercentage: Number.isFinite(currentPct) ? currentPct : null,
      nonCurrentPercentage: Number.isFinite(nonCurrentPct) ? nonCurrentPct : null,
      valid,
    }
  }

  const current = toMoney(remaining / 2)
  return {
    mode: 'equal',
    remaining,
    currentReceivable: current,
    nonCurrentReceivable: toMoney(Math.max(0, remaining - current)),
    currentPercentage: null,
    nonCurrentPercentage: null,
    valid: true,
  }
}

function ReceivableNewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = String(searchParams.get('edit') || '').trim()
  const isEditMode = !!editId
  const { user } = useAuthStore()

  const [accounts, setAccounts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loadingEdit, setLoadingEdit] = useState(isEditMode)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [errors, setErrors] = useState({})
  const [isLocked, setIsLocked] = useState(false)
  const [form, setForm] = useState({
    customerName: '',
    itemType: '',
    date: todayISO(),
    dueDate: todayISO(),
    salesAccountCode: '',
    totalSale: '',
    advanceReceived: '',
    receiptAccountCode: '',
    splitMode: 'equal',
    currentReceivable: '',
    currentPercentage: '50',
    nonCurrentPercentage: '50',
    creditLimit: '',
    description: '',
    reference: '',
  })

  useEffect(() => {
    setAccounts(loadChartAccountsFromStorage())
    setCustomers(loadReceivableCustomersFromStorage())
  }, [])

  useEffect(() => {
    if (!isEditMode) {
      setLoadingEdit(false)
      return
    }

    const existing = loadAccountsReceivableFromStorage().find((item) => item.id === editId && !item.deletedAt)
    if (!existing) {
      setFormError('Receivable transaction not found.')
      setLoadingEdit(false)
      return
    }
    if (existing.origin === 'journal_inferred') {
      setFormError('This row is auto-synced from Journal Entry and cannot be edited from Receivables.')
      setIsLocked(true)
      setLoadingEdit(false)
      return
    }

    const net = toMoney(Math.max(0, Number(existing.netReceivable) || (Number(existing.totalSale) || 0) - (Number(existing.advanceReceived) || 0)))
    const current = toMoney(Math.max(0, Number(existing.currentReceivable) || 0))
    const inferredCurrentPct = net > 0 ? toMoney((current / net) * 100) : 50

    setIsLocked(isAccountsReceivableLocked(existing))
    setForm({
      customerName: existing.customerName,
      itemType: existing.itemType || '',
      date: existing.date || todayISO(),
      dueDate: existing.dueDate || existing.date || todayISO(),
      salesAccountCode: existing.salesAccountCode,
      totalSale: String(existing.totalSale || ''),
      advanceReceived: String(existing.advanceReceived || ''),
      receiptAccountCode: existing.receiptAccountCode || '',
      splitMode: inferReceivableSplitMode(existing),
      currentReceivable: String(existing.currentReceivable ?? 0),
      currentPercentage: existing.currentPercentage == null ? String(inferredCurrentPct) : String(existing.currentPercentage),
      nonCurrentPercentage: existing.nonCurrentPercentage == null ? String(toMoney(100 - inferredCurrentPct)) : String(existing.nonCurrentPercentage),
      creditLimit: existing.creditLimit > 0 ? String(existing.creditLimit) : '',
      description: existing.description || '',
      reference: existing.reference || '',
    })
    setLoadingEdit(false)
  }, [editId, isEditMode])

  const salesAccountOptions = useMemo(() => (
    accounts
      .filter((account) => !account.deletedAt && account.active !== false && isPostableAccount(account, accounts))
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
  ), [accounts])

  const receiptAccountOptions = useMemo(() => (
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

  const selectedCustomer = useMemo(() => {
    const key = toKey(form.customerName)
    if (!key) return null
    return customers.find((item) => toKey(item.name) === key) || null
  }, [customers, form.customerName])

  useEffect(() => {
    if (!selectedCustomer) return
    setForm((prev) => {
      if (String(prev.creditLimit || '').trim() !== '') return prev
      if (!selectedCustomer.creditLimit) return prev
      return { ...prev, creditLimit: String(selectedCustomer.creditLimit) }
    })
  }, [selectedCustomer])

  const splitPreview = useMemo(() => getSplitPreview(form), [form])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError('')
  }

  const validate = () => {
    const nextErrors = {}
    const totalSale = toMoney(Number(form.totalSale) || 0)
    const advanceReceived = toMoney(Number(form.advanceReceived) || 0)
    const hasCreditLimit = String(form.creditLimit || '').trim() !== ''
    const creditLimitValue = hasCreditLimit ? toMoney(Number(form.creditLimit) || 0) : null
    const split = getSplitPreview(form)

    if (!form.customerName.trim()) nextErrors.customerName = 'Customer is required'
    if (!form.itemType.trim()) nextErrors.itemType = 'Item type is required'
    if (!form.date) nextErrors.date = 'Invoice date is required'
    if (!form.dueDate) nextErrors.dueDate = 'Due date is required'
    if (!form.salesAccountCode) nextErrors.salesAccountCode = 'Sales account is required'
    if (totalSale <= 0) nextErrors.totalSale = 'Total sale must be greater than zero'
    if (advanceReceived < 0) nextErrors.advanceReceived = 'Advance received cannot be negative'
    if (advanceReceived > totalSale) nextErrors.advanceReceived = 'Advance received cannot exceed total sale'
    if (advanceReceived > 0 && !form.receiptAccountCode) nextErrors.receiptAccountCode = 'Receipt account is required when advance is received'
    if (hasCreditLimit && creditLimitValue < 0) nextErrors.creditLimit = 'Credit limit cannot be negative'

    if (form.splitMode === 'manual') {
      const current = toMoney(Number(form.currentReceivable) || 0)
      if (current < 0) nextErrors.currentReceivable = 'Current receivable cannot be negative'
      if (current > split.remaining) nextErrors.currentReceivable = 'Current receivable cannot exceed net receivable'
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
      if (form.splitMode === 'manual' && !nextErrors.currentReceivable) nextErrors.currentReceivable = 'Invalid manual split'
      if (form.splitMode === 'percentage' && !nextErrors.nonCurrentPercentage) nextErrors.nonCurrentPercentage = 'Invalid percentage split'
    }

    const checkTotal = toMoney(split.currentReceivable + split.nonCurrentReceivable + advanceReceived)
    if (Math.abs(checkTotal - totalSale) > 0.01) {
      nextErrors.totalSale = 'Current + Non-current + Advance must equal total sale'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return null

    return {
      customerName: form.customerName.trim(),
      itemType: form.itemType.trim(),
      date: form.date,
      dueDate: form.dueDate,
      salesAccountCode: form.salesAccountCode,
      totalSale,
      advanceReceived,
      receiptAccountCode: advanceReceived > 0 ? String(form.receiptAccountCode || '').trim() : '',
      splitMode: form.splitMode,
      classificationMode: 'manual',
      currentReceivable: split.currentReceivable,
      nonCurrentReceivable: split.nonCurrentReceivable,
      currentPercentage: split.currentPercentage,
      nonCurrentPercentage: split.nonCurrentPercentage,
      allowManualClassification: true,
      creditLimit: hasCreditLimit ? creditLimitValue : null,
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
        const result = updateAccountsReceivableTransaction({
          receivableId: editId,
          ...payload,
          user: actor,
        })
        router.push(`/accounts/receivable?notice=updated&ar=${encodeURIComponent(result.transaction.id)}`)
        return
      }

      const result = createAccountsReceivableTransaction({
        ...payload,
        user: actor,
      })
      router.push(`/accounts/receivable?notice=created&ar=${encodeURIComponent(result.transaction.id)}`)
    } catch (error) {
      setFormError(error?.message || 'Unable to save accounts receivable transaction')
      setSaving(false)
    }
  }

  if (loadingEdit) {
    return (
      <AccountEntryPage
        title="Edit Accounts Receivable"
        subtitle="Loading receivable transaction details"
        backHref="/accounts/receivable"
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
      title={isEditMode ? 'Edit Accounts Receivable' : 'Record Accounts Receivable'}
      subtitle="Recognize full sale, advance receipt, and current/non-current receivable split"
      backHref="/accounts/receivable"
      onSave={handleSave}
      saveLabel={isEditMode ? 'Save Changes' : 'Save Receivable'}
      saving={saving}
      saveDisabled={isEditMode && isLocked}
      footer={(
        <div style={s.footerWrap}>
          <p style={es.mutedText}>Validation rule: `Advance + Current Receivable + Non-Current Receivable = Total Sale`</p>
          {isEditMode && isLocked ? <p style={s.lockedText}>This entry is locked after 24 hours and cannot be edited.</p> : null}
          {formError ? <p style={s.errorText}>{formError}</p> : null}
        </div>
      )}
    >
      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Customer Name *</label>
          <input
            list="receivable-customers"
            style={{ ...es.input, ...(errors.customerName ? es.inputError : {}) }}
            value={form.customerName}
            onChange={(event) => setField('customerName', event.target.value)}
            placeholder="Enter customer name"
          />
          <datalist id="receivable-customers">
            {customers.map((customer) => (
              <option key={customer.id} value={customer.name} />
            ))}
          </datalist>
          {errors.customerName ? <span style={es.errorText}>{errors.customerName}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Item Type *</label>
          <input
            style={{ ...es.input, ...(errors.itemType ? es.inputError : {}) }}
            value={form.itemType}
            onChange={(event) => setField('itemType', event.target.value)}
            placeholder="e.g. Product, Service"
          />
          {errors.itemType ? <span style={es.errorText}>{errors.itemType}</span> : null}
        </div>
      </div>

      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Sales / Credit Account *</label>
          <select
            style={{ ...es.input, ...(errors.salesAccountCode ? es.inputError : {}) }}
            value={form.salesAccountCode}
            onChange={(event) => setField('salesAccountCode', event.target.value)}
          >
            <option value="">Select sales account</option>
            {salesAccountOptions.map((account) => (
              <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
            ))}
          </select>
          {errors.salesAccountCode ? <span style={es.errorText}>{errors.salesAccountCode}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Receipt Account (Cash/Bank)</label>
          <select
            style={{ ...es.input, ...(errors.receiptAccountCode ? es.inputError : {}) }}
            value={form.receiptAccountCode}
            onChange={(event) => setField('receiptAccountCode', event.target.value)}
          >
            <option value="">Select receipt account</option>
            {receiptAccountOptions.map((account) => (
              <option key={account.code} value={account.code}>{account.code} - {account.name}</option>
            ))}
          </select>
          {errors.receiptAccountCode ? <span style={es.errorText}>{errors.receiptAccountCode}</span> : null}
        </div>
      </div>

      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Total Sale *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={{ ...es.input, ...(errors.totalSale ? es.inputError : {}) }}
            value={form.totalSale}
            onChange={(event) => setField('totalSale', event.target.value)}
            placeholder="0"
          />
          {errors.totalSale ? <span style={es.errorText}>{errors.totalSale}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Advance Received</label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={{ ...es.input, ...(errors.advanceReceived ? es.inputError : {}) }}
            value={form.advanceReceived}
            onChange={(event) => setField('advanceReceived', event.target.value)}
            placeholder="0"
          />
          {errors.advanceReceived ? <span style={es.errorText}>{errors.advanceReceived}</span> : null}
        </div>
      </div>

      <div style={es.row3}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Invoice Date *</label>
          <input type="date" style={{ ...es.input, ...(errors.date ? es.inputError : {}) }} value={form.date} onChange={(event) => setField('date', event.target.value)} />
          {errors.date ? <span style={es.errorText}>{errors.date}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Due Date *</label>
          <input type="date" style={{ ...es.input, ...(errors.dueDate ? es.inputError : {}) }} value={form.dueDate} onChange={(event) => setField('dueDate', event.target.value)} />
          {errors.dueDate ? <span style={es.errorText}>{errors.dueDate}</span> : null}
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
            <label style={es.label}>Current Receivable *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              style={{ ...es.input, ...(errors.currentReceivable ? es.inputError : {}) }}
              value={form.currentReceivable}
              onChange={(event) => setField('currentReceivable', event.target.value)}
              placeholder="0"
            />
            {errors.currentReceivable ? <span style={es.errorText}>{errors.currentReceivable}</span> : null}
          </div>

          <div style={es.fieldWrap}>
            <label style={es.label}>Non-Current Receivable</label>
            <input
              type="text"
              style={{ ...es.input, background: '#f8faf8', color: '#415443' }}
              value={splitPreview.nonCurrentReceivable.toLocaleString()}
              readOnly
            />
          </div>
        </div>
      ) : null}

      {form.splitMode === 'percentage' ? (
        <div style={es.row2}>
          <div style={es.fieldWrap}>
            <label style={es.label}>Current Receivable % *</label>
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
            <label style={es.label}>Non-Current Receivable % *</label>
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
          <p style={s.previewLabel}>Net Receivable</p>
          <p style={s.previewValue}>Rs {splitPreview.remaining.toLocaleString()}</p>
        </div>
        <div style={s.previewCard}>
          <p style={s.previewLabel}>Current Receivable</p>
          <p style={s.previewValue}>Rs {splitPreview.currentReceivable.toLocaleString()}</p>
        </div>
        <div style={s.previewCard}>
          <p style={s.previewLabel}>Non-Current Receivable</p>
          <p style={s.previewValue}>Rs {splitPreview.nonCurrentReceivable.toLocaleString()}</p>
        </div>
      </div>

      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Credit Limit (Optional)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={{ ...es.input, ...(errors.creditLimit ? es.inputError : {}) }}
            value={form.creditLimit}
            onChange={(event) => setField('creditLimit', event.target.value)}
            placeholder="0"
          />
          {errors.creditLimit ? <span style={es.errorText}>{errors.creditLimit}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Customer Master Credit Limit</label>
          <input
            type="text"
            style={{ ...es.input, background: '#f8faf8', color: '#415443' }}
            value={selectedCustomer ? `Rs ${selectedCustomer.creditLimit.toLocaleString()}` : '-'}
            readOnly
          />
        </div>
      </div>

      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Description</label>
          <input
            style={es.input}
            value={form.description}
            onChange={(event) => setField('description', event.target.value)}
            placeholder="Sales invoice to customer"
          />
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Reference</label>
          <input
            style={es.input}
            value={form.reference}
            onChange={(event) => setField('reference', event.target.value)}
            placeholder="Invoice No / Order Ref"
          />
        </div>
      </div>
    </AccountEntryPage>
  )
}

function ReceivableNewPageLoading() {
  return (
    <AccountEntryPage
      title="Accounts Receivable"
      subtitle="Preparing receivable form"
      backHref="/accounts/receivable"
      onSave={() => {}}
      saveLabel="Save"
      hideSave
    >
      <p style={es.mutedText}>Loading form...</p>
    </AccountEntryPage>
  )
}

export default function ReceivableNewPage() {
  return (
    <Suspense fallback={<ReceivableNewPageLoading />}>
      <ReceivableNewPageContent />
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

