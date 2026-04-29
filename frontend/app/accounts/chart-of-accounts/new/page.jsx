'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AccountEntryPage, { accountEntryStyles as es } from '@/components/accounts/AccountEntryPage'
import {
  ACCOUNT_GROUP_OPTIONS,
  addChartAccountFromDraft,
  loadChartAccountsFromStorage,
  loadDepreciationConfigsFromStorage,
  updateChartAccount,
} from '@/application/services/accounts/accountsWorkflow'

const toKey = (value) => String(value || '').trim().toLowerCase()

export default function ChartOfAccountsNewPage() {
  const router = useRouter()
  const [editCode, setEditCode] = useState('')
  const [presetMode, setPresetMode] = useState('')
  const isEditMode = Boolean(editCode)
  const isPettyPreset = !isEditMode && (presetMode === 'petty-cash' || presetMode === 'petty_cash')
  const [editAccount, setEditAccount] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    code: '',
    name: '',
    groupLabel: 'Assets',
    parentCode: '',
    openingBalance: '',
    autoDepreciation: false,
    depreciationMethod: 'straight-line',
    depreciationRate: '',
    usefulLifeYears: '',
    salvageValue: '',
  })

  const group = ACCOUNT_GROUP_OPTIONS.find((option) => option.label === form.groupLabel) || ACCOUNT_GROUP_OPTIONS[0]

  const parentAccounts = useMemo(() => {
    const allAccounts = loadChartAccountsFromStorage()
      .filter((account) => account.active && !account.deletedAt && account.type === group.type)
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))

    if (group.type === 'Assets') {
      const subcategoryParents = allAccounts.filter((account) => (
        account.level === 1 &&
        (account.subcategory === 'Current Assets' || account.subcategory === 'Non-Current Assets')
      ))
      if (subcategoryParents.length > 0) return subcategoryParents
      return allAccounts.filter((account) => account.level === 0)
    }

    if (group.type === 'Liabilities') {
      const subcategoryParents = allAccounts.filter((account) => (
        account.level === 1 &&
        (account.subcategory === 'Current Liabilities' || account.subcategory === 'Non-Current Liabilities')
      ))
      if (subcategoryParents.length > 0) return subcategoryParents
      return allAccounts.filter((account) => account.level === 0)
    }

    const directParents = allAccounts.filter((account) => account.level === 0)
    return directParents.length > 0 ? directParents : allAccounts
  }, [group.type])

  const selectedParent = useMemo(
    () => parentAccounts.find((account) => account.code === form.parentCode),
    [parentAccounts, form.parentCode],
  )

  const isDepreciableAsset = isEditMode
    ? (editAccount?.type === 'Assets' && editAccount?.subcategory === 'Non-Current Assets')
    : (group.type === 'Assets' && selectedParent?.subcategory === 'Non-Current Assets')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const queryEdit = params.get('edit')
    const preset = String(params.get('preset') || '').trim().toLowerCase()
    setEditCode(String(queryEdit || '').trim())
    setPresetMode(preset)
  }, [])

  useEffect(() => {
    if (isEditMode) return
    if (presetMode !== 'petty-cash' && presetMode !== 'petty_cash') return

    const allAccounts = loadChartAccountsFromStorage()
    const defaultParent = allAccounts.find((account) => (
      !account.deletedAt
      && account.active !== false
      && account.type === 'Assets'
      && account.level === 1
      && account.subcategory === 'Current Assets'
    ))

    setForm((prev) => ({
      ...prev,
      groupLabel: 'Assets',
      parentCode: defaultParent?.code || prev.parentCode,
      name: prev.name || 'Petty Cash',
    }))
  }, [isEditMode, presetMode])

  useEffect(() => {
    if (!isEditMode) return
    const account = loadChartAccountsFromStorage().find((item) => item.code === editCode && !item.deletedAt)
    if (!account) {
      setEditAccount(null)
      setErrors((prev) => ({ ...prev, form: `Account ${editCode} not found` }))
      return
    }
    setEditAccount(account)
    const existingConfig = loadDepreciationConfigsFromStorage().find((config) => config.assetCode === account.code)
    const method = String(existingConfig?.method || 'straight-line').trim().toLowerCase() === 'reducing-balance' ? 'reducing-balance' : 'straight-line'

    setForm((prev) => ({
      ...prev,
      code: account.code,
      name: account.name,
      groupLabel: account.type,
      parentCode: account.parentCode || '',
      openingBalance: String(Number(account.openingBalance) || 0),
      autoDepreciation: Boolean(existingConfig),
      depreciationMethod: method,
      depreciationRate: existingConfig?.rate ? String(Number(existingConfig.rate) || 0) : '',
      usefulLifeYears: existingConfig?.usefulLifeYears ? String(Number(existingConfig.usefulLifeYears) || 0) : '',
      salvageValue: String(Number(existingConfig?.salvageValue) || 0),
    }))
  }, [editCode, isEditMode])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }))
  }

  const setGroup = (groupLabel) => {
    if (isPettyPreset) return
    setForm((prev) => ({
      ...prev,
      groupLabel,
      parentCode: '',
      autoDepreciation: false,
      depreciationMethod: 'straight-line',
      depreciationRate: '',
      usefulLifeYears: '',
      salvageValue: '',
    }))
    setErrors((prev) => ({ ...prev, groupLabel: undefined, parentCode: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.code.trim()) next.code = 'Account code is required'
    if (!form.name.trim()) next.name = 'Account name is required'
    if (!form.groupLabel) next.groupLabel = 'Group is required'
    if (!form.parentCode.trim()) next.parentCode = 'Parent account is required'

    if (isPettyPreset) {
      if (!toKey(form.name).includes('petty')) next.name = 'Petty cash account name must include "petty"'
      if (selectedParent?.subcategory !== 'Current Assets') next.parentCode = 'Petty cash account must be under Current Assets'
    }

    if (isDepreciableAsset && form.autoDepreciation) {
      const method = String(form.depreciationMethod || 'straight-line').trim().toLowerCase()
      if (method !== 'straight-line' && method !== 'reducing-balance') next.depreciationMethod = 'Select a valid depreciation method'
      const life = Number(form.usefulLifeYears)
      if (method === 'straight-line' && (!Number.isFinite(life) || life <= 0)) next.usefulLifeYears = 'Useful life (years) must be greater than zero'
      const rate = Number(form.depreciationRate)
      if (method === 'reducing-balance' && (!Number.isFinite(rate) || rate <= 0)) next.depreciationRate = 'Rate must be greater than zero for Reducing Balance'
      const salvage = Number(form.salvageValue || 0)
      if (salvage < 0) next.salvageValue = 'Salvage value cannot be negative'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)

    try {
      if (isEditMode) {
        updateChartAccount(editCode, {
          code: form.code.trim(),
          name: form.name.trim(),
          subcategory: selectedParent?.subcategory || editAccount?.subcategory || group.subcategory,
          openingBalance: Number(form.openingBalance) || 0,
          autoDepreciation: isDepreciableAsset && form.autoDepreciation,
          depreciationMethod: form.depreciationMethod,
          depreciationRate: Number(form.depreciationRate) || 0,
          usefulLifeYears: Number(form.usefulLifeYears) || 0,
          salvageValue: Number(form.salvageValue) || 0,
        })
      } else {
        addChartAccountFromDraft({
          code: form.code.trim(),
          name: form.name.trim(),
          type: group.type,
          subcategory: selectedParent?.subcategory || group.subcategory,
          parentCode: form.parentCode.trim(),
          openingBalance: Number(form.openingBalance) || 0,
          autoDepreciation: isDepreciableAsset && form.autoDepreciation,
          depreciationMethod: form.depreciationMethod,
          depreciationRate: Number(form.depreciationRate) || 0,
          usefulLifeYears: Number(form.usefulLifeYears) || 0,
          salvageValue: Number(form.salvageValue) || 0,
        })
      }
      router.push('/accounts/chart-of-accounts')
    } catch (error) {
      setErrors((prev) => ({ ...prev, form: error?.message || 'Unable to save account' }))
      setSaving(false)
    }
  }

  return (
    <AccountEntryPage
      title={isEditMode ? `Edit Account ${editCode}` : 'Add Account'}
      subtitle={isEditMode ? 'Update account details and opening balance' : 'Create a new account under an existing parent account'}
      backHref="/accounts/chart-of-accounts"
      onSave={handleSave}
      saveLabel={isEditMode ? 'Update Account' : 'Save Account'}
      saving={saving}
    >
      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Account Code *</label>
          <input style={{ ...es.input, ...(errors.code ? es.inputError : {}) }} value={form.code} onChange={(e) => setField('code', e.target.value)} placeholder="e.g. 1130" />
          {errors.code ? <span style={es.errorText}>{errors.code}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Account Name *</label>
          <input style={{ ...es.input, ...(errors.name ? es.inputError : {}) }} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Delivery Vehicle" />
          {errors.name ? <span style={es.errorText}>{errors.name}</span> : null}
        </div>
      </div>

      {!isEditMode && (presetMode === 'petty-cash' || presetMode === 'petty_cash') ? (
        <p style={es.mutedText}>Petty cash preset applied. Create a posting account under Current Assets for daily cash expenses.</p>
      ) : null}

      <div style={es.row3}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Group *</label>
          <select
            style={{ ...es.input, ...(errors.groupLabel ? es.inputError : {}), ...((isEditMode || isPettyPreset) ? s.disabledInput : {}) }}
            value={form.groupLabel}
            onChange={(e) => setGroup(e.target.value)}
            disabled={isEditMode || isPettyPreset}
          >
            {ACCOUNT_GROUP_OPTIONS.map((option) => (
              <option key={option.label} value={option.label}>{option.label}</option>
            ))}
          </select>
          {errors.groupLabel ? <span style={es.errorText}>{errors.groupLabel}</span> : null}
        </div>

        <div style={es.fieldWrap}>
          <label style={es.label}>Opening Balance</label>
          <input type="number" min="0" step="0.01" style={es.input} value={form.openingBalance} onChange={(e) => setField('openingBalance', e.target.value)} placeholder="0" />
        </div>
      </div>

      <div style={es.row2}>
        <div style={es.fieldWrap}>
          <label style={es.label}>Parent Account *</label>
          <select
            style={{ ...es.input, ...(errors.parentCode ? es.inputError : {}), ...(isEditMode ? s.disabledInput : {}) }}
            value={form.parentCode}
            onChange={(e) => setField('parentCode', e.target.value)}
            disabled={isEditMode}
          >
            <option value="">Select parent account</option>
            {parentAccounts.map((account) => (
              <option key={account.id} value={account.code}>{account.code} - {account.name}</option>
            ))}
          </select>
          {errors.parentCode ? <span style={es.errorText}>{errors.parentCode}</span> : null}
          {isEditMode ? <p style={es.mutedText}>Parent and group cannot be changed in edit mode.</p> : null}
        </div>
      </div>

      {group.type === 'Assets' ? (
        <>
          <div style={es.fieldWrap}>
            <label style={es.label}>Depreciation Setup</label>
            {isDepreciableAsset ? (
              <label style={s.checkLabel}>
                <input type="checkbox" checked={form.autoDepreciation} onChange={(e) => setField('autoDepreciation', e.target.checked)} />
                {isEditMode ? 'Create/Update Depreciation Expense and Accumulated Depreciation accounts' : 'Auto-create Depreciation Expense and Accumulated Depreciation accounts'}
              </label>
            ) : (
              <p style={es.mutedText}>Depreciation setup is available only for Non-Current Assets.</p>
            )}
          </div>

          {isDepreciableAsset && form.autoDepreciation ? (
            <>
              <div style={es.row3}>
                <div style={es.fieldWrap}>
                  <label style={es.label}>Depreciation Method *</label>
                  <select style={{ ...es.input, ...(errors.depreciationMethod ? es.inputError : {}) }} value={form.depreciationMethod} onChange={(e) => setField('depreciationMethod', e.target.value)}>
                    <option value="straight-line">Straight Line Method</option>
                    <option value="reducing-balance">Reducing Balance Method</option>
                  </select>
                  {errors.depreciationMethod ? <span style={es.errorText}>{errors.depreciationMethod}</span> : null}
                </div>

                <div style={es.fieldWrap}>
                  <label style={es.label}>Rate (%) {form.depreciationMethod === 'reducing-balance' ? '*' : '(Optional)'}</label>
                  <input type="number" min="0" step="0.01" style={{ ...es.input, ...(errors.depreciationRate ? es.inputError : {}) }} value={form.depreciationRate} onChange={(e) => setField('depreciationRate', e.target.value)} placeholder={form.depreciationMethod === 'reducing-balance' ? 'e.g. 20' : 'Not required for Straight Line'} />
                  {errors.depreciationRate ? <span style={es.errorText}>{errors.depreciationRate}</span> : null}
                </div>
              </div>

              <div style={es.row2}>
              <div style={es.fieldWrap}>
                <label style={es.label}>Useful Life (Years) {form.depreciationMethod === 'straight-line' ? '*' : '(Optional)'}</label>
                <input type="number" min="1" step="1" style={{ ...es.input, ...(errors.usefulLifeYears ? es.inputError : {}) }} value={form.usefulLifeYears} onChange={(e) => setField('usefulLifeYears', e.target.value)} placeholder={form.depreciationMethod === 'straight-line' ? 'e.g. 5' : 'Optional for Reducing Balance'} />
                {errors.usefulLifeYears ? <span style={es.errorText}>{errors.usefulLifeYears}</span> : null}
              </div>

              <div style={es.fieldWrap}>
                <label style={es.label}>Salvage Value</label>
                <input type="number" min="0" step="0.01" style={{ ...es.input, ...(errors.salvageValue ? es.inputError : {}) }} value={form.salvageValue} onChange={(e) => setField('salvageValue', e.target.value)} placeholder="0" />
                {errors.salvageValue ? <span style={es.errorText}>{errors.salvageValue}</span> : null}
              </div>
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {errors.form ? <p style={es.errorText}>{errors.form}</p> : null}
    </AccountEntryPage>
  )
}

const s = {
  disabledInput: {
    background: '#f1f5f9',
    color: '#64748b',
    cursor: 'not-allowed',
  },
  checkLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#1a3d1f',
    fontWeight: 500,
  },
}

