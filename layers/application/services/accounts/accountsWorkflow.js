'use client'

import { accountingStateApi } from '@/infrastructure/api/endpoints'

export const ACCOUNT_TYPES = ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses']

export const ACCOUNT_SUBCATEGORIES = {
  Assets: ['Current Assets', 'Non-Current Assets'],
  Liabilities: ['Current Liabilities', 'Non-Current Liabilities'],
  Equity: [],
  Revenue: [],
  Expenses: ['Cost of Goods Sold', 'Operating Expenses', 'Administrative Expenses', 'Selling Expenses', 'Depreciation'],
}

export const ACCOUNT_GROUP_OPTIONS = [
  { label: 'Assets', type: 'Assets', subcategory: '' },
  { label: 'Liabilities', type: 'Liabilities', subcategory: '' },
  { label: 'Equity', type: 'Equity', subcategory: '' },
  { label: 'Revenue', type: 'Revenue', subcategory: '' },
  { label: 'Expenses', type: 'Expenses', subcategory: '' },
]

export const CHART_ACCOUNTS_STORAGE_KEY = 'accounts:chart-of-accounts:list'
export const GENERAL_ENTRY_ACCESS_KEY = 'accounts:general-entry:access'
export const GENERAL_LEDGER_STORAGE_KEY = 'accounts:general-ledger:entries'
export const DEPRECIATION_CONFIGS_STORAGE_KEY = 'accounts:depreciation:configs'
export const ACCOUNT_AUDIT_LOGS_STORAGE_KEY = 'accounts:audit-logs'
export const ACCOUNTS_PAYABLE_STORAGE_KEY = 'accounts:payable:transactions'
export const ACCOUNTS_RECEIVABLE_STORAGE_KEY = 'accounts:receivable:transactions'
export const ACCOUNTS_RECEIVABLE_CUSTOMERS_STORAGE_KEY = 'accounts:receivable:customers'
export const ACCOUNTS_EXPENSES_STORAGE_KEY = 'accounts:expenses:transactions'
export const CASH_BANK_TRANSACTIONS_STORAGE_KEY = 'accounts:cash-bank:transactions'
export const CASH_BANK_RECON_STORAGE_KEY = 'accounts:cash-bank:reconciliations'
export const PETTY_CASH_SETUPS_STORAGE_KEY = 'accounts:cash-bank:petty:setups'
export const ACCOUNTING_CLOSED_PERIODS_STORAGE_KEY = 'accounts:settings:closed-periods'

export const ACCOUNTING_BACKEND_STORAGE_KEYS = [
  CHART_ACCOUNTS_STORAGE_KEY,
  GENERAL_LEDGER_STORAGE_KEY,
  DEPRECIATION_CONFIGS_STORAGE_KEY,
  ACCOUNT_AUDIT_LOGS_STORAGE_KEY,
  ACCOUNTS_PAYABLE_STORAGE_KEY,
  ACCOUNTS_RECEIVABLE_STORAGE_KEY,
  ACCOUNTS_RECEIVABLE_CUSTOMERS_STORAGE_KEY,
  ACCOUNTS_EXPENSES_STORAGE_KEY,
  CASH_BANK_TRANSACTIONS_STORAGE_KEY,
  CASH_BANK_RECON_STORAGE_KEY,
  PETTY_CASH_SETUPS_STORAGE_KEY,
  ACCOUNTING_CLOSED_PERIODS_STORAGE_KEY,
]

export const GENERAL_ENTRY_ACCESS_TTL_MS = 15 * 60 * 1000
export const JOURNAL_LOCK_WINDOW_MS = 24 * 60 * 60 * 1000
export const DEPRECIATION_METHOD_OPTIONS = [
  { value: 'straight-line', label: 'Straight Line Method' },
  { value: 'reducing-balance', label: 'Reducing Balance Method' },
]
export const ACCOUNTS_EXPENSE_CATEGORY_OPTIONS = [
  'Utilities',
  'Salaries',
  'Maintenance',
  'Office Supplies',
  'Fuel & Transport',
  'Rent',
  'Marketing',
  'Miscellaneous',
]
export const ACCOUNTS_EXPENSE_PAYMENT_MODES = [
  { value: 'petty_cash', label: 'Petty Cash' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'credit', label: 'On Credit (Payable)' },
]
export const PETTY_CASH_REPLENISHMENT_CYCLES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom Days' },
]

const DEBIT_INCREASE_TYPES = new Set(['Assets', 'Expenses'])
const LEGACY_DUMMY_ACCOUNT_KEYS = new Set([
  '1110|cash in hand',
  '1120|bank account',
  '1210|plant & machinery',
  '1210|plant and machinery',
  '1210|plant and machinary',
  '1210|plamt and machinary',
  '1210|plamt & machinary',
  '2110|accounts payable',
  '4100|sales revenue',
  '5100|salaries expense',
  '5200|utilities expense',
  '5300|maintenance expense',
])
const REMOVED_ACCOUNT_NAME_KEYS = new Set([
  'plant and machinery',
  'plant and machinary',
  'plamt and machinery',
  'plamt and machinary',
])
const LEGACY_DUMMY_STRUCTURAL_BALANCES = {
  '1000': 4630000,
  '1100': 2830000,
  '1200': 1800000,
  '2000': 2100000,
  '2100': 2100000,
  '3000': 2900000,
  '4000': 8500000,
  '5000': 4200000,
}

const nowIso = () => new Date().toISOString()
const toMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100
const ACCOUNTING_BACKEND_KEY_SET = new Set(ACCOUNTING_BACKEND_STORAGE_KEYS)

let backendHydrated = false
let backendHydratePromise = null
let backendWriteEnabled = false
let backendSyncInFlight = false
let backendSyncTimer = null
let pendingSegmentSync = {}

const dispatchAccountsStorageUpdated = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('accounts:storage-updated'))
}

const parseStoredSegmentValue = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

const scheduleBackendSegmentSync = (delayMs = 350) => {
  if (typeof window === 'undefined') return
  if (backendSyncTimer) window.clearTimeout(backendSyncTimer)
  backendSyncTimer = window.setTimeout(() => {
    backendSyncTimer = null
    void flushPendingBackendSegmentSync()
  }, delayMs)
}

const mergePendingSegments = (segments) => {
  pendingSegmentSync = {
    ...segments,
    ...pendingSegmentSync,
  }
}

const flushPendingBackendSegmentSync = async () => {
  if (!backendWriteEnabled || backendSyncInFlight) return
  const keys = Object.keys(pendingSegmentSync)
  if (keys.length === 0) return

  const payload = pendingSegmentSync
  pendingSegmentSync = {}
  backendSyncInFlight = true

  try {
    await accountingStateApi.updateSegments(payload)
  } catch {
    mergePendingSegments(payload)
    scheduleBackendSegmentSync(1200)
  } finally {
    backendSyncInFlight = false
    if (Object.keys(pendingSegmentSync).length > 0) scheduleBackendSegmentSync(300)
  }
}

const queueSegmentSync = (key, value) => {
  if (typeof window === 'undefined') return
  if (!ACCOUNTING_BACKEND_KEY_SET.has(key)) return
  if (!backendWriteEnabled) return

  const parsedValue = parseStoredSegmentValue(value)
  if (parsedValue === undefined) return
  pendingSegmentSync[key] = parsedValue
  scheduleBackendSegmentSync()
}

export async function hydrateAccountsStateFromBackend({ force = false } = {}) {
  if (typeof window === 'undefined') return false
  if (backendHydrated && !force) return true
  if (backendHydratePromise && !force) return backendHydratePromise

  backendWriteEnabled = false
  backendHydratePromise = (async () => {
    try {
      const response = await accountingStateApi.getState()
      const segments = (response && typeof response.segments === 'object' && response.segments) || {}
      pendingSegmentSync = {}
      if (backendSyncTimer) {
        window.clearTimeout(backendSyncTimer)
        backendSyncTimer = null
      }

      ACCOUNTING_BACKEND_STORAGE_KEYS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(segments, key)) {
          sessionStorage.setItem(key, JSON.stringify(segments[key]))
        } else {
          sessionStorage.removeItem(key)
          localStorage.removeItem(key)
        }
      })
      backendHydrated = true
      dispatchAccountsStorageUpdated()
      return true
    } catch {
      return false
    } finally {
      backendWriteEnabled = true
      backendHydratePromise = null
      if (Object.keys(pendingSegmentSync).length > 0) scheduleBackendSegmentSync(200)
    }
  })()

  return backendHydratePromise
}

export async function resetAccountsStateOnBackend() {
  if (typeof window === 'undefined') return
  await accountingStateApi.resetState()
  pendingSegmentSync = {}
  if (backendSyncTimer) {
    window.clearTimeout(backendSyncTimer)
    backendSyncTimer = null
  }
  ACCOUNTING_BACKEND_STORAGE_KEYS.forEach((key) => {
    sessionStorage.removeItem(key)
    localStorage.removeItem(key)
  })
  dispatchAccountsStorageUpdated()
}

export const SEED_ACCOUNTS = [
  { id: 1, code: '1000', name: 'Assets', type: 'Assets', subcategory: '', level: 0, parentCode: null, openingBalance: 0, balance: 0, active: true },
  { id: 2, code: '1100', name: 'Current Assets', type: 'Assets', subcategory: 'Current Assets', level: 1, parentCode: '1000', openingBalance: 0, balance: 0, active: true },
  { id: 3, code: '1200', name: 'Non-Current Assets', type: 'Assets', subcategory: 'Non-Current Assets', level: 1, parentCode: '1000', openingBalance: 0, balance: 0, active: true },

  { id: 4, code: '2000', name: 'Liabilities', type: 'Liabilities', subcategory: '', level: 0, parentCode: null, openingBalance: 0, balance: 0, active: true },
  { id: 5, code: '2100', name: 'Current Liabilities', type: 'Liabilities', subcategory: 'Current Liabilities', level: 1, parentCode: '2000', openingBalance: 0, balance: 0, active: true },
  { id: 6, code: '2200', name: 'Non-Current Liabilities', type: 'Liabilities', subcategory: 'Non-Current Liabilities', level: 1, parentCode: '2000', openingBalance: 0, balance: 0, active: true },

  { id: 7, code: '3000', name: 'Equity', type: 'Equity', subcategory: '', level: 0, parentCode: null, openingBalance: 0, balance: 0, active: true },

  { id: 8, code: '4000', name: 'Revenue', type: 'Revenue', subcategory: '', level: 0, parentCode: null, openingBalance: 0, balance: 0, active: true },

  { id: 9, code: '5000', name: 'Expenses', type: 'Expenses', subcategory: '', level: 0, parentCode: null, openingBalance: 0, balance: 0, active: true },
]

export const SEED_LEDGER_ENTRIES = []

function getStorageValue(key, fallback) {
  if (typeof window === 'undefined') return fallback
  const current = sessionStorage.getItem(key)
  if (current !== null) return current

  const legacy = localStorage.getItem(key)
  if (legacy === null) return fallback
  sessionStorage.setItem(key, legacy)
  localStorage.removeItem(key)
  return legacy
}

function setStorageValue(key, value) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(key, value)
  queueSegmentSync(key, value)
  dispatchAccountsStorageUpdated()
}

function normalizeType(type, subcategory) {
  const cleanType = String(type || '').trim()
  if (cleanType === 'Depreciation') return { type: 'Expenses', subcategory: String(subcategory || 'Depreciation') || 'Depreciation' }
  if (!ACCOUNT_TYPES.includes(cleanType)) return { type: 'Assets', subcategory: String(subcategory || '') }
  return { type: cleanType, subcategory: String(subcategory || '') }
}

export function getAccountDisplayGroup(account) {
  return account?.type || ''
}

export function shouldShowAccountInMainTable(account) {
  if (!account || account.deletedAt) return false
  if (isRemovedByName(account)) return false
  if (account.type === 'Assets') return account.level === 1 && (account.subcategory === 'Current Assets' || account.subcategory === 'Non-Current Assets')
  if (account.type === 'Liabilities') return account.level === 1 && (account.subcategory === 'Current Liabilities' || account.subcategory === 'Non-Current Liabilities')
  return account.level === 0
}

function getParentCodes(accounts) {
  const parents = new Set()
  accounts.forEach((account) => {
    if (!account.deletedAt && account.parentCode) parents.add(account.parentCode)
  })
  return parents
}

export function isPostableAccount(account, accounts = []) {
  if (!account || account.deletedAt || account.active === false) return false
  if (account.level <= 0) return false
  const parentCodes = getParentCodes(accounts)
  return !parentCodes.has(account.code)
}

function sortAccountsByCodeAndName(a, b) {
  const codeA = String(a?.code || '')
  const codeB = String(b?.code || '')
  if (codeA && codeB && codeA !== codeB) return codeA.localeCompare(codeB, undefined, { numeric: true })
  return String(a?.name || '').localeCompare(String(b?.name || ''))
}

export function getLedgerAccountDropdownGroups(accounts = loadChartAccountsFromStorage()) {
  const postableAccounts = accounts
    .filter((account) => isPostableAccount(account, accounts))
    .sort(sortAccountsByCodeAndName)

  const assetCurrent = postableAccounts.filter((account) => (
    account.type === 'Assets' &&
    account.subcategory !== 'Non-Current Assets'
  ))
  const assetNonCurrent = postableAccounts.filter((account) => account.type === 'Assets' && account.subcategory === 'Non-Current Assets')
  const liabilityCurrent = postableAccounts.filter((account) => (
    account.type === 'Liabilities' &&
    account.subcategory !== 'Non-Current Liabilities'
  ))
  const liabilityNonCurrent = postableAccounts.filter((account) => account.type === 'Liabilities' && account.subcategory === 'Non-Current Liabilities')

  const groups = [
    {
      label: 'Assets > Current Assets',
      accounts: assetCurrent,
    },
    {
      label: 'Assets > Non-Current Assets',
      accounts: assetNonCurrent,
    },
    {
      label: 'Liabilities > Current Liabilities',
      accounts: liabilityCurrent,
    },
    {
      label: 'Liabilities > Non-Current Liabilities',
      accounts: liabilityNonCurrent,
    },
    {
      label: 'Equity',
      accounts: postableAccounts.filter((account) => account.type === 'Equity'),
    },
    {
      label: 'Revenues',
      accounts: postableAccounts.filter((account) => account.type === 'Revenue'),
    },
    {
      label: 'Expenses',
      accounts: postableAccounts.filter((account) => account.type === 'Expenses'),
    },
  ]

  return groups.filter((group) => group.accounts.length > 0)
}

function normalizeSubcategoryForType(type, subcategory, level) {
  const clean = String(subcategory || '').trim()
  if (level === 0) return ''

  if (type === 'Assets') {
    if (clean === 'Current Assets') return 'Current Assets'
    if (clean === 'Non-Current Assets' || clean === 'Fixed Assets' || clean === 'Intangible Assets') return 'Non-Current Assets'
    return 'Current Assets'
  }

  if (type === 'Liabilities') {
    if (clean === 'Current Liabilities') return 'Current Liabilities'
    if (clean === 'Non-Current Liabilities') return 'Non-Current Liabilities'
    if (clean.toLowerCase().includes('non-current') || clean.toLowerCase().includes('long')) return 'Non-Current Liabilities'
    return 'Current Liabilities'
  }

  return clean
}

export function normalizeAccount(account, fallbackId = Date.now()) {
  const normalizedType = normalizeType(account.type, account.subcategory)
  const level = Number(account.level) || 0
  return {
    id: account.id ?? fallbackId,
    code: String(account.code || '').trim(),
    name: String(account.name || '').trim(),
    type: normalizedType.type,
    subcategory: normalizeSubcategoryForType(normalizedType.type, normalizedType.subcategory, level),
    level,
    parentCode: account.parentCode ? String(account.parentCode).trim() : null,
    openingBalance: Number(account.openingBalance) || 0,
    balance: Number(account.balance) || 0,
    active: account.active !== false,
    deletedAt: account.deletedAt ? String(account.deletedAt) : null,
    createdAt: account.createdAt || nowIso(),
    updatedAt: account.updatedAt || nowIso(),
  }
}

function toTimeMs(value, fallbackMs = Date.now()) {
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : fallbackMs
}

function toIso(value, fallbackIso = nowIso()) {
  const ms = toTimeMs(value, NaN)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : fallbackIso
}

function normalizeLedgerEntry(entry) {
  const date = String(entry.date || '').trim()
  const dateFallbackIso = toIso(`${date}T00:00:00`, nowIso())
  const createdAt = toIso(entry.createdAt, dateFallbackIso)
  const voucherNo = String(entry.voucherNo || entry.id || '').trim()
  const description = String(entry.description || entry.narration || '').trim()
  const lockedAt = toIso(entry.lockedAt, new Date(toTimeMs(createdAt) + JOURNAL_LOCK_WINDOW_MS).toISOString())

  return {
    id: voucherNo,
    voucherNo,
    date,
    description,
    narration: description,
    reference: String(entry.reference || '').trim(),
    account: String(entry.account || '').trim(),
    accountCode: String(entry.accountCode || '').trim(),
    debit: Number(entry.debit) || 0,
    credit: Number(entry.credit) || 0,
    status: String(entry.status || 'Posted'),
    source: String(entry.source || 'journal').trim() || 'journal',
    createdAt,
    updatedAt: toIso(entry.updatedAt, createdAt),
    lockedAt,
    liabilityPlan: entry.liabilityPlan || null,
  }
}

function normalizeDepreciationConfig(config) {
  const method = String(config.method || 'straight-line').trim().toLowerCase()
  const normalizedMethod = method === 'reducing-balance' ? 'reducing-balance' : 'straight-line'
  const usefulLifeYears = Math.max(
    0,
    Number(config.usefulLifeYears) || ((Number(config.usefulLifeMonths) || 0) / 12),
  )
  return {
    assetCode: String(config.assetCode || '').trim(),
    expenseCode: String(config.expenseCode || '').trim(),
    accumulatedCode: String(config.accumulatedCode || '').trim(),
    method: normalizedMethod,
    rate: Math.max(0, Number(config.rate) || 0),
    usefulLifeYears,
    salvageValue: Number(config.salvageValue) || 0,
    assetCost: Number(config.assetCost) || 0,
    totalAccumulated: Number(config.totalAccumulated) || 0,
    lastPostedAt: config.lastPostedAt || null,
  }
}

function normalizeAuditLog(log, fallbackId = Date.now()) {
  return {
    id: log.id || `LOG-${fallbackId}`,
    at: log.at || nowIso(),
    action: String(log.action || '').trim() || 'UNKNOWN',
    entity: String(log.entity || '').trim() || 'ACCOUNT',
    entityCode: String(log.entityCode || '').trim(),
    note: String(log.note || '').trim(),
    user: String(log.user || 'system').trim(),
    meta: log.meta || null,
  }
}

function createAuditLogId() {
  const timePart = Date.now().toString(36).toUpperCase()
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `LOG-${timePart}-${randomPart}`
}

function ensureUniqueAuditLogIds(logs) {
  const seen = new Set()
  let changed = false

  const uniqueLogs = logs.map((log) => {
    let id = String(log?.id || '').trim()
    if (!id || seen.has(id)) {
      changed = true
      do {
        id = createAuditLogId()
      } while (seen.has(id))
      seen.add(id)
      return {
        ...log,
        id,
      }
    }

    seen.add(id)
    return log
  })

  return { logs: uniqueLogs, changed }
}

function isLegacyDummyAccount(account) {
  const code = String(account?.code || '').trim()
  const name = String(account?.name || '').trim().toLowerCase()
  return LEGACY_DUMMY_ACCOUNT_KEYS.has(`${code}|${name}`)
}

function normalizeAccountNameKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
}

function isRemovedByName(account) {
  const key = normalizeAccountNameKey(account?.name)
  if (REMOVED_ACCOUNT_NAME_KEYS.has(key)) return true
  const hasPlant = key.includes('plant') || key.includes('plamt')
  const hasMachinery = key.includes('machinery') || key.includes('machinary')
  return hasPlant && hasMachinery
}

function normalizeLegacyEquityBalance(account) {
  if (
    String(account?.code || '').trim() === '3000' &&
    String(account?.name || '').trim().toLowerCase() === 'equity' &&
    Number(account?.openingBalance) === 2900000 &&
    Number(account?.balance) === 2900000
  ) {
    return {
      ...account,
      openingBalance: 0,
      balance: 0,
      updatedAt: nowIso(),
    }
  }
  return account
}

function normalizeLegacyStructuralBalance(account, hasLegacySnapshot) {
  if (!hasLegacySnapshot) return account

  const code = String(account?.code || '').trim()
  const expectedBalance = LEGACY_DUMMY_STRUCTURAL_BALANCES[code]
  if (typeof expectedBalance !== 'number') return account
  if (Number(account?.balance) !== expectedBalance) return account

  return {
    ...account,
    openingBalance: 0,
    balance: 0,
    updatedAt: nowIso(),
  }
}

function sanitizeStoredAccounts(accounts) {
  let changed = false
  const sanitized = []
  const hasLegacySnapshot = accounts.some(isLegacyDummyAccount) || accounts.some((account) => {
    const code = String(account?.code || '').trim()
    const expectedBalance = LEGACY_DUMMY_STRUCTURAL_BALANCES[code]
    return typeof expectedBalance === 'number' && Number(account?.balance) === expectedBalance
  })

  accounts.forEach((account) => {
    if (isLegacyDummyAccount(account) || isRemovedByName(account)) {
      changed = true
      return
    }

    const normalized = normalizeLegacyStructuralBalance(normalizeLegacyEquityBalance(account), hasLegacySnapshot)
    if (
      normalized.openingBalance !== account.openingBalance ||
      normalized.balance !== account.balance
    ) {
      changed = true
    }
    sanitized.push(normalized)
  })

  return { sanitized, changed }
}

function isLegacyDummyLedgerEntry(entry) {
  return (
    String(entry?.id || '').trim() === 'JV-001' &&
    String(entry?.narration || '').trim().toLowerCase() === 'opening cash balance' &&
    (String(entry?.accountCode || '').trim() === '1110' || String(entry?.accountCode || '').trim() === '3000')
  )
}

function sanitizeStoredLedgerEntries(entries) {
  const sanitized = entries.filter((entry) => !isLegacyDummyLedgerEntry(entry))
  return { sanitized, changed: sanitized.length !== entries.length }
}

function hasAccountBalanceDrift(previousAccounts, nextAccounts) {
  const nextByCode = new Map(nextAccounts.map((account) => [account.code, account]))
  return previousAccounts.some((account) => {
    const next = nextByCode.get(account.code)
    if (!next) return true
    return Number(next.balance) !== Number(account.balance)
  })
}

export function loadChartAccountsFromStorage() {
  const raw = getStorageValue(CHART_ACCOUNTS_STORAGE_KEY, null)
  if (!raw) {
    return rebuildAccountBalancesFromLedger(SEED_ACCOUNTS.map((a) => normalizeAccount(a)), loadLedgerEntriesFromStorage())
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return rebuildAccountBalancesFromLedger(SEED_ACCOUNTS.map((a) => normalizeAccount(a)), loadLedgerEntriesFromStorage())
    }
    const normalizedAccounts = parsed.map((account, index) => normalizeAccount(account, Date.now() + index))
    const { sanitized, changed } = sanitizeStoredAccounts(normalizedAccounts)
    const accountsToUse = sanitized.length > 0 ? sanitized : SEED_ACCOUNTS.map((a) => normalizeAccount(a))
    const recalculated = recalculateParentBalances(accountsToUse)
    const synced = rebuildAccountBalancesFromLedger(recalculated, loadLedgerEntriesFromStorage())
    if (changed || hasAccountBalanceDrift(recalculated, synced)) saveChartAccountsToStorage(synced)
    return synced
  } catch {
    return rebuildAccountBalancesFromLedger(SEED_ACCOUNTS.map((a) => normalizeAccount(a)), loadLedgerEntriesFromStorage())
  }
}

export function saveChartAccountsToStorage(accounts) {
  setStorageValue(CHART_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts.map((a) => normalizeAccount(a))))
}

export function loadLedgerEntriesFromStorage() {
  const raw = getStorageValue(GENERAL_LEDGER_STORAGE_KEY, null)
  if (!raw) return SEED_LEDGER_ENTRIES.map(normalizeLedgerEntry)

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return SEED_LEDGER_ENTRIES.map(normalizeLedgerEntry)
    const normalizedEntries = parsed.map(normalizeLedgerEntry)
    const { sanitized, changed } = sanitizeStoredLedgerEntries(normalizedEntries)
    if (changed) saveLedgerEntriesToStorage(sanitized)
    return sanitized
  } catch {
    return SEED_LEDGER_ENTRIES.map(normalizeLedgerEntry)
  }
}

export function saveLedgerEntriesToStorage(entries) {
  setStorageValue(GENERAL_LEDGER_STORAGE_KEY, JSON.stringify(entries.map(normalizeLedgerEntry)))
}

function hydrateDepreciationConfigTotals(configs, ledgerEntries) {
  return configs.map((config) => {
    const totalAccumulated = Math.max(0, ledgerEntries.reduce((sum, entry) => {
      if (entry.accountCode !== config.accumulatedCode) return sum
      if (String(entry.status || '').toLowerCase() !== 'posted') return sum
      return sum + (Number(entry.credit) || 0) - (Number(entry.debit) || 0)
    }, 0))

    return {
      ...config,
      totalAccumulated,
      bookValue: Math.max(0, (Number(config.assetCost) || 0) - totalAccumulated),
    }
  })
}

export function loadDepreciationConfigsFromStorage() {
  const raw = getStorageValue(DEPRECIATION_CONFIGS_STORAGE_KEY, null)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const normalized = parsed.map(normalizeDepreciationConfig)
    return hydrateDepreciationConfigTotals(normalized, loadLedgerEntriesFromStorage())
  } catch {
    return []
  }
}

export function saveDepreciationConfigsToStorage(configs) {
  setStorageValue(DEPRECIATION_CONFIGS_STORAGE_KEY, JSON.stringify(configs.map(normalizeDepreciationConfig)))
}

export function loadAuditLogsFromStorage() {
  const raw = getStorageValue(ACCOUNT_AUDIT_LOGS_STORAGE_KEY, null)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const normalized = parsed.map((log, index) => normalizeAuditLog(log, Date.now() + index))
    const { logs, changed } = ensureUniqueAuditLogIds(normalized)
    if (changed) saveAuditLogsToStorage(logs)
    return logs
  } catch {
    return []
  }
}

export function saveAuditLogsToStorage(logs) {
  const normalized = Array.isArray(logs)
    ? logs.map((log, index) => normalizeAuditLog(log, Date.now() + index))
    : []
  const { logs: uniqueLogs } = ensureUniqueAuditLogIds(normalized)
  setStorageValue(ACCOUNT_AUDIT_LOGS_STORAGE_KEY, JSON.stringify(uniqueLogs))
}

export function appendAuditLog({ action, entity = 'ACCOUNT', entityCode = '', note = '', user = 'system', meta = null }) {
  const logs = loadAuditLogsFromStorage()
  logs.unshift(normalizeAuditLog({
    id: createAuditLogId(),
    at: nowIso(),
    action,
    entity,
    entityCode,
    note,
    user,
    meta,
  }))
  saveAuditLogsToStorage(logs.slice(0, 500))
}

export function getActiveAccounts(accounts = loadChartAccountsFromStorage()) {
  return accounts.filter((account) => !account.deletedAt)
}

function computeNextVoucherId(entries) {
  const max = entries.reduce((highest, entry) => {
    const match = String(entry.id || '').match(/^JV-(\d+)$/)
    const value = match ? Number(match[1]) : 0
    return value > highest ? value : highest
  }, 0)
  return `JV-${String(max + 1).padStart(3, '0')}`
}

export function getNextVoucherNumber(entries = loadLedgerEntriesFromStorage()) {
  return computeNextVoucherId(entries)
}

function getEntryLockDeadlineMs(entry) {
  const explicit = toTimeMs(entry?.lockedAt, NaN)
  if (Number.isFinite(explicit)) return explicit
  const createdAtMs = toTimeMs(entry?.createdAt, toTimeMs(`${entry?.date || ''}T00:00:00`, Date.now()))
  return createdAtMs + JOURNAL_LOCK_WINDOW_MS
}

export function isLedgerEntryLocked(entry, nowMs = Date.now()) {
  if (!entry) return true
  return nowMs >= getEntryLockDeadlineMs(entry)
}

export function isLedgerVoucherLocked(voucherNo, entries = loadLedgerEntriesFromStorage(), nowMs = Date.now()) {
  const key = String(voucherNo || '').trim()
  if (!key) return true
  const voucherEntries = entries.filter((entry) => entry.id === key)
  if (voucherEntries.length === 0) return true
  return voucherEntries.some((entry) => isLedgerEntryLocked(entry, nowMs))
}

export function adjustBalanceByEntryType(accountType, debit, credit) {
  if (DEBIT_INCREASE_TYPES.has(accountType)) return debit - credit
  return credit - debit
}

export function recalculateParentBalances(accounts) {
  const alive = accounts.filter((account) => !account.deletedAt)
  const accountMap = new Map(alive.map((account) => [account.code, account]))
  const childCodesByParent = new Map()

  alive.forEach((account) => {
    if (!account.parentCode) return
    if (!childCodesByParent.has(account.parentCode)) childCodesByParent.set(account.parentCode, [])
    childCodesByParent.get(account.parentCode).push(account.code)
  })

  const memo = new Map()
  const visit = (code) => {
    if (memo.has(code)) return memo.get(code)
    const account = accountMap.get(code)
    if (!account) return 0

    const children = childCodesByParent.get(code) || []
    if (children.length === 0) {
      const own = Number(account.balance) || 0
      memo.set(code, own)
      return own
    }

    const aggregate = children.reduce((sum, childCode) => sum + visit(childCode), 0)
    account.balance = aggregate
    memo.set(code, aggregate)
    return aggregate
  }

  alive.filter((account) => account.level === 0).forEach((account) => visit(account.code))
  return accounts
}

function rebuildAccountBalancesFromLedger(accounts, ledgerEntries) {
  const nextAccounts = accounts.map((account) => ({ ...account }))
  const activeByCode = new Map()

  nextAccounts.forEach((account) => {
    if (account.deletedAt) return
    account.balance = Number(account.openingBalance) || 0
    activeByCode.set(account.code, account)
  })

  ledgerEntries.forEach((entry) => {
    if (String(entry.status || '').toLowerCase() !== 'posted') return
    const account = activeByCode.get(String(entry.accountCode || '').trim())
    if (!account) return
    account.balance = (Number(account.balance) || 0) + adjustBalanceByEntryType(account.type, Number(entry.debit) || 0, Number(entry.credit) || 0)
  })

  return recalculateParentBalances(nextAccounts)
}

function getDescendantCodes(accounts, rootCode) {
  const childrenByParent = new Map()
  accounts.forEach((account) => {
    if (!account.parentCode || account.deletedAt) return
    if (!childrenByParent.has(account.parentCode)) childrenByParent.set(account.parentCode, [])
    childrenByParent.get(account.parentCode).push(account.code)
  })

  const result = [rootCode]
  const stack = [rootCode]
  while (stack.length > 0) {
    const current = stack.pop()
    const children = childrenByParent.get(current) || []
    children.forEach((code) => {
      result.push(code)
      stack.push(code)
    })
  }

  return result
}

export function isAccountUsedInLedger(accountCode, ledgerEntries = loadLedgerEntriesFromStorage()) {
  // opening-balance entries are system-managed and should not prevent account editing
  return ledgerEntries.some((entry) => (
    !entry?.deletedAt
    && String(entry?.status || '').trim().toLowerCase() === 'posted'
    && entry.accountCode === accountCode
    && String(entry.source || '').trim().toLowerCase() !== 'opening-balance'
  ))
}

// Returns the best equity account code to use as the balancing leg for opening balance journal entries.
// Prefers a leaf-level child of the Equity (3000) account; falls back to 3000 itself.
function resolveOpeningBalanceEquityCode(accountsLookup) {
  const EQUITY_ROOT = '3000'
  // Find active, non-deleted children of equity that are themselves postable (leaf nodes)
  const children = (accountsLookup || []).filter(
    (a) => !a.deletedAt && a.active !== false && a.parentCode === EQUITY_ROOT,
  )
  if (children.length > 0) {
    // Prefer an account whose name looks like "Opening Balance Equity" or "Retained Earnings"
    const preferred = children.find((a) =>
      /opening.balance|retained|equity/i.test(a.name),
    )
    return (preferred || children[0]).code
  }
  return EQUITY_ROOT
}

export function isAccountLocked(accountCode, accounts = loadChartAccountsFromStorage(), ledgerEntries = loadLedgerEntriesFromStorage()) {
  const codes = getDescendantCodes(accounts, accountCode)
  return codes.some((code) => isAccountUsedInLedger(code, ledgerEntries))
}

function normalizeJournalRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => ({
      accountCode: String(row.accountCode || '').trim(),
      debit: Number(row.debit) || 0,
      credit: Number(row.credit) || 0,
    }))
    .filter((row) => row.accountCode && (row.debit > 0 || row.credit > 0))
}

function validateJournalRows(validRows) {
  if (validRows.length < 2) throw new Error('At least two valid rows are required')
  if (validRows.some((row) => row.debit > 0 && row.credit > 0)) throw new Error('A row cannot have both debit and credit values')
  const totalDebit = validRows.reduce((sum, row) => sum + row.debit, 0)
  const totalCredit = validRows.reduce((sum, row) => sum + row.credit, 0)
  if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.0001) throw new Error('Entry must be balanced')
}

function validateJournalPostingAccounts(validRows, accounts) {
  const accountByCode = new Map(accounts.filter((item) => !item.deletedAt).map((item) => [item.code, item]))
  validRows.forEach((row) => {
    const account = accountByCode.get(row.accountCode)
    if (!account) throw new Error('Account does not exist in Chart of Accounts')
    if (!isPostableAccount(account, accounts)) throw new Error('Only active posting accounts can be used')
  })
}

export function postJournalRows({ date, narration = '', description = '', reference = '', rows, liabilityPlan = null, user = 'system', source = 'journal' }) {
  const cleanDate = String(date || '').trim()
  const cleanDescription = String(description || narration || '').trim()

  if (!cleanDate || !cleanDescription) throw new Error('Date and description are required')
  const closedPeriod = getClosedPeriodLabelForDate(cleanDate)
  if (closedPeriod) throw new Error(`Accounting period "${closedPeriod}" is closed. Re-open from Settings before posting.`)
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('At least two rows are required')

  const validRows = normalizeJournalRows(rows)
  validateJournalRows(validRows)

  const accounts = loadChartAccountsFromStorage().map((a) => ({ ...a }))
  const ledgerEntries = loadLedgerEntriesFromStorage().map((e) => ({ ...e }))
  validateJournalPostingAccounts(validRows, accounts)

  const voucherId = computeNextVoucherId(ledgerEntries)
  const createdAt = nowIso()
  const lockedAt = new Date(toTimeMs(createdAt) + JOURNAL_LOCK_WINDOW_MS).toISOString()
  const accountByCode = new Map(accounts.filter((item) => !item.deletedAt).map((item) => [item.code, item]))
  const newEntries = validRows.map((row) => {
    const account = accountByCode.get(row.accountCode)
    return normalizeLedgerEntry({
      id: voucherId,
      voucherNo: voucherId,
      date: cleanDate,
      description: cleanDescription,
      reference,
      account: `${account.code} - ${account.name}`,
      accountCode: account.code,
      debit: row.debit,
      credit: row.credit,
      status: 'Posted',
      source,
      createdAt,
      updatedAt: createdAt,
      lockedAt,
      liabilityPlan,
    })
  })

  const updatedLedger = [...ledgerEntries, ...newEntries]
  const updatedAccounts = rebuildAccountBalancesFromLedger(accounts, updatedLedger)

  saveChartAccountsToStorage(updatedAccounts)
  saveLedgerEntriesToStorage(updatedLedger)
  appendAuditLog({
    action: 'JOURNAL_POSTED',
    entity: 'LEDGER',
    entityCode: voucherId,
    note: `Posted journal voucher ${voucherId}`,
    user,
    meta: { rows: validRows.length, source },
  })

  return { accounts: updatedAccounts, entries: updatedLedger, voucherId }
}

export function updateJournalVoucher({ voucherNo, date, narration = '', description = '', reference = '', rows, liabilityPlan = undefined, user = 'system' }) {
  const voucherId = String(voucherNo || '').trim()
  if (!voucherId) throw new Error('Voucher number is required')

  const cleanDate = String(date || '').trim()
  const cleanDescription = String(description || narration || '').trim()
  if (!cleanDate || !cleanDescription) throw new Error('Date and description are required')
  const closedPeriod = getClosedPeriodLabelForDate(cleanDate)
  if (closedPeriod) throw new Error(`Accounting period "${closedPeriod}" is closed. Re-open from Settings before updating.`)

  const validRows = normalizeJournalRows(rows)
  validateJournalRows(validRows)

  const accounts = loadChartAccountsFromStorage().map((a) => ({ ...a }))
  const ledgerEntries = loadLedgerEntriesFromStorage().map((e) => ({ ...e }))
  const existingVoucherEntries = ledgerEntries.filter((entry) => entry.id === voucherId)
  if (existingVoucherEntries.length === 0) throw new Error('Voucher not found')
  validateJournalPostingAccounts(validRows, accounts)

  const createdAtMs = existingVoucherEntries.reduce((lowest, entry) => Math.min(lowest, toTimeMs(entry.createdAt, Date.now())), Number.MAX_SAFE_INTEGER)
  const preservedCreatedAt = new Date(createdAtMs).toISOString()
  const preservedLockedAt = new Date(createdAtMs + JOURNAL_LOCK_WINDOW_MS).toISOString()
  const source = String(existingVoucherEntries[0]?.source || 'journal').trim() || 'journal'
  const preservedLiabilityPlan = existingVoucherEntries[0]?.liabilityPlan || null
  const finalLiabilityPlan = liabilityPlan === undefined ? preservedLiabilityPlan : liabilityPlan
  const accountByCode = new Map(accounts.filter((item) => !item.deletedAt).map((item) => [item.code, item]))
  const now = nowIso()

  const replacement = validRows.map((row) => {
    const account = accountByCode.get(row.accountCode)
    return normalizeLedgerEntry({
      id: voucherId,
      voucherNo: voucherId,
      date: cleanDate,
      description: cleanDescription,
      reference,
      account: `${account.code} - ${account.name}`,
      accountCode: account.code,
      debit: row.debit,
      credit: row.credit,
      status: 'Posted',
      source,
      createdAt: preservedCreatedAt,
      updatedAt: now,
      lockedAt: preservedLockedAt,
      liabilityPlan: finalLiabilityPlan,
    })
  })

  const updatedLedger = [...ledgerEntries.filter((entry) => entry.id !== voucherId), ...replacement]
  const updatedAccounts = rebuildAccountBalancesFromLedger(accounts, updatedLedger)

  saveChartAccountsToStorage(updatedAccounts)
  saveLedgerEntriesToStorage(updatedLedger)
  appendAuditLog({ action: 'JOURNAL_UPDATED', entity: 'LEDGER', entityCode: voucherId, note: `Updated voucher ${voucherId}`, user, meta: { rows: validRows.length } })

  return { accounts: updatedAccounts, entries: updatedLedger, voucherId }
}

export function deleteJournalVoucher(voucherNo, user = 'system') {
  const voucherId = String(voucherNo || '').trim()
  if (!voucherId) throw new Error('Voucher number is required')

  const accounts = loadChartAccountsFromStorage().map((a) => ({ ...a }))
  const ledgerEntries = loadLedgerEntriesFromStorage().map((e) => ({ ...e }))
  const voucherEntries = ledgerEntries.filter((entry) => entry.id === voucherId)
  if (voucherEntries.length === 0) throw new Error('Voucher not found')

  const updatedLedger = ledgerEntries.filter((entry) => entry.id !== voucherId)
  const updatedAccounts = rebuildAccountBalancesFromLedger(accounts, updatedLedger)

  saveChartAccountsToStorage(updatedAccounts)
  saveLedgerEntriesToStorage(updatedLedger)
  appendAuditLog({ action: 'JOURNAL_DELETED', entity: 'LEDGER', entityCode: voucherId, note: `Deleted voucher ${voucherId}`, user, meta: { removedRows: voucherEntries.length } })

  return { accounts: updatedAccounts, entries: updatedLedger, voucherId }
}

export function postGeneralEntry({ date, narration, description = '', reference = '', debitCode, creditCode, amount, liabilityPlan = null, user = 'system', source = 'journal' }) {
  const amountNumber = Number(amount)
  if (!debitCode || !creditCode || !Number.isFinite(amountNumber) || amountNumber <= 0) throw new Error('Invalid general entry')
  return postJournalRows({
    date,
    narration,
    description,
    reference,
    liabilityPlan,
    user,
    source,
    rows: [
      { accountCode: debitCode, debit: amountNumber, credit: 0 },
      { accountCode: creditCode, debit: 0, credit: amountNumber },
    ],
  })
}

function buildChildCode(baseCode, prefix) {
  return `${prefix}-${String(baseCode).trim()}`
}

function ensureDepreciationSetup({
  accounts,
  configs,
  assetCode,
  assetName,
  assetOpeningBalance,
  assetParentAccount = null,
  depreciationMethod: depreciationMethodInput = 'straight-line',
  depreciationRate: depreciationRateInput = 0,
  usefulLifeYears = 0,
  salvageValue = 0,
}) {
  const depreciationMethodRaw = String(depreciationMethodInput || 'straight-line').trim().toLowerCase()
  const depreciationMethod = depreciationMethodRaw === 'reducing-balance' ? 'reducing-balance' : 'straight-line'
  const depreciationRate = Math.max(0, Number(depreciationRateInput) || 0)
  const lifeYears = Number(usefulLifeYears) || 0
  const salvage = Number(salvageValue) || 0

  if (depreciationMethod === 'straight-line' && lifeYears <= 0) {
    throw new Error('Useful life (years) is required for Straight Line depreciation')
  }
  if (depreciationMethod === 'reducing-balance' && depreciationRate <= 0) {
    throw new Error('Rate is required for Reducing Balance depreciation')
  }

  const code = String(assetCode || '').trim()
  const name = String(assetName || '').trim()
  if (!code || !name) throw new Error('Asset code and name are required for depreciation setup')

  const expenseCode = buildChildCode(code, 'DEP')
  const accumulatedCode = buildChildCode(code, 'ACCDEP')

  if (!accounts.some((account) => account.code === expenseCode && !account.deletedAt)) {
    const expenseParent = accounts.find((account) => account.code === '5000' && !account.deletedAt) || accounts.find((account) => account.type === 'Expenses' && account.level === 0 && !account.deletedAt)
    if (expenseParent) {
      accounts.push(normalizeAccount({
        id: Date.now() + 1,
        code: expenseCode,
        name: `Depreciation Expense - ${name}`,
        type: 'Expenses',
        subcategory: 'Depreciation',
        level: expenseParent.level + 1,
        parentCode: expenseParent.code,
        openingBalance: 0,
        balance: 0,
        active: true,
      }))
    }
  }

  if (!accounts.some((account) => account.code === accumulatedCode && !account.deletedAt)) {
    const fixedAssetsParent = accounts.find((account) => account.code === '1200' && !account.deletedAt) || assetParentAccount
    accounts.push(normalizeAccount({
      id: Date.now() + 2,
      code: accumulatedCode,
      name: `Accumulated Depreciation - ${name}`,
      type: 'Assets',
      subcategory: 'Non-Current Assets',
      level: (fixedAssetsParent?.level || 0) + 1,
      parentCode: fixedAssetsParent?.code || '1000',
      openingBalance: 0,
      balance: 0,
      active: true,
    }))
  }

  const existingConfigIndex = configs.findIndex((config) => config.assetCode === code)
  const config = {
    assetCode: code,
    expenseCode,
    accumulatedCode,
    method: depreciationMethod,
    rate: depreciationRate,
    usefulLifeYears: lifeYears,
    salvageValue: salvage,
    assetCost: Number(assetOpeningBalance) || 0,
    totalAccumulated: existingConfigIndex >= 0 ? Number(configs[existingConfigIndex].totalAccumulated) || 0 : 0,
    lastPostedAt: existingConfigIndex >= 0 ? configs[existingConfigIndex].lastPostedAt : null,
  }

  if (existingConfigIndex >= 0) configs[existingConfigIndex] = config
  else configs.push(config)
}

export function addChartAccountFromDraft(draft, user = 'system') {
  const accounts = loadChartAccountsFromStorage().map((a) => ({ ...a }))
  const configs = loadDepreciationConfigsFromStorage().map((c) => ({ ...c }))

  const code = String(draft.code || '').trim()
  if (!code) throw new Error('Account code is required')
  if (accounts.some((account) => account.code === code && !account.deletedAt)) throw new Error('Account code already exists')

  const parentAccount = accounts.find((account) => account.code === String(draft.parentCode || '').trim() && !account.deletedAt)
  if (!parentAccount) throw new Error('Parent account not found')

  const resolvedSubcategory = String(draft.subcategory || parentAccount.subcategory || '').trim()
  const normalizedType = normalizeType(draft.type, resolvedSubcategory)

  if (parentAccount.type !== normalizedType.type) throw new Error('Child account type must match parent account type')

  accounts.push(normalizeAccount({
    id: Date.now(),
    code,
    name: draft.name,
    type: normalizedType.type,
    subcategory: normalizedType.subcategory || parentAccount.subcategory || '',
    level: parentAccount.level + 1,
    parentCode: parentAccount.code,
    openingBalance: Number(draft.openingBalance) || 0,
    balance: Number(draft.openingBalance) || 0,
    active: draft.active !== false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }))

  const finalSubcategory = normalizedType.subcategory || parentAccount.subcategory || ''
  const shouldAutoDepreciate = draft.autoDepreciation === true && normalizedType.type === 'Assets' && finalSubcategory === 'Non-Current Assets'

  if (shouldAutoDepreciate) {
    ensureDepreciationSetup({
      accounts,
      configs,
      assetCode: code,
      assetName: draft.name,
      assetOpeningBalance: Number(draft.openingBalance) || 0,
      assetParentAccount: parentAccount,
      depreciationMethod: draft.depreciationMethod,
      depreciationRate: Number(draft.depreciationRate) || 0,
      usefulLifeYears: Number(draft.usefulLifeYears) || 0,
      salvageValue: Number(draft.salvageValue) || 0,
    })
  }

  const updatedAccounts = recalculateParentBalances(accounts)
  saveChartAccountsToStorage(updatedAccounts)
  saveDepreciationConfigsToStorage(configs)
  appendAuditLog({ action: 'ACCOUNT_CREATED', entityCode: code, note: `Created account ${code} - ${draft.name}`, user })

  // Post opening balance as a journal entry so Trial Balance stays balanced.
  // Opening Balance Equity account (3000) is used as the balancing leg.
  const obAmount = Number(draft.openingBalance) || 0
  if (obAmount !== 0) {
    const obDate = String(draft.openingBalanceDate || draft.createdAt || new Date().toISOString().slice(0, 10)).slice(0, 10) || new Date().toISOString().slice(0, 10)
    const obNarration = `Opening balance - ${code} ${draft.name}`
    try {
      const ledgerEntries = loadLedgerEntriesFromStorage().map((e) => ({ ...e }))
      const voucherId = computeNextVoucherId(ledgerEntries)
      const createdAt = nowIso()
      const lockedAt = new Date(toTimeMs(createdAt) + JOURNAL_LOCK_WINDOW_MS).toISOString()
      const accountsForLookup = loadChartAccountsFromStorage()
      const accountByCode = new Map(accountsForLookup.filter((a) => !a.deletedAt).map((a) => [a.code, a]))
      const newAccount = accountByCode.get(code) || { code, name: draft.name }
      const OB_EQUITY_CODE = resolveOpeningBalanceEquityCode(accountsForLookup)
      const equityAccount = accountByCode.get(OB_EQUITY_CODE) || { code: OB_EQUITY_CODE, name: 'Equity' }

      // For Debit-normal accounts (Assets, Expenses): Debit the account, Credit equity
      // For Credit-normal accounts (Liabilities, Equity, Revenue): Credit the account, Debit equity
      const isDebitNormal = DEBIT_INCREASE_TYPES.has(normalizedType.type)
      const newEntries = [
        normalizeLedgerEntry({
          id: voucherId,
          voucherNo: voucherId,
          date: obDate,
          description: obNarration,
          narration: obNarration,
          reference: 'OB',
          account: `${newAccount.code} - ${newAccount.name}`,
          accountCode: code,
          debit: isDebitNormal ? Math.abs(obAmount) : 0,
          credit: isDebitNormal ? 0 : Math.abs(obAmount),
          status: 'Posted',
          source: 'opening-balance',
          createdAt,
          updatedAt: createdAt,
          lockedAt,
        }),
        normalizeLedgerEntry({
          id: voucherId,
          voucherNo: voucherId,
          date: obDate,
          description: obNarration,
          narration: obNarration,
          reference: 'OB',
          account: `${equityAccount.code} - ${equityAccount.name}`,
          accountCode: OB_EQUITY_CODE,
          debit: isDebitNormal ? 0 : Math.abs(obAmount),
          credit: isDebitNormal ? Math.abs(obAmount) : 0,
          status: 'Posted',
          source: 'opening-balance',
          createdAt,
          updatedAt: createdAt,
          lockedAt,
        }),
      ]
      const updatedLedger = [...ledgerEntries, ...newEntries]
      saveLedgerEntriesToStorage(updatedLedger)
      const rebuiltAccounts = rebuildAccountBalancesFromLedger(loadChartAccountsFromStorage(), updatedLedger)
      saveChartAccountsToStorage(rebuiltAccounts)
      appendAuditLog({ action: 'OPENING_BALANCE_POSTED', entityCode: code, note: `Opening balance journal ${voucherId} posted for ${code}`, user, meta: { amount: obAmount } })
    } catch (obError) {
      // Non-fatal: opening balance entry failed (e.g. equity account missing), account is still created
      appendAuditLog({ action: 'OPENING_BALANCE_FAILED', entityCode: code, note: `Opening balance journal failed: ${obError?.message}`, user })
    }
  }

  return { accounts: loadChartAccountsFromStorage(), configs }
}

export function updateChartAccount(code, updates, user = 'system') {
  const targetCode = String(code || '').trim()
  const accounts = loadChartAccountsFromStorage().map((a) => ({ ...a }))
  const configs = loadDepreciationConfigsFromStorage().map((c) => ({ ...c }))
  const ledgerEntries = loadLedgerEntriesFromStorage()

  const accountIndex = accounts.findIndex((account) => account.code === targetCode && !account.deletedAt)
  if (accountIndex < 0) throw new Error('Account not found')
  if (isAccountLocked(targetCode, accounts, ledgerEntries)) throw new Error('This account is linked with journal entries and cannot be edited')

  const account = accounts[accountIndex]
  const nextCode = String(updates.code || account.code).trim()
  const nextName = String(updates.name || account.name).trim()

  if (!nextCode) throw new Error('Account code is required')
  if (!nextName) throw new Error('Account name is required')

  if (nextCode !== account.code && accounts.some((item) => item.code === nextCode && !item.deletedAt)) {
    throw new Error('Account code already exists')
  }

  const nextType = updates.type || account.type
  if (nextType !== account.type) throw new Error('Account type cannot be changed')

  accounts[accountIndex] = normalizeAccount({
    ...account,
    code: nextCode,
    name: nextName,
    subcategory: typeof updates.subcategory === 'string' ? updates.subcategory : account.subcategory,
    openingBalance: updates.openingBalance ?? account.openingBalance,
    balance: Number(updates.openingBalance ?? account.openingBalance) || 0,
    active: updates.active ?? account.active,
    updatedAt: nowIso(),
  })

  if (nextCode !== targetCode) {
    accounts.forEach((item) => {
      if (item.parentCode === targetCode) item.parentCode = nextCode
    })
    configs.forEach((config) => {
      if (config.assetCode === targetCode) config.assetCode = nextCode
    })
  }

  const updatedAccount = accounts[accountIndex]
  const updatedParent = accounts.find((item) => item.code === updatedAccount.parentCode && !item.deletedAt) || null
  const shouldAutoDepreciate = updates.autoDepreciation === true && updatedAccount.type === 'Assets' && updatedAccount.subcategory === 'Non-Current Assets'

  if (shouldAutoDepreciate) {
    ensureDepreciationSetup({
      accounts,
      configs,
      assetCode: updatedAccount.code,
      assetName: updatedAccount.name,
      assetOpeningBalance: Number(updatedAccount.openingBalance) || 0,
      assetParentAccount: updatedParent,
      depreciationMethod: updates.depreciationMethod,
      depreciationRate: Number(updates.depreciationRate) || 0,
      usefulLifeYears: Number(updates.usefulLifeYears) || 0,
      salvageValue: Number(updates.salvageValue) || 0,
    })
  }

  const updatedAccounts = recalculateParentBalances(accounts)
  saveChartAccountsToStorage(updatedAccounts)
  saveDepreciationConfigsToStorage(configs)
  appendAuditLog({ action: 'ACCOUNT_UPDATED', entityCode: nextCode, note: `Updated account ${nextCode} - ${nextName}`, user, meta: { previousCode: targetCode } })

  // If openingBalance changed, update the existing OB journal entry or create a new one
  const prevOB = Number(account.openingBalance) || 0
  const nextOB = Number(updates.openingBalance ?? account.openingBalance) || 0
  if (nextOB !== prevOB) {
    try {
      let currentLedger = loadLedgerEntriesFromStorage().map((e) => ({ ...e }))
      // Remove old OB entries for this account code
      const oldOBVouchers = new Set(
        currentLedger
          .filter((e) => e.source === 'opening-balance' && (e.accountCode === targetCode || e.accountCode === nextCode))
          .map((e) => e.voucherNo),
      )
      // Also remove the matching equity legs of those vouchers
      currentLedger = currentLedger.filter((e) => !oldOBVouchers.has(e.voucherNo))

      if (nextOB !== 0) {
        const voucherId = computeNextVoucherId(currentLedger)
        const createdAt = nowIso()
        const lockedAt = new Date(toTimeMs(createdAt) + JOURNAL_LOCK_WINDOW_MS).toISOString()
        const obDate = new Date().toISOString().slice(0, 10)
        const obNarration = `Opening balance - ${nextCode} ${nextName}`
        const isDebitNormal = DEBIT_INCREASE_TYPES.has(updatedAccount.type)
        const equityAccountsLookup = loadChartAccountsFromStorage()
        const OB_EQUITY_CODE = resolveOpeningBalanceEquityCode(equityAccountsLookup)
        const equityAccount = equityAccountsLookup.find((a) => a.code === OB_EQUITY_CODE) || { code: OB_EQUITY_CODE, name: 'Equity' }
        const obEntries = [
          normalizeLedgerEntry({ id: voucherId, voucherNo: voucherId, date: obDate, description: obNarration, narration: obNarration, reference: 'OB', account: `${nextCode} - ${nextName}`, accountCode: nextCode, debit: isDebitNormal ? Math.abs(nextOB) : 0, credit: isDebitNormal ? 0 : Math.abs(nextOB), status: 'Posted', source: 'opening-balance', createdAt, updatedAt: createdAt, lockedAt }),
          normalizeLedgerEntry({ id: voucherId, voucherNo: voucherId, date: obDate, description: obNarration, narration: obNarration, reference: 'OB', account: `${equityAccount.code} - ${equityAccount.name}`, accountCode: OB_EQUITY_CODE, debit: isDebitNormal ? 0 : Math.abs(nextOB), credit: isDebitNormal ? Math.abs(nextOB) : 0, status: 'Posted', source: 'opening-balance', createdAt, updatedAt: createdAt, lockedAt }),
        ]
        currentLedger = [...currentLedger, ...obEntries]
      }

      saveLedgerEntriesToStorage(currentLedger)
      const rebuiltAccounts = rebuildAccountBalancesFromLedger(loadChartAccountsFromStorage(), currentLedger)
      saveChartAccountsToStorage(rebuiltAccounts)
      appendAuditLog({ action: 'OPENING_BALANCE_UPDATED', entityCode: nextCode, note: `Opening balance updated for ${nextCode}: ${prevOB} → ${nextOB}`, user })
    } catch (obError) {
      appendAuditLog({ action: 'OPENING_BALANCE_UPDATE_FAILED', entityCode: nextCode, note: `OB update failed: ${obError?.message}`, user })
    }
  }

  return loadChartAccountsFromStorage()
}

export function toggleChartAccountStatus(code, nextActive, user = 'system') {
  const targetCode = String(code || '').trim()
  const accounts = loadChartAccountsFromStorage().map((a) => ({ ...a }))
  const ledgerEntries = loadLedgerEntriesFromStorage()

  const account = accounts.find((item) => item.code === targetCode && !item.deletedAt)
  if (!account) throw new Error('Account not found')
  if (isAccountLocked(targetCode, accounts, ledgerEntries)) throw new Error('Accounts linked in transactions cannot be modified')

  account.active = Boolean(nextActive)
  account.updatedAt = nowIso()

  saveChartAccountsToStorage(accounts)
  appendAuditLog({ action: 'ACCOUNT_STATUS_CHANGED', entityCode: targetCode, note: `Marked ${targetCode} as ${account.active ? 'active' : 'inactive'}`, user })
  return accounts
}

export function softDeleteChartAccount(code, user = 'system') {
  const targetCode = String(code || '').trim()
  const accounts = loadChartAccountsFromStorage().map((a) => ({ ...a }))
  const ledgerEntries = loadLedgerEntriesFromStorage()

  const account = accounts.find((item) => item.code === targetCode && !item.deletedAt)
  if (!account) throw new Error('Account not found')

  const descendantCodes = getDescendantCodes(accounts, targetCode)
  const usedCode = descendantCodes.find((entryCode) => isAccountUsedInLedger(entryCode, ledgerEntries))
  if (usedCode) throw new Error('Accounts linked in transactions cannot be removed')

  const deletedAt = nowIso()
  accounts.forEach((item) => {
    if (descendantCodes.includes(item.code)) {
      item.deletedAt = deletedAt
      item.active = false
      item.updatedAt = deletedAt
      item.balance = 0
    }
  })

  const updatedAccounts = recalculateParentBalances(accounts)
  saveChartAccountsToStorage(updatedAccounts)
  appendAuditLog({ action: 'ACCOUNT_SOFT_DELETED', entityCode: targetCode, note: `Soft deleted account ${targetCode}`, user, meta: { removedCount: descendantCodes.length } })

  // Remove opening-balance journal entries for all deleted accounts
  try {
    const currentLedger = loadLedgerEntriesFromStorage().map((e) => ({ ...e }))
    const obVouchers = new Set(
      currentLedger
        .filter((e) => e.source === 'opening-balance' && descendantCodes.includes(e.accountCode))
        .map((e) => e.voucherNo),
    )
    if (obVouchers.size > 0) {
      const prunedLedger = currentLedger.filter((e) => !obVouchers.has(e.voucherNo))
      saveLedgerEntriesToStorage(prunedLedger)
      const rebuiltAccounts = rebuildAccountBalancesFromLedger(loadChartAccountsFromStorage(), prunedLedger)
      saveChartAccountsToStorage(rebuiltAccounts)
    }
  } catch (_) { /* non-fatal */ }

  return loadChartAccountsFromStorage()
}

export function bulkImportChartAccounts(rows, user = 'system') {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('No rows found for import')

  const accounts = loadChartAccountsFromStorage().map((a) => ({ ...a }))
  const existingCodes = new Set(accounts.filter((account) => !account.deletedAt).map((account) => account.code))

  let created = 0
  const errors = []

  rows.forEach((rawRow, index) => {
    const rowNo = index + 1
    const code = String(rawRow.code || '').trim()
    const name = String(rawRow.name || '').trim()
    const typeCandidate = String(rawRow.type || '').trim()
    const parentCode = String(rawRow.parentCode || '').trim()
    const openingBalance = Number(rawRow.openingBalance) || 0
    const status = String(rawRow.status || 'Active').trim().toLowerCase()

    if (!code || !name || !typeCandidate || !parentCode) {
      errors.push(`Row ${rowNo}: code, name, type and parentCode are required`)
      return
    }

    const normalizedType = normalizeType(typeCandidate, rawRow.subcategory)
    const parent = accounts.find((account) => account.code === parentCode && !account.deletedAt)

    if (!parent) {
      errors.push(`Row ${rowNo}: parent account '${parentCode}' was not found`)
      return
    }

    if (parent.type !== normalizedType.type) {
      errors.push(`Row ${rowNo}: parent type mismatch for '${code}'`)
      return
    }

    if (existingCodes.has(code)) {
      errors.push(`Row ${rowNo}: duplicate account code '${code}'`)
      return
    }

    const account = normalizeAccount({
      id: Date.now() + rowNo,
      code,
      name,
      type: normalizedType.type,
      subcategory: normalizedType.subcategory || parent.subcategory || '',
      level: parent.level + 1,
      parentCode,
      openingBalance,
      balance: openingBalance,
      active: status !== 'inactive',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })

    accounts.push(account)
    existingCodes.add(code)
    created += 1
  })

  const updatedAccounts = recalculateParentBalances(accounts)
  saveChartAccountsToStorage(updatedAccounts)
  appendAuditLog({ action: 'ACCOUNT_BULK_IMPORT', entityCode: 'BATCH', note: `Imported ${created} account(s)`, user, meta: { created, errors: errors.length } })

  // Post opening balance journal entries for imported accounts with openingBalance != 0
  try {
    let currentLedger = loadLedgerEntriesFromStorage().map((e) => ({ ...e }))
    const importedWithOB = rows.filter((rawRow, index) => {
      const code = String(rawRow.code || '').trim()
      const ob = Number(rawRow.openingBalance) || 0
      return code && ob !== 0
    })
    if (importedWithOB.length > 0) {
      const accountsLookup = loadChartAccountsFromStorage()
      const accountByCode = new Map(accountsLookup.filter((a) => !a.deletedAt).map((a) => [a.code, a]))
      const OB_EQUITY_CODE = resolveOpeningBalanceEquityCode(accountsLookup)
      const equityAccount = accountByCode.get(OB_EQUITY_CODE) || { code: OB_EQUITY_CODE, name: 'Equity' }
      const obDate = new Date().toISOString().slice(0, 10)

      importedWithOB.forEach((rawRow) => {
        const code = String(rawRow.code || '').trim()
        const ob = Number(rawRow.openingBalance) || 0
        const name = String(rawRow.name || code).trim()
        const typeRaw = String(rawRow.type || '').trim()
        const normalizedTypeForOB = normalizeType(typeRaw, rawRow.subcategory)
        const isDebitNormal = DEBIT_INCREASE_TYPES.has(normalizedTypeForOB.type)
        const voucherId = computeNextVoucherId(currentLedger)
        const createdAt = nowIso()
        const lockedAt = new Date(toTimeMs(createdAt) + JOURNAL_LOCK_WINDOW_MS).toISOString()
        const obNarration = `Opening balance - ${code} ${name}`
        currentLedger = [
          ...currentLedger,
          normalizeLedgerEntry({ id: voucherId, voucherNo: voucherId, date: obDate, description: obNarration, narration: obNarration, reference: 'OB', account: `${code} - ${name}`, accountCode: code, debit: isDebitNormal ? Math.abs(ob) : 0, credit: isDebitNormal ? 0 : Math.abs(ob), status: 'Posted', source: 'opening-balance', createdAt, updatedAt: createdAt, lockedAt }),
          normalizeLedgerEntry({ id: voucherId, voucherNo: voucherId, date: obDate, description: obNarration, narration: obNarration, reference: 'OB', account: `${equityAccount.code} - ${equityAccount.name}`, accountCode: OB_EQUITY_CODE, debit: isDebitNormal ? 0 : Math.abs(ob), credit: isDebitNormal ? Math.abs(ob) : 0, status: 'Posted', source: 'opening-balance', createdAt, updatedAt: createdAt, lockedAt }),
        ]
      })
      saveLedgerEntriesToStorage(currentLedger)
      const rebuiltAccounts = rebuildAccountBalancesFromLedger(loadChartAccountsFromStorage(), currentLedger)
      saveChartAccountsToStorage(rebuiltAccounts)
    }
  } catch (_) { /* non-fatal */ }

  return { created, errors, totalRows: rows.length }
}

export function parseAccountImportCsv(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const separator = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(separator).map((header) => header.trim().toLowerCase())

  return lines.slice(1).map((line) => {
    const cols = line.split(separator).map((col) => col.trim())
    const row = {}
    headers.forEach((header, idx) => {
      row[header] = cols[idx] ?? ''
    })
    return {
      code: row.code,
      name: row.name,
      parentCode: row.parentcode || row.parent_code,
      type: row.type,
      subcategory: row.subcategory,
      openingBalance: row.openingbalance || row.opening_balance,
      status: row.status,
    }
  })
}

export function calculateDepreciationForConfig(config) {
  const method = String(config?.method || 'straight-line').trim().toLowerCase() === 'reducing-balance' ? 'reducing-balance' : 'straight-line'
  const rate = Math.max(0, Number(config?.rate) || 0)
  const usefulLifeYears = Math.max(
    0,
    Number(config?.usefulLifeYears) || ((Number(config?.usefulLifeMonths) || 0) / 12),
  )
  const assetCost = Math.max(0, Number(config?.assetCost) || 0)
  const salvageValue = Math.max(0, Number(config?.salvageValue) || 0)
  const totalAccumulated = Math.max(0, Number(config?.totalAccumulated) || 0)

  const depreciableBase = Math.max(0, assetCost - salvageValue)
  const bookValue = Math.max(0, assetCost - totalAccumulated)
  const maxCharge = Math.max(0, bookValue - salvageValue)

  const suggestedAmount = method === 'reducing-balance'
    ? Math.min(maxCharge, bookValue * (rate / 100))
    : usefulLifeYears > 0
      ? Math.min(Math.max(0, depreciableBase - totalAccumulated), depreciableBase / usefulLifeYears)
      : 0

  return {
    method,
    rate,
    usefulLifeYears,
    assetCost,
    salvageValue,
    totalAccumulated,
    depreciableBase,
    bookValue,
    maxCharge,
    suggestedAmount: Math.max(0, suggestedAmount),
  }
}

export function postDepreciationForAsset({ assetCode, date, reference = '', narration = '', amountOverride = null, user = 'system' }) {
  const configs = loadDepreciationConfigsFromStorage().map((c) => ({ ...c }))
  const configIndex = configs.findIndex((config) => config.assetCode === assetCode)
  if (configIndex < 0) throw new Error('Depreciation setup not found for this asset')

  const config = configs[configIndex]
  const snapshot = calculateDepreciationForConfig(config)
  if (snapshot.method === 'straight-line' && snapshot.usefulLifeYears <= 0) throw new Error('Useful life is required for Straight Line depreciation')
  if (snapshot.method === 'reducing-balance' && snapshot.rate <= 0) throw new Error('Rate is required for Reducing Balance depreciation')

  let amount = Number(amountOverride)
  if (!Number.isFinite(amount) || amount <= 0) amount = snapshot.suggestedAmount
  const postingAmount = Math.min(amount, snapshot.maxCharge)
  if (postingAmount <= 0) throw new Error('Asset is fully depreciated or depreciation rule is not configured')

  postGeneralEntry({
    date,
    narration: narration.trim() || `Depreciation posted for asset ${assetCode}`,
    description: narration.trim() || `Depreciation posted for asset ${assetCode}`,
    reference,
    debitCode: config.expenseCode,
    creditCode: config.accumulatedCode,
    amount: postingAmount,
    user,
    source: 'depreciation',
  })

  configs[configIndex] = {
    ...config,
    lastPostedAt: date,
  }
  saveDepreciationConfigsToStorage(configs)

  const nextTotalAccumulated = snapshot.totalAccumulated + postingAmount
  return {
    amount: postingAmount,
    totalAccumulated: nextTotalAccumulated,
    remaining: Math.max(0, snapshot.depreciableBase - nextTotalAccumulated),
    bookValue: Math.max(0, snapshot.assetCost - nextTotalAccumulated),
  }
}

export function getDateRangeFromFilter({ mode, customStart, customEnd, financialYearMode }) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  if (mode === 'today') {
    return { start: today, end: today, label: 'Today' }
  }

  if (mode === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    return { start, end, label: 'This Month' }
  }

  if (mode === 'custom') {
    const start = customStart || today
    const end = customEnd || today
    return { start, end, label: 'Custom Range' }
  }

  if (mode === 'fy') {
    const year = now.getFullYear()

    if (financialYearMode === 'jul-jun') {
      const julyStart = new Date(year, 6, 1)
      const nextJuneEnd = new Date(year + 1, 5, 30)
      const lastJulyStart = new Date(year - 1, 6, 1)
      const thisJuneEnd = new Date(year, 5, 30)
      const isSecondHalf = now >= julyStart

      return isSecondHalf
        ? { start: julyStart.toISOString().slice(0, 10), end: nextJuneEnd.toISOString().slice(0, 10), label: 'FY Jul-Jun' }
        : { start: lastJulyStart.toISOString().slice(0, 10), end: thisJuneEnd.toISOString().slice(0, 10), label: 'FY Jul-Jun' }
    }

    const janStart = new Date(year, 0, 1).toISOString().slice(0, 10)
    const decEnd = new Date(year, 11, 31).toISOString().slice(0, 10)
    return { start: janStart, end: decEnd, label: 'FY Jan-Dec' }
  }

  return { start: '', end: '', label: 'All Time' }
}

function normalizeAccountingPeriodRecord(record, fallbackId = Date.now()) {
  const closedAt = toIso(record?.closedAt, nowIso())
  const periodLabel = String(record?.periodLabel || '').trim()
  return {
    id: String(record?.id || `ACP-${fallbackId}`).trim(),
    periodLabel,
    periodKey: String(record?.periodKey || toKey(periodLabel)).trim(),
    closedAt,
    closedBy: String(record?.closedBy || 'system').trim(),
    notes: String(record?.notes || '').trim(),
    createdAt: toIso(record?.createdAt, closedAt),
    updatedAt: toIso(record?.updatedAt, closedAt),
  }
}

function formatAccountingPeriodLabelFromDate(value) {
  const ms = parseDateOnlyMs(value)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function buildAccountingPeriodKey(label) {
  return toKey(String(label || '').trim())
}

export function loadClosedAccountingPeriodsFromStorage() {
  const raw = getStorageValue(ACCOUNTING_CLOSED_PERIODS_STORAGE_KEY, null)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item, index) => normalizeAccountingPeriodRecord(item, Date.now() + index))
      .filter((item) => item.periodLabel && item.periodKey)
      .sort((a, b) => toTimeMs(b.closedAt, 0) - toTimeMs(a.closedAt, 0))
  } catch {
    return []
  }
}

export function saveClosedAccountingPeriodsToStorage(items) {
  const normalized = Array.isArray(items)
    ? items
      .map((item, index) => normalizeAccountingPeriodRecord(item, Date.now() + index))
      .filter((item) => item.periodLabel && item.periodKey)
    : []
  setStorageValue(ACCOUNTING_CLOSED_PERIODS_STORAGE_KEY, JSON.stringify(normalized))
}

function getClosedPeriodLabelForDate(dateValue, closedPeriods = loadClosedAccountingPeriodsFromStorage()) {
  const label = formatAccountingPeriodLabelFromDate(dateValue)
  if (!label) return ''
  const key = buildAccountingPeriodKey(label)
  const matched = closedPeriods.find((period) => period.periodKey === key)
  return matched ? matched.periodLabel : ''
}

export function closeAccountingPeriod({
  periodDate = '',
  periodLabel = '',
  notes = '',
  closedBy = 'system',
} = {}) {
  const label = String(periodLabel || '').trim() || formatAccountingPeriodLabelFromDate(periodDate || nowIso().slice(0, 10))
  if (!label) throw new Error('Unable to resolve period label')

  const key = buildAccountingPeriodKey(label)
  if (!key) throw new Error('Invalid period label')

  const periods = loadClosedAccountingPeriodsFromStorage().map((item) => ({ ...item }))
  if (periods.some((item) => item.periodKey === key)) throw new Error(`Period "${label}" is already closed`)

  const now = nowIso()
  const record = normalizeAccountingPeriodRecord({
    id: `ACP-${Date.now()}`,
    periodLabel: label,
    periodKey: key,
    closedAt: now,
    closedBy,
    notes: String(notes || '').trim(),
    createdAt: now,
    updatedAt: now,
  }, Date.now())

  periods.unshift(record)
  saveClosedAccountingPeriodsToStorage(periods)
  appendAuditLog({
    action: 'ACCOUNTING_PERIOD_CLOSED',
    entity: 'ACCOUNTING_PERIOD',
    entityCode: record.periodLabel,
    note: `Closed accounting period ${record.periodLabel}`,
    user: closedBy,
    meta: {
      periodKey: record.periodKey,
      notes: record.notes,
      closedAt: record.closedAt,
    },
  })

  return record
}

const VOUCHER_SOURCE_PAYMENT_HINTS = [
  'payment',
  'withdrawal',
  'petty_cash',
]
const VOUCHER_SOURCE_RECEIPT_HINTS = [
  'receipt',
  'deposit',
]
const VOUCHER_PAYMENT_TYPE_LABEL = 'Payment Voucher'
const VOUCHER_RECEIPT_TYPE_LABEL = 'Receipt Voucher'
const VOUCHER_JOURNAL_TYPE_LABEL = 'Journal Voucher'

function inferVoucherTypeFromSource(source) {
  const key = toKey(source)
  if (VOUCHER_SOURCE_RECEIPT_HINTS.some((hint) => key.includes(hint))) return VOUCHER_RECEIPT_TYPE_LABEL
  if (VOUCHER_SOURCE_PAYMENT_HINTS.some((hint) => key.includes(hint))) return VOUCHER_PAYMENT_TYPE_LABEL
  return VOUCHER_JOURNAL_TYPE_LABEL
}

function inferVoucherTypeFromRows(source, rows, accountByCode) {
  const sourceKey = toKey(source)
  if (sourceKey.includes('petty_cash')) return VOUCHER_JOURNAL_TYPE_LABEL
  const bySource = inferVoucherTypeFromSource(source)
  if (bySource !== VOUCHER_JOURNAL_TYPE_LABEL) return bySource

  const cashRows = rows.filter((row) => {
    const account = accountByCode.get(row.accountCode)
    if (!account) return false
    const kind = getCashBankKindFromCodeAndName(account.code, account.name)
    return kind === 'cash' || kind === 'bank' || kind === 'petty-cash'
  })
  if (cashRows.length === 0) return VOUCHER_JOURNAL_TYPE_LABEL

  const cashNet = toMoney(cashRows.reduce((sum, row) => (
    sum + (Number(row.debit) || 0) - (Number(row.credit) || 0)
  ), 0))
  if (cashNet > 0) return VOUCHER_RECEIPT_TYPE_LABEL
  if (cashNet < 0) return VOUCHER_PAYMENT_TYPE_LABEL
  return VOUCHER_JOURNAL_TYPE_LABEL
}

function getVoucherCounterparty(rows, accountByCode) {
  const decorated = rows.map((row) => {
    const account = accountByCode.get(row.accountCode)
    const kind = account ? getCashBankKindFromCodeAndName(account.code, account.name) : ''
    return {
      ...row,
      account,
      kind,
      amount: Math.max(Number(row.debit) || 0, Number(row.credit) || 0),
    }
  })
  const nonCash = decorated.filter((row) => row.kind !== 'cash' && row.kind !== 'bank' && row.kind !== 'petty-cash')
  const candidates = nonCash.length > 0 ? nonCash : decorated
  const dominant = [...candidates].sort((a, b) => b.amount - a.amount)[0]
  if (!dominant) return '-'

  const accountName = String(dominant.account?.name || dominant.accountCode || '-').trim()
  const key = toKey(accountName)
  if (key.includes('accounts payable')) return extractEntityNameFromAccount(accountName, 'Accounts Payable')
  if (key.includes('accounts receivable')) return extractEntityNameFromAccount(accountName, 'Accounts Receivable')
  return accountName
}

function summarizeVoucher(voucherNo, rows, accountByCode) {
  if (!Array.isArray(rows) || rows.length === 0) return null

  const sortedRows = [...rows].sort(sortEntriesForVoucherSummary)
  const first = sortedRows[0]
  const totalDebit = toMoney(sortedRows.reduce((sum, row) => sum + (Number(row.debit) || 0), 0))
  const totalCredit = toMoney(sortedRows.reduce((sum, row) => sum + (Number(row.credit) || 0), 0))
  const type = inferVoucherTypeFromRows(first.source, sortedRows, accountByCode)
  const cashRows = sortedRows.filter((row) => {
    const account = accountByCode.get(row.accountCode)
    if (!account) return false
    const kind = getCashBankKindFromCodeAndName(account.code, account.name)
    return kind === 'cash' || kind === 'bank' || kind === 'petty-cash'
  })
  const cashNet = toMoney(cashRows.reduce((sum, row) => (
    sum + (Number(row.debit) || 0) - (Number(row.credit) || 0)
  ), 0))

  const dominantRow = [...sortedRows]
    .map((row) => ({
      row,
      amount: Math.max(Number(row.debit) || 0, Number(row.credit) || 0),
    }))
    .sort((a, b) => b.amount - a.amount)[0]
  const dominantAccount = dominantRow ? accountByCode.get(dominantRow.row.accountCode) : null
  const dominantAccountLabel = dominantAccount
    ? `${dominantAccount.code} - ${dominantAccount.name}`
    : (dominantRow ? String(dominantRow.row.accountCode || '-') : '-')

  const accountLines = sortedRows.map((row, index) => {
    const account = accountByCode.get(row.accountCode)
    return {
      id: `${voucherNo}-${row.accountCode}-${index}`,
      accountCode: row.accountCode,
      accountName: account ? `${account.code} - ${account.name}` : row.accountCode,
      debit: toMoney(row.debit),
      credit: toMoney(row.credit),
      description: String(row.description || row.narration || '').trim(),
    }
  })

  const createdAt = sortedRows.reduce((earliest, row) => {
    const candidate = toIso(row.createdAt, nowIso())
    return toTimeMs(candidate, Date.now()) < toTimeMs(earliest, Date.now()) ? candidate : earliest
  }, toIso(first.createdAt, nowIso()))

  return {
    id: voucherNo,
    voucherNo,
    date: first.date,
    type,
    source: first.source,
    reference: String(first.reference || '').trim(),
    description: String(first.description || first.narration || '').trim(),
    party: getVoucherCounterparty(sortedRows, accountByCode),
    account: dominantAccountLabel,
    amount: Math.abs(type === VOUCHER_JOURNAL_TYPE_LABEL ? Math.max(totalDebit, totalCredit) : cashNet || Math.max(totalDebit, totalCredit)),
    totalDebit,
    totalCredit,
    status: sortedRows.every((row) => toKey(row.status) === 'posted') ? 'Posted' : 'Draft',
    createdAt,
    lines: accountLines,
    lineCount: accountLines.length,
  }
}

function sortEntriesForVoucherSummary(a, b) {
  const dateDiff = parseDateOnlyMs(a?.date) - parseDateOnlyMs(b?.date)
  if (Number.isFinite(dateDiff) && dateDiff !== 0) return dateDiff
  const createdDiff = toTimeMs(a?.createdAt, 0) - toTimeMs(b?.createdAt, 0)
  if (createdDiff !== 0) return createdDiff
  return String(a?.accountCode || '').localeCompare(String(b?.accountCode || ''))
}

export function loadVoucherSummariesFromLedger({
  fromDate = '',
  toDate = '',
  type = 'all',
  search = '',
} = {}) {
  const accounts = loadChartAccountsFromStorage()
  const accountByCode = new Map(accounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))
  const normalizedType = toKey(type)
  const normalizedSearch = toKey(search)
  const startMs = parseDateOnlyMs(fromDate)
  const endMs = parseDateOnlyMs(toDate)
  const voucherMap = new Map()

  loadLedgerEntriesFromStorage()
    .filter((entry) => !entry.deletedAt && toKey(entry.status) === 'posted')
    .forEach((entry) => {
      const voucherNo = String(entry.voucherNo || entry.id || '').trim()
      if (!voucherNo) return
      const dateMs = parseDateOnlyMs(entry.date)
      if (Number.isFinite(startMs) && Number.isFinite(dateMs) && dateMs < startMs) return
      if (Number.isFinite(endMs) && Number.isFinite(dateMs) && dateMs > endMs) return

      if (!voucherMap.has(voucherNo)) voucherMap.set(voucherNo, [])
      voucherMap.get(voucherNo).push(entry)
    })

  return Array.from(voucherMap.entries())
    .map(([voucherNo, rows]) => summarizeVoucher(voucherNo, rows, accountByCode))
    .filter(Boolean)
    .filter((voucher) => {
      if (normalizedType && normalizedType !== 'all' && toKey(voucher.type) !== normalizedType) return false
      if (!normalizedSearch) return true
      const haystack = toKey([
        voucher.id,
        voucher.voucherNo,
        voucher.type,
        voucher.party,
        voucher.account,
        voucher.description,
        voucher.reference,
        voucher.source,
      ].join(' '))
      return haystack.includes(normalizedSearch)
    })
    .sort((a, b) => {
      const dateDiff = parseDateOnlyMs(b.date) - parseDateOnlyMs(a.date)
      if (Number.isFinite(dateDiff) && dateDiff !== 0) return dateDiff
      const createdDiff = toTimeMs(b.createdAt, 0) - toTimeMs(a.createdAt, 0)
      if (createdDiff !== 0) return createdDiff
      return String(b.voucherNo).localeCompare(String(a.voucherNo))
    })
}

export function loadVoucherDetailFromLedger(voucherNo) {
  const key = String(voucherNo || '').trim()
  if (!key) return null
  const rows = loadLedgerEntriesFromStorage()
    .filter((entry) => !entry.deletedAt && toKey(entry.status) === 'posted' && String(entry.voucherNo || entry.id || '').trim() === key)
  if (rows.length === 0) return null

  const accounts = loadChartAccountsFromStorage()
  const accountByCode = new Map(accounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))
  return summarizeVoucher(key, rows, accountByCode)
}

export function createAccountingVoucher({
  type,
  date,
  narration = '',
  description = '',
  reference = '',
  amount = 0,
  cashAccountCode = '',
  counterAccountCode = '',
  rows = [],
  user = 'system',
}) {
  const cleanType = String(type || '').trim()
  const cleanDate = String(date || '').trim()
  const cleanNarration = String(narration || description || '').trim()
  const cleanReference = String(reference || '').trim()

  if (!cleanDate) throw new Error('Voucher date is required')
  if (!cleanNarration) throw new Error('Narration is required')

  const accounts = loadChartAccountsFromStorage()
  const accountByCode = new Map(accounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))

  if (cleanType === VOUCHER_JOURNAL_TYPE_LABEL) {
    if (!Array.isArray(rows) || rows.length < 2) throw new Error('Journal voucher requires at least two rows')
    const normalizedRows = rows
      .map((row) => ({
        accountCode: String(row?.accountCode || '').trim(),
        debit: Math.max(0, toMoney(Number(row?.debit) || 0)),
        credit: Math.max(0, toMoney(Number(row?.credit) || 0)),
      }))
      .filter((row) => row.accountCode && (row.debit > 0 || row.credit > 0))
    if (normalizedRows.length < 2) throw new Error('Journal voucher requires at least two valid lines')
    const totalDebit = toMoney(normalizedRows.reduce((sum, row) => sum + row.debit, 0))
    const totalCredit = toMoney(normalizedRows.reduce((sum, row) => sum + row.credit, 0))
    if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.0001) throw new Error('Journal voucher must be balanced')

    const posting = postJournalRows({
      date: cleanDate,
      narration: cleanNarration,
      description: cleanNarration,
      reference: cleanReference,
      rows: normalizedRows,
      source: 'voucher_journal',
      user,
    })
    return {
      voucherId: posting.voucherId,
      voucher: loadVoucherDetailFromLedger(posting.voucherId),
    }
  }

  const amountValue = Math.max(0, toMoney(Number(amount) || 0))
  if (amountValue <= 0) throw new Error('Voucher amount must be greater than zero')

  const cashAccount = assertCurrentAssetCashBank(
    cashAccountCode,
    accountByCode,
    accounts,
    cleanType === VOUCHER_RECEIPT_TYPE_LABEL ? 'Receipt account' : 'Payment account',
    ['cash', 'bank', 'petty-cash'],
  )
  const counterAccount = assertPostingAccount(counterAccountCode, accountByCode, accounts, 'Counter account')
  if (counterAccount.code === cashAccount.code) throw new Error('Counter account must be different from cash/bank account')

  const posting = postGeneralEntry({
    date: cleanDate,
    narration: cleanNarration,
    description: cleanNarration,
    reference: cleanReference,
    debitCode: cleanType === VOUCHER_RECEIPT_TYPE_LABEL ? cashAccount.code : counterAccount.code,
    creditCode: cleanType === VOUCHER_RECEIPT_TYPE_LABEL ? counterAccount.code : cashAccount.code,
    amount: amountValue,
    source: cleanType === VOUCHER_RECEIPT_TYPE_LABEL ? 'voucher_receipt' : 'voucher_payment',
    user,
  })

  return {
    voucherId: posting.voucherId,
    voucher: loadVoucherDetailFromLedger(posting.voucherId),
  }
}

function normalizeCodePart(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10) || 'SUP'
}

function toKey(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizePayableSplitMode(value) {
  const mode = String(value || 'equal').trim().toLowerCase()
  if (mode === 'manual' || mode === 'percentage') return mode
  return 'equal'
}

function normalizeReceivableSplitMode(value) {
  const mode = String(value || 'auto').trim().toLowerCase()
  if (mode === 'manual' || mode === 'percentage' || mode === 'equal') return mode
  return 'auto'
}

function computeNextPayableId(items) {
  const max = items.reduce((highest, item) => {
    const match = String(item?.id || '').match(/^AP-(\d+)$/)
    const value = match ? Number(match[1]) : 0
    return value > highest ? value : highest
  }, 0)
  return `AP-${String(max + 1).padStart(3, '0')}`
}

function normalizePayablePayment(payment, fallbackId) {
  const createdAt = toIso(payment.createdAt, nowIso())
  return {
    id: String(payment.id || `APPAY-${fallbackId}`).trim(),
    voucherNo: String(payment.voucherNo || '').trim(),
    portion: String(payment.portion || '').trim().toLowerCase() === 'non-current' ? 'non-current' : 'current',
    date: String(payment.date || '').trim(),
    amount: toMoney(Math.max(0, Number(payment.amount) || 0)),
    paymentAccountCode: String(payment.paymentAccountCode || '').trim(),
    paymentAccountName: String(payment.paymentAccountName || '').trim(),
    description: String(payment.description || '').trim(),
    createdAt,
    updatedAt: toIso(payment.updatedAt, createdAt),
    deletedAt: payment.deletedAt ? toIso(payment.deletedAt, nowIso()) : null,
  }
}

function derivePayableStatus({
  totalCost,
  advancePaid,
  currentPaid,
  nonCurrentPaid,
}) {
  const settled = toMoney(advancePaid + currentPaid + nonCurrentPaid)
  const outstanding = toMoney(Math.max(0, totalCost - settled))
  if (outstanding <= 0) return 'Paid'
  if (settled > 0) return 'Partially Paid'
  return 'Unpaid'
}

function normalizePayableTransaction(record, fallbackId = Date.now()) {
  const createdAt = toIso(record.createdAt, nowIso())
  const lockedAt = toIso(record.lockedAt, new Date(toTimeMs(createdAt) + JOURNAL_LOCK_WINDOW_MS).toISOString())
  const totalCost = toMoney(Math.max(0, Number(record.totalCost) || 0))
  const advancePaid = toMoney(Math.max(0, Number(record.advancePaid) || 0))
  const remainingPayable = toMoney(Math.max(0, totalCost - advancePaid))
  const currentLiabilityRaw = toMoney(Math.max(0, Number(record.currentLiability) || 0))
  const currentLiability = toMoney(Math.min(remainingPayable, currentLiabilityRaw))
  const nonCurrentLiability = toMoney(Math.max(0, toMoney(remainingPayable - currentLiability)))
  const currentPaid = toMoney(Math.max(0, Number(record.currentPaid) || 0))
  const nonCurrentPaid = toMoney(Math.max(0, Number(record.nonCurrentPaid) || 0))
  const currentOutstanding = toMoney(Math.max(0, currentLiability - currentPaid))
  const nonCurrentOutstanding = toMoney(Math.max(0, nonCurrentLiability - nonCurrentPaid))
  const outstandingAmount = toMoney(Math.max(0, totalCost - advancePaid - currentPaid - nonCurrentPaid))
  const splitMode = normalizePayableSplitMode(record.splitMode)
  const currentPercentage = Number(record.currentPercentage)
  const nonCurrentPercentage = Number(record.nonCurrentPercentage)
  const paymentsRaw = Array.isArray(record.payments) ? record.payments : []
  const payments = paymentsRaw.map((payment, index) => normalizePayablePayment(payment, `${fallbackId}-${index}`))
  const origin = String(record?.origin || '').trim().toLowerCase() === 'journal_inferred' ? 'journal_inferred' : 'module'

  return {
    id: String(record.id || `AP-${fallbackId}`).trim(),
    voucherNo: String(record.voucherNo || '').trim(),
    supplierName: String(record.supplierName || '').trim(),
    itemType: String(record.itemType || '').trim(),
    description: String(record.description || '').trim(),
    reference: String(record.reference || '').trim(),
    date: String(record.date || '').trim(),
    payableDate: String(record.payableDate || '').trim(),
    purchaseAccountCode: String(record.purchaseAccountCode || '').trim(),
    purchaseAccountName: String(record.purchaseAccountName || '').trim(),
    paymentAccountCode: String(record.paymentAccountCode || '').trim(),
    paymentAccountName: String(record.paymentAccountName || '').trim(),
    currentLiabilityAccountCode: String(record.currentLiabilityAccountCode || '').trim(),
    currentLiabilityAccountName: String(record.currentLiabilityAccountName || '').trim(),
    nonCurrentLiabilityAccountCode: String(record.nonCurrentLiabilityAccountCode || '').trim(),
    nonCurrentLiabilityAccountName: String(record.nonCurrentLiabilityAccountName || '').trim(),
    splitMode,
    currentPercentage: Number.isFinite(currentPercentage) ? currentPercentage : null,
    nonCurrentPercentage: Number.isFinite(nonCurrentPercentage) ? nonCurrentPercentage : null,
    totalCost,
    advancePaid,
    remainingPayable,
    currentLiability,
    nonCurrentLiability,
    currentPaid,
    nonCurrentPaid,
    currentOutstanding,
    nonCurrentOutstanding,
    outstandingAmount,
    status: derivePayableStatus({ totalCost, advancePaid, currentPaid, nonCurrentPaid }),
    createdAt,
    updatedAt: toIso(record.updatedAt, createdAt),
    lockedAt,
    deletedAt: record.deletedAt ? toIso(record.deletedAt, nowIso()) : null,
    payments,
    origin,
  }
}

function refreshPayableAccountNames(items, accounts = loadChartAccountsFromStorage()) {
  const accountByCode = new Map(accounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))

  return items.map((item) => {
    const purchase = accountByCode.get(item.purchaseAccountCode)
    const payment = accountByCode.get(item.paymentAccountCode)
    const currentLiabilityAccount = accountByCode.get(item.currentLiabilityAccountCode)
    const nonCurrentLiabilityAccount = accountByCode.get(item.nonCurrentLiabilityAccountCode)
    const payments = item.payments.map((paymentItem) => {
      const paymentAccount = accountByCode.get(paymentItem.paymentAccountCode)
      return {
        ...paymentItem,
        paymentAccountName: paymentAccount ? `${paymentAccount.code} - ${paymentAccount.name}` : paymentItem.paymentAccountName,
      }
    })

    return {
      ...item,
      purchaseAccountName: purchase ? `${purchase.code} - ${purchase.name}` : item.purchaseAccountName,
      paymentAccountName: payment ? `${payment.code} - ${payment.name}` : item.paymentAccountName,
      currentLiabilityAccountName: currentLiabilityAccount ? `${currentLiabilityAccount.code} - ${currentLiabilityAccount.name}` : item.currentLiabilityAccountName,
      nonCurrentLiabilityAccountName: nonCurrentLiabilityAccount ? `${nonCurrentLiabilityAccount.code} - ${nonCurrentLiabilityAccount.name}` : item.nonCurrentLiabilityAccountName,
      payments,
    }
  })
}

function getPayableLockDeadlineMs(item) {
  const explicit = toTimeMs(item?.lockedAt, NaN)
  if (Number.isFinite(explicit)) return explicit
  return toTimeMs(item?.createdAt, Date.now()) + JOURNAL_LOCK_WINDOW_MS
}

function ensurePayableLiabilityAccount({ supplierName, subcategory, user = 'system' }) {
  const supplier = String(supplierName || '').trim()
  if (!supplier) throw new Error('Supplier is required')
  const normalizedSubcategory = subcategory === 'Non-Current Liabilities' ? 'Non-Current Liabilities' : 'Current Liabilities'
  const accountName = `Accounts Payable - ${supplier}`
  const accounts = loadChartAccountsFromStorage()

  const existing = accounts.find((account) => (
    !account.deletedAt &&
    account.type === 'Liabilities' &&
    account.subcategory === normalizedSubcategory &&
    toKey(account.name) === toKey(accountName)
  ))
  if (existing) return existing.code

  const parentCode = normalizedSubcategory === 'Non-Current Liabilities' ? '2200' : '2100'
  const parent = accounts.find((account) => !account.deletedAt && account.code === parentCode)
    || accounts.find((account) => !account.deletedAt && account.type === 'Liabilities' && account.level === 1 && account.subcategory === normalizedSubcategory)
  if (!parent) throw new Error(`${normalizedSubcategory} parent account not found`)

  const prefix = normalizedSubcategory === 'Non-Current Liabilities' ? 'APN' : 'APC'
  let code
  let idx = 1
  do {
    code = `${prefix}-${normalizeCodePart(supplier)}-${String(idx).padStart(3, '0')}`
    idx += 1
  } while (accounts.some((account) => !account.deletedAt && account.code === code))

  addChartAccountFromDraft({
    code,
    name: accountName,
    type: 'Liabilities',
    subcategory: normalizedSubcategory,
    parentCode: parent.code,
    openingBalance: 0,
  }, user)

  return code
}

function resolvePayableSplit({
  splitMode,
  remainingPayable,
  manualCurrent = null,
  currentPercentage = null,
  nonCurrentPercentage = null,
}) {
  const normalizedMode = normalizePayableSplitMode(splitMode)
  const remaining = toMoney(Math.max(0, Number(remainingPayable) || 0))
  if (remaining <= 0) {
    return {
      splitMode: normalizedMode,
      currentLiability: 0,
      nonCurrentLiability: 0,
      currentPercentage: normalizedMode === 'percentage' ? 0 : null,
      nonCurrentPercentage: normalizedMode === 'percentage' ? 0 : null,
    }
  }

  if (normalizedMode === 'manual') {
    const currentLiability = toMoney(Number(manualCurrent) || 0)
    if (currentLiability < 0) throw new Error('Current liability cannot be negative')
    if (currentLiability > remaining) throw new Error('Current liability cannot exceed remaining payable')
    return {
      splitMode: normalizedMode,
      currentLiability,
      nonCurrentLiability: toMoney(Math.max(0, remaining - currentLiability)),
      currentPercentage: null,
      nonCurrentPercentage: null,
    }
  }

  if (normalizedMode === 'percentage') {
    let currentPct = Number(currentPercentage)
    let nonCurrentPct = Number(nonCurrentPercentage)

    if (!Number.isFinite(currentPct) && !Number.isFinite(nonCurrentPct)) {
      throw new Error('Provide current/non-current percentage split')
    }
    if (!Number.isFinite(currentPct) && Number.isFinite(nonCurrentPct)) currentPct = 100 - nonCurrentPct
    if (Number.isFinite(currentPct) && !Number.isFinite(nonCurrentPct)) nonCurrentPct = 100 - currentPct

    currentPct = Number(currentPct)
    nonCurrentPct = Number(nonCurrentPct)

    if (currentPct < 0 || nonCurrentPct < 0) throw new Error('Percentage values cannot be negative')
    if (currentPct > 100 || nonCurrentPct > 100) throw new Error('Percentage values cannot exceed 100')
    if (Math.abs((currentPct + nonCurrentPct) - 100) > 0.0001) throw new Error('Current and non-current percentages must total 100')

    const currentLiability = toMoney((remaining * currentPct) / 100)
    const nonCurrentLiability = toMoney(Math.max(0, remaining - currentLiability))
    return {
      splitMode: normalizedMode,
      currentLiability,
      nonCurrentLiability,
      currentPercentage: currentPct,
      nonCurrentPercentage: nonCurrentPct,
    }
  }

  const currentLiability = toMoney(remaining / 2)
  return {
    splitMode: 'equal',
    currentLiability,
    nonCurrentLiability: toMoney(Math.max(0, remaining - currentLiability)),
    currentPercentage: null,
    nonCurrentPercentage: null,
  }
}

function validatePayablePostingAccounts({
  accounts,
  purchaseAccountCode,
  paymentAccountCode,
  advancePaid,
}) {
  const accountByCode = new Map(accounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))
  const purchaseAccount = accountByCode.get(purchaseAccountCode)
  if (!purchaseAccount) throw new Error('Purchase account not found')
  if (!isPostableAccount(purchaseAccount, accounts)) throw new Error('Purchase account must be a posting account')
  if (purchaseAccount.type !== 'Assets' && purchaseAccount.type !== 'Expenses') {
    throw new Error('Purchase account must belong to Assets or Expenses')
  }

  if (advancePaid > 0) {
    const paymentAccount = accountByCode.get(paymentAccountCode)
    if (!paymentAccount) throw new Error('Payment account not found')
    if (!isPostableAccount(paymentAccount, accounts)) throw new Error('Payment account must be a posting account')
    if (paymentAccount.type !== 'Assets' || paymentAccount.subcategory !== 'Current Assets') {
      throw new Error('Payment account must be a Current Asset account (Cash/Bank)')
    }
  }

  return { accountByCode, purchaseAccount }
}

const PAYABLE_MODULE_SOURCE_SET = new Set([
  'payable_purchase',
  'payable_payment_current',
  'payable_payment_non_current',
])

const RECEIVABLE_MODULE_SOURCE_SET = new Set([
  'receivable_invoice',
  'receivable_payment_current',
  'receivable_payment_non_current',
])

const PAYABLE_INFERENCE_HINTS = ['payable', 'payble', 'supplier', 'vendor', 'creditor']
const RECEIVABLE_INFERENCE_HINTS = ['receivable', 'recievable', 'receiveable', 'customer', 'debtor']
const PAYABLE_INFERENCE_CODE_PREFIXES = ['APC-', 'APN-']
const RECEIVABLE_INFERENCE_CODE_PREFIXES = ['ARC-', 'ARN-']

function accountMatchesInferenceHints(account, accountByCode, hints = []) {
  if (!account) return false
  const visited = new Set()
  let cursor = account

  while (cursor && !visited.has(cursor.code)) {
    visited.add(cursor.code)
    const nameKey = toKey(cursor.name)
    const codeKey = toKey(cursor.code)
    if (hints.some((hint) => nameKey.includes(hint) || codeKey.includes(hint))) return true
    cursor = cursor.parentCode ? accountByCode.get(cursor.parentCode) : null
  }

  return false
}

function accountMatchesCodePrefix(account, prefixes = []) {
  const code = String(account?.code || '').trim().toUpperCase()
  if (!code) return false
  return prefixes.some((prefix) => code.startsWith(prefix))
}

function isPayableInferenceAccount(account, accountByCode, accounts) {
  if (!account || account.deletedAt) return false
  if (account.type !== 'Liabilities') return false
  if (!isPostableAccount(account, accounts)) return false
  return accountMatchesCodePrefix(account, PAYABLE_INFERENCE_CODE_PREFIXES)
    || accountMatchesInferenceHints(account, accountByCode, PAYABLE_INFERENCE_HINTS)
}

function isReceivableInferenceAccount(account, accountByCode, accounts) {
  if (!account || account.deletedAt) return false
  if (account.type !== 'Assets') return false
  if (!isPostableAccount(account, accounts)) return false
  return accountMatchesCodePrefix(account, RECEIVABLE_INFERENCE_CODE_PREFIXES)
    || accountMatchesInferenceHints(account, accountByCode, RECEIVABLE_INFERENCE_HINTS)
}

function isContextualPayableAccount(account, accounts) {
  if (!account || account.deletedAt) return false
  if (account.type !== 'Liabilities') return false
  if (!isPostableAccount(account, accounts)) return false
  return account.subcategory === 'Current Liabilities' || account.subcategory === 'Non-Current Liabilities'
}

function isContextualReceivableAccount(account, accounts) {
  if (!account || account.deletedAt) return false
  if (account.type !== 'Assets') return false
  if (!isPostableAccount(account, accounts)) return false
  const kind = getCashBankKindFromCodeAndName(account.code, account.name)
  if (kind === 'cash' || kind === 'bank' || kind === 'petty-cash') return false
  return account.subcategory === 'Current Assets' || account.subcategory === 'Non-Current Assets'
}

function hasPayableVoucherShape(voucherRows, targetAccountCode, accountByCode) {
  if (!Array.isArray(voucherRows) || voucherRows.length === 0) return false
  return voucherRows.some((row) => {
    if (row.accountCode === targetAccountCode) return false
    const debit = Number(row.debit) || 0
    if (debit <= 0) return false
    const counter = accountByCode.get(row.accountCode)
    if (!counter || counter.deletedAt) return false
    if (counter.type === 'Expenses') return true
    if (counter.type === 'Assets') {
      const kind = getCashBankKindFromCodeAndName(counter.code, counter.name)
      return kind !== 'cash' && kind !== 'bank' && kind !== 'petty-cash'
    }
    return false
  })
}

function hasReceivableVoucherShape(voucherRows, targetAccountCode, accountByCode) {
  if (!Array.isArray(voucherRows) || voucherRows.length === 0) return false
  return voucherRows.some((row) => {
    if (row.accountCode === targetAccountCode) return false
    const credit = Number(row.credit) || 0
    if (credit <= 0) return false
    const counter = accountByCode.get(row.accountCode)
    if (!counter || counter.deletedAt) return false
    return counter.type === 'Revenue'
  })
}

function isPostedLedgerEntry(entry) {
  return !entry?.deletedAt && String(entry?.status || '').trim().toLowerCase() === 'posted'
}

function toDateFromEntryOrIso(entryDate, entryIso) {
  const cleanDate = String(entryDate || '').trim()
  if (cleanDate) return cleanDate
  return String(entryIso || '').slice(0, 10) || nowIso().slice(0, 10)
}

function extractEntityNameFromAccount(accountName, prefix) {
  const clean = String(accountName || '').trim()
  if (!clean) return prefix
  const key = toKey(clean)
  const prefixKey = toKey(prefix)
  if (!key.includes(prefixKey)) return clean
  const pieces = clean.split('-').map((piece) => String(piece || '').trim()).filter(Boolean)
  if (pieces.length <= 1) return clean
  return pieces.slice(1).join(' - ') || clean
}

function loadStoredPayablesFromStorage() {
  const raw = getStorageValue(ACCOUNTS_PAYABLE_STORAGE_KEY, null)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.map((item, index) => normalizePayableTransaction(item, Date.now() + index))
  } catch {
    return []
  }
}

function buildInferredPayablesFromLedger(existingPayables = []) {
  const accounts = loadChartAccountsFromStorage()
  const accountByCode = new Map(accounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))
  const existingVoucherNos = new Set(existingPayables.map((item) => String(item?.voucherNo || '').trim()).filter(Boolean))
  const postedLedger = loadLedgerEntriesFromStorage().filter(isPostedLedgerEntry)
  const voucherRowsByVoucher = new Map()
  postedLedger.forEach((row) => {
    const voucherNo = String(row.voucherNo || row.id || '').trim()
    if (!voucherNo) return
    if (!voucherRowsByVoucher.has(voucherNo)) voucherRowsByVoucher.set(voucherNo, [])
    voucherRowsByVoucher.get(voucherNo).push(row)
  })

  const buckets = new Map()
  postedLedger.forEach((row) => {
    const source = toKey(row.source)
    if (PAYABLE_MODULE_SOURCE_SET.has(source)) return
    const voucherNo = String(row.voucherNo || row.id || '').trim()
    if (!voucherNo) return
    if (existingVoucherNos.has(voucherNo)) return
    const account = accountByCode.get(row.accountCode)
    const strictMatch = isPayableInferenceAccount(account, accountByCode, accounts)
    const contextualMatch = isContextualPayableAccount(account, accounts)
      && hasPayableVoucherShape(voucherRowsByVoucher.get(voucherNo), row.accountCode, accountByCode)
    if (!strictMatch && !contextualMatch) return

    const diff = toMoney((Number(row.credit) || 0) - (Number(row.debit) || 0))
    const key = `${voucherNo}::${row.accountCode}`
    if (!buckets.has(key)) {
      buckets.set(key, {
        voucherNo,
        accountCode: row.accountCode,
        netCredit: 0,
        date: toDateFromEntryOrIso(row.date, row.createdAt),
        createdAt: toIso(row.createdAt, nowIso()),
      })
    }
    const target = buckets.get(key)
    target.netCredit = toMoney(target.netCredit + diff)
  })

  return Array.from(buckets.values())
    .filter((bucket) => bucket.netCredit > 0)
    .map((bucket, index) => {
      const liabilityAccount = accountByCode.get(bucket.accountCode)
      const latestVoucherRows = voucherRowsByVoucher.get(bucket.voucherNo) || []
      const purchaseRow = latestVoucherRows.find((row) => (
        row.accountCode !== bucket.accountCode
        && (Number(row.debit) || 0) > 0
      )) || null
      const purchaseAccount = purchaseRow ? accountByCode.get(purchaseRow.accountCode) : null
      const isNonCurrent = liabilityAccount?.subcategory === 'Non-Current Liabilities'
      const supplierName = extractEntityNameFromAccount(liabilityAccount?.name || '', 'Accounts Payable')
      const createdAt = bucket.createdAt || nowIso()

      return normalizePayableTransaction({
        id: `AP-JV-${bucket.voucherNo}-${bucket.accountCode}`,
        voucherNo: bucket.voucherNo || `JV-${bucket.accountCode}`,
        supplierName: supplierName || 'Journal Entry',
        itemType: 'Journal Entry',
        description: `Inferred from GL posting (${liabilityAccount?.name || bucket.accountCode})`,
        reference: 'Auto-Synced',
        date: bucket.date,
        payableDate: bucket.date,
        purchaseAccountCode: purchaseAccount?.code || '',
        purchaseAccountName: purchaseAccount ? `${purchaseAccount.code} - ${purchaseAccount.name}` : '',
        paymentAccountCode: '',
        paymentAccountName: '',
        currentLiabilityAccountCode: isNonCurrent ? '' : bucket.accountCode,
        currentLiabilityAccountName: isNonCurrent ? '' : `${bucket.accountCode} - ${liabilityAccount?.name || ''}`.trim(),
        nonCurrentLiabilityAccountCode: isNonCurrent ? bucket.accountCode : '',
        nonCurrentLiabilityAccountName: isNonCurrent ? `${bucket.accountCode} - ${liabilityAccount?.name || ''}`.trim() : '',
        splitMode: 'manual',
        currentPercentage: null,
        nonCurrentPercentage: null,
        totalCost: bucket.netCredit,
        advancePaid: 0,
        currentLiability: isNonCurrent ? 0 : bucket.netCredit,
        nonCurrentLiability: isNonCurrent ? bucket.netCredit : 0,
        currentPaid: 0,
        nonCurrentPaid: 0,
        createdAt,
        updatedAt: createdAt,
        lockedAt: createdAt,
        payments: [],
        origin: 'journal_inferred',
      }, Date.now() + index)
    })
}

export function loadAccountsPayableFromStorage() {
  const stored = loadStoredPayablesFromStorage()
  const inferred = buildInferredPayablesFromLedger(stored)
  const refreshed = refreshPayableAccountNames([...stored, ...inferred])
  return refreshed.sort((a, b) => toTimeMs(b.createdAt, 0) - toTimeMs(a.createdAt, 0))
}

export function saveAccountsPayableToStorage(items) {
  const ownItems = Array.isArray(items)
    ? items.filter((item) => String(item?.origin || 'module').trim().toLowerCase() !== 'journal_inferred')
    : []
  setStorageValue(ACCOUNTS_PAYABLE_STORAGE_KEY, JSON.stringify(ownItems.map((item, index) => normalizePayableTransaction(item, Date.now() + index))))
}

export function isAccountsPayableLocked(item, nowMs = Date.now()) {
  if (!item) return true
  return nowMs >= getPayableLockDeadlineMs(item)
}

export function createAccountsPayableTransaction({
  supplierName,
  purchaseAccountCode,
  itemType = '',
  totalCost,
  advancePaid = 0,
  paymentAccountCode = '',
  splitMode = 'equal',
  currentLiability = null,
  currentPercentage = null,
  nonCurrentPercentage = null,
  date,
  payableDate = '',
  description = '',
  reference = '',
  user = 'system',
}) {
  const supplier = String(supplierName || '').trim()
  if (!supplier) throw new Error('Supplier is required')

  const cleanPurchaseAccountCode = String(purchaseAccountCode || '').trim()
  if (!cleanPurchaseAccountCode) throw new Error('Purchase account is required')

  const cleanDate = String(date || '').trim()
  if (!cleanDate) throw new Error('Date is required')

  const cleanPayableDate = String(payableDate || '').trim()
  if (!cleanPayableDate) throw new Error('Payable date is required')

  const totalCostAmount = toMoney(Number(totalCost) || 0)
  if (totalCostAmount <= 0) throw new Error('Total cost must be greater than zero')

  const advancePaidAmount = toMoney(Number(advancePaid) || 0)
  if (advancePaidAmount < 0) throw new Error('Advance paid cannot be negative')
  if (advancePaidAmount > totalCostAmount) throw new Error('Advance paid cannot exceed total cost')

  const remainingPayable = toMoney(Math.max(0, totalCostAmount - advancePaidAmount))
  const split = resolvePayableSplit({
    splitMode,
    remainingPayable,
    manualCurrent: currentLiability,
    currentPercentage,
    nonCurrentPercentage,
  })
  if (split.currentLiability < 0 || split.nonCurrentLiability < 0) throw new Error('Liability split cannot be negative')

  const splitTotal = toMoney(split.currentLiability + split.nonCurrentLiability)
  if (Math.abs(splitTotal - remainingPayable) > 0.0001) throw new Error('Current and non-current split must match remaining payable')

  const cleanPaymentAccountCode = String(paymentAccountCode || '').trim()
  const accounts = loadChartAccountsFromStorage()
  const { accountByCode, purchaseAccount } = validatePayablePostingAccounts({
    accounts,
    purchaseAccountCode: cleanPurchaseAccountCode,
    paymentAccountCode: cleanPaymentAccountCode,
    advancePaid: advancePaidAmount,
  })
  const paymentAccount = cleanPaymentAccountCode ? accountByCode.get(cleanPaymentAccountCode) : null

  const currentLiabilityAccountCode = split.currentLiability > 0
    ? ensurePayableLiabilityAccount({ supplierName: supplier, subcategory: 'Current Liabilities', user })
    : ''
  const nonCurrentLiabilityAccountCode = split.nonCurrentLiability > 0
    ? ensurePayableLiabilityAccount({ supplierName: supplier, subcategory: 'Non-Current Liabilities', user })
    : ''

  const now = nowIso()
  const cleanDescription = String(description || '').trim() || `Purchase from ${supplier}`
  const rows = [
    { accountCode: cleanPurchaseAccountCode, debit: totalCostAmount, credit: 0 },
  ]
  if (advancePaidAmount > 0) rows.push({ accountCode: cleanPaymentAccountCode, debit: 0, credit: advancePaidAmount })
  if (split.currentLiability > 0) rows.push({ accountCode: currentLiabilityAccountCode, debit: 0, credit: split.currentLiability })
  if (split.nonCurrentLiability > 0) rows.push({ accountCode: nonCurrentLiabilityAccountCode, debit: 0, credit: split.nonCurrentLiability })

  const posting = postJournalRows({
    date: cleanDate,
    narration: cleanDescription,
    description: cleanDescription,
    reference: String(reference || '').trim(),
    rows,
    liabilityPlan: {
      source: 'accounts_payable',
      splitMode: split.splitMode,
      currentLiability: split.currentLiability,
      nonCurrentLiability: split.nonCurrentLiability,
      remainingPayable,
    },
    user,
    source: 'payable_purchase',
  })

  const ledgerEntries = posting.entries.filter((entry) => entry.id === posting.voucherId)
  const createdAt = ledgerEntries.length > 0
    ? ledgerEntries.reduce((earliest, entry) => {
      const candidate = toTimeMs(entry.createdAt, Date.now())
      return candidate < earliest ? candidate : earliest
    }, Number.MAX_SAFE_INTEGER)
    : toTimeMs(now, Date.now())
  const lockedAt = ledgerEntries.length > 0
    ? ledgerEntries[0].lockedAt
    : new Date(createdAt + JOURNAL_LOCK_WINDOW_MS).toISOString()

  const records = loadStoredPayablesFromStorage().map((item) => ({ ...item }))
  const payableId = computeNextPayableId(records)
  const createdIso = new Date(createdAt).toISOString()
  const accountMapForNames = new Map(loadChartAccountsFromStorage().filter((account) => !account.deletedAt).map((account) => [account.code, account]))

  const record = normalizePayableTransaction({
    id: payableId,
    voucherNo: posting.voucherId,
    supplierName: supplier,
    itemType: String(itemType || '').trim(),
    description: cleanDescription,
    reference: String(reference || '').trim(),
    date: cleanDate,
    payableDate: cleanPayableDate,
    purchaseAccountCode: cleanPurchaseAccountCode,
    purchaseAccountName: `${purchaseAccount.code} - ${purchaseAccount.name}`,
    paymentAccountCode: cleanPaymentAccountCode,
    paymentAccountName: paymentAccount ? `${paymentAccount.code} - ${paymentAccount.name}` : '',
    currentLiabilityAccountCode,
    currentLiabilityAccountName: accountMapForNames.get(currentLiabilityAccountCode)
      ? `${currentLiabilityAccountCode} - ${accountMapForNames.get(currentLiabilityAccountCode).name}`
      : '',
    nonCurrentLiabilityAccountCode,
    nonCurrentLiabilityAccountName: accountMapForNames.get(nonCurrentLiabilityAccountCode)
      ? `${nonCurrentLiabilityAccountCode} - ${accountMapForNames.get(nonCurrentLiabilityAccountCode).name}`
      : '',
    splitMode: split.splitMode,
    currentPercentage: split.currentPercentage,
    nonCurrentPercentage: split.nonCurrentPercentage,
    totalCost: totalCostAmount,
    advancePaid: advancePaidAmount,
    currentLiability: split.currentLiability,
    nonCurrentLiability: split.nonCurrentLiability,
    currentPaid: 0,
    nonCurrentPaid: 0,
    createdAt: createdIso,
    updatedAt: createdIso,
    lockedAt,
    deletedAt: null,
    payments: [],
  }, Date.now())

  records.unshift(record)
  saveAccountsPayableToStorage(records)
  appendAuditLog({
    action: 'PAYABLE_CREATED',
    entity: 'PAYABLE',
    entityCode: payableId,
    note: `Created accounts payable transaction ${payableId} (voucher ${posting.voucherId})`,
    user,
    meta: {
      supplier,
      totalCost: totalCostAmount,
      advancePaid: advancePaidAmount,
      currentLiability: split.currentLiability,
      nonCurrentLiability: split.nonCurrentLiability,
    },
  })

  return { transaction: record, voucherId: posting.voucherId }
}

export function updateAccountsPayableTransaction({
  payableId,
  supplierName,
  purchaseAccountCode,
  itemType = '',
  totalCost,
  advancePaid = 0,
  paymentAccountCode = '',
  splitMode = 'equal',
  currentLiability = null,
  currentPercentage = null,
  nonCurrentPercentage = null,
  date,
  payableDate = '',
  description = '',
  reference = '',
  user = 'system',
}) {
  const cleanId = String(payableId || '').trim()
  if (!cleanId) throw new Error('Accounts payable id is required')

  const records = loadStoredPayablesFromStorage().map((item) => ({ ...item }))
  const index = records.findIndex((item) => item.id === cleanId && !item.deletedAt)
  if (index < 0) throw new Error('Accounts payable transaction not found')
  const existing = normalizePayableTransaction(records[index], Date.now())

  if (isAccountsPayableLocked(existing)) throw new Error('This payable entry is locked and cannot be edited after 24 hours')
  const hasPostedPayments = existing.payments.some((payment) => !payment.deletedAt)

  const supplier = String(supplierName || '').trim()
  if (!supplier) throw new Error('Supplier is required')
  if (hasPostedPayments && supplier !== existing.supplierName) {
    throw new Error('Supplier cannot be changed after payments are posted')
  }

  const cleanPurchaseAccountCode = String(purchaseAccountCode || '').trim()
  if (!cleanPurchaseAccountCode) throw new Error('Purchase account is required')

  const cleanDate = String(date || '').trim()
  if (!cleanDate) throw new Error('Date is required')

  const cleanPayableDate = String(payableDate || '').trim()
  if (!cleanPayableDate) throw new Error('Payable date is required')

  const totalCostAmount = toMoney(Number(totalCost) || 0)
  if (totalCostAmount <= 0) throw new Error('Total cost must be greater than zero')

  const advancePaidAmount = toMoney(Number(advancePaid) || 0)
  if (advancePaidAmount < 0) throw new Error('Advance paid cannot be negative')
  if (advancePaidAmount > totalCostAmount) throw new Error('Advance paid cannot exceed total cost')

  const remainingPayable = toMoney(Math.max(0, totalCostAmount - advancePaidAmount))
  const split = resolvePayableSplit({
    splitMode,
    remainingPayable,
    manualCurrent: currentLiability,
    currentPercentage,
    nonCurrentPercentage,
  })

  const splitTotal = toMoney(split.currentLiability + split.nonCurrentLiability)
  if (Math.abs(splitTotal - remainingPayable) > 0.0001) throw new Error('Current and non-current split must match remaining payable')
  if (split.currentLiability < existing.currentPaid) throw new Error('Current liability cannot be less than already paid current amount')
  if (split.nonCurrentLiability < existing.nonCurrentPaid) throw new Error('Non-current liability cannot be less than already paid non-current amount')

  const cleanPaymentAccountCode = String(paymentAccountCode || '').trim()
  const accounts = loadChartAccountsFromStorage()
  const { accountByCode, purchaseAccount } = validatePayablePostingAccounts({
    accounts,
    purchaseAccountCode: cleanPurchaseAccountCode,
    paymentAccountCode: cleanPaymentAccountCode,
    advancePaid: advancePaidAmount,
  })
  const paymentAccount = cleanPaymentAccountCode ? accountByCode.get(cleanPaymentAccountCode) : null

  const currentLiabilityAccountCode = split.currentLiability > 0
    ? (
      hasPostedPayments
        ? (
          String(existing.currentLiabilityAccountCode || '').trim()
          || (existing.currentPaid > 0 ? '' : ensurePayableLiabilityAccount({ supplierName: supplier, subcategory: 'Current Liabilities', user }))
        )
        : ensurePayableLiabilityAccount({ supplierName: supplier, subcategory: 'Current Liabilities', user })
    )
    : ''
  const nonCurrentLiabilityAccountCode = split.nonCurrentLiability > 0
    ? (
      hasPostedPayments
        ? (
          String(existing.nonCurrentLiabilityAccountCode || '').trim()
          || (existing.nonCurrentPaid > 0 ? '' : ensurePayableLiabilityAccount({ supplierName: supplier, subcategory: 'Non-Current Liabilities', user }))
        )
        : ensurePayableLiabilityAccount({ supplierName: supplier, subcategory: 'Non-Current Liabilities', user })
    )
    : ''
  if (split.currentLiability > 0 && !currentLiabilityAccountCode) {
    throw new Error('Current liability account is required because payments are already posted')
  }
  if (split.nonCurrentLiability > 0 && !nonCurrentLiabilityAccountCode) {
    throw new Error('Non-current liability account is required because payments are already posted')
  }

  const cleanDescription = String(description || '').trim() || `Purchase from ${supplier}`
  const rows = [
    { accountCode: cleanPurchaseAccountCode, debit: totalCostAmount, credit: 0 },
  ]
  if (advancePaidAmount > 0) rows.push({ accountCode: cleanPaymentAccountCode, debit: 0, credit: advancePaidAmount })
  if (split.currentLiability > 0) rows.push({ accountCode: currentLiabilityAccountCode, debit: 0, credit: split.currentLiability })
  if (split.nonCurrentLiability > 0) rows.push({ accountCode: nonCurrentLiabilityAccountCode, debit: 0, credit: split.nonCurrentLiability })

  updateJournalVoucher({
    voucherNo: existing.voucherNo,
    date: cleanDate,
    description: cleanDescription,
    reference: String(reference || '').trim(),
    rows,
    user,
  })

  const now = nowIso()
  const refreshedAccounts = loadChartAccountsFromStorage()
  const refreshedAccountByCode = new Map(refreshedAccounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))
  const updated = normalizePayableTransaction({
    ...existing,
    supplierName: supplier,
    itemType: String(itemType || '').trim(),
    description: cleanDescription,
    reference: String(reference || '').trim(),
    date: cleanDate,
    payableDate: cleanPayableDate,
    purchaseAccountCode: cleanPurchaseAccountCode,
    purchaseAccountName: `${purchaseAccount.code} - ${purchaseAccount.name}`,
    paymentAccountCode: cleanPaymentAccountCode,
    paymentAccountName: paymentAccount ? `${paymentAccount.code} - ${paymentAccount.name}` : '',
    currentLiabilityAccountCode,
    currentLiabilityAccountName: refreshedAccountByCode.get(currentLiabilityAccountCode)
      ? `${currentLiabilityAccountCode} - ${refreshedAccountByCode.get(currentLiabilityAccountCode).name}`
      : '',
    nonCurrentLiabilityAccountCode,
    nonCurrentLiabilityAccountName: refreshedAccountByCode.get(nonCurrentLiabilityAccountCode)
      ? `${nonCurrentLiabilityAccountCode} - ${refreshedAccountByCode.get(nonCurrentLiabilityAccountCode).name}`
      : '',
    splitMode: split.splitMode,
    currentPercentage: split.currentPercentage,
    nonCurrentPercentage: split.nonCurrentPercentage,
    totalCost: totalCostAmount,
    advancePaid: advancePaidAmount,
    currentLiability: split.currentLiability,
    nonCurrentLiability: split.nonCurrentLiability,
    currentPaid: existing.currentPaid,
    nonCurrentPaid: existing.nonCurrentPaid,
    payments: existing.payments,
    updatedAt: now,
  }, Date.now())

  records[index] = updated
  saveAccountsPayableToStorage(records)
  appendAuditLog({
    action: 'PAYABLE_UPDATED',
    entity: 'PAYABLE',
    entityCode: cleanId,
    note: `Updated accounts payable transaction ${cleanId}`,
    user,
    meta: {
      voucherNo: existing.voucherNo,
      totalCost: totalCostAmount,
      advancePaid: advancePaidAmount,
      currentLiability: split.currentLiability,
      nonCurrentLiability: split.nonCurrentLiability,
    },
  })

  return { transaction: updated, voucherId: existing.voucherNo }
}

export function deleteAccountsPayableTransaction(payableId, user = 'system') {
  const cleanId = String(payableId || '').trim()
  if (!cleanId) throw new Error('Accounts payable id is required')

  const records = loadStoredPayablesFromStorage().map((item) => ({ ...item }))
  const index = records.findIndex((item) => item.id === cleanId && !item.deletedAt)
  if (index < 0) throw new Error('Accounts payable transaction not found')
  const target = normalizePayableTransaction(records[index], Date.now())

  if (isAccountsPayableLocked(target)) throw new Error('This payable entry is locked and cannot be deleted after 24 hours')

  target.payments
    .filter((payment) => !payment.deletedAt && payment.voucherNo)
    .forEach((payment) => {
      deleteJournalVoucher(payment.voucherNo, user)
    })

  deleteJournalVoucher(target.voucherNo, user)

  const removedAt = nowIso()
  records[index] = {
    ...target,
    deletedAt: removedAt,
    updatedAt: removedAt,
    payments: target.payments.map((payment) => ({ ...payment, deletedAt: payment.deletedAt || removedAt })),
  }
  saveAccountsPayableToStorage(records)

  appendAuditLog({
    action: 'PAYABLE_DELETED',
    entity: 'PAYABLE',
    entityCode: cleanId,
    note: `Deleted accounts payable transaction ${cleanId}`,
    user,
    meta: { voucherNo: target.voucherNo, paymentsRemoved: target.payments.length },
  })

  return { id: cleanId, voucherNo: target.voucherNo }
}

export function postAccountsPayablePayment({
  payableId,
  portion = 'current',
  date,
  amount,
  paymentAccountCode,
  description = '',
  reference = '',
  user = 'system',
}) {
  const cleanId = String(payableId || '').trim()
  if (!cleanId) throw new Error('Accounts payable id is required')

  const records = loadStoredPayablesFromStorage().map((item) => ({ ...item }))
  const index = records.findIndex((item) => item.id === cleanId && !item.deletedAt)
  if (index < 0) throw new Error('Accounts payable transaction not found')
  const target = normalizePayableTransaction(records[index], Date.now())

  const cleanDate = String(date || '').trim()
  if (!cleanDate) throw new Error('Payment date is required')

  const cleanPortion = String(portion || '').trim().toLowerCase() === 'non-current' ? 'non-current' : 'current'
  const liabilityAccountCode = cleanPortion === 'non-current' ? target.nonCurrentLiabilityAccountCode : target.currentLiabilityAccountCode
  if (!liabilityAccountCode) throw new Error(`No ${cleanPortion === 'non-current' ? 'non-current' : 'current'} liability available for payment`)

  const portionOutstanding = cleanPortion === 'non-current' ? target.nonCurrentOutstanding : target.currentOutstanding
  if (portionOutstanding <= 0) throw new Error('Selected liability portion is already fully paid')

  const amountNumber = toMoney(Number(amount) || 0)
  if (amountNumber <= 0) throw new Error('Payment amount must be greater than zero')
  if (amountNumber > portionOutstanding) throw new Error('Payment amount cannot exceed outstanding selected liability')

  const cleanPaymentCode = String(paymentAccountCode || '').trim()
  if (!cleanPaymentCode) throw new Error('Payment account is required')

  const accounts = loadChartAccountsFromStorage()
  const accountByCode = new Map(accounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))
  const paymentAccount = accountByCode.get(cleanPaymentCode)
  if (!paymentAccount) throw new Error('Payment account not found')
  if (!isPostableAccount(paymentAccount, accounts)) throw new Error('Payment account must be a posting account')
  if (paymentAccount.type !== 'Assets' || paymentAccount.subcategory !== 'Current Assets') {
    throw new Error('Payment account must be a Current Asset account (Cash/Bank)')
  }

  const liabilityAccount = accountByCode.get(liabilityAccountCode)
  if (!liabilityAccount) throw new Error('Liability account was not found in chart of accounts')

  const cleanDescription = String(description || '').trim() || `${cleanPortion === 'non-current' ? 'Non-current' : 'Current'} liability payment for ${target.supplierName}`
  const posting = postJournalRows({
    date: cleanDate,
    narration: cleanDescription,
    description: cleanDescription,
    reference: String(reference || '').trim(),
    rows: [
      { accountCode: liabilityAccountCode, debit: amountNumber, credit: 0 },
      { accountCode: cleanPaymentCode, debit: 0, credit: amountNumber },
    ],
    liabilityPlan: {
      source: 'accounts_payable_payment',
      payableId: cleanId,
      portion: cleanPortion,
    },
    user,
    source: cleanPortion === 'non-current' ? 'payable_payment_non_current' : 'payable_payment_current',
  })

  const paymentRecord = normalizePayablePayment({
    id: `APPAY-${Date.now()}`,
    voucherNo: posting.voucherId,
    portion: cleanPortion,
    date: cleanDate,
    amount: amountNumber,
    paymentAccountCode: cleanPaymentCode,
    paymentAccountName: `${paymentAccount.code} - ${paymentAccount.name}`,
    description: cleanDescription,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }, Date.now())

  const updated = normalizePayableTransaction({
    ...target,
    currentPaid: cleanPortion === 'current' ? toMoney(target.currentPaid + amountNumber) : target.currentPaid,
    nonCurrentPaid: cleanPortion === 'non-current' ? toMoney(target.nonCurrentPaid + amountNumber) : target.nonCurrentPaid,
    payments: [...target.payments, paymentRecord],
    updatedAt: nowIso(),
  }, Date.now())

  records[index] = updated
  saveAccountsPayableToStorage(records)
  appendAuditLog({
    action: 'PAYABLE_PAYMENT_POSTED',
    entity: 'PAYABLE',
    entityCode: cleanId,
    note: `Posted ${cleanPortion} payable payment for ${cleanId} (voucher ${posting.voucherId})`,
    user,
    meta: {
      amount: amountNumber,
      portion: cleanPortion,
      paymentAccountCode: cleanPaymentCode,
      liabilityAccountCode,
    },
  })

  return { transaction: updated, voucherId: posting.voucherId, payment: paymentRecord }
}

function normalizeReceivableCustomer(record, fallbackId = Date.now()) {
  const name = String(record?.name || '').trim()
  return {
    id: String(record?.id || `RCUST-${fallbackId}`).trim(),
    name,
    contact: String(record?.contact || '-').trim() || '-',
    creditLimit: Math.max(0, toMoney(Number(record?.creditLimit) || 0)),
    notes: String(record?.notes || '').trim(),
    createdAt: toIso(record?.createdAt, nowIso()),
    updatedAt: toIso(record?.updatedAt, nowIso()),
    deletedAt: record?.deletedAt ? toIso(record.deletedAt, nowIso()) : null,
  }
}

export function loadReceivableCustomersFromStorage() {
  const raw = getStorageValue(ACCOUNTS_RECEIVABLE_CUSTOMERS_STORAGE_KEY, null)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item, index) => normalizeReceivableCustomer(item, Date.now() + index))
      .filter((item) => !item.deletedAt && item.name)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

export function saveReceivableCustomersToStorage(customers) {
  const normalized = Array.isArray(customers)
    ? customers.map((item, index) => normalizeReceivableCustomer(item, Date.now() + index))
    : []
  setStorageValue(ACCOUNTS_RECEIVABLE_CUSTOMERS_STORAGE_KEY, JSON.stringify(normalized))
}

export function upsertReceivableCustomerMaster({ name, contact = '-', creditLimit = null, notes = '', user = 'system' }) {
  const customerName = String(name || '').trim()
  if (!customerName) throw new Error('Customer name is required')

  const customers = loadReceivableCustomersFromStorage().map((item) => ({ ...item }))
  const key = toKey(customerName)
  const now = nowIso()
  const index = customers.findIndex((item) => toKey(item.name) === key && !item.deletedAt)

  const parsedLimit = Number(creditLimit)
  const hasProvidedLimit = Number.isFinite(parsedLimit)

  if (index >= 0) {
    const existing = customers[index]
    const updated = normalizeReceivableCustomer({
      ...existing,
      name: customerName,
      contact: String(contact || existing.contact || '-').trim() || '-',
      creditLimit: hasProvidedLimit ? Math.max(0, toMoney(parsedLimit)) : existing.creditLimit,
      notes: String(notes || existing.notes || '').trim(),
      updatedAt: now,
    }, Date.now())
    customers[index] = updated
    saveReceivableCustomersToStorage(customers)
    appendAuditLog({
      action: 'RECEIVABLE_CUSTOMER_UPDATED',
      entity: 'CUSTOMER',
      entityCode: updated.id,
      note: `Updated customer master ${updated.name}`,
      user,
      meta: { creditLimit: updated.creditLimit },
    })
    return updated
  }

  const created = normalizeReceivableCustomer({
    id: `RCUST-${Date.now()}`,
    name: customerName,
    contact: String(contact || '-').trim() || '-',
    creditLimit: hasProvidedLimit ? Math.max(0, toMoney(parsedLimit)) : 0,
    notes: String(notes || '').trim(),
    createdAt: now,
    updatedAt: now,
  }, Date.now())
  customers.push(created)
  saveReceivableCustomersToStorage(customers)
  appendAuditLog({
    action: 'RECEIVABLE_CUSTOMER_CREATED',
    entity: 'CUSTOMER',
    entityCode: created.id,
    note: `Created customer master ${created.name}`,
    user,
    meta: { creditLimit: created.creditLimit },
  })
  return created
}

function normalizeReceivablePayment(payment, fallbackId) {
  const createdAt = toIso(payment?.createdAt, nowIso())
  const rawPortion = String(payment?.portion || '').trim().toLowerCase()
  const portion = rawPortion === 'non-current' ? 'non-current' : 'current'
  return {
    id: String(payment?.id || `ARPAY-${fallbackId}`).trim(),
    voucherNo: String(payment?.voucherNo || '').trim(),
    portion,
    date: String(payment?.date || '').trim(),
    amount: Math.max(0, toMoney(Number(payment?.amount) || 0)),
    paymentAccountCode: String(payment?.paymentAccountCode || '').trim(),
    paymentAccountName: String(payment?.paymentAccountName || '').trim(),
    receivableAccountCode: String(payment?.receivableAccountCode || '').trim(),
    receivableAccountName: String(payment?.receivableAccountName || '').trim(),
    description: String(payment?.description || '').trim(),
    createdAt,
    updatedAt: toIso(payment?.updatedAt, createdAt),
    deletedAt: payment?.deletedAt ? toIso(payment.deletedAt, nowIso()) : null,
  }
}

function parseDateOnlyMs(value) {
  const clean = String(value || '').trim()
  if (!clean) return NaN
  const parsed = Date.parse(`${clean}T00:00:00`)
  return Number.isFinite(parsed) ? parsed : NaN
}

function isReceivableDueWithinOneYear({ invoiceDate, dueDate }) {
  const invoiceMs = parseDateOnlyMs(invoiceDate)
  const dueMs = parseDateOnlyMs(dueDate || invoiceDate)
  if (!Number.isFinite(invoiceMs) || !Number.isFinite(dueMs)) return true
  const limit = new Date(invoiceMs)
  limit.setFullYear(limit.getFullYear() + 1)
  return dueMs <= limit.getTime()
}

function deriveReceivableBucketFromDates({ invoiceDate, dueDate }) {
  return isReceivableDueWithinOneYear({ invoiceDate, dueDate }) ? 'current' : 'non-current'
}

function deriveReceivableStatus({ netReceivable, totalReceived }) {
  const outstanding = Math.max(0, toMoney(netReceivable - totalReceived))
  if (outstanding <= 0) return 'Paid'
  if (totalReceived > 0) return 'Partially Received'
  return 'Unpaid'
}

function resolveReceivableSplit({
  invoiceDate,
  dueDate,
  netReceivable,
  splitMode = 'auto',
  classificationMode = 'auto',
  manualCurrentReceivable = null,
  currentPercentage = null,
  nonCurrentPercentage = null,
  manualNonCurrentReceivable = null,
  allowManualOverride = false,
}) {
  const remaining = Math.max(0, toMoney(Number(netReceivable) || 0))
  const requestedSplitMode = normalizeReceivableSplitMode(splitMode)
  const requestedClassificationMode = String(classificationMode || 'auto').trim().toLowerCase() === 'manual' ? 'manual' : 'auto'
  const mode = requestedSplitMode === 'auto'
    ? (requestedClassificationMode === 'manual' ? 'manual' : 'auto')
    : requestedSplitMode
  const dueWithinOneYear = isReceivableDueWithinOneYear({ invoiceDate, dueDate })

  if (remaining <= 0) {
    return {
      splitMode: mode === 'auto' ? 'auto' : mode,
      classificationMode: mode === 'auto' ? 'auto' : 'manual',
      classificationBucket: 'current',
      dueWithinOneYear,
      currentReceivable: 0,
      nonCurrentReceivable: 0,
      currentPercentage: mode === 'percentage' ? 0 : null,
      nonCurrentPercentage: mode === 'percentage' ? 0 : null,
    }
  }

  if (!allowManualOverride || mode === 'auto') {
    return {
      splitMode: 'auto',
      classificationMode: 'auto',
      classificationBucket: dueWithinOneYear ? 'current' : 'non-current',
      dueWithinOneYear,
      currentReceivable: dueWithinOneYear ? remaining : 0,
      nonCurrentReceivable: dueWithinOneYear ? 0 : remaining,
      currentPercentage: null,
      nonCurrentPercentage: null,
    }
  }

  if (mode === 'manual') {
    let currentAmount = Number(manualCurrentReceivable)
    let nonCurrentAmount = Number(manualNonCurrentReceivable)
    const hasCurrent = Number.isFinite(currentAmount)
    const hasNonCurrent = Number.isFinite(nonCurrentAmount)

    if (!hasCurrent && !hasNonCurrent) {
      throw new Error('Provide current or non-current receivable split for manual classification')
    }
    if (!hasCurrent && hasNonCurrent) currentAmount = remaining - nonCurrentAmount
    if (hasCurrent && !hasNonCurrent) nonCurrentAmount = remaining - currentAmount

    currentAmount = toMoney(Number(currentAmount) || 0)
    nonCurrentAmount = toMoney(Number(nonCurrentAmount) || 0)

    if (currentAmount < 0 || nonCurrentAmount < 0) {
      throw new Error('Receivable split values cannot be negative')
    }
    const splitTotal = toMoney(currentAmount + nonCurrentAmount)
    if (Math.abs(splitTotal - remaining) > 0.0001) {
      throw new Error('Current and non-current receivable split must match net receivable')
    }

    return {
      splitMode: 'manual',
      classificationMode: 'manual',
      classificationBucket: currentAmount > 0 && nonCurrentAmount > 0
        ? 'mixed'
        : (nonCurrentAmount > 0 ? 'non-current' : 'current'),
      dueWithinOneYear,
      currentReceivable: currentAmount,
      nonCurrentReceivable: nonCurrentAmount,
      currentPercentage: null,
      nonCurrentPercentage: null,
    }
  }

  if (mode === 'percentage') {
    let currentPct = Number(currentPercentage)
    let nonCurrentPct = Number(nonCurrentPercentage)

    if (!Number.isFinite(currentPct) && !Number.isFinite(nonCurrentPct)) {
      throw new Error('Provide current/non-current percentage split')
    }
    if (!Number.isFinite(currentPct) && Number.isFinite(nonCurrentPct)) currentPct = 100 - nonCurrentPct
    if (Number.isFinite(currentPct) && !Number.isFinite(nonCurrentPct)) nonCurrentPct = 100 - currentPct

    currentPct = Number(currentPct)
    nonCurrentPct = Number(nonCurrentPct)

    if (currentPct < 0 || nonCurrentPct < 0) throw new Error('Percentage values cannot be negative')
    if (currentPct > 100 || nonCurrentPct > 100) throw new Error('Percentage values cannot exceed 100')
    if (Math.abs((currentPct + nonCurrentPct) - 100) > 0.0001) throw new Error('Current and non-current percentages must total 100')

    const currentAmount = toMoney((remaining * currentPct) / 100)
    const nonCurrentAmount = toMoney(Math.max(0, remaining - currentAmount))
    return {
      splitMode: 'percentage',
      classificationMode: 'manual',
      classificationBucket: currentAmount > 0 && nonCurrentAmount > 0
        ? 'mixed'
        : (nonCurrentAmount > 0 ? 'non-current' : 'current'),
      dueWithinOneYear,
      currentReceivable: currentAmount,
      nonCurrentReceivable: nonCurrentAmount,
      currentPercentage: currentPct,
      nonCurrentPercentage: nonCurrentPct,
    }
  }

  const currentAmount = toMoney(remaining / 2)
  const nonCurrentAmount = toMoney(Math.max(0, remaining - currentAmount))

  return {
    splitMode: 'equal',
    classificationMode: 'manual',
    classificationBucket: currentAmount > 0 && nonCurrentAmount > 0
      ? 'mixed'
      : (nonCurrentAmount > 0 ? 'non-current' : 'current'),
    dueWithinOneYear,
    currentReceivable: currentAmount,
    nonCurrentReceivable: nonCurrentAmount,
    currentPercentage: null,
    nonCurrentPercentage: null,
  }
}

function normalizeReceivableTransaction(record, fallbackId = Date.now()) {
  const createdAt = toIso(record?.createdAt, nowIso())
  const lockedAt = toIso(record?.lockedAt, new Date(toTimeMs(createdAt) + JOURNAL_LOCK_WINDOW_MS).toISOString())
  const totalSale = Math.max(0, toMoney(Number(record?.totalSale) || 0))
  const advanceReceived = Math.max(0, toMoney(Number(record?.advanceReceived) || 0))
  const netReceivable = Math.max(0, toMoney(totalSale - advanceReceived))
  const legacyReceivableAccountCode = String(record?.receivableAccountCode || '').trim()
  const legacyReceivableAccountName = String(record?.receivableAccountName || '').trim()
  const rawCurrentReceivable = Number(record?.currentReceivable)
  const rawNonCurrentReceivable = Number(record?.nonCurrentReceivable)
  const hasCurrentReceivable = Number.isFinite(rawCurrentReceivable)
  const hasNonCurrentReceivable = Number.isFinite(rawNonCurrentReceivable)

  let currentReceivable = 0
  let nonCurrentReceivable = 0

  if (hasCurrentReceivable || hasNonCurrentReceivable) {
    if (hasCurrentReceivable) currentReceivable = Math.max(0, toMoney(rawCurrentReceivable))
    if (hasNonCurrentReceivable) nonCurrentReceivable = Math.max(0, toMoney(rawNonCurrentReceivable))
    if (!hasCurrentReceivable) currentReceivable = Math.max(0, toMoney(netReceivable - nonCurrentReceivable))
    if (!hasNonCurrentReceivable) nonCurrentReceivable = Math.max(0, toMoney(netReceivable - currentReceivable))
  } else if (legacyReceivableAccountCode) {
    currentReceivable = netReceivable
    nonCurrentReceivable = 0
  } else if (String(record?.nonCurrentReceivableAccountCode || '').trim()) {
    currentReceivable = 0
    nonCurrentReceivable = netReceivable
  } else {
    const autoBucket = deriveReceivableBucketFromDates({ invoiceDate: record?.date, dueDate: record?.dueDate })
    currentReceivable = autoBucket === 'current' ? netReceivable : 0
    nonCurrentReceivable = autoBucket === 'non-current' ? netReceivable : 0
  }

  const normalizedSplitTotal = toMoney(currentReceivable + nonCurrentReceivable)
  if (Math.abs(normalizedSplitTotal - netReceivable) > 0.0001) {
    const overflow = toMoney(normalizedSplitTotal - netReceivable)
    if (overflow > 0) {
      if (nonCurrentReceivable >= overflow) {
        nonCurrentReceivable = Math.max(0, toMoney(nonCurrentReceivable - overflow))
      } else {
        currentReceivable = Math.max(0, toMoney(currentReceivable - overflow))
      }
    } else {
      const shortfall = Math.abs(overflow)
      currentReceivable = toMoney(currentReceivable + shortfall)
    }
  }

  const legacyReceivedAmount = Math.max(0, toMoney(Number(record?.receivedAmount) || 0))
  const rawCurrentReceived = Number(record?.currentReceived)
  const rawNonCurrentReceived = Number(record?.nonCurrentReceived)
  const hasCurrentReceived = Number.isFinite(rawCurrentReceived)
  const hasNonCurrentReceived = Number.isFinite(rawNonCurrentReceived)
  let currentReceived = hasCurrentReceived ? Math.max(0, toMoney(rawCurrentReceived)) : legacyReceivedAmount
  let nonCurrentReceived = hasNonCurrentReceived ? Math.max(0, toMoney(rawNonCurrentReceived)) : 0

  if (currentReceived > currentReceivable) currentReceived = currentReceivable
  if (nonCurrentReceived > nonCurrentReceivable) nonCurrentReceived = nonCurrentReceivable

  const receivedAmount = Math.max(0, toMoney(currentReceived + nonCurrentReceived))
  const outstandingAmount = Math.max(0, toMoney(netReceivable - receivedAmount))
  const currentOutstanding = Math.max(0, toMoney(currentReceivable - currentReceived))
  const nonCurrentOutstanding = Math.max(0, toMoney(nonCurrentReceivable - nonCurrentReceived))
  const dueWithinOneYear = isReceivableDueWithinOneYear({ invoiceDate: record?.date, dueDate: record?.dueDate })
  const rawCurrentPercentage = Number(record?.currentPercentage)
  const rawNonCurrentPercentage = Number(record?.nonCurrentPercentage)
  let currentPercentage = Number.isFinite(rawCurrentPercentage) ? rawCurrentPercentage : null
  let nonCurrentPercentage = Number.isFinite(rawNonCurrentPercentage) ? rawNonCurrentPercentage : null

  let splitMode = normalizeReceivableSplitMode(record?.splitMode)
  if (splitMode === 'auto') {
    const legacyMode = String(record?.classificationMode || '').trim().toLowerCase()
    if (legacyMode === 'manual') {
      splitMode = currentPercentage != null || nonCurrentPercentage != null ? 'percentage' : 'manual'
    }
  }
  if (splitMode === 'percentage') {
    if (currentPercentage == null && nonCurrentPercentage != null) currentPercentage = toMoney(100 - nonCurrentPercentage)
    if (currentPercentage != null && nonCurrentPercentage == null) nonCurrentPercentage = toMoney(100 - currentPercentage)
    if (currentPercentage == null && nonCurrentPercentage == null) {
      const fallbackCurrentPct = netReceivable > 0 ? toMoney((currentReceivable / netReceivable) * 100) : 0
      currentPercentage = fallbackCurrentPct
      nonCurrentPercentage = toMoney(100 - fallbackCurrentPct)
    }
  } else {
    currentPercentage = null
    nonCurrentPercentage = null
  }

  const classificationMode = splitMode === 'auto' ? 'auto' : 'manual'
  const classificationBucket = currentReceivable > 0 && nonCurrentReceivable > 0
    ? 'mixed'
    : (nonCurrentReceivable > 0 ? 'non-current' : 'current')
  const paymentsRaw = Array.isArray(record?.payments) ? record.payments : []
  const payments = paymentsRaw.map((payment, index) => normalizeReceivablePayment(payment, `${fallbackId}-${index}`))
  const origin = String(record?.origin || '').trim().toLowerCase() === 'journal_inferred' ? 'journal_inferred' : 'module'

  const currentReceivableAccountCode = String(
    record?.currentReceivableAccountCode
    || (classificationBucket !== 'non-current' ? legacyReceivableAccountCode : ''),
  ).trim()
  const nonCurrentReceivableAccountCode = String(
    record?.nonCurrentReceivableAccountCode
    || (classificationBucket === 'non-current' ? legacyReceivableAccountCode : ''),
  ).trim()
  const currentReceivableAccountName = String(
    record?.currentReceivableAccountName
    || (classificationBucket !== 'non-current' ? legacyReceivableAccountName : ''),
  ).trim()
  const nonCurrentReceivableAccountName = String(
    record?.nonCurrentReceivableAccountName
    || (classificationBucket === 'non-current' ? legacyReceivableAccountName : ''),
  ).trim()
  const receivableAccountCode = currentReceivableAccountCode || nonCurrentReceivableAccountCode
  const receivableAccountName = currentReceivableAccountName || nonCurrentReceivableAccountName

  return {
    id: String(record?.id || `AR-${fallbackId}`).trim(),
    voucherNo: String(record?.voucherNo || '').trim(),
    customerName: String(record?.customerName || '').trim(),
    itemType: String(record?.itemType || '').trim(),
    description: String(record?.description || '').trim(),
    reference: String(record?.reference || '').trim(),
    date: String(record?.date || '').trim(),
    dueDate: String(record?.dueDate || '').trim(),
    salesAccountCode: String(record?.salesAccountCode || '').trim(),
    salesAccountName: String(record?.salesAccountName || '').trim(),
    receiptAccountCode: String(record?.receiptAccountCode || '').trim(),
    receiptAccountName: String(record?.receiptAccountName || '').trim(),
    receivableAccountCode,
    receivableAccountName,
    currentReceivableAccountCode,
    currentReceivableAccountName,
    nonCurrentReceivableAccountCode,
    nonCurrentReceivableAccountName,
    splitMode,
    currentPercentage,
    nonCurrentPercentage,
    classificationMode,
    classificationBucket,
    dueWithinOneYear,
    totalSale,
    advanceReceived,
    netReceivable,
    currentReceivable,
    nonCurrentReceivable,
    currentReceived,
    nonCurrentReceived,
    currentOutstanding,
    nonCurrentOutstanding,
    receivedAmount,
    outstandingAmount,
    creditLimit: Math.max(0, toMoney(Number(record?.creditLimit) || 0)),
    status: deriveReceivableStatus({ netReceivable, totalReceived: receivedAmount }),
    createdAt,
    updatedAt: toIso(record?.updatedAt, createdAt),
    lockedAt,
    deletedAt: record?.deletedAt ? toIso(record.deletedAt, nowIso()) : null,
    payments,
    origin,
  }
}

function refreshReceivableAccountNames(items, accounts = loadChartAccountsFromStorage()) {
  const accountByCode = new Map(accounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))

  return items.map((item) => {
    const salesAccount = accountByCode.get(item.salesAccountCode)
    const receiptAccount = accountByCode.get(item.receiptAccountCode)
    const currentReceivableAccount = accountByCode.get(item.currentReceivableAccountCode)
    const nonCurrentReceivableAccount = accountByCode.get(item.nonCurrentReceivableAccountCode)
    const receivableAccount = currentReceivableAccount || nonCurrentReceivableAccount || accountByCode.get(item.receivableAccountCode)
    const payments = item.payments.map((payment) => {
      const account = accountByCode.get(payment.paymentAccountCode)
      const receivablePaymentAccount = accountByCode.get(payment.receivableAccountCode)
      return {
        ...payment,
        paymentAccountName: account ? `${account.code} - ${account.name}` : payment.paymentAccountName,
        receivableAccountName: receivablePaymentAccount ? `${receivablePaymentAccount.code} - ${receivablePaymentAccount.name}` : payment.receivableAccountName,
      }
    })

    return {
      ...item,
      salesAccountName: salesAccount ? `${salesAccount.code} - ${salesAccount.name}` : item.salesAccountName,
      receiptAccountName: receiptAccount ? `${receiptAccount.code} - ${receiptAccount.name}` : item.receiptAccountName,
      currentReceivableAccountName: currentReceivableAccount ? `${currentReceivableAccount.code} - ${currentReceivableAccount.name}` : item.currentReceivableAccountName,
      nonCurrentReceivableAccountName: nonCurrentReceivableAccount ? `${nonCurrentReceivableAccount.code} - ${nonCurrentReceivableAccount.name}` : item.nonCurrentReceivableAccountName,
      receivableAccountCode: item.currentReceivableAccountCode || item.nonCurrentReceivableAccountCode || item.receivableAccountCode,
      receivableAccountName: receivableAccount ? `${receivableAccount.code} - ${receivableAccount.name}` : item.receivableAccountName,
      payments,
    }
  })
}

function computeNextReceivableId(items) {
  const max = items.reduce((highest, item) => {
    const match = String(item?.id || '').match(/^AR-(\d+)$/)
    const value = match ? Number(match[1]) : 0
    return value > highest ? value : highest
  }, 0)
  return `AR-${String(max + 1).padStart(3, '0')}`
}

function getReceivableLockDeadlineMs(item) {
  const explicit = toTimeMs(item?.lockedAt, NaN)
  if (Number.isFinite(explicit)) return explicit
  return toTimeMs(item?.createdAt, Date.now()) + JOURNAL_LOCK_WINDOW_MS
}

export function isAccountsReceivableLocked(item, nowMs = Date.now()) {
  if (!item) return true
  return nowMs >= getReceivableLockDeadlineMs(item)
}

function loadStoredReceivablesFromStorage() {
  const raw = getStorageValue(ACCOUNTS_RECEIVABLE_STORAGE_KEY, null)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item, index) => normalizeReceivableTransaction(item, Date.now() + index))
  } catch {
    return []
  }
}

function buildInferredReceivablesFromLedger(existingReceivables = []) {
  const accounts = loadChartAccountsFromStorage()
  const accountByCode = new Map(accounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))
  const existingVoucherNos = new Set(existingReceivables.map((item) => String(item?.voucherNo || '').trim()).filter(Boolean))
  const postedLedger = loadLedgerEntriesFromStorage().filter(isPostedLedgerEntry)
  const voucherRowsByVoucher = new Map()
  postedLedger.forEach((row) => {
    const voucherNo = String(row.voucherNo || row.id || '').trim()
    if (!voucherNo) return
    if (!voucherRowsByVoucher.has(voucherNo)) voucherRowsByVoucher.set(voucherNo, [])
    voucherRowsByVoucher.get(voucherNo).push(row)
  })

  const buckets = new Map()
  postedLedger.forEach((row) => {
    const source = toKey(row.source)
    if (RECEIVABLE_MODULE_SOURCE_SET.has(source)) return
    const voucherNo = String(row.voucherNo || row.id || '').trim()
    if (!voucherNo) return
    if (existingVoucherNos.has(voucherNo)) return
    const account = accountByCode.get(row.accountCode)
    const strictMatch = isReceivableInferenceAccount(account, accountByCode, accounts)
    const contextualMatch = isContextualReceivableAccount(account, accounts)
      && hasReceivableVoucherShape(voucherRowsByVoucher.get(voucherNo), row.accountCode, accountByCode)
    if (!strictMatch && !contextualMatch) return

    const diff = toMoney((Number(row.debit) || 0) - (Number(row.credit) || 0))
    const key = `${voucherNo}::${row.accountCode}`
    if (!buckets.has(key)) {
      buckets.set(key, {
        voucherNo,
        accountCode: row.accountCode,
        netDebit: 0,
        date: toDateFromEntryOrIso(row.date, row.createdAt),
        createdAt: toIso(row.createdAt, nowIso()),
      })
    }
    const target = buckets.get(key)
    target.netDebit = toMoney(target.netDebit + diff)
  })

  return Array.from(buckets.values())
    .filter((bucket) => bucket.netDebit > 0)
    .map((bucket, index) => {
      const receivableAccount = accountByCode.get(bucket.accountCode)
      const latestVoucherRows = voucherRowsByVoucher.get(bucket.voucherNo) || []
      const salesRow = latestVoucherRows.find((row) => (
        row.accountCode !== bucket.accountCode
        && (Number(row.credit) || 0) > 0
      )) || null
      const salesAccount = salesRow ? accountByCode.get(salesRow.accountCode) : null
      const isNonCurrent = receivableAccount?.subcategory === 'Non-Current Assets'
      const customerName = extractEntityNameFromAccount(receivableAccount?.name || '', 'Accounts Receivable')
      const createdAt = bucket.createdAt || nowIso()

      return normalizeReceivableTransaction({
        id: `AR-JV-${bucket.voucherNo}-${bucket.accountCode}`,
        voucherNo: bucket.voucherNo || `JV-${bucket.accountCode}`,
        customerName: customerName || 'Journal Entry',
        itemType: 'Journal Entry',
        description: `Inferred from GL posting (${receivableAccount?.name || bucket.accountCode})`,
        reference: 'Auto-Synced',
        date: bucket.date,
        dueDate: bucket.date,
        salesAccountCode: salesAccount?.code || '',
        salesAccountName: salesAccount ? `${salesAccount.code} - ${salesAccount.name}` : '',
        receiptAccountCode: '',
        receiptAccountName: '',
        receivableAccountCode: bucket.accountCode,
        receivableAccountName: `${bucket.accountCode} - ${receivableAccount?.name || ''}`.trim(),
        currentReceivableAccountCode: isNonCurrent ? '' : bucket.accountCode,
        currentReceivableAccountName: isNonCurrent ? '' : `${bucket.accountCode} - ${receivableAccount?.name || ''}`.trim(),
        nonCurrentReceivableAccountCode: isNonCurrent ? bucket.accountCode : '',
        nonCurrentReceivableAccountName: isNonCurrent ? `${bucket.accountCode} - ${receivableAccount?.name || ''}`.trim() : '',
        splitMode: 'manual',
        classificationMode: 'manual',
        currentPercentage: null,
        nonCurrentPercentage: null,
        totalSale: bucket.netDebit,
        advanceReceived: 0,
        currentReceivable: isNonCurrent ? 0 : bucket.netDebit,
        nonCurrentReceivable: isNonCurrent ? bucket.netDebit : 0,
        currentReceived: 0,
        nonCurrentReceived: 0,
        receivedAmount: 0,
        creditLimit: 0,
        createdAt,
        updatedAt: createdAt,
        lockedAt: createdAt,
        payments: [],
        origin: 'journal_inferred',
      }, Date.now() + index)
    })
}

export function loadAccountsReceivableFromStorage() {
  const stored = loadStoredReceivablesFromStorage()
  const inferred = buildInferredReceivablesFromLedger(stored)
  const refreshed = refreshReceivableAccountNames([...stored, ...inferred])
  return refreshed.sort((a, b) => toTimeMs(b.createdAt, 0) - toTimeMs(a.createdAt, 0))
}

export function saveAccountsReceivableToStorage(items) {
  const normalized = Array.isArray(items)
    ? items
      .filter((item) => String(item?.origin || 'module').trim().toLowerCase() !== 'journal_inferred')
      .map((item, index) => normalizeReceivableTransaction(item, Date.now() + index))
    : []
  setStorageValue(ACCOUNTS_RECEIVABLE_STORAGE_KEY, JSON.stringify(normalized))
}

function ensureCustomerReceivableAccount({ customerName, subcategory = 'Current Assets', user = 'system' }) {
  const customer = String(customerName || '').trim()
  if (!customer) throw new Error('Customer is required')
  const normalizedSubcategory = subcategory === 'Non-Current Assets' ? 'Non-Current Assets' : 'Current Assets'

  const accountName = `Accounts Receivable - ${customer}`
  const accounts = loadChartAccountsFromStorage()
  const existing = accounts.find((account) => (
    !account.deletedAt
    && account.type === 'Assets'
    && account.subcategory === normalizedSubcategory
    && toKey(account.name) === toKey(accountName)
  ))
  if (existing) return existing.code

  const parentCode = normalizedSubcategory === 'Non-Current Assets' ? '1200' : '1100'
  const parent = accounts.find((account) => !account.deletedAt && account.code === parentCode)
    || accounts.find((account) => !account.deletedAt && account.type === 'Assets' && account.level === 1 && account.subcategory === normalizedSubcategory)
  if (!parent) throw new Error(`${normalizedSubcategory} parent account not found`)

  const prefix = normalizedSubcategory === 'Non-Current Assets' ? 'ARN' : 'ARC'
  let code
  let idx = 1
  do {
    code = `${prefix}-${normalizeCodePart(customer)}-${String(idx).padStart(3, '0')}`
    idx += 1
  } while (accounts.some((account) => !account.deletedAt && account.code === code))

  addChartAccountFromDraft({
    code,
    name: accountName,
    type: 'Assets',
    subcategory: normalizedSubcategory,
    parentCode: parent.code,
    openingBalance: 0,
  }, user)

  return code
}

function validateReceivablePostingAccounts({
  accounts,
  salesAccountCode,
  receiptAccountCode,
  advanceReceived,
}) {
  const accountByCode = new Map(accounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))
  const salesAccount = accountByCode.get(salesAccountCode)
  if (!salesAccount) throw new Error('Sales account not found')
  if (!isPostableAccount(salesAccount, accounts)) throw new Error('Sales account must be a posting account')

  if (advanceReceived > 0) {
    const receiptAccount = accountByCode.get(receiptAccountCode)
    if (!receiptAccount) throw new Error('Receipt account not found')
    if (!isPostableAccount(receiptAccount, accounts)) throw new Error('Receipt account must be a posting account')
    if (receiptAccount.type !== 'Assets' || receiptAccount.subcategory !== 'Current Assets') {
      throw new Error('Receipt account must be a Current Asset account (Cash/Bank)')
    }
  }

  return { accountByCode, salesAccount }
}

function getCustomerOutstandingReceivable(records, customerName, excludeId = '') {
  const key = toKey(customerName)
  return Math.max(0, toMoney(records.reduce((sum, item) => {
    if (item.deletedAt) return sum
    if (excludeId && item.id === excludeId) return sum
    if (toKey(item.customerName) !== key) return sum
    return toMoney(sum + toMoney(item.outstandingAmount))
  }, 0)))
}

function resolveCustomerCreditLimit({ customerName, providedCreditLimit }) {
  const customers = loadReceivableCustomersFromStorage()
  const existing = customers.find((item) => toKey(item.name) === toKey(customerName) && !item.deletedAt) || null
  const parsed = Number(providedCreditLimit)
  const hasProvidedLimit = Number.isFinite(parsed)
  const limit = hasProvidedLimit ? Math.max(0, toMoney(parsed)) : Math.max(0, toMoney(existing?.creditLimit || 0))
  return { limit, existingCustomer: existing, hasProvidedLimit }
}

export function createAccountsReceivableTransaction({
  customerName,
  salesAccountCode,
  itemType = '',
  totalSale,
  advanceReceived = 0,
  receiptAccountCode = '',
  date,
  dueDate = '',
  splitMode = 'auto',
  classificationMode = 'auto',
  currentReceivable = null,
  currentPercentage = null,
  nonCurrentPercentage = null,
  nonCurrentReceivable = null,
  allowManualClassification = false,
  description = '',
  reference = '',
  creditLimit = null,
  user = 'system',
}) {
  const customer = String(customerName || '').trim()
  if (!customer) throw new Error('Customer is required')

  const cleanSalesCode = String(salesAccountCode || '').trim()
  if (!cleanSalesCode) throw new Error('Sales account is required')

  const cleanDate = String(date || '').trim()
  if (!cleanDate) throw new Error('Invoice date is required')

  const cleanDueDate = String(dueDate || cleanDate).trim()
  if (!cleanDueDate) throw new Error('Due date is required')

  const totalSaleAmount = Math.max(0, toMoney(Number(totalSale) || 0))
  if (totalSaleAmount <= 0) throw new Error('Total sale must be greater than zero')

  const advanceAmount = Math.max(0, toMoney(Number(advanceReceived) || 0))
  if (advanceAmount < 0) throw new Error('Advance received cannot be negative')
  if (advanceAmount > totalSaleAmount) throw new Error('Advance received cannot exceed total sale')

  const cleanReceiptCode = String(receiptAccountCode || '').trim()
  const netReceivable = Math.max(0, toMoney(totalSaleAmount - advanceAmount))
  const split = resolveReceivableSplit({
    invoiceDate: cleanDate,
    dueDate: cleanDueDate,
    netReceivable,
    splitMode,
    classificationMode,
    manualCurrentReceivable: currentReceivable,
    currentPercentage,
    nonCurrentPercentage,
    manualNonCurrentReceivable: nonCurrentReceivable,
    allowManualOverride: allowManualClassification,
  })

  const accounts = loadChartAccountsFromStorage()
  const { accountByCode, salesAccount } = validateReceivablePostingAccounts({
    accounts,
    salesAccountCode: cleanSalesCode,
    receiptAccountCode: cleanReceiptCode,
    advanceReceived: advanceAmount,
  })
  const receiptAccount = cleanReceiptCode ? accountByCode.get(cleanReceiptCode) : null

  const currentReceivableAccountCode = split.currentReceivable > 0
    ? ensureCustomerReceivableAccount({ customerName: customer, subcategory: 'Current Assets', user })
    : ''
  const nonCurrentReceivableAccountCode = split.nonCurrentReceivable > 0
    ? ensureCustomerReceivableAccount({ customerName: customer, subcategory: 'Non-Current Assets', user })
    : ''

  const records = loadStoredReceivablesFromStorage().map((item) => ({ ...item }))
  const { limit: customerLimit } = resolveCustomerCreditLimit({ customerName: customer, providedCreditLimit: creditLimit })
  const existingOutstanding = getCustomerOutstandingReceivable(records, customer)
  const projectedOutstanding = Math.max(0, toMoney(existingOutstanding + netReceivable))
  if (customerLimit > 0 && projectedOutstanding > customerLimit) {
    throw new Error(`Credit limit exceeded for ${customer}. Limit: ${customerLimit.toLocaleString()}, projected outstanding: ${projectedOutstanding.toLocaleString()}`)
  }

  const cleanDescription = String(description || '').trim() || `Sales invoice for ${customer}`
  const rows = []
  if (split.currentReceivable > 0) rows.push({ accountCode: currentReceivableAccountCode, debit: split.currentReceivable, credit: 0 })
  if (split.nonCurrentReceivable > 0) rows.push({ accountCode: nonCurrentReceivableAccountCode, debit: split.nonCurrentReceivable, credit: 0 })
  if (advanceAmount > 0) rows.push({ accountCode: cleanReceiptCode, debit: advanceAmount, credit: 0 })
  rows.push({ accountCode: cleanSalesCode, debit: 0, credit: totalSaleAmount })

  const posting = postJournalRows({
    date: cleanDate,
    narration: cleanDescription,
    description: cleanDescription,
    reference: String(reference || '').trim(),
    rows,
    liabilityPlan: {
      source: 'accounts_receivable',
      totalSale: totalSaleAmount,
      advanceReceived: advanceAmount,
      netReceivable,
      splitMode: split.splitMode,
      classificationMode: split.classificationMode,
      classificationBucket: split.classificationBucket,
      currentReceivable: split.currentReceivable,
      nonCurrentReceivable: split.nonCurrentReceivable,
      currentPercentage: split.currentPercentage,
      nonCurrentPercentage: split.nonCurrentPercentage,
    },
    user,
    source: 'receivable_invoice',
  })

  const ledgerEntries = posting.entries.filter((entry) => entry.id === posting.voucherId)
  const createdAtMs = ledgerEntries.length > 0
    ? ledgerEntries.reduce((earliest, entry) => {
      const candidate = toTimeMs(entry.createdAt, Date.now())
      return candidate < earliest ? candidate : earliest
    }, Number.MAX_SAFE_INTEGER)
    : Date.now()
  const createdAt = new Date(createdAtMs).toISOString()
  const lockedAt = ledgerEntries.length > 0
    ? ledgerEntries[0].lockedAt
    : new Date(createdAtMs + JOURNAL_LOCK_WINDOW_MS).toISOString()

  const refreshedAccounts = loadChartAccountsFromStorage()
  const refreshedMap = new Map(refreshedAccounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))
  const receivableId = computeNextReceivableId(records)
  const record = normalizeReceivableTransaction({
    id: receivableId,
    voucherNo: posting.voucherId,
    customerName: customer,
    itemType: String(itemType || '').trim(),
    description: cleanDescription,
    reference: String(reference || '').trim(),
    date: cleanDate,
    dueDate: cleanDueDate,
    salesAccountCode: cleanSalesCode,
    salesAccountName: `${salesAccount.code} - ${salesAccount.name}`,
    receiptAccountCode: cleanReceiptCode,
    receiptAccountName: receiptAccount ? `${receiptAccount.code} - ${receiptAccount.name}` : '',
    receivableAccountCode: currentReceivableAccountCode || nonCurrentReceivableAccountCode,
    receivableAccountName: (currentReceivableAccountCode || nonCurrentReceivableAccountCode) && refreshedMap.get(currentReceivableAccountCode || nonCurrentReceivableAccountCode)
      ? `${currentReceivableAccountCode || nonCurrentReceivableAccountCode} - ${refreshedMap.get(currentReceivableAccountCode || nonCurrentReceivableAccountCode).name}`
      : '',
    currentReceivableAccountCode,
    currentReceivableAccountName: currentReceivableAccountCode && refreshedMap.get(currentReceivableAccountCode)
      ? `${currentReceivableAccountCode} - ${refreshedMap.get(currentReceivableAccountCode).name}`
      : '',
    nonCurrentReceivableAccountCode,
    nonCurrentReceivableAccountName: nonCurrentReceivableAccountCode && refreshedMap.get(nonCurrentReceivableAccountCode)
      ? `${nonCurrentReceivableAccountCode} - ${refreshedMap.get(nonCurrentReceivableAccountCode).name}`
      : '',
    splitMode: split.splitMode,
    currentPercentage: split.currentPercentage,
    nonCurrentPercentage: split.nonCurrentPercentage,
    classificationMode: split.classificationMode,
    classificationBucket: split.classificationBucket,
    dueWithinOneYear: split.dueWithinOneYear,
    totalSale: totalSaleAmount,
    advanceReceived: advanceAmount,
    currentReceivable: split.currentReceivable,
    nonCurrentReceivable: split.nonCurrentReceivable,
    currentReceived: 0,
    nonCurrentReceived: 0,
    receivedAmount: 0,
    creditLimit: customerLimit,
    createdAt,
    updatedAt: createdAt,
    lockedAt,
    payments: [],
  }, Date.now())

  records.unshift(record)
  saveAccountsReceivableToStorage(records)
  upsertReceivableCustomerMaster({ name: customer, creditLimit: customerLimit, user })
  appendAuditLog({
    action: 'RECEIVABLE_CREATED',
    entity: 'RECEIVABLE',
    entityCode: receivableId,
    note: `Created accounts receivable ${receivableId} (voucher ${posting.voucherId})`,
    user,
    meta: {
      customer,
      totalSale: totalSaleAmount,
      advanceReceived: advanceAmount,
      netReceivable,
      splitMode: split.splitMode,
      classificationMode: split.classificationMode,
      classificationBucket: split.classificationBucket,
      currentReceivable: split.currentReceivable,
      nonCurrentReceivable: split.nonCurrentReceivable,
      currentPercentage: split.currentPercentage,
      nonCurrentPercentage: split.nonCurrentPercentage,
    },
  })

  return { transaction: record, voucherId: posting.voucherId }
}

export function updateAccountsReceivableTransaction({
  receivableId,
  customerName,
  salesAccountCode,
  itemType = '',
  totalSale,
  advanceReceived = 0,
  receiptAccountCode = '',
  date,
  dueDate = '',
  splitMode = 'auto',
  classificationMode = 'auto',
  currentReceivable = null,
  currentPercentage = null,
  nonCurrentPercentage = null,
  nonCurrentReceivable = null,
  allowManualClassification = false,
  description = '',
  reference = '',
  creditLimit = null,
  user = 'system',
}) {
  const cleanId = String(receivableId || '').trim()
  if (!cleanId) throw new Error('Accounts receivable id is required')

  const records = loadStoredReceivablesFromStorage().map((item) => ({ ...item }))
  const index = records.findIndex((item) => item.id === cleanId && !item.deletedAt)
  if (index < 0) throw new Error('Accounts receivable transaction not found')
  const existing = normalizeReceivableTransaction(records[index], Date.now())

  if (isAccountsReceivableLocked(existing)) throw new Error('This receivable entry is locked and cannot be edited after 24 hours')

  const customer = String(customerName || '').trim()
  if (!customer) throw new Error('Customer is required')
  const hasPostedPayments = existing.payments.some((payment) => !payment.deletedAt)
  if (hasPostedPayments && customer !== existing.customerName) {
    throw new Error('Customer cannot be changed after payments are posted')
  }

  const cleanSalesCode = String(salesAccountCode || '').trim()
  if (!cleanSalesCode) throw new Error('Sales account is required')

  const cleanDate = String(date || '').trim()
  if (!cleanDate) throw new Error('Invoice date is required')

  const cleanDueDate = String(dueDate || cleanDate).trim()
  if (!cleanDueDate) throw new Error('Due date is required')

  const totalSaleAmount = Math.max(0, toMoney(Number(totalSale) || 0))
  if (totalSaleAmount <= 0) throw new Error('Total sale must be greater than zero')

  const advanceAmount = Math.max(0, toMoney(Number(advanceReceived) || 0))
  if (advanceAmount > totalSaleAmount) throw new Error('Advance received cannot exceed total sale')

  const cleanReceiptCode = String(receiptAccountCode || '').trim()
  const netReceivable = Math.max(0, toMoney(totalSaleAmount - advanceAmount))
  if (netReceivable < existing.receivedAmount) {
    throw new Error('Net receivable cannot be less than already received amount')
  }
  const split = resolveReceivableSplit({
    invoiceDate: cleanDate,
    dueDate: cleanDueDate,
    netReceivable,
    splitMode,
    classificationMode,
    manualCurrentReceivable: currentReceivable,
    currentPercentage,
    nonCurrentPercentage,
    manualNonCurrentReceivable: nonCurrentReceivable,
    allowManualOverride: allowManualClassification,
  })
  if (split.currentReceivable < existing.currentReceived) {
    throw new Error('Current receivable cannot be less than already received current amount')
  }
  if (split.nonCurrentReceivable < existing.nonCurrentReceived) {
    throw new Error('Non-current receivable cannot be less than already received non-current amount')
  }

  const accounts = loadChartAccountsFromStorage()
  const { accountByCode, salesAccount } = validateReceivablePostingAccounts({
    accounts,
    salesAccountCode: cleanSalesCode,
    receiptAccountCode: cleanReceiptCode,
    advanceReceived: advanceAmount,
  })
  const receiptAccount = cleanReceiptCode ? accountByCode.get(cleanReceiptCode) : null

  const currentReceivableAccountCode = split.currentReceivable > 0
    ? (
      hasPostedPayments
        ? (
          String(existing.currentReceivableAccountCode || '').trim()
          || (existing.currentReceived > 0 ? '' : ensureCustomerReceivableAccount({ customerName: customer, subcategory: 'Current Assets', user }))
        )
        : ensureCustomerReceivableAccount({ customerName: customer, subcategory: 'Current Assets', user })
    )
    : ''
  const nonCurrentReceivableAccountCode = split.nonCurrentReceivable > 0
    ? (
      hasPostedPayments
        ? (
          String(existing.nonCurrentReceivableAccountCode || '').trim()
          || (existing.nonCurrentReceived > 0 ? '' : ensureCustomerReceivableAccount({ customerName: customer, subcategory: 'Non-Current Assets', user }))
        )
        : ensureCustomerReceivableAccount({ customerName: customer, subcategory: 'Non-Current Assets', user })
    )
    : ''
  if (split.currentReceivable > 0 && !currentReceivableAccountCode) {
    throw new Error('Current receivable account is required because payments are already posted')
  }
  if (split.nonCurrentReceivable > 0 && !nonCurrentReceivableAccountCode) {
    throw new Error('Non-current receivable account is required because payments are already posted')
  }

  const { limit: customerLimit } = resolveCustomerCreditLimit({ customerName: customer, providedCreditLimit: creditLimit })
  const existingOutstanding = getCustomerOutstandingReceivable(records, customer, cleanId)
  const projectedOutstanding = Math.max(0, toMoney(existingOutstanding + Math.max(0, netReceivable - existing.receivedAmount)))
  if (customerLimit > 0 && projectedOutstanding > customerLimit) {
    throw new Error(`Credit limit exceeded for ${customer}. Limit: ${customerLimit.toLocaleString()}, projected outstanding: ${projectedOutstanding.toLocaleString()}`)
  }

  const cleanDescription = String(description || '').trim() || `Sales invoice for ${customer}`
  const rows = []
  if (split.currentReceivable > 0) rows.push({ accountCode: currentReceivableAccountCode, debit: split.currentReceivable, credit: 0 })
  if (split.nonCurrentReceivable > 0) rows.push({ accountCode: nonCurrentReceivableAccountCode, debit: split.nonCurrentReceivable, credit: 0 })
  if (advanceAmount > 0) rows.push({ accountCode: cleanReceiptCode, debit: advanceAmount, credit: 0 })
  rows.push({ accountCode: cleanSalesCode, debit: 0, credit: totalSaleAmount })

  updateJournalVoucher({
    voucherNo: existing.voucherNo,
    date: cleanDate,
    description: cleanDescription,
    reference: String(reference || '').trim(),
    rows,
    liabilityPlan: {
      source: 'accounts_receivable',
      splitMode: split.splitMode,
      classificationMode: split.classificationMode,
      classificationBucket: split.classificationBucket,
      currentReceivable: split.currentReceivable,
      nonCurrentReceivable: split.nonCurrentReceivable,
      currentPercentage: split.currentPercentage,
      nonCurrentPercentage: split.nonCurrentPercentage,
      netReceivable,
    },
    user,
  })

  const now = nowIso()
  const refreshedAccounts = loadChartAccountsFromStorage()
  const refreshedMap = new Map(refreshedAccounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))
  const updated = normalizeReceivableTransaction({
    ...existing,
    customerName: customer,
    itemType: String(itemType || '').trim(),
    description: cleanDescription,
    reference: String(reference || '').trim(),
    date: cleanDate,
    dueDate: cleanDueDate,
    salesAccountCode: cleanSalesCode,
    salesAccountName: `${salesAccount.code} - ${salesAccount.name}`,
    receiptAccountCode: cleanReceiptCode,
    receiptAccountName: receiptAccount ? `${receiptAccount.code} - ${receiptAccount.name}` : '',
    receivableAccountCode: currentReceivableAccountCode || nonCurrentReceivableAccountCode,
    receivableAccountName: (currentReceivableAccountCode || nonCurrentReceivableAccountCode) && refreshedMap.get(currentReceivableAccountCode || nonCurrentReceivableAccountCode)
      ? `${currentReceivableAccountCode || nonCurrentReceivableAccountCode} - ${refreshedMap.get(currentReceivableAccountCode || nonCurrentReceivableAccountCode).name}`
      : '',
    currentReceivableAccountCode,
    currentReceivableAccountName: currentReceivableAccountCode && refreshedMap.get(currentReceivableAccountCode)
      ? `${currentReceivableAccountCode} - ${refreshedMap.get(currentReceivableAccountCode).name}`
      : '',
    nonCurrentReceivableAccountCode,
    nonCurrentReceivableAccountName: nonCurrentReceivableAccountCode && refreshedMap.get(nonCurrentReceivableAccountCode)
      ? `${nonCurrentReceivableAccountCode} - ${refreshedMap.get(nonCurrentReceivableAccountCode).name}`
      : '',
    splitMode: split.splitMode,
    currentPercentage: split.currentPercentage,
    nonCurrentPercentage: split.nonCurrentPercentage,
    classificationMode: split.classificationMode,
    classificationBucket: split.classificationBucket,
    dueWithinOneYear: split.dueWithinOneYear,
    totalSale: totalSaleAmount,
    advanceReceived: advanceAmount,
    currentReceivable: split.currentReceivable,
    nonCurrentReceivable: split.nonCurrentReceivable,
    currentReceived: existing.currentReceived,
    nonCurrentReceived: existing.nonCurrentReceived,
    receivedAmount: existing.receivedAmount,
    creditLimit: customerLimit,
    updatedAt: now,
    payments: existing.payments,
  }, Date.now())

  records[index] = updated
  saveAccountsReceivableToStorage(records)
  upsertReceivableCustomerMaster({ name: customer, creditLimit: customerLimit, user })
  appendAuditLog({
    action: 'RECEIVABLE_UPDATED',
    entity: 'RECEIVABLE',
    entityCode: cleanId,
    note: `Updated accounts receivable ${cleanId}`,
    user,
    meta: {
      voucherNo: existing.voucherNo,
      totalSale: totalSaleAmount,
      advanceReceived: advanceAmount,
      netReceivable,
      splitMode: split.splitMode,
      classificationMode: split.classificationMode,
      classificationBucket: split.classificationBucket,
      currentReceivable: split.currentReceivable,
      nonCurrentReceivable: split.nonCurrentReceivable,
      currentPercentage: split.currentPercentage,
      nonCurrentPercentage: split.nonCurrentPercentage,
    },
  })

  return { transaction: updated, voucherId: existing.voucherNo }
}

export function deleteAccountsReceivableTransaction(receivableId, user = 'system') {
  const cleanId = String(receivableId || '').trim()
  if (!cleanId) throw new Error('Accounts receivable id is required')

  const records = loadStoredReceivablesFromStorage().map((item) => ({ ...item }))
  const index = records.findIndex((item) => item.id === cleanId && !item.deletedAt)
  if (index < 0) throw new Error('Accounts receivable transaction not found')
  const target = normalizeReceivableTransaction(records[index], Date.now())

  if (isAccountsReceivableLocked(target)) throw new Error('This receivable entry is locked and cannot be deleted after 24 hours')

  target.payments
    .filter((payment) => !payment.deletedAt && payment.voucherNo)
    .forEach((payment) => deleteJournalVoucher(payment.voucherNo, user))

  deleteJournalVoucher(target.voucherNo, user)

  const removedAt = nowIso()
  records[index] = {
    ...target,
    deletedAt: removedAt,
    updatedAt: removedAt,
    payments: target.payments.map((payment) => ({ ...payment, deletedAt: payment.deletedAt || removedAt })),
  }
  saveAccountsReceivableToStorage(records)
  appendAuditLog({
    action: 'RECEIVABLE_DELETED',
    entity: 'RECEIVABLE',
    entityCode: cleanId,
    note: `Deleted accounts receivable ${cleanId}`,
    user,
    meta: { voucherNo: target.voucherNo, paymentsRemoved: target.payments.length },
  })

  return { id: cleanId, voucherNo: target.voucherNo }
}

export function postAccountsReceivablePayment({
  receivableId,
  portion = 'auto',
  date,
  amount,
  paymentAccountCode,
  description = '',
  reference = '',
  user = 'system',
}) {
  const cleanId = String(receivableId || '').trim()
  if (!cleanId) throw new Error('Accounts receivable id is required')

  const records = loadStoredReceivablesFromStorage().map((item) => ({ ...item }))
  const index = records.findIndex((item) => item.id === cleanId && !item.deletedAt)
  if (index < 0) throw new Error('Accounts receivable transaction not found')
  const target = normalizeReceivableTransaction(records[index], Date.now())

  const cleanDate = String(date || '').trim()
  if (!cleanDate) throw new Error('Payment date is required')

  const amountNumber = Math.max(0, toMoney(Number(amount) || 0))
  if (amountNumber <= 0) throw new Error('Payment amount must be greater than zero')
  if (amountNumber > target.outstandingAmount) throw new Error('Payment amount cannot exceed outstanding receivable')

  const cleanPaymentCode = String(paymentAccountCode || '').trim()
  if (!cleanPaymentCode) throw new Error('Payment account is required')

  const requestedPortion = String(portion || '').trim().toLowerCase()
  let cleanPortion = requestedPortion === 'current' || requestedPortion === 'non-current' ? requestedPortion : 'auto'
  if (cleanPortion === 'auto') {
    if (target.currentOutstanding > 0 && target.nonCurrentOutstanding <= 0) cleanPortion = 'current'
    else if (target.nonCurrentOutstanding > 0 && target.currentOutstanding <= 0) cleanPortion = 'non-current'
    else if (target.currentOutstanding > 0) cleanPortion = 'current'
    else cleanPortion = 'non-current'
  }

  const receivableAccountCode = cleanPortion === 'non-current' ? target.nonCurrentReceivableAccountCode : target.currentReceivableAccountCode
  if (!receivableAccountCode) throw new Error(`No ${cleanPortion === 'non-current' ? 'non-current' : 'current'} receivable available for payment`)

  const selectedOutstanding = cleanPortion === 'non-current' ? target.nonCurrentOutstanding : target.currentOutstanding
  if (selectedOutstanding <= 0) throw new Error('Selected receivable portion is already fully received')
  if (amountNumber > selectedOutstanding) throw new Error('Payment amount cannot exceed selected receivable outstanding')

  const accounts = loadChartAccountsFromStorage()
  const accountByCode = new Map(accounts.filter((account) => !account.deletedAt).map((account) => [account.code, account]))
  const paymentAccount = accountByCode.get(cleanPaymentCode)
  if (!paymentAccount) throw new Error('Payment account not found')
  if (!isPostableAccount(paymentAccount, accounts)) throw new Error('Payment account must be a posting account')
  if (paymentAccount.type !== 'Assets' || paymentAccount.subcategory !== 'Current Assets') {
    throw new Error('Payment account must be a Current Asset account (Cash/Bank)')
  }
  const receivableAccount = accountByCode.get(receivableAccountCode)
  if (!receivableAccount) throw new Error('Receivable account was not found in chart of accounts')

  const cleanDescription = String(description || '').trim() || `${cleanPortion === 'non-current' ? 'Non-current' : 'Current'} customer payment received from ${target.customerName}`
  const posting = postJournalRows({
    date: cleanDate,
    narration: cleanDescription,
    description: cleanDescription,
    reference: String(reference || '').trim(),
    rows: [
      { accountCode: cleanPaymentCode, debit: amountNumber, credit: 0 },
      { accountCode: receivableAccountCode, debit: 0, credit: amountNumber },
    ],
    liabilityPlan: {
      source: 'accounts_receivable_payment',
      receivableId: cleanId,
      portion: cleanPortion,
    },
    user,
    source: cleanPortion === 'non-current' ? 'receivable_payment_non_current' : 'receivable_payment_current',
  })

  const paymentRecord = normalizeReceivablePayment({
    id: `ARPAY-${Date.now()}`,
    voucherNo: posting.voucherId,
    portion: cleanPortion,
    date: cleanDate,
    amount: amountNumber,
    paymentAccountCode: cleanPaymentCode,
    paymentAccountName: `${paymentAccount.code} - ${paymentAccount.name}`,
    receivableAccountCode,
    receivableAccountName: `${receivableAccount.code} - ${receivableAccount.name}`,
    description: cleanDescription,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }, Date.now())

  const updated = normalizeReceivableTransaction({
    ...target,
    currentReceived: cleanPortion === 'current' ? Math.max(0, toMoney(target.currentReceived + amountNumber)) : target.currentReceived,
    nonCurrentReceived: cleanPortion === 'non-current' ? Math.max(0, toMoney(target.nonCurrentReceived + amountNumber)) : target.nonCurrentReceived,
    receivedAmount: Math.max(0, toMoney(target.receivedAmount + amountNumber)),
    updatedAt: nowIso(),
    payments: [...target.payments, paymentRecord],
  }, Date.now())

  records[index] = updated
  saveAccountsReceivableToStorage(records)
  appendAuditLog({
    action: 'RECEIVABLE_PAYMENT_POSTED',
    entity: 'RECEIVABLE',
    entityCode: cleanId,
    note: `Posted receivable payment for ${cleanId} (voucher ${posting.voucherId})`,
    user,
    meta: {
      amount: amountNumber,
      portion: cleanPortion,
      paymentAccountCode: cleanPaymentCode,
      receivableAccountCode,
    },
  })

  return { transaction: updated, voucherId: posting.voucherId, payment: paymentRecord }
}

export const CASH_BANK_TRANSACTION_TYPES = [
  { value: 'cash_receipt', label: 'Cash Receipt' },
  { value: 'cash_payment', label: 'Cash Payment' },
  { value: 'bank_deposit', label: 'Bank Deposit' },
  { value: 'bank_withdrawal', label: 'Bank Withdrawal' },
  { value: 'petty_cash_fund', label: 'Petty Cash Funding' },
  { value: 'petty_cash_expense', label: 'Petty Cash Expense' },
]

export const CASH_BANK_RECON_SOURCE_TYPES = [
  { value: 'manual', label: 'Manual Entry' },
  { value: 'csv', label: 'CSV Upload' },
]

function normalizeCashBankTransactionType(value) {
  const clean = String(value || '').trim().toLowerCase()
  return CASH_BANK_TRANSACTION_TYPES.some((item) => item.value === clean) ? clean : 'cash_receipt'
}

function normalizeReconSourceType(value) {
  const clean = String(value || '').trim().toLowerCase()
  return clean === 'csv' ? 'csv' : 'manual'
}

function getCashBankKindFromCodeAndName(code, name) {
  const codeKey = String(code || '').trim().toLowerCase()
  const nameKey = toKey(name)
  if (nameKey.includes('petty')) return 'petty-cash'
  if (nameKey.includes('bank')) return 'bank'
  if (nameKey.includes('cash')) return 'cash'
  if (codeKey.startsWith('112')) return 'bank'
  if (codeKey.startsWith('111')) return 'cash'
  return ''
}

function isCurrentAssetPostingAccount(account, accounts) {
  return !!account
    && !account.deletedAt
    && account.active !== false
    && account.type === 'Assets'
    && account.subcategory === 'Current Assets'
    && isPostableAccount(account, accounts)
}

function isLikelyReceivableOrPayableName(name) {
  const key = toKey(name)
  return key.includes('receivable') || key.includes('payable')
}

export function loadCashBankAccountsFromChart(accounts = loadChartAccountsFromStorage()) {
  return accounts
    .filter((account) => isCurrentAssetPostingAccount(account, accounts))
    .map((account) => ({
      ...account,
      kind: getCashBankKindFromCodeAndName(account.code, account.name),
    }))
    .filter((account) => account.kind && !isLikelyReceivableOrPayableName(account.name))
    .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
}

export function getCashBankAccountsSummary() {
  const accounts = loadCashBankAccountsFromChart()
  const totalCash = toMoney(accounts
    .filter((item) => item.kind === 'cash' || item.kind === 'petty-cash')
    .reduce((sum, item) => sum + (Number(item.balance) || 0), 0))
  const totalBank = toMoney(accounts
    .filter((item) => item.kind === 'bank')
    .reduce((sum, item) => sum + (Number(item.balance) || 0), 0))
  const pettyCash = toMoney(accounts
    .filter((item) => item.kind === 'petty-cash')
    .reduce((sum, item) => sum + (Number(item.balance) || 0), 0))

  return {
    totalCash,
    totalBank,
    pettyCash,
    totalBalance: toMoney(totalCash + totalBank),
    accountCount: accounts.length,
    cashAccountCount: accounts.filter((item) => item.kind === 'cash' || item.kind === 'petty-cash').length,
    bankAccountCount: accounts.filter((item) => item.kind === 'bank').length,
    pettyCashAccountCount: accounts.filter((item) => item.kind === 'petty-cash').length,
  }
}

function normalizeCashBankTransaction(record, fallbackId = Date.now()) {
  const createdAt = toIso(record?.createdAt, nowIso())
  const lockedAt = toIso(record?.lockedAt, new Date(toTimeMs(createdAt) + JOURNAL_LOCK_WINDOW_MS).toISOString())
  const type = normalizeCashBankTransactionType(record?.transactionType)
  const amount = Math.max(0, toMoney(Number(record?.amount) || 0))

  return {
    id: String(record?.id || `CBT-${fallbackId}`).trim(),
    voucherNo: String(record?.voucherNo || '').trim(),
    transactionType: type,
    date: String(record?.date || '').trim(),
    amount,
    primaryAccountCode: String(record?.primaryAccountCode || '').trim(),
    primaryAccountName: String(record?.primaryAccountName || '').trim(),
    secondaryAccountCode: String(record?.secondaryAccountCode || '').trim(),
    secondaryAccountName: String(record?.secondaryAccountName || '').trim(),
    reference: String(record?.reference || '').trim(),
    description: String(record?.description || '').trim(),
    source: String(record?.source || 'cash_bank').trim() || 'cash_bank',
    direction: String(record?.direction || '').trim() || 'transfer',
    reconciliationStatus: String(record?.reconciliationStatus || '').trim().toLowerCase() === 'reconciled' ? 'reconciled' : 'unreconciled',
    reconciliationId: String(record?.reconciliationId || '').trim(),
    reconciledAt: record?.reconciledAt ? toIso(record.reconciledAt, createdAt) : null,
    createdAt,
    updatedAt: toIso(record?.updatedAt, createdAt),
    lockedAt,
    deletedAt: record?.deletedAt ? toIso(record.deletedAt, nowIso()) : null,
  }
}

function normalizeCashBankStatementEntry(entry, fallbackId = Date.now()) {
  return {
    id: String(entry?.id || `CBST-${fallbackId}`).trim(),
    date: String(entry?.date || '').trim(),
    amount: toMoney(Number(entry?.amount) || 0),
    description: String(entry?.description || '').trim(),
    reference: String(entry?.reference || '').trim(),
    matched: entry?.matched === true,
    matchedVoucherNo: String(entry?.matchedVoucherNo || '').trim(),
  }
}

function normalizeCashBankReconciliation(record, fallbackId = Date.now()) {
  const createdAt = toIso(record?.createdAt, nowIso())
  const entriesRaw = Array.isArray(record?.statementEntries) ? record.statementEntries : []
  const matchedVouchers = Array.isArray(record?.matchedVoucherNos)
    ? record.matchedVoucherNos.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  return {
    id: String(record?.id || `BREC-${fallbackId}`).trim(),
    bankAccountCode: String(record?.bankAccountCode || '').trim(),
    bankAccountName: String(record?.bankAccountName || '').trim(),
    periodStart: String(record?.periodStart || '').trim(),
    periodEnd: String(record?.periodEnd || '').trim(),
    statementDate: String(record?.statementDate || '').trim(),
    statementEndingBalance: toMoney(Number(record?.statementEndingBalance) || 0),
    bookBalance: toMoney(Number(record?.bookBalance) || 0),
    difference: toMoney(Number(record?.difference) || 0),
    sourceType: normalizeReconSourceType(record?.sourceType),
    status: String(record?.status || '').trim().toLowerCase() === 'reconciled' ? 'reconciled' : 'review',
    notes: String(record?.notes || '').trim(),
    statementEntries: entriesRaw.map((entry, index) => normalizeCashBankStatementEntry(entry, `${fallbackId}-${index}`)),
    totalEntries: Math.max(0, Number(record?.totalEntries) || 0),
    matchedEntries: Math.max(0, Number(record?.matchedEntries) || 0),
    unmatchedEntries: Math.max(0, Number(record?.unmatchedEntries) || 0),
    matchedVoucherNos: [...new Set(matchedVouchers)],
    user: String(record?.user || 'system').trim(),
    createdAt,
    updatedAt: toIso(record?.updatedAt, createdAt),
  }
}

function refreshCashBankTransactionNames(items, accounts = loadChartAccountsFromStorage()) {
  const byCode = new Map(accounts.filter((item) => !item.deletedAt).map((item) => [item.code, item]))
  return items.map((item) => {
    const primary = byCode.get(item.primaryAccountCode)
    const secondary = byCode.get(item.secondaryAccountCode)
    return {
      ...item,
      primaryAccountName: primary ? `${primary.code} - ${primary.name}` : item.primaryAccountName,
      secondaryAccountName: secondary ? `${secondary.code} - ${secondary.name}` : item.secondaryAccountName,
    }
  })
}

export function loadCashBankTransactionsFromStorage() {
  const raw = getStorageValue(CASH_BANK_TRANSACTIONS_STORAGE_KEY, null)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const normalized = parsed.map((item, index) => normalizeCashBankTransaction(item, Date.now() + index))
      .filter((item) => !item.deletedAt)
    const refreshed = refreshCashBankTransactionNames(normalized)
    return refreshed.sort((a, b) => toTimeMs(b.createdAt, 0) - toTimeMs(a.createdAt, 0))
  } catch {
    return []
  }
}

export function saveCashBankTransactionsToStorage(items) {
  const normalized = Array.isArray(items)
    ? items.map((item, index) => normalizeCashBankTransaction(item, Date.now() + index))
    : []
  setStorageValue(CASH_BANK_TRANSACTIONS_STORAGE_KEY, JSON.stringify(normalized))
}

export function loadCashBankReconciliationsFromStorage() {
  const raw = getStorageValue(CASH_BANK_RECON_STORAGE_KEY, null)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item, index) => normalizeCashBankReconciliation(item, Date.now() + index))
      .sort((a, b) => toTimeMs(b.createdAt, 0) - toTimeMs(a.createdAt, 0))
  } catch {
    return []
  }
}

export function saveCashBankReconciliationsToStorage(items) {
  const normalized = Array.isArray(items)
    ? items.map((item, index) => normalizeCashBankReconciliation(item, Date.now() + index))
    : []
  setStorageValue(CASH_BANK_RECON_STORAGE_KEY, JSON.stringify(normalized))
}

function normalizeDateRangeValue(value) {
  const clean = String(value || '').trim()
  if (!clean) return ''
  return Number.isFinite(parseDateOnlyMs(clean)) ? clean : ''
}

function isDateWithinRange(dateValue, startDate, endDate) {
  const dateMs = parseDateOnlyMs(dateValue)
  if (!Number.isFinite(dateMs)) return false
  const startMs = parseDateOnlyMs(startDate)
  const endMs = parseDateOnlyMs(endDate)
  if (Number.isFinite(startMs) && dateMs < startMs) return false
  if (Number.isFinite(endMs) && dateMs > endMs) return false
  return true
}

function getCashBankBookRows({ bankAccountCode, periodStart = '', periodEnd = '' }) {
  const cleanCode = String(bankAccountCode || '').trim()
  if (!cleanCode) return []
  const startDate = normalizeDateRangeValue(periodStart)
  const endDate = normalizeDateRangeValue(periodEnd)

  return loadLedgerEntriesFromStorage()
    .filter((entry) => (
      !entry.deletedAt
      && String(entry.status || '').toLowerCase() === 'posted'
      && entry.accountCode === cleanCode
      && (!startDate && !endDate ? true : isDateWithinRange(entry.date, startDate, endDate))
    ))
    .map((entry) => ({
      voucherNo: entry.voucherNo,
      date: entry.date,
      description: entry.description,
      reference: entry.reference,
      signedAmount: toMoney((Number(entry.debit) || 0) - (Number(entry.credit) || 0)),
    }))
}

function reconcileStatementEntriesWithBook(statementEntries, bookRows) {
  const used = new Set()
  const normalizedRows = Array.isArray(bookRows) ? bookRows : []
  const updatedEntries = statementEntries.map((entry) => {
    const amount = toMoney(Number(entry.amount) || 0)
    const statementMs = parseDateOnlyMs(entry.date)
    let matchIndex = -1

    for (let i = 0; i < normalizedRows.length; i += 1) {
      if (used.has(i)) continue
      const row = normalizedRows[i]
      if (Math.abs(toMoney((Number(row.signedAmount) || 0) - amount)) > 0.01) continue
      const rowMs = parseDateOnlyMs(row.date)
      if (Number.isFinite(statementMs) && Number.isFinite(rowMs) && Math.abs(statementMs - rowMs) > (3 * 24 * 60 * 60 * 1000)) continue
      matchIndex = i
      break
    }

    if (matchIndex >= 0) {
      used.add(matchIndex)
      const matchedRow = normalizedRows[matchIndex]
      return normalizeCashBankStatementEntry({
        ...entry,
        matched: true,
        matchedVoucherNo: matchedRow.voucherNo,
      }, Date.now())
    }

    return normalizeCashBankStatementEntry({
      ...entry,
      matched: false,
      matchedVoucherNo: '',
    }, Date.now())
  })

  const matchedEntries = updatedEntries.filter((entry) => entry.matched)
  return {
    entries: updatedEntries,
    matchedCount: matchedEntries.length,
    unmatchedCount: Math.max(0, updatedEntries.length - matchedEntries.length),
    matchedVoucherNos: [...new Set(matchedEntries.map((entry) => entry.matchedVoucherNo).filter(Boolean))],
  }
}

function markCashBankTransactionsAsReconciled({ vouchers, reconciliationId, bankAccountCode }) {
  const voucherSet = new Set((Array.isArray(vouchers) ? vouchers : []).map((item) => String(item || '').trim()).filter(Boolean))
  if (voucherSet.size === 0) return
  const now = nowIso()
  const cleanBankCode = String(bankAccountCode || '').trim()
  if (!cleanBankCode) return

  const transactions = loadCashBankTransactionsFromStorage().map((item) => ({ ...item }))
  let changed = false
  const next = transactions.map((transaction) => {
    if (!voucherSet.has(transaction.voucherNo)) return transaction
    if (transaction.primaryAccountCode !== cleanBankCode && transaction.secondaryAccountCode !== cleanBankCode) return transaction
    changed = true
    return {
      ...transaction,
      reconciliationStatus: 'reconciled',
      reconciliationId,
      reconciledAt: now,
      updatedAt: now,
    }
  })

  if (changed) saveCashBankTransactionsToStorage(next)
}

export function loadCashBankActivityFeed({
  search = '',
  accountCode = '',
  transactionType = 'all',
  fromDate = '',
  toDate = '',
} = {}) {
  const accounts = loadCashBankAccountsFromChart()
  const accountSet = new Set(accounts.map((item) => item.code))
  const cleanAccountCode = String(accountCode || '').trim()
  const cleanSearch = toKey(search)
  const cleanType = normalizeCashBankTransactionType(transactionType)
  const startDate = normalizeDateRangeValue(fromDate)
  const endDate = normalizeDateRangeValue(toDate)
  const ownTxByVoucher = new Map(loadCashBankTransactionsFromStorage().map((item) => [item.voucherNo, item]))
  const reconciliationByVoucher = new Map()
  loadCashBankReconciliationsFromStorage().forEach((record) => {
    const vouchers = Array.isArray(record.matchedVoucherNos) ? record.matchedVoucherNos : []
    vouchers.forEach((voucherNo) => {
      const key = String(voucherNo || '').trim()
      if (!key) return
      if (!reconciliationByVoucher.has(key)) reconciliationByVoucher.set(key, record.id)
    })
  })

  const postedRows = loadLedgerEntriesFromStorage().filter((entry) => (
    String(entry.status || '').toLowerCase() === 'posted'
    && accountSet.has(entry.accountCode)
  ))

  const vouchers = new Map()
  postedRows.forEach((row) => {
    if (cleanAccountCode && row.accountCode !== cleanAccountCode) return
    if ((startDate || endDate) && !isDateWithinRange(row.date, startDate, endDate)) return
    const key = row.voucherNo
    if (!vouchers.has(key)) {
      vouchers.set(key, {
        voucherNo: row.voucherNo,
        date: row.date,
        description: row.description,
        reference: row.reference,
        source: row.source,
        createdAt: row.createdAt,
        totalIn: 0,
        totalOut: 0,
        accountCodes: new Set(),
      })
    }
    const target = vouchers.get(key)
    target.totalIn = toMoney(target.totalIn + (Number(row.debit) || 0))
    target.totalOut = toMoney(target.totalOut + (Number(row.credit) || 0))
    target.accountCodes.add(row.accountCode)
  })

  const rows = Array.from(vouchers.values()).map((item) => {
    const linked = ownTxByVoucher.get(item.voucherNo) || null
    const matchedReconId = reconciliationByVoucher.get(item.voucherNo) || ''
    const inferredType = linked?.transactionType
      || (item.source.includes('receivable') ? 'cash_receipt'
        : item.source.includes('payable') ? 'cash_payment'
          : 'cash_receipt')
    const normalizedType = normalizeCashBankTransactionType(inferredType)
    const signed = toMoney(item.totalIn - item.totalOut)
    return {
      id: linked?.id || item.voucherNo,
      voucherNo: item.voucherNo,
      date: item.date,
      source: item.source,
      transactionType: normalizedType,
      description: item.description,
      reference: item.reference,
      amount: Math.max(item.totalIn, item.totalOut),
      totalIn: item.totalIn,
      totalOut: item.totalOut,
      signedAmount: signed,
      direction: signed >= 0 ? 'in' : 'out',
      accountCodes: [...item.accountCodes],
      reconciliationStatus: linked?.reconciliationStatus === 'reconciled' || !!matchedReconId ? 'reconciled' : 'unreconciled',
      reconciliationId: linked?.reconciliationId || matchedReconId,
      createdAt: linked?.createdAt || item.createdAt,
    }
  })
    .filter((item) => {
      if (transactionType && transactionType !== 'all' && item.transactionType !== cleanType) return false
      if (!cleanSearch) return true
      const haystack = `${item.voucherNo} ${item.description} ${item.reference} ${item.source} ${item.transactionType}`.toLowerCase()
      return haystack.includes(cleanSearch)
    })
    .sort((a, b) => toTimeMs(b.createdAt || b.date, 0) - toTimeMs(a.createdAt || a.date, 0))

  return rows
}

function assertPostingAccount(accountCode, accountByCode, accounts, label) {
  const cleanCode = String(accountCode || '').trim()
  if (!cleanCode) throw new Error(`${label} is required`)
  const account = accountByCode.get(cleanCode)
  if (!account) throw new Error(`${label} account not found`)
  if (!isPostableAccount(account, accounts)) throw new Error(`${label} must be a posting account`)
  return account
}

function assertCurrentAssetCashBank(accountCode, accountByCode, accounts, label, allowedKinds = ['cash', 'bank', 'petty-cash']) {
  const account = assertPostingAccount(accountCode, accountByCode, accounts, label)
  if (account.type !== 'Assets' || account.subcategory !== 'Current Assets') {
    throw new Error(`${label} must belong to Current Assets`)
  }
  const kind = getCashBankKindFromCodeAndName(account.code, account.name)
  if (!allowedKinds.includes(kind)) {
    throw new Error(`${label} must be a ${allowedKinds.join(' / ')} account`)
  }
  if (isLikelyReceivableOrPayableName(account.name)) {
    throw new Error(`${label} cannot be receivable/payable account`)
  }
  return account
}

function resolveExpensePaymentModeFromCashBankKind(kind) {
  if (kind === 'bank') return 'bank'
  if (kind === 'petty-cash') return 'petty_cash'
  return 'cash'
}

function syncCashBankExpenseIntoExpenseModule({
  date,
  amount,
  description,
  reference,
  voucherNo,
  cashBankTransactionId,
  expenseAccount,
  paymentAccount,
  paymentKind,
  user,
}) {
  const records = loadStoredExpensesFromStorage().map((item) => ({ ...item }))
  const existing = records.find((item) => item.voucherNo === voucherNo)
  if (existing) return

  const now = nowIso()
  const expense = normalizeAccountsExpense({
    id: computeNextExpenseId(records),
    date,
    category: 'Miscellaneous',
    itemName: String(description || '').trim(),
    description: String(description || '').trim(),
    amount,
    expenseAccountCode: expenseAccount?.code || '',
    expenseAccountName: expenseAccount ? `${expenseAccount.code} - ${expenseAccount.name}` : '',
    paymentMode: resolveExpensePaymentModeFromCashBankKind(paymentKind),
    paymentAccountCode: paymentAccount?.code || '',
    paymentAccountName: paymentAccount ? `${paymentAccount.code} - ${paymentAccount.name}` : '',
    payableAccountCode: '',
    payableAccountName: '',
    reference: String(reference || '').trim(),
    voucherNo,
    cashBankTransactionId,
    status: 'posted',
    createdAt: now,
    updatedAt: now,
  }, Date.now())

  records.unshift(expense)
  saveAccountsExpensesToStorage(records)
  appendAuditLog({
    action: 'EXPENSE_SYNCED_FROM_CASH_BANK',
    entity: 'EXPENSE',
    entityCode: expense.id,
    note: `Synced expense ${expense.id} from cash/bank transaction ${cashBankTransactionId}`,
    user,
    meta: {
      voucherNo,
      cashBankTransactionId,
      amount,
      expenseAccountCode: expense.expenseAccountCode,
      paymentAccountCode: expense.paymentAccountCode,
    },
  })
}

export function createCashBankTransaction({
  transactionType,
  date,
  amount,
  accountCode = '',
  counterAccountCode = '',
  cashAccountCode = '',
  bankAccountCode = '',
  pettyCashAccountCode = '',
  expenseAccountCode = '',
  reference = '',
  description = '',
  origin = 'cash_bank',
  user = 'system',
}) {
  const type = normalizeCashBankTransactionType(transactionType)
  const cleanDate = String(date || '').trim()
  if (!cleanDate) throw new Error('Date is required')

  const amountValue = Math.max(0, toMoney(Number(amount) || 0))
  if (amountValue <= 0) throw new Error('Amount must be greater than zero')

  const accounts = loadChartAccountsFromStorage()
  const accountByCode = new Map(accounts.filter((item) => !item.deletedAt).map((item) => [item.code, item]))
  const cleanReference = String(reference || '').trim()
  let rows = []
  let source = 'cash_bank'
  let primary = null
  let secondary = null
  let direction = 'transfer'
  let cleanDescription = String(description || '').trim()

  if (type === 'cash_receipt') {
    primary = assertCurrentAssetCashBank(accountCode, accountByCode, accounts, 'Cash/Bank account', ['cash', 'bank', 'petty-cash'])
    secondary = assertPostingAccount(counterAccountCode, accountByCode, accounts, 'Counter account')
    if (primary.code === secondary.code) throw new Error('Counter account must be different from cash/bank account')
    rows = [
      { accountCode: primary.code, debit: amountValue, credit: 0 },
      { accountCode: secondary.code, debit: 0, credit: amountValue },
    ]
    source = 'cash_bank_receipt'
    direction = 'in'
    if (!cleanDescription) cleanDescription = `Cash/Bank receipt into ${primary.name}`
  } else if (type === 'cash_payment') {
    primary = assertCurrentAssetCashBank(accountCode, accountByCode, accounts, 'Cash/Bank account', ['cash', 'bank', 'petty-cash'])
    secondary = assertPostingAccount(counterAccountCode, accountByCode, accounts, 'Counter account')
    if (primary.code === secondary.code) throw new Error('Counter account must be different from cash/bank account')
    rows = [
      { accountCode: secondary.code, debit: amountValue, credit: 0 },
      { accountCode: primary.code, debit: 0, credit: amountValue },
    ]
    source = 'cash_bank_payment'
    direction = 'out'
    if (!cleanDescription) cleanDescription = `Cash/Bank payment from ${primary.name}`
  } else if (type === 'bank_deposit') {
    const cashAccount = assertCurrentAssetCashBank(cashAccountCode, accountByCode, accounts, 'Cash account', ['cash', 'petty-cash'])
    const bankAccount = assertCurrentAssetCashBank(bankAccountCode, accountByCode, accounts, 'Bank account', ['bank'])
    if (cashAccount.code === bankAccount.code) throw new Error('Cash and bank account must be different')
    primary = bankAccount
    secondary = cashAccount
    rows = [
      { accountCode: bankAccount.code, debit: amountValue, credit: 0 },
      { accountCode: cashAccount.code, debit: 0, credit: amountValue },
    ]
    source = 'cash_bank_deposit'
    direction = 'transfer'
    if (!cleanDescription) cleanDescription = `Bank deposit from ${cashAccount.name} to ${bankAccount.name}`
  } else if (type === 'bank_withdrawal') {
    const bankAccount = assertCurrentAssetCashBank(bankAccountCode, accountByCode, accounts, 'Bank account', ['bank'])
    const cashAccount = assertCurrentAssetCashBank(cashAccountCode, accountByCode, accounts, 'Cash account', ['cash', 'petty-cash'])
    if (cashAccount.code === bankAccount.code) throw new Error('Bank and cash account must be different')
    primary = cashAccount
    secondary = bankAccount
    rows = [
      { accountCode: cashAccount.code, debit: amountValue, credit: 0 },
      { accountCode: bankAccount.code, debit: 0, credit: amountValue },
    ]
    source = 'cash_bank_withdrawal'
    direction = 'transfer'
    if (!cleanDescription) cleanDescription = `Bank withdrawal from ${bankAccount.name} to ${cashAccount.name}`
  } else if (type === 'petty_cash_fund') {
    const petty = assertCurrentAssetCashBank(pettyCashAccountCode, accountByCode, accounts, 'Petty cash account', ['petty-cash', 'cash'])
    const funding = assertCurrentAssetCashBank(accountCode || counterAccountCode, accountByCode, accounts, 'Funding account', ['cash', 'bank'])
    if (petty.code === funding.code) throw new Error('Petty cash and funding account must be different')
    primary = petty
    secondary = funding
    rows = [
      { accountCode: petty.code, debit: amountValue, credit: 0 },
      { accountCode: funding.code, debit: 0, credit: amountValue },
    ]
    source = 'petty_cash_fund'
    direction = 'transfer'
    if (!cleanDescription) cleanDescription = `Petty cash funded from ${funding.name}`
  } else {
    const petty = assertCurrentAssetCashBank(pettyCashAccountCode || accountCode, accountByCode, accounts, 'Petty cash account', ['petty-cash', 'cash'])
    const expense = assertPostingAccount(expenseAccountCode || counterAccountCode, accountByCode, accounts, 'Expense account')
    if (expense.type !== 'Expenses') throw new Error('Expense account must belong to Expenses')
    if (petty.code === expense.code) throw new Error('Expense account must be different from petty cash account')
    primary = petty
    secondary = expense
    rows = [
      { accountCode: expense.code, debit: amountValue, credit: 0 },
      { accountCode: petty.code, debit: 0, credit: amountValue },
    ]
    source = 'petty_cash_expense'
    direction = 'out'
    if (!cleanDescription) cleanDescription = `Petty cash expense (${expense.name})`
  }

  const posting = postJournalRows({
    date: cleanDate,
    narration: cleanDescription,
    description: cleanDescription,
    reference: cleanReference,
    rows,
    liabilityPlan: {
      source: 'cash_bank',
      transactionType: type,
      primaryAccountCode: primary?.code || '',
      secondaryAccountCode: secondary?.code || '',
      amount: amountValue,
    },
    user,
    source,
  })

  const ledgerEntries = posting.entries.filter((entry) => entry.id === posting.voucherId)
  const createdAt = ledgerEntries.length > 0
    ? ledgerEntries.reduce((earliest, entry) => {
      const candidate = toTimeMs(entry.createdAt, Date.now())
      return candidate < earliest ? candidate : earliest
    }, Number.MAX_SAFE_INTEGER)
    : Date.now()
  const createdIso = new Date(createdAt).toISOString()
  const lockedAt = ledgerEntries.length > 0
    ? ledgerEntries[0].lockedAt
    : new Date(createdAt + JOURNAL_LOCK_WINDOW_MS).toISOString()

  const transactions = loadCashBankTransactionsFromStorage().map((item) => ({ ...item }))
  const record = normalizeCashBankTransaction({
    id: `CBT-${Date.now()}`,
    voucherNo: posting.voucherId,
    transactionType: type,
    date: cleanDate,
    amount: amountValue,
    primaryAccountCode: primary?.code || '',
    primaryAccountName: primary ? `${primary.code} - ${primary.name}` : '',
    secondaryAccountCode: secondary?.code || '',
    secondaryAccountName: secondary ? `${secondary.code} - ${secondary.name}` : '',
    reference: cleanReference,
    description: cleanDescription,
    source,
    direction,
    reconciliationStatus: (primary && getCashBankKindFromCodeAndName(primary.code, primary.name) === 'bank')
      || (secondary && getCashBankKindFromCodeAndName(secondary.code, secondary.name) === 'bank')
      ? 'unreconciled'
      : 'reconciled',
    createdAt: createdIso,
    updatedAt: createdIso,
    lockedAt,
  }, Date.now())

  transactions.unshift(record)
  saveCashBankTransactionsToStorage(transactions)
  appendAuditLog({
    action: 'CASH_BANK_TRANSACTION_CREATED',
    entity: 'CASH_BANK',
    entityCode: record.id,
    note: `Posted cash/bank transaction ${record.id} (voucher ${posting.voucherId})`,
    user,
    meta: {
      transactionType: type,
      amount: amountValue,
      voucherNo: posting.voucherId,
      primaryAccountCode: record.primaryAccountCode,
      secondaryAccountCode: record.secondaryAccountCode,
    },
  })

  const paymentKind = primary ? getCashBankKindFromCodeAndName(primary.code, primary.name) : ''
  const shouldSyncExpense = (
    (type === 'petty_cash_expense' && secondary?.type === 'Expenses')
    || (type === 'cash_payment' && secondary?.type === 'Expenses')
  ) && String(origin || '').trim() !== 'expenses_module'

  if (shouldSyncExpense) {
    syncCashBankExpenseIntoExpenseModule({
      date: cleanDate,
      amount: amountValue,
      description: cleanDescription,
      reference: cleanReference,
      voucherNo: posting.voucherId,
      cashBankTransactionId: record.id,
      expenseAccount: secondary,
      paymentAccount: primary,
      paymentKind,
      user,
    })
  }

  return { transaction: record, voucherId: posting.voucherId }
}

export function createBankReconciliation({
  bankAccountCode,
  periodStart = '',
  periodEnd = '',
  statementDate = '',
  statementEndingBalance,
  sourceType = 'manual',
  statementEntries = [],
  notes = '',
  user = 'system',
}) {
  const cleanBankCode = String(bankAccountCode || '').trim()
  if (!cleanBankCode) throw new Error('Bank account is required')
  const cleanSource = normalizeReconSourceType(sourceType)
  const cleanStart = normalizeDateRangeValue(periodStart)
  const cleanEnd = normalizeDateRangeValue(periodEnd)
  const cleanStatementDate = normalizeDateRangeValue(statementDate) || nowIso().slice(0, 10)

  const accounts = loadChartAccountsFromStorage()
  const byCode = new Map(accounts.filter((item) => !item.deletedAt).map((item) => [item.code, item]))
  const bankAccount = assertCurrentAssetCashBank(cleanBankCode, byCode, accounts, 'Bank account', ['bank'])

  const parsedStatementBalance = Number(statementEndingBalance)
  if (!Number.isFinite(parsedStatementBalance)) throw new Error('Statement ending balance is required')
  const statementBalance = toMoney(parsedStatementBalance)

  const normalizedEntries = (Array.isArray(statementEntries) ? statementEntries : [])
    .map((entry, index) => normalizeCashBankStatementEntry(entry, `${Date.now()}-${index}`))
    .filter((entry) => Number.isFinite(Number(entry.amount)) && Math.abs(Number(entry.amount)) > 0)

  if (cleanSource === 'csv' && normalizedEntries.length === 0) {
    throw new Error('CSV reconciliation requires statement rows')
  }

  const bookRows = getCashBankBookRows({
    bankAccountCode: cleanBankCode,
    periodStart: cleanStart,
    periodEnd: cleanEnd,
  })
  const accountNow = loadChartAccountsFromStorage().find((item) => item.code === cleanBankCode && !item.deletedAt)
  const bookBalance = toMoney(Number(accountNow?.balance) || 0)
  const match = reconcileStatementEntriesWithBook(normalizedEntries, bookRows)
  const difference = toMoney(statementBalance - bookBalance)
  const status = Math.abs(difference) <= 0.01 && match.unmatchedCount === 0 ? 'reconciled' : 'review'

  const records = loadCashBankReconciliationsFromStorage().map((item) => ({ ...item }))
  const now = nowIso()
  const reconciliation = normalizeCashBankReconciliation({
    id: `BREC-${Date.now()}`,
    bankAccountCode: cleanBankCode,
    bankAccountName: `${bankAccount.code} - ${bankAccount.name}`,
    periodStart: cleanStart,
    periodEnd: cleanEnd,
    statementDate: cleanStatementDate,
    statementEndingBalance: statementBalance,
    bookBalance,
    difference,
    sourceType: cleanSource,
    status,
    notes: String(notes || '').trim(),
    statementEntries: match.entries,
    totalEntries: match.entries.length,
    matchedEntries: match.matchedCount,
    unmatchedEntries: match.unmatchedCount,
    matchedVoucherNos: match.matchedVoucherNos,
    user,
    createdAt: now,
    updatedAt: now,
  }, Date.now())

  records.unshift(reconciliation)
  saveCashBankReconciliationsToStorage(records)
  markCashBankTransactionsAsReconciled({
    vouchers: reconciliation.matchedVoucherNos,
    reconciliationId: reconciliation.id,
    bankAccountCode: cleanBankCode,
  })
  appendAuditLog({
    action: 'BANK_RECONCILIATION_CREATED',
    entity: 'CASH_BANK_RECON',
    entityCode: reconciliation.id,
    note: `Bank reconciliation completed for ${cleanBankCode}`,
    user,
    meta: {
      bankAccountCode: cleanBankCode,
      sourceType: cleanSource,
      statementEndingBalance: statementBalance,
      bookBalance,
      difference,
      matchedEntries: reconciliation.matchedEntries,
      unmatchedEntries: reconciliation.unmatchedEntries,
    },
  })

  return { reconciliation }
}

function normalizeExpensePaymentMode(value) {
  const clean = String(value || '').trim().toLowerCase()
  if (clean === 'cash' || clean === 'bank' || clean === 'credit') return clean
  return 'petty_cash'
}

function computeNextExpenseId(items) {
  const max = items.reduce((highest, item) => {
    const match = String(item?.id || '').match(/^EXP-(\d+)$/)
    const value = match ? Number(match[1]) : 0
    return value > highest ? value : highest
  }, 0)
  return `EXP-${String(max + 1).padStart(3, '0')}`
}

function normalizeExpenseCategory(value) {
  const clean = String(value || '').trim()
  if (!clean) return 'Miscellaneous'
  const matched = ACCOUNTS_EXPENSE_CATEGORY_OPTIONS.find((item) => toKey(item) === toKey(clean))
  return matched || clean
}

function normalizeAccountsExpense(record, fallbackId = Date.now()) {
  const createdAt = toIso(record?.createdAt, nowIso())
  const status = String(record?.status || '').trim().toLowerCase() === 'void' ? 'void' : 'posted'
  const origin = String(record?.origin || '').trim().toLowerCase() === 'journal_inferred' ? 'journal_inferred' : 'module'

  return {
    id: String(record?.id || `EXP-${fallbackId}`).trim(),
    date: String(record?.date || '').trim(),
    category: normalizeExpenseCategory(record?.category),
    itemName: String(record?.itemName || '').trim(),
    description: String(record?.description || '').trim(),
    amount: Math.max(0, toMoney(Number(record?.amount) || 0)),
    expenseAccountCode: String(record?.expenseAccountCode || '').trim(),
    expenseAccountName: String(record?.expenseAccountName || '').trim(),
    paymentMode: normalizeExpensePaymentMode(record?.paymentMode),
    paymentAccountCode: String(record?.paymentAccountCode || '').trim(),
    paymentAccountName: String(record?.paymentAccountName || '').trim(),
    payableAccountCode: String(record?.payableAccountCode || '').trim(),
    payableAccountName: String(record?.payableAccountName || '').trim(),
    reference: String(record?.reference || '').trim(),
    voucherNo: String(record?.voucherNo || '').trim(),
    cashBankTransactionId: String(record?.cashBankTransactionId || '').trim(),
    status,
    origin,
    createdAt,
    updatedAt: toIso(record?.updatedAt, createdAt),
    deletedAt: record?.deletedAt ? toIso(record.deletedAt, nowIso()) : null,
  }
}

function refreshExpenseAccountNames(items, accounts = loadChartAccountsFromStorage()) {
  const byCode = new Map(accounts.filter((item) => !item.deletedAt).map((item) => [item.code, item]))
  return items.map((item) => {
    const expenseAccount = byCode.get(item.expenseAccountCode)
    const paymentAccount = byCode.get(item.paymentAccountCode)
    const payableAccount = byCode.get(item.payableAccountCode)
    return {
      ...item,
      expenseAccountName: expenseAccount ? `${expenseAccount.code} - ${expenseAccount.name}` : item.expenseAccountName,
      paymentAccountName: paymentAccount ? `${paymentAccount.code} - ${paymentAccount.name}` : item.paymentAccountName,
      payableAccountName: payableAccount ? `${payableAccount.code} - ${payableAccount.name}` : item.payableAccountName,
    }
  })
}

function loadStoredExpensesFromStorage() {
  const raw = getStorageValue(ACCOUNTS_EXPENSES_STORAGE_KEY, null)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item, index) => normalizeAccountsExpense(item, Date.now() + index))
      .filter((item) => !item.deletedAt)
  } catch {
    return []
  }
}

function inferExpenseModeFromPaymentAccount(account) {
  if (!account) return 'credit'
  if (account.type === 'Liabilities') return 'credit'
  if (account.type === 'Assets' && account.subcategory === 'Current Assets') {
    const kind = getCashBankKindFromCodeAndName(account.code, account.name)
    if (kind === 'bank') return 'bank'
    if (kind === 'petty-cash') return 'petty_cash'
    if (kind === 'cash') return 'cash'
    return 'cash'
  }
  return 'credit'
}

function buildInferredExpensesFromLedger(existingExpenses = []) {
  const existingVoucherNos = new Set(existingExpenses.map((item) => String(item?.voucherNo || '').trim()).filter(Boolean))
  const accounts = loadChartAccountsFromStorage()
  const accountByCode = new Map(accounts.filter((item) => !item.deletedAt).map((item) => [item.code, item]))
  const postedLedger = loadLedgerEntriesFromStorage().filter(isPostedLedgerEntry)
  const voucherMap = new Map()

  postedLedger.forEach((entry) => {
    const voucherNo = String(entry.voucherNo || entry.id || '').trim()
    if (!voucherNo || existingVoucherNos.has(voucherNo)) return
    if (!voucherMap.has(voucherNo)) voucherMap.set(voucherNo, [])
    voucherMap.get(voucherNo).push(entry)
  })

  const inferred = []
  voucherMap.forEach((rows, voucherNo) => {
    const expenseRows = rows.filter((row) => {
      const account = accountByCode.get(row.accountCode)
      return account?.type === 'Expenses' && (Number(row.debit) || 0) > 0
    })
    if (expenseRows.length === 0) return

    const voucherCreatedAt = rows.reduce((earliest, row) => {
      const candidate = toIso(row.createdAt, nowIso())
      return toTimeMs(candidate, Date.now()) < toTimeMs(earliest, Date.now()) ? candidate : earliest
    }, toIso(rows[0]?.createdAt, nowIso()))
    const voucherDate = toDateFromEntryOrIso(rows[0]?.date, voucherCreatedAt)
    const narration = String(rows[0]?.description || rows[0]?.narration || '').trim()
    const reference = String(rows[0]?.reference || '').trim()

    expenseRows.forEach((expenseRow, index) => {
      const expenseAccount = accountByCode.get(expenseRow.accountCode)
      const paymentRow = rows
        .filter((row) => row.accountCode !== expenseRow.accountCode && (Number(row.credit) || 0) > 0)
        .sort((a, b) => (Number(b.credit) || 0) - (Number(a.credit) || 0))[0] || null
      const paymentAccount = paymentRow ? accountByCode.get(paymentRow.accountCode) : null
      const paymentMode = inferExpenseModeFromPaymentAccount(paymentAccount)

      inferred.push(normalizeAccountsExpense({
        id: `EXP-JV-${voucherNo}-${String(index + 1).padStart(2, '0')}`,
        date: toDateFromEntryOrIso(expenseRow.date, voucherCreatedAt) || voucherDate,
        category: expenseAccount?.subcategory || 'Miscellaneous',
        itemName: expenseAccount?.name || 'Journal Expense',
        description: String(expenseRow.description || narration || '').trim() || 'Inferred from journal entry',
        amount: Number(expenseRow.debit) || 0,
        expenseAccountCode: expenseAccount?.code || expenseRow.accountCode,
        expenseAccountName: expenseAccount ? `${expenseAccount.code} - ${expenseAccount.name}` : expenseRow.accountCode,
        paymentMode,
        paymentAccountCode: paymentMode === 'credit' ? '' : (paymentAccount?.code || ''),
        paymentAccountName: paymentMode === 'credit' ? '' : (paymentAccount ? `${paymentAccount.code} - ${paymentAccount.name}` : ''),
        payableAccountCode: paymentMode === 'credit' ? (paymentAccount?.code || '') : '',
        payableAccountName: paymentMode === 'credit' ? (paymentAccount ? `${paymentAccount.code} - ${paymentAccount.name}` : '') : '',
        reference,
        voucherNo,
        cashBankTransactionId: '',
        status: 'posted',
        origin: 'journal_inferred',
        createdAt: voucherCreatedAt,
        updatedAt: voucherCreatedAt,
      }, Date.now() + inferred.length))
    })
  })

  return inferred
}

export function loadAccountsExpensesFromStorage() {
  const stored = loadStoredExpensesFromStorage()
  const inferred = buildInferredExpensesFromLedger(stored)
  const refreshed = refreshExpenseAccountNames([...stored, ...inferred])
  return refreshed.sort((a, b) => toTimeMs(b.createdAt, 0) - toTimeMs(a.createdAt, 0))
}

export function saveAccountsExpensesToStorage(items) {
  const normalized = Array.isArray(items)
    ? items
      .filter((item) => String(item?.origin || 'module').trim().toLowerCase() !== 'journal_inferred')
      .map((item, index) => normalizeAccountsExpense(item, Date.now() + index))
    : []
  setStorageValue(ACCOUNTS_EXPENSES_STORAGE_KEY, JSON.stringify(normalized))
}

function buildExpenseNarration({ category, itemName, description }) {
  const cleanCategory = normalizeExpenseCategory(category)
  const cleanItem = String(itemName || '').trim()
  const cleanDescription = String(description || '').trim()

  if (cleanItem && cleanDescription) return `${cleanItem} - ${cleanDescription} (${cleanCategory})`
  if (cleanItem) return `${cleanItem} (${cleanCategory})`
  if (cleanDescription) return `${cleanDescription} (${cleanCategory})`
  return `${cleanCategory} expense`
}

export function createAccountsExpenseTransaction({
  date,
  category = 'Miscellaneous',
  itemName = '',
  description = '',
  amount,
  expenseAccountCode,
  paymentMode = 'petty_cash',
  paymentAccountCode = '',
  payableAccountCode = '',
  reference = '',
  user = 'system',
}) {
  const cleanDate = String(date || '').trim()
  if (!cleanDate) throw new Error('Date is required')

  const amountValue = Math.max(0, toMoney(Number(amount) || 0))
  if (amountValue <= 0) throw new Error('Amount must be greater than zero')

  const accounts = loadChartAccountsFromStorage()
  const accountByCode = new Map(accounts.filter((item) => !item.deletedAt).map((item) => [item.code, item]))
  const expenseAccount = assertPostingAccount(expenseAccountCode, accountByCode, accounts, 'Expense account')
  if (expenseAccount.type !== 'Expenses') throw new Error('Expense account must belong to Expenses')

  const cleanPaymentMode = normalizeExpensePaymentMode(paymentMode)
  const cleanCategory = normalizeExpenseCategory(category)
  const cleanReference = String(reference || '').trim()
  const narration = buildExpenseNarration({
    category: cleanCategory,
    itemName,
    description,
  })

  let voucherNo = ''
  let cashBankTransactionId = ''
  let paymentAccount = null
  let payableAccount = null

  if (cleanPaymentMode === 'credit') {
    payableAccount = assertPostingAccount(payableAccountCode, accountByCode, accounts, 'Payable account')
    if (payableAccount.type !== 'Liabilities') throw new Error('Payable account must belong to Liabilities')
    const posting = postJournalRows({
      date: cleanDate,
      narration,
      description: narration,
      reference: cleanReference,
      rows: [
        { accountCode: expenseAccount.code, debit: amountValue, credit: 0 },
        { accountCode: payableAccount.code, debit: 0, credit: amountValue },
      ],
      liabilityPlan: {
        source: 'expenses_module',
        paymentMode: cleanPaymentMode,
        amount: amountValue,
      },
      user,
      source: 'expenses_module_credit',
    })
    voucherNo = posting.voucherId
  } else {
    const allowedKinds = cleanPaymentMode === 'bank'
      ? ['bank']
      : cleanPaymentMode === 'cash'
        ? ['cash']
        : ['petty-cash', 'cash']
    paymentAccount = assertCurrentAssetCashBank(
      paymentAccountCode,
      accountByCode,
      accounts,
      cleanPaymentMode === 'bank' ? 'Bank account' : cleanPaymentMode === 'cash' ? 'Cash account' : 'Petty cash account',
      allowedKinds,
    )

    if (cleanPaymentMode === 'petty_cash') {
      const result = createCashBankTransaction({
        transactionType: 'petty_cash_expense',
        date: cleanDate,
        amount: amountValue,
        pettyCashAccountCode: paymentAccount.code,
        expenseAccountCode: expenseAccount.code,
        reference: cleanReference,
        description: narration,
        origin: 'expenses_module',
        user,
      })
      voucherNo = result.voucherId
      cashBankTransactionId = result.transaction.id
    } else {
      const result = createCashBankTransaction({
        transactionType: 'cash_payment',
        date: cleanDate,
        amount: amountValue,
        accountCode: paymentAccount.code,
        counterAccountCode: expenseAccount.code,
        reference: cleanReference,
        description: narration,
        origin: 'expenses_module',
        user,
      })
      voucherNo = result.voucherId
      cashBankTransactionId = result.transaction.id
    }
  }

  const records = loadStoredExpensesFromStorage().map((item) => ({ ...item }))
  const now = nowIso()
  const expense = normalizeAccountsExpense({
    id: computeNextExpenseId(records),
    date: cleanDate,
    category: cleanCategory,
    itemName: String(itemName || '').trim(),
    description: String(description || '').trim(),
    amount: amountValue,
    expenseAccountCode: expenseAccount.code,
    expenseAccountName: `${expenseAccount.code} - ${expenseAccount.name}`,
    paymentMode: cleanPaymentMode,
    paymentAccountCode: paymentAccount?.code || '',
    paymentAccountName: paymentAccount ? `${paymentAccount.code} - ${paymentAccount.name}` : '',
    payableAccountCode: payableAccount?.code || '',
    payableAccountName: payableAccount ? `${payableAccount.code} - ${payableAccount.name}` : '',
    reference: cleanReference,
    voucherNo,
    cashBankTransactionId,
    status: 'posted',
    createdAt: now,
    updatedAt: now,
  }, Date.now())

  records.unshift(expense)
  saveAccountsExpensesToStorage(records)
  appendAuditLog({
    action: 'EXPENSE_CREATED',
    entity: 'EXPENSE',
    entityCode: expense.id,
    note: `Posted expense ${expense.id} (voucher ${voucherNo})`,
    user,
    meta: {
      amount: amountValue,
      paymentMode: cleanPaymentMode,
      expenseAccountCode: expense.expenseAccountCode,
      paymentAccountCode: expense.paymentAccountCode,
      payableAccountCode: expense.payableAccountCode,
      voucherNo,
      cashBankTransactionId,
    },
  })

  return { expense, voucherNo, cashBankTransactionId }
}

export function getAccountsExpenseSummary({ fromDate = '', toDate = '' } = {}) {
  const startDate = normalizeDateRangeValue(fromDate)
  const endDate = normalizeDateRangeValue(toDate)
  const records = loadAccountsExpensesFromStorage().filter((item) => {
    if (!startDate && !endDate) return true
    return isDateWithinRange(item.date, startDate, endDate)
  })

  const totalsByMode = {
    petty_cash: 0,
    cash: 0,
    bank: 0,
    credit: 0,
  }
  const totalsByCategory = new Map()

  records.forEach((item) => {
    const amount = Math.max(0, toMoney(Number(item.amount) || 0))
    const mode = normalizeExpensePaymentMode(item.paymentMode)
    totalsByMode[mode] = toMoney(totalsByMode[mode] + amount)
    const category = normalizeExpenseCategory(item.category)
    totalsByCategory.set(category, toMoney((totalsByCategory.get(category) || 0) + amount))
  })

  return {
    total: toMoney(records.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)),
    count: records.length,
    totalsByMode,
    totalsByCategory: Array.from(totalsByCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  }
}

function normalizePettyCashCycle(value) {
  const clean = String(value || '').trim().toLowerCase()
  if (clean === 'daily' || clean === 'weekly' || clean === 'custom') return clean
  return 'weekly'
}

function normalizePettyCashSetup(record, fallbackId = Date.now()) {
  const createdAt = toIso(record?.createdAt, nowIso())
  const cycle = normalizePettyCashCycle(record?.replenishmentCycle)
  return {
    id: String(record?.id || `PCS-${fallbackId}`).trim(),
    pettyCashAccountCode: String(record?.pettyCashAccountCode || '').trim(),
    pettyCashAccountName: String(record?.pettyCashAccountName || '').trim(),
    fundingAccountCode: String(record?.fundingAccountCode || '').trim(),
    fundingAccountName: String(record?.fundingAccountName || '').trim(),
    fixedAmount: Math.max(0, toMoney(Number(record?.fixedAmount) || 0)),
    replenishmentCycle: cycle,
    customCycleDays: cycle === 'custom' ? Math.max(1, Math.round(Number(record?.customCycleDays) || 1)) : 0,
    approvalRequired: record?.approvalRequired === true,
    autoReplenish: record?.autoReplenish === true,
    lastReplenishedAt: record?.lastReplenishedAt ? toIso(record.lastReplenishedAt, createdAt) : null,
    lastAutoRunAt: record?.lastAutoRunAt ? toIso(record.lastAutoRunAt, createdAt) : null,
    createdAt,
    updatedAt: toIso(record?.updatedAt, createdAt),
    deletedAt: record?.deletedAt ? toIso(record.deletedAt, nowIso()) : null,
  }
}

function refreshPettyCashSetupNames(items, accounts = loadChartAccountsFromStorage()) {
  const byCode = new Map(accounts.filter((item) => !item.deletedAt).map((item) => [item.code, item]))
  return items.map((item) => {
    const petty = byCode.get(item.pettyCashAccountCode)
    const funding = byCode.get(item.fundingAccountCode)
    return {
      ...item,
      pettyCashAccountName: petty ? `${petty.code} - ${petty.name}` : item.pettyCashAccountName,
      fundingAccountName: funding ? `${funding.code} - ${funding.name}` : item.fundingAccountName,
    }
  })
}

export function loadPettyCashSetupsFromStorage() {
  const raw = getStorageValue(PETTY_CASH_SETUPS_STORAGE_KEY, null)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const normalized = parsed
      .map((item, index) => normalizePettyCashSetup(item, Date.now() + index))
      .filter((item) => !item.deletedAt)
    return refreshPettyCashSetupNames(normalized)
      .sort((a, b) => toTimeMs(b.updatedAt, 0) - toTimeMs(a.updatedAt, 0))
  } catch {
    return []
  }
}

export function savePettyCashSetupsToStorage(items) {
  const normalized = Array.isArray(items)
    ? items.map((item, index) => normalizePettyCashSetup(item, Date.now() + index))
    : []
  setStorageValue(PETTY_CASH_SETUPS_STORAGE_KEY, JSON.stringify(normalized))
}

function getPettyCycleDays(setup) {
  if (setup.replenishmentCycle === 'daily') return 1
  if (setup.replenishmentCycle === 'weekly') return 7
  return Math.max(1, Number(setup.customCycleDays) || 1)
}

function calculatePettyReplenishmentAmount({ pettyCashAccountCode, fixedAmount, accounts = loadChartAccountsFromStorage() }) {
  const petty = accounts.find((item) => item.code === pettyCashAccountCode && !item.deletedAt)
  const current = Math.max(0, toMoney(Number(petty?.balance) || 0))
  const fixed = Math.max(0, toMoney(Number(fixedAmount) || 0))
  return {
    currentBalance: current,
    replenishmentAmount: Math.max(0, toMoney(fixed - current)),
  }
}

export function loadPettyCashSetupsWithBalances() {
  const accounts = loadChartAccountsFromStorage()
  const setups = loadPettyCashSetupsFromStorage()

  return setups.map((setup) => {
    const { currentBalance, replenishmentAmount } = calculatePettyReplenishmentAmount({
      pettyCashAccountCode: setup.pettyCashAccountCode,
      fixedAmount: setup.fixedAmount,
      accounts,
    })
    const utilization = setup.fixedAmount > 0
      ? Math.max(0, Math.min(100, toMoney(((setup.fixedAmount - currentBalance) / setup.fixedAmount) * 100)))
      : 0

    return {
      ...setup,
      currentBalance,
      replenishmentAmount,
      utilization,
      dueForReplenishment: replenishmentAmount > 0,
    }
  })
}

export function upsertPettyCashSetup({
  setupId = '',
  pettyCashAccountCode,
  fundingAccountCode,
  fixedAmount,
  replenishmentCycle = 'weekly',
  customCycleDays = 0,
  approvalRequired = false,
  autoReplenish = false,
  fundImmediately = false,
  date = '',
  reference = '',
  description = '',
  user = 'system',
}) {
  const amount = Math.max(0, toMoney(Number(fixedAmount) || 0))
  if (amount <= 0) throw new Error('Fixed petty cash amount must be greater than zero')

  const accounts = loadChartAccountsFromStorage()
  const byCode = new Map(accounts.filter((item) => !item.deletedAt).map((item) => [item.code, item]))
  const pettyAccount = assertCurrentAssetCashBank(pettyCashAccountCode, byCode, accounts, 'Petty cash account', ['petty-cash', 'cash'])
  const fundingAccount = assertCurrentAssetCashBank(fundingAccountCode, byCode, accounts, 'Funding account', ['cash', 'bank'])
  if (pettyAccount.code === fundingAccount.code) throw new Error('Funding account must be different from petty cash account')

  const setups = loadPettyCashSetupsFromStorage().map((item) => ({ ...item }))
  const cleanSetupId = String(setupId || '').trim()
  const existingIndex = cleanSetupId
    ? setups.findIndex((item) => item.id === cleanSetupId)
    : setups.findIndex((item) => item.pettyCashAccountCode === pettyAccount.code)

  const now = nowIso()
  const previous = existingIndex >= 0 ? setups[existingIndex] : null
  const cycle = normalizePettyCashCycle(replenishmentCycle)
  const next = normalizePettyCashSetup({
    id: previous?.id || `PCS-${Date.now()}`,
    pettyCashAccountCode: pettyAccount.code,
    pettyCashAccountName: `${pettyAccount.code} - ${pettyAccount.name}`,
    fundingAccountCode: fundingAccount.code,
    fundingAccountName: `${fundingAccount.code} - ${fundingAccount.name}`,
    fixedAmount: amount,
    replenishmentCycle: cycle,
    customCycleDays: cycle === 'custom' ? Math.max(1, Math.round(Number(customCycleDays) || 1)) : 0,
    approvalRequired: approvalRequired === true,
    autoReplenish: autoReplenish === true,
    lastReplenishedAt: previous?.lastReplenishedAt || null,
    lastAutoRunAt: previous?.lastAutoRunAt || null,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  }, Date.now())

  if (existingIndex >= 0) setups[existingIndex] = next
  else setups.unshift(next)

  let fundingVoucherNo = ''
  if (fundImmediately) {
    const { replenishmentAmount } = calculatePettyReplenishmentAmount({
      pettyCashAccountCode: pettyAccount.code,
      fixedAmount: amount,
      accounts,
    })
    if (replenishmentAmount > 0) {
      const result = createCashBankTransaction({
        transactionType: 'petty_cash_fund',
        date: String(date || '').trim() || now.slice(0, 10),
        amount: replenishmentAmount,
        accountCode: fundingAccount.code,
        pettyCashAccountCode: pettyAccount.code,
        reference: String(reference || '').trim(),
        description: String(description || '').trim() || `Initial petty cash funding (${pettyAccount.name})`,
        user,
      })
      fundingVoucherNo = result.voucherId
      const targetIndex = setups.findIndex((item) => item.id === next.id)
      if (targetIndex >= 0) {
        setups[targetIndex] = {
          ...setups[targetIndex],
          lastReplenishedAt: nowIso(),
          updatedAt: nowIso(),
        }
      }
    }
  }

  savePettyCashSetupsToStorage(setups)
  appendAuditLog({
    action: existingIndex >= 0 ? 'PETTY_CASH_SETUP_UPDATED' : 'PETTY_CASH_SETUP_CREATED',
    entity: 'PETTY_CASH_SETUP',
    entityCode: next.id,
    note: `${existingIndex >= 0 ? 'Updated' : 'Created'} petty cash setup for ${pettyAccount.code}`,
    user,
    meta: {
      fixedAmount: amount,
      fundingAccountCode: fundingAccount.code,
      pettyCashAccountCode: pettyAccount.code,
      replenishmentCycle: cycle,
      autoReplenish: next.autoReplenish,
      approvalRequired: next.approvalRequired,
      fundingVoucherNo,
    },
  })

  return { setup: next, fundingVoucherNo }
}

export function replenishPettyCashSetup({
  setupId,
  date = '',
  reference = '',
  description = '',
  user = 'system',
}) {
  const cleanId = String(setupId || '').trim()
  if (!cleanId) throw new Error('Setup id is required')

  const setups = loadPettyCashSetupsFromStorage().map((item) => ({ ...item }))
  const targetIndex = setups.findIndex((item) => item.id === cleanId)
  if (targetIndex < 0) throw new Error('Petty cash setup not found')
  const target = setups[targetIndex]

  const accounts = loadChartAccountsFromStorage()
  const byCode = new Map(accounts.filter((item) => !item.deletedAt).map((item) => [item.code, item]))
  const pettyAccount = assertCurrentAssetCashBank(target.pettyCashAccountCode, byCode, accounts, 'Petty cash account', ['petty-cash', 'cash'])
  const fundingAccount = assertCurrentAssetCashBank(target.fundingAccountCode, byCode, accounts, 'Funding account', ['cash', 'bank'])

  const { replenishmentAmount } = calculatePettyReplenishmentAmount({
    pettyCashAccountCode: target.pettyCashAccountCode,
    fixedAmount: target.fixedAmount,
    accounts,
  })
  if (replenishmentAmount <= 0) throw new Error('Petty cash is already at fixed level')

  const result = createCashBankTransaction({
    transactionType: 'petty_cash_fund',
    date: String(date || '').trim() || nowIso().slice(0, 10),
    amount: replenishmentAmount,
    accountCode: fundingAccount.code,
    pettyCashAccountCode: pettyAccount.code,
    reference: String(reference || '').trim(),
    description: String(description || '').trim() || `Petty cash replenishment (${pettyAccount.name})`,
    user,
  })

  const now = nowIso()
  setups[targetIndex] = {
    ...target,
    lastReplenishedAt: now,
    updatedAt: now,
  }
  savePettyCashSetupsToStorage(setups)
  appendAuditLog({
    action: 'PETTY_CASH_REPLENISHED',
    entity: 'PETTY_CASH_SETUP',
    entityCode: target.id,
    note: `Replenished petty cash ${target.pettyCashAccountCode}`,
    user,
    meta: {
      voucherNo: result.voucherId,
      amount: replenishmentAmount,
    },
  })

  return {
    setup: setups[targetIndex],
    replenishmentAmount,
    voucherNo: result.voucherId,
  }
}

function isPettyCashSetupDue(setup, todayIso) {
  const base = setup.lastReplenishedAt || setup.updatedAt || setup.createdAt
  const baseDate = String(base || '').slice(0, 10)
  const baseMs = parseDateOnlyMs(baseDate)
  const todayMs = parseDateOnlyMs(todayIso)
  if (!Number.isFinite(baseMs) || !Number.isFinite(todayMs)) return true
  const dueMs = baseMs + (getPettyCycleDays(setup) * 24 * 60 * 60 * 1000)
  return todayMs >= dueMs
}

export function runAutoPettyCashReplenishment({ asOfDate = '', user = 'system' } = {}) {
  const todayIso = String(asOfDate || '').trim() || nowIso().slice(0, 10)
  const setups = loadPettyCashSetupsFromStorage()
  const dueSetups = setups.filter((setup) => setup.autoReplenish && isPettyCashSetupDue(setup, todayIso))
  if (dueSetups.length === 0) return { processed: 0, vouchers: [] }

  const vouchers = []
  dueSetups.forEach((setup) => {
    try {
      const result = replenishPettyCashSetup({
        setupId: setup.id,
        date: todayIso,
        description: `Auto replenishment (${setup.replenishmentCycle})`,
        user,
      })
      vouchers.push(result.voucherNo)
    } catch {
      // Ignore setups already at fixed level or with invalid data.
    }
  })

  if (vouchers.length > 0) {
    const latest = loadPettyCashSetupsFromStorage().map((item) => ({ ...item }))
    const now = nowIso()
    const dueIds = new Set(dueSetups.map((item) => item.id))
    const next = latest.map((setup) => (
      dueIds.has(setup.id)
        ? { ...setup, lastAutoRunAt: now, updatedAt: now }
        : setup
    ))
    savePettyCashSetupsToStorage(next)
  }

  return { processed: vouchers.length, vouchers }
}

