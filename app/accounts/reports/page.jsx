'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AccountLayout from '@/presentation/layouts/AccountLayout'
import {
  adjustBalanceByEntryType,
  isPostableAccount,
  loadAccountsExpensesFromStorage,
  loadAccountsPayableFromStorage,
  loadAccountsReceivableFromStorage,
  loadCashBankAccountsFromChart,
  loadChartAccountsFromStorage,
  loadLedgerEntriesFromStorage,
} from '@/application/services/accounts/accountsWorkflow'
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  Download,
  Droplets,
  FileText,
  Landmark,
  Printer,
  RefreshCcw,
  Scale,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { addPdfReportHeader, getUserDisplayName, loadImageDataUrl } from '@/lib/reportDesign'

const REPORT_TYPES = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'trial-balance', label: 'Trial Balance', icon: Scale },
  { id: 'income-statement', label: 'Income Statement', icon: TrendingUp },
  { id: 'balance-sheet', label: 'Balance Sheet', icon: Building2 },
  { id: 'cash-flow', label: 'Cash Flow', icon: Droplets },
  { id: 'day-book', label: 'Day Book', icon: FileText },
  { id: 'supplier-ledger', label: 'Supplier Ledger', icon: Users },
  { id: 'customer-ledger', label: 'Customer Ledger', icon: Users },
  { id: 'general-ledger', label: 'General Ledger', icon: BookOpen },
]

const DEBIT_INCREASE_TYPES = new Set(['Assets', 'Expenses'])

const toMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100
const todayISO = () => new Date().toISOString().slice(0, 10)
const monthStartISO = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function parseDateOnlyMs(value) {
  const clean = String(value || '').trim()
  if (!clean) return NaN
  const parsed = Date.parse(`${clean}T00:00:00`)
  return Number.isFinite(parsed) ? parsed : NaN
}

function isDateInRange(dateValue, fromDate, toDate) {
  const dateMs = parseDateOnlyMs(dateValue)
  if (!Number.isFinite(dateMs)) return false
  const fromMs = parseDateOnlyMs(fromDate)
  const toMs = parseDateOnlyMs(toDate)
  if (Number.isFinite(fromMs) && dateMs < fromMs) return false
  if (Number.isFinite(toMs) && dateMs > toMs) return false
  return true
}

function isDateBefore(dateValue, pivotDate) {
  const dateMs = parseDateOnlyMs(dateValue)
  const pivotMs = parseDateOnlyMs(pivotDate)
  if (!Number.isFinite(dateMs) || !Number.isFinite(pivotMs)) return false
  return dateMs < pivotMs
}

function isDateOnOrBefore(dateValue, pivotDate) {
  if (!pivotDate) return true
  const dateMs = parseDateOnlyMs(dateValue)
  const pivotMs = parseDateOnlyMs(pivotDate)
  if (!Number.isFinite(dateMs) || !Number.isFinite(pivotMs)) return false
  return dateMs <= pivotMs
}

function formatMoney(value) {
  const amount = toMoney(value)
  return `Rs ${amount.toLocaleString()}`
}

function formatDateTime(value) {
  const ms = Date.parse(String(value || ''))
  if (!Number.isFinite(ms)) return '-'
  return new Date(ms).toLocaleString()
}

function sortByCode(a, b) {
  return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true })
}

function sortLedgerRows(a, b) {
  if (a.date !== b.date) return String(a.date || '').localeCompare(String(b.date || ''))
  const createdA = Date.parse(String(a.createdAt || ''))
  const createdB = Date.parse(String(b.createdAt || ''))
  if (Number.isFinite(createdA) && Number.isFinite(createdB) && createdA !== createdB) return createdA - createdB
  if (String(a.voucherNo || '') !== String(b.voucherNo || '')) return String(a.voucherNo || '').localeCompare(String(b.voucherNo || ''))
  return String(a.accountCode || '').localeCompare(String(b.accountCode || ''))
}

function splitBalanceToDebitCredit(accountType, balance) {
  const amount = toMoney(balance)
  if (Math.abs(amount) <= 0.0001) return { debit: 0, credit: 0 }
  if (DEBIT_INCREASE_TYPES.has(accountType)) {
    return amount >= 0 ? { debit: amount, credit: 0 } : { debit: 0, credit: Math.abs(amount) }
  }
  return amount >= 0 ? { debit: 0, credit: amount } : { debit: Math.abs(amount), credit: 0 }
}

function csvEscape(value) {
  const raw = String(value == null ? '' : value)
  const trimmed = raw.trimStart()
  const formulaLike = trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')
  const safeRaw = formulaLike ? `'${raw}` : raw
  if (!safeRaw.includes(',') && !safeRaw.includes('"') && !safeRaw.includes('\n')) return safeRaw
  return `"${safeRaw.replace(/"/g, '""')}"`
}

function rowsToCsvWithPattern(columns, rows) {
  if (!Array.isArray(columns) || columns.length === 0) return ''
  const headers = columns.map((column) => csvEscape(column.label)).join(',')
  if (!Array.isArray(rows) || rows.length === 0) return `${headers}\n`
  const lines = [headers]
  rows.forEach((row) => {
    lines.push(columns.map((column) => csvEscape(row[column.key])).join(','))
  })
  return `${lines.join('\n')}\n`
}

function downloadBlob(fileName, text, mimeType) {
  if (typeof window === 'undefined') return
  const blob = new Blob([text], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function classifyCashFlowBucket(voucherRows, accountByCode, cashAccountCodes) {
  const nonCashRows = voucherRows.filter((row) => !cashAccountCodes.has(row.accountCode))
  const nonCashAccounts = nonCashRows.map((row) => accountByCode.get(row.accountCode)).filter(Boolean)

  if (nonCashAccounts.some((account) => account.type === 'Assets' && account.subcategory === 'Non-Current Assets')) return 'investing'
  if (nonCashAccounts.some((account) => account.type === 'Equity')) return 'financing'
  if (nonCashAccounts.some((account) => account.type === 'Liabilities' && account.subcategory === 'Non-Current Liabilities')) return 'financing'
  return 'operating'
}

function safeReportName(activeReport) {
  return String(activeReport || 'report').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'report'
}

function parseCurrencyNumber(value) {
  const raw = String(value == null ? '' : value).trim()
  if (!raw) return NaN
  const normalized = raw
    .replace(/rs\.?/gi, '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
  return Number(normalized)
}

function formatExportAmount(value) {
  return `Rs. ${toMoney(value).toFixed(2)}`
}

function formatPdfAmount(value) {
  return toMoney(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPdfCellValue(value, column) {
  if (value == null) return ''
  const raw = String(value)
  if (column?.align !== 'right') return raw

  const parsed = parseCurrencyNumber(raw)
  if (!Number.isFinite(parsed)) return raw
  return `Rs. ${formatPdfAmount(parsed)}`
}

function safeKey(value, fallback = 'all') {
  const clean = String(value || '').trim()
  if (!clean) return fallback
  return clean.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || fallback
}

function exportTimestamp() {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${min}`
}

function buildExportFileName(activeReport, fromDate, toDate, extension, selectedAccountCode = '') {
  const reportPart = safeReportName(activeReport)
  const fromPart = safeKey(fromDate, 'start')
  const toPart = safeKey(toDate, 'end')
  const accountPart = activeReport === 'general-ledger' && selectedAccountCode
    ? `-${safeKey(selectedAccountCode, 'account')}`
    : ''
  return `${reportPart}${accountPart}-${fromPart}-${toPart}-${exportTimestamp()}.${extension}`
}

function buildReportExportPattern(activeReport, reportData, fromDate, toDate) {
  if (activeReport === 'overview') {
    return {
      orientation: 'portrait',
      columns: [
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value', align: 'right' },
      ],
      rows: [
        { metric: 'Period From', value: fromDate || '-' },
        { metric: 'Period To', value: toDate || '-' },
        { metric: 'Total Assets', value: formatExportAmount(reportData.overview.totalAssets) },
        { metric: 'Total Liabilities', value: formatExportAmount(reportData.overview.totalLiabilities) },
        { metric: 'Total Equity', value: formatExportAmount(reportData.overview.totalEquity) },
        { metric: 'Net Profit', value: formatExportAmount(reportData.overview.netProfit) },
        { metric: 'Cash Balance', value: formatExportAmount(reportData.overview.cashBalance) },
        { metric: 'AP Outstanding', value: formatExportAmount(reportData.overview.apOutstanding) },
        { metric: 'AR Outstanding', value: formatExportAmount(reportData.overview.arOutstanding) },
        { metric: 'Balance Difference', value: formatExportAmount(reportData.overview.balanceDifference) },
      ],
    }
  }

  if (activeReport === 'trial-balance') {
    return {
      orientation: 'landscape',
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Account' },
        { key: 'type', label: 'Type' },
        { key: 'subcategory', label: 'Subcategory' },
        { key: 'debit', label: 'Debit', align: 'right' },
        { key: 'credit', label: 'Credit', align: 'right' },
      ],
      rows: [
        ...reportData.trialBalanceRows.map((row) => ({
          code: row.code,
          name: row.name,
          type: row.type,
          subcategory: row.subcategory || '-',
          debit: formatExportAmount(row.debit),
          credit: formatExportAmount(row.credit),
        })),
        {
          code: '',
          name: 'Total',
          type: '',
          subcategory: '',
          debit: formatExportAmount(reportData.trialTotals.debit),
          credit: formatExportAmount(reportData.trialTotals.credit),
          _summary: true,
        },
      ],
    }
  }

  if (activeReport === 'income-statement') {
    return {
      orientation: 'portrait',
      columns: [
        { key: 'section', label: 'Section' },
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Account' },
        { key: 'amount', label: 'Amount', align: 'right' },
      ],
      rows: [
        ...reportData.incomeStatement.revenueRows.map((row) => ({
          section: 'Revenue',
          code: row.code,
          name: row.name,
          amount: formatExportAmount(row.amount),
        })),
        ...reportData.incomeStatement.expenseRows.map((row) => ({
          section: 'Expense',
          code: row.code,
          name: row.name,
          amount: formatExportAmount(row.amount),
        })),
        {
          section: 'Summary',
          code: '',
          name: 'Total Revenue',
          amount: formatExportAmount(reportData.incomeStatement.totalRevenue),
          _summary: true,
        },
        {
          section: 'Summary',
          code: '',
          name: 'Total Expenses',
          amount: formatExportAmount(reportData.incomeStatement.totalExpenses),
          _summary: true,
        },
        {
          section: 'Summary',
          code: '',
          name: 'Net Profit',
          amount: formatExportAmount(reportData.incomeStatement.netProfit),
          _summary: true,
        },
      ],
    }
  }

  if (activeReport === 'balance-sheet') {
    return {
      orientation: 'portrait',
      columns: [
        { key: 'section', label: 'Section' },
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Account' },
        { key: 'amount', label: 'Amount', align: 'right' },
      ],
      rows: [
        ...reportData.balanceSheet.assetRows.map((row) => ({
          section: 'Asset',
          code: row.code,
          name: row.name,
          amount: formatExportAmount(row.amount),
        })),
        ...reportData.balanceSheet.liabilityRows.map((row) => ({
          section: 'Liability',
          code: row.code,
          name: row.name,
          amount: formatExportAmount(row.amount),
        })),
        ...reportData.balanceSheet.equityRows.map((row) => ({
          section: 'Equity',
          code: row.code,
          name: row.name,
          amount: formatExportAmount(row.amount),
        })),
        {
          section: 'Summary',
          code: '',
          name: 'Total Assets',
          amount: formatExportAmount(reportData.balanceSheet.totalAssets),
          _summary: true,
        },
        {
          section: 'Summary',
          code: '',
          name: 'Liabilities + Equity',
          amount: formatExportAmount(reportData.balanceSheet.liabilityAndEquity),
          _summary: true,
        },
        {
          section: 'Summary',
          code: '',
          name: 'Difference',
          amount: formatExportAmount(reportData.balanceSheet.difference),
          _summary: true,
        },
      ],
    }
  }

  if (activeReport === 'cash-flow') {
    return {
      orientation: 'landscape',
      columns: [
        { key: 'bucket', label: 'Bucket' },
        { key: 'date', label: 'Date' },
        { key: 'voucherNo', label: 'Voucher' },
        { key: 'source', label: 'Source' },
        { key: 'description', label: 'Description' },
        { key: 'inflow', label: 'Inflow', align: 'right' },
        { key: 'outflow', label: 'Outflow', align: 'right' },
        { key: 'net', label: 'Net', align: 'right' },
      ],
      rows: [
        ...reportData.cashFlow.operatingRows.map((row) => ({
          bucket: 'Operating',
          date: row.date,
          voucherNo: row.voucherNo,
          source: row.source || '-',
          description: row.description,
          inflow: formatExportAmount(row.inflow),
          outflow: formatExportAmount(row.outflow),
          net: formatExportAmount(row.net),
        })),
        ...reportData.cashFlow.investingRows.map((row) => ({
          bucket: 'Investing',
          date: row.date,
          voucherNo: row.voucherNo,
          source: row.source || '-',
          description: row.description,
          inflow: formatExportAmount(row.inflow),
          outflow: formatExportAmount(row.outflow),
          net: formatExportAmount(row.net),
        })),
        ...reportData.cashFlow.financingRows.map((row) => ({
          bucket: 'Financing',
          date: row.date,
          voucherNo: row.voucherNo,
          source: row.source || '-',
          description: row.description,
          inflow: formatExportAmount(row.inflow),
          outflow: formatExportAmount(row.outflow),
          net: formatExportAmount(row.net),
        })),
        {
          bucket: 'Summary',
          date: '',
          voucherNo: '',
          source: '',
          description: 'Opening Cash',
          inflow: '',
          outflow: '',
          net: formatExportAmount(reportData.cashFlow.openingCash),
          _summary: true,
        },
        {
          bucket: 'Summary',
          date: '',
          voucherNo: '',
          source: '',
          description: 'Closing Cash',
          inflow: '',
          outflow: '',
          net: formatExportAmount(reportData.cashFlow.closingCash),
          _summary: true,
        },
        {
          bucket: 'Summary',
          date: '',
          voucherNo: '',
          source: '',
          description: 'Operating Net',
          inflow: '',
          outflow: '',
          net: formatExportAmount(reportData.cashFlow.operatingNet),
          _summary: true,
        },
        {
          bucket: 'Summary',
          date: '',
          voucherNo: '',
          source: '',
          description: 'Investing Net',
          inflow: '',
          outflow: '',
          net: formatExportAmount(reportData.cashFlow.investingNet),
          _summary: true,
        },
        {
          bucket: 'Summary',
          date: '',
          voucherNo: '',
          source: '',
          description: 'Financing Net',
          inflow: '',
          outflow: '',
          net: formatExportAmount(reportData.cashFlow.financingNet),
          _summary: true,
        },
        {
          bucket: 'Summary',
          date: '',
          voucherNo: '',
          source: '',
          description: 'Net Movement',
          inflow: '',
          outflow: '',
          net: formatExportAmount(reportData.cashFlow.netMovement),
          _summary: true,
        },
      ],
    }
  }

  if (activeReport === 'day-book') {
    return {
      orientation: 'landscape',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'voucherNo', label: 'Voucher' },
        { key: 'source', label: 'Source' },
        { key: 'description', label: 'Description' },
        { key: 'reference', label: 'Reference' },
        { key: 'debit', label: 'Debit', align: 'right' },
        { key: 'credit', label: 'Credit', align: 'right' },
      ],
      rows: [
        ...reportData.dayBookRows.map((row) => ({
          date: row.date,
          voucherNo: row.voucherNo,
          source: row.source || '-',
          description: row.description,
          reference: row.reference || '-',
          debit: formatExportAmount(row.totalDebit),
          credit: formatExportAmount(row.totalCredit),
        })),
        {
          date: '',
          voucherNo: '',
          source: '',
          description: 'Totals',
          reference: '',
          debit: formatExportAmount(reportData.dayBookRows.reduce((sum, row) => sum + (Number(row.totalDebit) || 0), 0)),
          credit: formatExportAmount(reportData.dayBookRows.reduce((sum, row) => sum + (Number(row.totalCredit) || 0), 0)),
          _summary: true,
        },
      ],
    }
  }

  if (activeReport === 'supplier-ledger') {
    return {
      orientation: 'landscape',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'transactionId', label: 'Transaction' },
        { key: 'supplierName', label: 'Supplier' },
        { key: 'voucherNo', label: 'Voucher' },
        { key: 'status', label: 'Status' },
        { key: 'totalCost', label: 'Total', align: 'right' },
        { key: 'paid', label: 'Paid', align: 'right' },
        { key: 'outstanding', label: 'Outstanding', align: 'right' },
      ],
      rows: [
        ...reportData.supplierRows.map((row) => ({
          date: row.date,
          transactionId: row.transactionId,
          supplierName: row.supplierName,
          voucherNo: row.voucherNo || '-',
          status: row.status || '-',
          totalCost: formatExportAmount(row.totalCost),
          paid: formatExportAmount(row.paid),
          outstanding: formatExportAmount(row.outstanding),
        })),
        {
          date: '',
          transactionId: '',
          supplierName: 'Total',
          voucherNo: '',
          status: '',
          totalCost: formatExportAmount(reportData.supplierTotals.purchases),
          paid: formatExportAmount(reportData.supplierTotals.paid),
          outstanding: formatExportAmount(reportData.supplierTotals.outstanding),
          _summary: true,
        },
      ],
    }
  }

  if (activeReport === 'customer-ledger') {
    return {
      orientation: 'landscape',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'transactionId', label: 'Transaction' },
        { key: 'customerName', label: 'Customer' },
        { key: 'voucherNo', label: 'Voucher' },
        { key: 'status', label: 'Status' },
        { key: 'totalSale', label: 'Sale', align: 'right' },
        { key: 'collected', label: 'Collected', align: 'right' },
        { key: 'outstanding', label: 'Outstanding', align: 'right' },
      ],
      rows: [
        ...reportData.customerRows.map((row) => ({
          date: row.date,
          transactionId: row.transactionId,
          customerName: row.customerName,
          voucherNo: row.voucherNo || '-',
          status: row.status || '-',
          totalSale: formatExportAmount(row.totalSale),
          collected: formatExportAmount(row.collected),
          outstanding: formatExportAmount(row.outstanding),
        })),
        {
          date: '',
          transactionId: '',
          customerName: 'Total',
          voucherNo: '',
          status: '',
          totalSale: formatExportAmount(reportData.customerTotals.sales),
          collected: formatExportAmount(reportData.customerTotals.collected),
          outstanding: formatExportAmount(reportData.customerTotals.outstanding),
          _summary: true,
        },
      ],
    }
  }

  if (activeReport === 'general-ledger') {
    return {
      orientation: 'landscape',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'voucherNo', label: 'Voucher' },
        { key: 'source', label: 'Source' },
        { key: 'description', label: 'Description' },
        { key: 'reference', label: 'Reference' },
        { key: 'debit', label: 'Debit', align: 'right' },
        { key: 'credit', label: 'Credit', align: 'right' },
        { key: 'runningBalance', label: 'Running Balance', align: 'right' },
      ],
      rows: [
        {
          date: '',
          voucherNo: '',
          source: '',
          description: `Opening Balance (${reportData.generalLedger.selected?.code || '-'})`,
          reference: '',
          debit: '',
          credit: '',
          runningBalance: formatExportAmount(reportData.generalLedger.openingBalance),
          _summary: true,
        },
        ...reportData.generalLedger.rows.map((row) => ({
          date: row.date,
          voucherNo: row.voucherNo,
          source: row.source || '-',
          description: row.description,
          reference: row.reference || '-',
          debit: formatExportAmount(row.debit),
          credit: formatExportAmount(row.credit),
          runningBalance: formatExportAmount(row.runningBalance),
        })),
        {
          date: '',
          voucherNo: '',
          source: '',
          description: 'Totals',
          reference: '',
          debit: formatExportAmount(reportData.generalLedger.totals.debit),
          credit: formatExportAmount(reportData.generalLedger.totals.credit),
          runningBalance: formatExportAmount(reportData.generalLedger.totals.closing),
          _summary: true,
        },
      ],
    }
  }

  return { orientation: 'portrait', columns: [], rows: [] }
}

export default function ReportsPage() {
  const { user } = useAuthStore()
  const generatedBy = getUserDisplayName(user)
  const [activeReport, setActiveReport] = useState('overview')
  const [fromDate, setFromDate] = useState(monthStartISO())
  const [toDate, setToDate] = useState(todayISO())
  const [selectedAccountCode, setSelectedAccountCode] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [noticeText, setNoticeText] = useState('')
  const [errorText, setErrorText] = useState('')
  const [snapshot, setSnapshot] = useState({
    accounts: [],
    ledger: [],
    payables: [],
    receivables: [],
    expenses: [],
    cashBankAccounts: [],
    updatedAt: '',
  })

  const refreshData = useCallback(() => {
    setRefreshing(true)
    try {
      const accounts = loadChartAccountsFromStorage().filter((account) => !account.deletedAt)
      const ledger = loadLedgerEntriesFromStorage()
        .filter((entry) => String(entry.status || '').toLowerCase() === 'posted' && !entry.deletedAt)
        .sort(sortLedgerRows)
      const payables = loadAccountsPayableFromStorage().filter((item) => !item.deletedAt)
      const receivables = loadAccountsReceivableFromStorage().filter((item) => !item.deletedAt)
      const expenses = loadAccountsExpensesFromStorage().filter((item) => !item.deletedAt)
      const cashBankAccounts = loadCashBankAccountsFromChart(accounts)

      setSnapshot({
        accounts,
        ledger,
        payables,
        receivables,
        expenses,
        cashBankAccounts,
        updatedAt: new Date().toISOString(),
      })
      setErrorText('')
    } catch (error) {
      setErrorText(error?.message || 'Unable to load reports data')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    refreshData()
    const interval = window.setInterval(refreshData, 5000)
    window.addEventListener('focus', refreshData)
    window.addEventListener('storage', refreshData)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshData)
      window.removeEventListener('storage', refreshData)
    }
  }, [refreshData])

  const reportData = useMemo(() => {
    const accounts = snapshot.accounts
    const ledger = snapshot.ledger
    const accountByCode = new Map(accounts.map((account) => [account.code, account]))
    const postableAccounts = accounts.filter((account) => isPostableAccount(account, accounts)).sort(sortByCode)
    const cashAccountCodes = new Set(snapshot.cashBankAccounts.map((account) => account.code))

    const ledgerInRange = ledger.filter((entry) => isDateInRange(entry.date, fromDate, toDate))
    const accountPeriodActivity = new Map()
    ledgerInRange.forEach((entry) => {
      const key = String(entry.accountCode || '').trim()
      if (!key) return
      const existing = accountPeriodActivity.get(key) || { debit: 0, credit: 0 }
      existing.debit = toMoney(existing.debit + (Number(entry.debit) || 0))
      existing.credit = toMoney(existing.credit + (Number(entry.credit) || 0))
      accountPeriodActivity.set(key, existing)
    })

    // Seed every account with its openingBalance field value.
    // Then accumulate only NON-opening-balance ledger entries (skip source='opening-balance'
    // because those journal entries were auto-posted to represent the same openingBalance field —
    // including them would double-count the opening balance).
    const closingBalanceByCode = new Map()
    postableAccounts.forEach((account) => {
      closingBalanceByCode.set(account.code, toMoney(Number(account.openingBalance) || 0))
    })
    ledger.forEach((entry) => {
      if (!isDateOnOrBefore(entry.date, toDate)) return
      // Skip opening-balance source entries — the openingBalance field already seeds the map above.
      if (String(entry.source || '').toLowerCase() === 'opening-balance') return
      const account = accountByCode.get(entry.accountCode)
      if (!account || !isPostableAccount(account, accounts)) return
      const current = toMoney(closingBalanceByCode.has(account.code) ? closingBalanceByCode.get(account.code) : 0)
      const next = toMoney(current + adjustBalanceByEntryType(account.type, Number(entry.debit) || 0, Number(entry.credit) || 0))
      closingBalanceByCode.set(account.code, next)
    })

    const trialBalanceRows = postableAccounts
      .map((account) => {
        const balance = toMoney(closingBalanceByCode.get(account.code) || 0)
        const split = splitBalanceToDebitCredit(account.type, balance)
        const periodActivity = accountPeriodActivity.get(account.code) || { debit: 0, credit: 0 }
        const openingBalance = toMoney(Number(account.openingBalance) || 0)
        const shouldShow = split.debit > 0 || split.credit > 0 || periodActivity.debit > 0 || periodActivity.credit > 0 || Math.abs(openingBalance) > 0
        if (!shouldShow) return null
        return {
          code: account.code,
          name: account.name,
          type: account.type,
          subcategory: account.subcategory || '',
          openingBalance,
          debit: split.debit,
          credit: split.credit,
          balance,
        }
      })
      .filter(Boolean)
      .sort(sortByCode)

    const trialTotals = trialBalanceRows.reduce((sum, row) => ({
      debit: toMoney(sum.debit + row.debit),
      credit: toMoney(sum.credit + row.credit),
    }), { debit: 0, credit: 0 })

    const revenueMap = new Map()
    const expenseMap = new Map()
    ledgerInRange.forEach((entry) => {
      const account = accountByCode.get(entry.accountCode)
      if (!account || !isPostableAccount(account, accounts)) return
      if (account.type === 'Revenue') {
        const amount = toMoney((Number(entry.credit) || 0) - (Number(entry.debit) || 0))
        revenueMap.set(account.code, toMoney((revenueMap.get(account.code) || 0) + amount))
      }
      if (account.type === 'Expenses') {
        const amount = toMoney((Number(entry.debit) || 0) - (Number(entry.credit) || 0))
        expenseMap.set(account.code, toMoney((expenseMap.get(account.code) || 0) + amount))
      }
    })

    const incomeStatement = {
      revenueRows: Array.from(revenueMap.entries())
        .map(([code, amount]) => ({ code, name: accountByCode.get(code)?.name || code, amount }))
        .filter((row) => Math.abs(row.amount) > 0.0001)
        .sort((a, b) => b.amount - a.amount),
      expenseRows: Array.from(expenseMap.entries())
        .map(([code, amount]) => ({ code, name: accountByCode.get(code)?.name || code, amount }))
        .filter((row) => Math.abs(row.amount) > 0.0001)
        .sort((a, b) => b.amount - a.amount),
    }
    incomeStatement.totalRevenue = toMoney(incomeStatement.revenueRows.reduce((sum, row) => sum + row.amount, 0))
    incomeStatement.totalExpenses = toMoney(incomeStatement.expenseRows.reduce((sum, row) => sum + row.amount, 0))
    incomeStatement.netProfit = toMoney(incomeStatement.totalRevenue - incomeStatement.totalExpenses)

    const balanceSheetAssets = []
    const balanceSheetLiabilities = []
    const balanceSheetEquity = []
    let closingRevenueTotal = 0
    let closingExpenseTotal = 0

    postableAccounts.forEach((account) => {
      const amount = toMoney(closingBalanceByCode.get(account.code) || 0)
      if (Math.abs(amount) <= 0.0001) return
      if (account.type === 'Assets') balanceSheetAssets.push({ code: account.code, name: account.name, subcategory: account.subcategory || '', amount })
      if (account.type === 'Liabilities') balanceSheetLiabilities.push({ code: account.code, name: account.name, subcategory: account.subcategory || '', amount })
      if (account.type === 'Equity') balanceSheetEquity.push({ code: account.code, name: account.name, subcategory: account.subcategory || '', amount })
      if (account.type === 'Revenue') closingRevenueTotal = toMoney(closingRevenueTotal + amount)
      if (account.type === 'Expenses') closingExpenseTotal = toMoney(closingExpenseTotal + amount)
    })

    const currentEarnings = toMoney(closingRevenueTotal - closingExpenseTotal)
    if (Math.abs(currentEarnings) > 0.0001) {
      balanceSheetEquity.push({
        code: 'CURR-EARNINGS',
        name: 'Current Year Earnings',
        subcategory: 'Equity Adjustment',
        amount: currentEarnings,
      })
    }

    const balanceSheet = {
      assetRows: balanceSheetAssets.sort(sortByCode),
      liabilityRows: balanceSheetLiabilities.sort(sortByCode),
      equityRows: balanceSheetEquity.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true })),
    }
    balanceSheet.totalAssets = toMoney(balanceSheet.assetRows.reduce((sum, row) => sum + row.amount, 0))
    balanceSheet.totalLiabilities = toMoney(balanceSheet.liabilityRows.reduce((sum, row) => sum + row.amount, 0))
    balanceSheet.totalEquity = toMoney(balanceSheet.equityRows.reduce((sum, row) => sum + row.amount, 0))
    balanceSheet.liabilityAndEquity = toMoney(balanceSheet.totalLiabilities + balanceSheet.totalEquity)
    balanceSheet.difference = toMoney(balanceSheet.totalAssets - balanceSheet.liabilityAndEquity)

    const openingCashBalanceByCode = new Map()
    snapshot.cashBankAccounts.forEach((account) => {
      openingCashBalanceByCode.set(account.code, toMoney(Number(account.openingBalance) || 0))
    })
    if (fromDate) {
      ledger.forEach((entry) => {
        if (!isDateBefore(entry.date, fromDate)) return
        if (!cashAccountCodes.has(entry.accountCode)) return
        // Skip 'opening-balance' source entries — the openingBalance field already captures them.
        if (String(entry.source || '').toLowerCase() === 'opening-balance') return
        const account = accountByCode.get(entry.accountCode)
        if (!account) return
        const current = toMoney(openingCashBalanceByCode.get(account.code) || 0)
        const next = toMoney(current + adjustBalanceByEntryType(account.type, Number(entry.debit) || 0, Number(entry.credit) || 0))
        openingCashBalanceByCode.set(account.code, next)
      })
    }
    const openingCash = toMoney(Array.from(openingCashBalanceByCode.values()).reduce((sum, value) => sum + value, 0))
    const closingCash = toMoney(Array.from(cashAccountCodes.values()).reduce((sum, code) => sum + toMoney(closingBalanceByCode.get(code) || 0), 0))

    const cashFlowBuckets = {
      operating: [],
      investing: [],
      financing: [],
    }

    const voucherMap = new Map()
    ledgerInRange.forEach((entry) => {
      const voucherNo = String(entry.voucherNo || entry.id || '').trim()
      if (!voucherNo) return
      if (!voucherMap.has(voucherNo)) voucherMap.set(voucherNo, [])
      voucherMap.get(voucherNo).push(entry)
    })

    voucherMap.forEach((voucherRows, voucherNo) => {
      const sortedRows = [...voucherRows].sort(sortLedgerRows)
      const cashImpact = toMoney(sortedRows.reduce((sum, row) => {
        if (!cashAccountCodes.has(row.accountCode)) return sum
        return sum + (Number(row.debit) || 0) - (Number(row.credit) || 0)
      }, 0))
      if (Math.abs(cashImpact) <= 0.0001) return

      const bucket = classifyCashFlowBucket(sortedRows, accountByCode, cashAccountCodes)
      cashFlowBuckets[bucket].push({
        date: sortedRows[0].date,
        voucherNo,
        source: sortedRows[0].source,
        description: sortedRows[0].description || sortedRows[0].narration || '-',
        reference: sortedRows[0].reference || '',
        inflow: cashImpact > 0 ? cashImpact : 0,
        outflow: cashImpact < 0 ? Math.abs(cashImpact) : 0,
        net: cashImpact,
      })
    })

    Object.keys(cashFlowBuckets).forEach((bucketKey) => {
      cashFlowBuckets[bucketKey] = cashFlowBuckets[bucketKey]
        .sort((a, b) => parseDateOnlyMs(a.date) - parseDateOnlyMs(b.date))
    })

    const cashFlow = {
      openingCash,
      closingCash,
      operatingRows: cashFlowBuckets.operating,
      investingRows: cashFlowBuckets.investing,
      financingRows: cashFlowBuckets.financing,
    }
    cashFlow.operatingIn = toMoney(cashFlow.operatingRows.reduce((sum, row) => sum + row.inflow, 0))
    cashFlow.operatingOut = toMoney(cashFlow.operatingRows.reduce((sum, row) => sum + row.outflow, 0))
    cashFlow.operatingNet = toMoney(cashFlow.operatingIn - cashFlow.operatingOut)
    cashFlow.investingIn = toMoney(cashFlow.investingRows.reduce((sum, row) => sum + row.inflow, 0))
    cashFlow.investingOut = toMoney(cashFlow.investingRows.reduce((sum, row) => sum + row.outflow, 0))
    cashFlow.investingNet = toMoney(cashFlow.investingIn - cashFlow.investingOut)
    cashFlow.financingIn = toMoney(cashFlow.financingRows.reduce((sum, row) => sum + row.inflow, 0))
    cashFlow.financingOut = toMoney(cashFlow.financingRows.reduce((sum, row) => sum + row.outflow, 0))
    cashFlow.financingNet = toMoney(cashFlow.financingIn - cashFlow.financingOut)
    cashFlow.netMovement = toMoney(cashFlow.operatingNet + cashFlow.investingNet + cashFlow.financingNet)
    cashFlow.balanceMovement = toMoney(cashFlow.closingCash - cashFlow.openingCash)

    const dayBookRows = Array.from(voucherMap.entries())
      .map(([voucherNo, rows]) => {
        const sortedRows = [...rows].sort(sortLedgerRows)
        const totalDebit = toMoney(sortedRows.reduce((sum, row) => sum + (Number(row.debit) || 0), 0))
        const totalCredit = toMoney(sortedRows.reduce((sum, row) => sum + (Number(row.credit) || 0), 0))
        return {
          date: sortedRows[0].date,
          voucherNo,
          source: sortedRows[0].source,
          description: sortedRows[0].description || sortedRows[0].narration || '-',
          reference: sortedRows[0].reference || '',
          totalDebit,
          totalCredit,
          accountCount: new Set(sortedRows.map((row) => row.accountCode)).size,
        }
      })
      .sort((a, b) => {
        const dateDiff = parseDateOnlyMs(b.date) - parseDateOnlyMs(a.date)
        if (dateDiff !== 0) return dateDiff
        return String(b.voucherNo).localeCompare(String(a.voucherNo))
      })

    const supplierRows = snapshot.payables
      .filter((item) => isDateInRange(item.payableDate || item.date, fromDate, toDate))
      .map((item) => {
        const paid = toMoney((Number(item.advancePaid) || 0) + (Number(item.currentPaid) || 0) + (Number(item.nonCurrentPaid) || 0))
        const payments = Array.isArray(item.payments) ? item.payments.filter((payment) => !payment.deletedAt).length : 0
        return {
          date: item.payableDate || item.date,
          transactionId: item.id,
          supplierName: item.supplierName || '-',
          voucherNo: item.voucherNo || '-',
          totalCost: toMoney(item.totalCost),
          paid,
          outstanding: toMoney(item.outstandingAmount),
          currentOutstanding: toMoney(item.currentOutstanding),
          nonCurrentOutstanding: toMoney(item.nonCurrentOutstanding),
          status: item.status || '-',
          payments,
        }
      })
      .sort((a, b) => parseDateOnlyMs(b.date) - parseDateOnlyMs(a.date))

    const supplierTotals = {
      purchases: toMoney(supplierRows.reduce((sum, row) => sum + row.totalCost, 0)),
      paid: toMoney(supplierRows.reduce((sum, row) => sum + row.paid, 0)),
      outstanding: toMoney(supplierRows.reduce((sum, row) => sum + row.outstanding, 0)),
    }

    const customerRows = snapshot.receivables
      .filter((item) => isDateInRange(item.date, fromDate, toDate))
      .map((item) => {
        const collected = toMoney((Number(item.advanceReceived) || 0) + (Number(item.receivedAmount) || 0))
        const payments = Array.isArray(item.payments) ? item.payments.filter((payment) => !payment.deletedAt).length : 0
        return {
          date: item.date,
          transactionId: item.id,
          customerName: item.customerName || '-',
          voucherNo: item.voucherNo || '-',
          totalSale: toMoney(item.totalSale),
          collected,
          outstanding: toMoney(item.outstandingAmount),
          currentOutstanding: toMoney(item.currentOutstanding),
          nonCurrentOutstanding: toMoney(item.nonCurrentOutstanding),
          status: item.status || '-',
          payments,
        }
      })
      .sort((a, b) => parseDateOnlyMs(b.date) - parseDateOnlyMs(a.date))

    const customerTotals = {
      sales: toMoney(customerRows.reduce((sum, row) => sum + row.totalSale, 0)),
      collected: toMoney(customerRows.reduce((sum, row) => sum + row.collected, 0)),
      outstanding: toMoney(customerRows.reduce((sum, row) => sum + row.outstanding, 0)),
    }

    const generalLedgerAccountOptions = postableAccounts.map((account) => ({
      code: account.code,
      name: account.name,
      type: account.type,
      subcategory: account.subcategory || '',
      openingBalance: toMoney(account.openingBalance),
    }))

    const selectedGeneralAccount = generalLedgerAccountOptions.find((item) => item.code === selectedAccountCode)
      || generalLedgerAccountOptions[0]
      || null

    let openingForSelected = 0
    let generalLedgerRows = []
    let generalLedgerTotals = { debit: 0, credit: 0, closing: 0 }

    if (selectedGeneralAccount) {
      openingForSelected = toMoney(selectedGeneralAccount.openingBalance)
      if (fromDate) {
        ledger.forEach((entry) => {
          if (entry.accountCode !== selectedGeneralAccount.code) return
          if (!isDateBefore(entry.date, fromDate)) return
          // Skip 'opening-balance' source entries — the openingBalance field already captures them.
          // Including them would double-count the opening balance.
          if (String(entry.source || '').toLowerCase() === 'opening-balance') return
          openingForSelected = toMoney(openingForSelected + adjustBalanceByEntryType(
            selectedGeneralAccount.type,
            Number(entry.debit) || 0,
            Number(entry.credit) || 0,
          ))
        })
      }

      let running = openingForSelected
      generalLedgerRows = ledger
        .filter((entry) => entry.accountCode === selectedGeneralAccount.code && isDateInRange(entry.date, fromDate, toDate))
        .map((entry) => {
          const debit = toMoney(entry.debit)
          const credit = toMoney(entry.credit)
          running = toMoney(running + adjustBalanceByEntryType(selectedGeneralAccount.type, debit, credit))
          return {
            date: entry.date,
            voucherNo: entry.voucherNo || entry.id,
            source: entry.source,
            description: entry.description || entry.narration || '-',
            reference: entry.reference || '',
            debit,
            credit,
            runningBalance: running,
          }
        })
        .sort(sortLedgerRows)

      generalLedgerTotals = {
        debit: toMoney(generalLedgerRows.reduce((sum, row) => sum + row.debit, 0)),
        credit: toMoney(generalLedgerRows.reduce((sum, row) => sum + row.credit, 0)),
        closing: toMoney(generalLedgerRows.length > 0 ? generalLedgerRows[generalLedgerRows.length - 1].runningBalance : openingForSelected),
      }
    }

    const overview = {
      totalAssets: balanceSheet.totalAssets,
      totalLiabilities: balanceSheet.totalLiabilities,
      totalEquity: balanceSheet.totalEquity,
      netProfit: incomeStatement.netProfit,
      cashBalance: closingCash,
      postedVouchers: dayBookRows.length,
      apOutstanding: supplierTotals.outstanding,
      arOutstanding: customerTotals.outstanding,
      periodExpense: incomeStatement.totalExpenses,
      periodRevenue: incomeStatement.totalRevenue,
      balanceDifference: balanceSheet.difference,
      currentRatio: balanceSheet.totalLiabilities > 0
        ? toMoney(balanceSheet.totalAssets / balanceSheet.totalLiabilities)
        : null,
    }

    return {
      trialBalanceRows,
      trialTotals,
      incomeStatement,
      balanceSheet,
      cashFlow,
      dayBookRows,
      supplierRows,
      supplierTotals,
      customerRows,
      customerTotals,
      generalLedger: {
        accountOptions: generalLedgerAccountOptions,
        selected: selectedGeneralAccount,
        openingBalance: openingForSelected,
        rows: generalLedgerRows,
        totals: generalLedgerTotals,
      },
      overview,
    }
  }, [snapshot, fromDate, toDate, selectedAccountCode])

  useEffect(() => {
    if (!reportData.generalLedger.selected && reportData.generalLedger.accountOptions.length > 0) {
      setSelectedAccountCode(reportData.generalLedger.accountOptions[0].code)
      return
    }
    const selectedExists = reportData.generalLedger.accountOptions.some((item) => item.code === selectedAccountCode)
    if (!selectedExists && reportData.generalLedger.accountOptions.length > 0) {
      setSelectedAccountCode(reportData.generalLedger.accountOptions[0].code)
    }
  }, [reportData.generalLedger.accountOptions, reportData.generalLedger.selected, selectedAccountCode])

  const reportLabel = REPORT_TYPES.find((item) => item.id === activeReport)?.label || 'Report'
  const exportPattern = useMemo(
    () => buildReportExportPattern(activeReport, reportData, fromDate, toDate),
    [activeReport, reportData, fromDate, toDate],
  )
  const printRows = useMemo(() => {
    if (!exportPattern.columns || exportPattern.columns.length === 0) return []
    if (exportPattern.rows && exportPattern.rows.length > 0) return exportPattern.rows
    return [{ _summary: true, [exportPattern.columns[0].key]: 'No rows available for selected filters.' }]
  }, [exportPattern])

  const downloadCsv = () => {
    if (!exportPattern.columns || exportPattern.columns.length === 0) {
      setErrorText('No export pattern available for this report.')
      return
    }
    const csv = rowsToCsvWithPattern(exportPattern.columns, exportPattern.rows)
    const file = buildExportFileName(activeReport, fromDate, toDate, 'csv', selectedAccountCode)
    downloadBlob(file, `\ufeff${csv}`, 'text/csv;charset=utf-8;')
    setNoticeText(`CSV downloaded: ${file} (${exportPattern.rows.length} rows)`)
    setErrorText('')
  }

  const downloadPdf = async () => {
    if (!exportPattern.columns || exportPattern.columns.length === 0) {
      setErrorText('No export pattern available for this report.')
      return
    }

    setExportingPdf(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }, logoImage] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
        loadImageDataUrl('/qudarti-packaging-logo.png'),
      ])

      const doc = new jsPDF({
        orientation: exportPattern.orientation || 'portrait',
        unit: 'pt',
        format: 'a4',
      })
      const tableStartY = addPdfReportHeader(doc, {
        title: reportLabel,
        subtitle: `Financial report | Period: ${fromDate || '-'} to ${toDate || '-'}`,
        generatedBy,
        recordCount: exportPattern.rows.length,
        logoImage,
      })

      const head = [exportPattern.columns.map((column) => column.label)]
      const bodyRows = exportPattern.rows.length > 0
        ? exportPattern.rows
        : [{ _summary: true, [exportPattern.columns[0].key]: 'No rows available for selected filters.' }]
      const body = bodyRows.map((row) => exportPattern.columns.map((column) => formatPdfCellValue(row[column.key], column)))

      const columnStyles = {}
      exportPattern.columns.forEach((column, index) => {
        const key = String(column.key || '').toLowerCase()
        if (key.includes('description')) {
          columnStyles[index] = { cellWidth: 230 }
          return
        }
        if (key.includes('name')) {
          columnStyles[index] = { cellWidth: 170 }
          return
        }
        if (key.includes('reference')) {
          columnStyles[index] = { cellWidth: 120 }
          return
        }
        if (column.align === 'right') {
          columnStyles[index] = { halign: 'right', cellWidth: 92 }
        }
      })

      autoTable(doc, {
        startY: tableStartY,
        margin: { left: 32, right: 32, bottom: 24 },
        showHead: 'everyPage',
        head,
        body,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 4, textColor: [39, 53, 41], lineColor: [0, 0, 0], lineWidth: 0.45, fillColor: [255, 255, 255] },
        headStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.45 },
        bodyStyles: { fillColor: [255, 255, 255], lineColor: [0, 0, 0] },
        alternateRowStyles: { fillColor: [252, 252, 252] },
        columnStyles,
        didParseCell: (data) => {
          if (data.section !== 'body') return
          const rowRef = bodyRows[data.row.index]
          if (rowRef?._summary) {
            data.cell.styles.fillColor = [239, 246, 252]
            data.cell.styles.textColor = [15, 23, 42]
            data.cell.styles.fontStyle = 'bold'
            return
          }

          const columnRef = exportPattern.columns[data.column.index]
          if (columnRef?.align !== 'right') return

          const cellValue = parseCurrencyNumber(data.cell.raw ?? '')
          if (!Number.isFinite(cellValue) || cellValue >= 0) return
          data.cell.styles.textColor = [153, 27, 27]
        },
        didDrawPage: () => {
          const pageWidth = doc.internal.pageSize.getWidth()
          const pageHeight = doc.internal.pageSize.getHeight()
          doc.setFontSize(9)
          doc.setTextColor(100, 116, 100)
          doc.text('Qudarti Food Processors | System generated report', 32, pageHeight - 18, { align: 'left' })
          doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - 32, pageHeight - 18, { align: 'right' })
        },
      })

      const file = buildExportFileName(activeReport, fromDate, toDate, 'pdf', selectedAccountCode)
      doc.save(file)
      setNoticeText(`PDF downloaded: ${file} (${exportPattern.rows.length} rows)`)
      setErrorText('')
    } catch (error) {
      setErrorText(error?.message || 'Unable to export PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  const onPrint = () => {
    window.print()
  }

  return (
    <AccountLayout>
      <div style={s.page}>
        <section style={s.hero} className="no-print">
          <div style={s.heroLeft}>
            <div style={s.heroIcon}><Landmark size={22} color="#166534" /></div>
            <div>
              <h1 style={s.title}>Financial Reports</h1>
              <p style={s.subtitle}>Live accounting reports from GL, COA, payable, receivable, expense, and cash/bank data.</p>
            </div>
          </div>
          <div style={s.heroMeta}>
            <span style={s.metaChip}>Last Sync: {snapshot.updatedAt ? formatDateTime(snapshot.updatedAt) : '-'}</span>
          </div>
        </section>

        {noticeText ? <p style={s.noticeText} className="no-print">{noticeText}</p> : null}
        {errorText ? <p style={s.errorText} className="no-print">{errorText}</p> : null}

        <section style={s.toolbar} className="no-print">
          <div style={s.reportTabs}>
            {REPORT_TYPES.map((item) => {
              const Icon = item.icon
              const active = activeReport === item.id
              return (
                <button key={item.id} style={{ ...s.tabBtn, ...(active ? s.tabBtnActive : {}) }} onClick={() => setActiveReport(item.id)}>
                  <Icon size={14} /> {item.label}
                </button>
              )
            })}
          </div>

          <div style={s.controlGrid}>
            <div style={s.field}>
              <label style={s.label}><CalendarDays size={12} /> From Date</label>
              <input type="date" style={s.input} value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}><CalendarDays size={12} /> To Date</label>
              <input type="date" style={s.input} value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
            {activeReport === 'general-ledger' ? (
              <div style={s.field}>
                <label style={s.label}>Ledger Account</label>
                <select style={s.input} value={selectedAccountCode} onChange={(event) => setSelectedAccountCode(event.target.value)}>
                  {reportData.generalLedger.accountOptions.map((account) => (
                    <option key={account.code} value={account.code}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div style={s.actionRow}>
            <button style={s.btnGhost} onClick={refreshData} disabled={refreshing}>
              <RefreshCcw size={14} /> {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button style={s.btnGhost} onClick={onPrint}>
              <Printer size={14} /> Print
            </button>
            <button style={s.btnPrimary} onClick={downloadPdf} disabled={exportingPdf}>
              <Download size={14} /> {exportingPdf ? 'Preparing PDF...' : 'Download PDF'}
            </button>
            <button style={s.btnPrimaryAlt} onClick={downloadCsv}>
              <Download size={14} /> Download CSV
            </button>
          </div>
        </section>

        <section style={s.reportCard}>
          <div className="print-only" style={s.printHead}>
            <div style={s.printBrandRow}>
              <div style={s.printLogoFrame}>
                <img src="/qudarti-packaging-logo.png" alt="Qudarti Food Logo" style={s.printLogo} />
              </div>
              <div style={s.printBrandText}>
                <p style={s.printBrand}>Qudarti Food Processors</p>
                <p style={s.printCompanySuffix}>(SMC-PVT) LTD.</p>
              </div>
            </div>
            <div style={s.printTitleBlock}>
              <p style={s.printEyebrow}>Financial Report</p>
              <p style={s.printTitle}>{reportLabel}</p>
              <p style={s.printedBy}>Printed By: {generatedBy}</p>
            </div>
          </div>

          <div
            className={`print-only ${exportPattern.columns.length > 8 ? 'print-wide-report' : 'print-standard-report'}`}
            style={s.printTableWrap}
          >
            {exportPattern.columns.length > 0 ? (
              <table style={s.table}>
                <thead>
                  <tr>
                    {exportPattern.columns.map((column) => (
                      <th
                        key={column.key}
                        style={{ ...s.th, textAlign: column.align === 'right' ? 'right' : 'left' }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {printRows.map((row, idx) => (
                    <tr key={`print-${idx}`} style={row._summary ? { ...s.tr, background: '#f0fdf4' } : s.tr}>
                      {exportPattern.columns.map((column) => (
                        <td
                          key={`${idx}-${column.key}`}
                          style={row._summary
                            ? { ...s.printSummaryTd, textAlign: column.align === 'right' ? 'right' : 'left' }
                            : { ...s.td, textAlign: column.align === 'right' ? 'right' : 'left' }}
                        >
                          {row[column.key] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={s.printMeta}>No export pattern available for this report.</p>
            )}
          </div>

          <div className="screen-report" style={{ overflowX: 'auto' }}>
          <div style={s.reportHead}>
            <h2 style={s.reportTitle}>{reportLabel}</h2>
            <p style={s.reportSub}>Period: {fromDate || '-'} to {toDate || '-'}</p>
          </div>

          {activeReport === 'overview' ? (
            <>
              <div style={s.kpiGrid}>
                <div style={s.kpiCard}>
                  <p style={s.kpiLabel}>Total Assets</p>
                  <p style={s.kpiValue}>{formatMoney(reportData.overview.totalAssets)}</p>
                </div>
                <div style={s.kpiCard}>
                  <p style={s.kpiLabel}>Total Liabilities</p>
                  <p style={s.kpiValue}>{formatMoney(reportData.overview.totalLiabilities)}</p>
                </div>
                <div style={s.kpiCard}>
                  <p style={s.kpiLabel}>Total Equity</p>
                  <p style={s.kpiValue}>{formatMoney(reportData.overview.totalEquity)}</p>
                </div>
                <div style={{ ...s.kpiCard, background: reportData.overview.netProfit >= 0 ? '#ecfdf5' : '#fef2f2' }}>
                  <p style={s.kpiLabel}>Net Profit</p>
                  <p style={{ ...s.kpiValue, color: reportData.overview.netProfit >= 0 ? '#065f46' : '#991b1b' }}>{formatMoney(reportData.overview.netProfit)}</p>
                </div>
                <div style={s.kpiCard}>
                  <p style={s.kpiLabel}>Cash + Bank Balance</p>
                  <p style={s.kpiValue}>{formatMoney(reportData.overview.cashBalance)}</p>
                </div>
                <div style={s.kpiCard}>
                  <p style={s.kpiLabel}>Posted Vouchers</p>
                  <p style={s.kpiValue}>{reportData.overview.postedVouchers}</p>
                </div>
              </div>

              <div style={s.dualGrid}>
                <div style={s.panel}>
                  <h3 style={s.panelTitle}>Receivable vs Payable</h3>
                  <div style={s.rowSplit}><span>AR Outstanding</span><strong>{formatMoney(reportData.overview.arOutstanding)}</strong></div>
                  <div style={s.rowSplit}><span>AP Outstanding</span><strong>{formatMoney(reportData.overview.apOutstanding)}</strong></div>
                  <div style={s.rowSplit}><span>Current Ratio</span><strong>{reportData.overview.currentRatio != null ? reportData.overview.currentRatio.toFixed(2) : '-'}</strong></div>
                </div>
                <div style={s.panel}>
                  <h3 style={s.panelTitle}>Balance Sheet Check</h3>
                  <div style={s.rowSplit}><span>Total Assets</span><strong>{formatMoney(reportData.balanceSheet.totalAssets)}</strong></div>
                  <div style={s.rowSplit}><span>Liabilities + Equity</span><strong>{formatMoney(reportData.balanceSheet.liabilityAndEquity)}</strong></div>
                  <div style={s.rowSplit}>
                    <span>Difference</span>
                    <strong style={{ color: Math.abs(reportData.overview.balanceDifference) <= 0.01 ? '#065f46' : '#991b1b' }}>
                      {formatMoney(reportData.overview.balanceDifference)}
                    </strong>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {activeReport === 'trial-balance' ? (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Code</th>
                    <th style={s.th}>Account</th>
                    <th style={s.th}>Type</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Opening Balance</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Debit</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Credit</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Closing Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.trialBalanceRows.map((row) => (
                    <tr key={row.code} style={s.tr}>
                      <td style={s.td}>{row.code}</td>
                      <td style={s.td}>{row.name}</td>
                      <td style={s.td}>{row.type}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: '#6b7280' }}>{formatMoney(row.openingBalance)}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.debit)}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.credit)}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: row.balance >= 0 ? '#065f46' : '#991b1b' }}>
                        {formatMoney(row.balance)}
                      </td>
                    </tr>
                  ))}
                  {reportData.trialBalanceRows.length === 0 ? (
                    <tr><td style={s.emptyCell} colSpan={7}>No balances available for selected period.</td></tr>
                  ) : null}
                </tbody>
                <tfoot>
                  <tr style={s.tFoot}>
                    <td style={s.td} colSpan={3}>Total</td>
                    <td style={s.td} />
                    <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(reportData.trialTotals.debit)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(reportData.trialTotals.credit)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: Math.abs(reportData.trialTotals.debit - reportData.trialTotals.credit) <= 0.01 ? '#065f46' : '#991b1b' }}>
                      {Math.abs(reportData.trialTotals.debit - reportData.trialTotals.credit) <= 0.01 ? '✓ Balanced' : `Diff: ${formatMoney(reportData.trialTotals.debit - reportData.trialTotals.credit)}`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : null}

          {activeReport === 'income-statement' ? (
            <>
              <div style={s.dualGrid}>
                <div style={s.panel}>
                  <h3 style={s.panelTitle}>Revenue</h3>
                  {reportData.incomeStatement.revenueRows.map((row) => (
                    <div key={row.code} style={s.rowSplit}>
                      <span>{row.code} - {row.name}</span>
                      <strong>{formatMoney(row.amount)}</strong>
                    </div>
                  ))}
                  {reportData.incomeStatement.revenueRows.length === 0 ? <p style={s.emptyText}>No revenue in selected period.</p> : null}
                  <div style={s.totalRow}>
                    <span>Total Revenue</span>
                    <strong>{formatMoney(reportData.incomeStatement.totalRevenue)}</strong>
                  </div>
                </div>

                <div style={s.panel}>
                  <h3 style={s.panelTitle}>Expenses</h3>
                  {reportData.incomeStatement.expenseRows.map((row) => (
                    <div key={row.code} style={s.rowSplit}>
                      <span>{row.code} - {row.name}</span>
                      <strong>{formatMoney(row.amount)}</strong>
                    </div>
                  ))}
                  {reportData.incomeStatement.expenseRows.length === 0 ? <p style={s.emptyText}>No expenses in selected period.</p> : null}
                  <div style={s.totalRow}>
                    <span>Total Expenses</span>
                    <strong>{formatMoney(reportData.incomeStatement.totalExpenses)}</strong>
                  </div>
                </div>
              </div>

              <div style={{ ...s.netCard, background: reportData.incomeStatement.netProfit >= 0 ? '#ecfdf5' : '#fef2f2' }}>
                <span>Net {reportData.incomeStatement.netProfit >= 0 ? 'Profit' : 'Loss'}</span>
                <strong style={{ color: reportData.incomeStatement.netProfit >= 0 ? '#065f46' : '#991b1b' }}>
                  {formatMoney(reportData.incomeStatement.netProfit)}
                </strong>
              </div>
            </>
          ) : null}

          {activeReport === 'balance-sheet' ? (
            <>
              <div style={s.dualGrid}>
                <div style={s.panel}>
                  <h3 style={s.panelTitle}>Assets</h3>
                  {reportData.balanceSheet.assetRows.map((row) => (
                    <div key={row.code} style={s.rowSplit}>
                      <span>{row.code} - {row.name}</span>
                      <strong>{formatMoney(row.amount)}</strong>
                    </div>
                  ))}
                  {reportData.balanceSheet.assetRows.length === 0 ? <p style={s.emptyText}>No asset balances.</p> : null}
                  <div style={s.totalRow}>
                    <span>Total Assets</span>
                    <strong>{formatMoney(reportData.balanceSheet.totalAssets)}</strong>
                  </div>
                </div>

                <div style={s.panel}>
                  <h3 style={s.panelTitle}>Liabilities + Equity</h3>
                  {reportData.balanceSheet.liabilityRows.map((row) => (
                    <div key={row.code} style={s.rowSplit}>
                      <span>{row.code} - {row.name}</span>
                      <strong>{formatMoney(row.amount)}</strong>
                    </div>
                  ))}
                  {reportData.balanceSheet.equityRows.map((row) => (
                    <div key={row.code} style={s.rowSplit}>
                      <span>{row.code} - {row.name}</span>
                      <strong>{formatMoney(row.amount)}</strong>
                    </div>
                  ))}
                  {reportData.balanceSheet.liabilityRows.length === 0 && reportData.balanceSheet.equityRows.length === 0 ? <p style={s.emptyText}>No liabilities/equity balances.</p> : null}
                  <div style={s.totalRow}>
                    <span>Liabilities + Equity</span>
                    <strong>{formatMoney(reportData.balanceSheet.liabilityAndEquity)}</strong>
                  </div>
                </div>
              </div>
              <div style={{ ...s.netCard, background: Math.abs(reportData.balanceSheet.difference) <= 0.01 ? '#ecfdf5' : '#fef2f2' }}>
                <span>Balance Difference</span>
                <strong style={{ color: Math.abs(reportData.balanceSheet.difference) <= 0.01 ? '#065f46' : '#991b1b' }}>
                  {formatMoney(reportData.balanceSheet.difference)}
                </strong>
              </div>
            </>
          ) : null}

          {activeReport === 'cash-flow' ? (
            <>
              <div style={s.kpiGrid}>
                <div style={s.kpiCard}>
                  <p style={s.kpiLabel}>Opening Cash</p>
                  <p style={s.kpiValue}>{formatMoney(reportData.cashFlow.openingCash)}</p>
                </div>
                <div style={s.kpiCard}>
                  <p style={s.kpiLabel}>Closing Cash</p>
                  <p style={s.kpiValue}>{formatMoney(reportData.cashFlow.closingCash)}</p>
                </div>
                <div style={s.kpiCard}>
                  <p style={s.kpiLabel}>Net Movement (Flow)</p>
                  <p style={s.kpiValue}>{formatMoney(reportData.cashFlow.netMovement)}</p>
                </div>
                <div style={{ ...s.kpiCard, background: Math.abs(reportData.cashFlow.netMovement - reportData.cashFlow.balanceMovement) <= 0.01 ? '#ecfdf5' : '#fef2f2' }}>
                  <p style={s.kpiLabel}>Net Movement (Balance)</p>
                  <p style={{ ...s.kpiValue, color: Math.abs(reportData.cashFlow.netMovement - reportData.cashFlow.balanceMovement) <= 0.01 ? '#065f46' : '#991b1b' }}>{formatMoney(reportData.cashFlow.balanceMovement)}</p>
                </div>
              </div>

              <div style={s.dualGrid}>
                <div style={s.panel}>
                  <h3 style={s.panelTitle}>Operating Activities</h3>
                  {reportData.cashFlow.operatingRows.map((row) => (
                    <div key={`${row.voucherNo}-${row.date}-op`} style={s.rowSplit}>
                      <span>{row.date} | {row.voucherNo} — {row.description}</span>
                      <strong style={{ color: row.net >= 0 ? '#065f46' : '#991b1b' }}>{formatMoney(row.net)}</strong>
                    </div>
                  ))}
                  {reportData.cashFlow.operatingRows.length === 0 ? <p style={s.emptyText}>No operating cash movement.</p> : null}
                  <div style={s.totalRow}>
                    <span>Net Cash from Operating Activities</span>
                    <strong style={{ color: reportData.cashFlow.operatingNet >= 0 ? '#065f46' : '#991b1b' }}>{formatMoney(reportData.cashFlow.operatingNet)}</strong>
                  </div>
                </div>
                <div style={s.panel}>
                  <h3 style={s.panelTitle}>Investing Activities</h3>
                  {reportData.cashFlow.investingRows.map((row) => (
                    <div key={`${row.voucherNo}-${row.date}-inv`} style={s.rowSplit}>
                      <span>{row.date} | {row.voucherNo} — {row.description}</span>
                      <strong style={{ color: row.net >= 0 ? '#065f46' : '#991b1b' }}>{formatMoney(row.net)}</strong>
                    </div>
                  ))}
                  {reportData.cashFlow.investingRows.length === 0 ? <p style={s.emptyText}>No investing movement.</p> : null}
                  <div style={s.totalRow}>
                    <span>Net Cash from Investing Activities</span>
                    <strong style={{ color: reportData.cashFlow.investingNet >= 0 ? '#065f46' : '#991b1b' }}>{formatMoney(reportData.cashFlow.investingNet)}</strong>
                  </div>
                </div>
              </div>

              <div style={s.panel}>
                <h3 style={s.panelTitle}>Financing Activities</h3>
                {reportData.cashFlow.financingRows.map((row) => (
                  <div key={`${row.voucherNo}-${row.date}-fin`} style={s.rowSplit}>
                    <span>{row.date} | {row.voucherNo} — {row.description}</span>
                    <strong style={{ color: row.net >= 0 ? '#065f46' : '#991b1b' }}>{formatMoney(row.net)}</strong>
                  </div>
                ))}
                {reportData.cashFlow.financingRows.length === 0 ? <p style={s.emptyText}>No financing movement.</p> : null}
                <div style={s.totalRow}>
                  <span>Net Cash from Financing Activities</span>
                  <strong style={{ color: reportData.cashFlow.financingNet >= 0 ? '#065f46' : '#991b1b' }}>{formatMoney(reportData.cashFlow.financingNet)}</strong>
                </div>
              </div>

              <div style={{ ...s.netCard, background: '#f0fdf4', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Opening Cash Balance</span>
                  <strong>{formatMoney(reportData.cashFlow.openingCash)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>+ Net Cash Movement</span>
                  <strong style={{ color: reportData.cashFlow.netMovement >= 0 ? '#065f46' : '#991b1b' }}>{formatMoney(reportData.cashFlow.netMovement)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #d1fae5', paddingTop: 8, fontSize: 16 }}>
                  <span>= Closing Cash Balance</span>
                  <strong style={{ color: '#065f46' }}>{formatMoney(reportData.cashFlow.openingCash + reportData.cashFlow.netMovement)}</strong>
                </div>
              </div>
            </>
          ) : null}

          {activeReport === 'day-book' ? (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Date</th>
                    <th style={s.th}>Voucher</th>
                    <th style={s.th}>Source</th>
                    <th style={s.th}>Description</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Debit</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.dayBookRows.map((row) => (
                    <tr key={`${row.voucherNo}-${row.date}`} style={s.tr}>
                      <td style={s.td}>{row.date}</td>
                      <td style={s.td}>{row.voucherNo}</td>
                      <td style={s.td}>{row.source}</td>
                      <td style={s.td}>{row.description}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.totalDebit)}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.totalCredit)}</td>
                    </tr>
                  ))}
                  {reportData.dayBookRows.length === 0 ? <tr><td style={s.emptyCell} colSpan={6}>No vouchers in selected period.</td></tr> : null}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeReport === 'supplier-ledger' ? (
            <>
              <div style={s.kpiGrid}>
                <div style={s.kpiCard}><p style={s.kpiLabel}>Total Purchases</p><p style={s.kpiValue}>{formatMoney(reportData.supplierTotals.purchases)}</p></div>
                <div style={s.kpiCard}><p style={s.kpiLabel}>Total Paid</p><p style={s.kpiValue}>{formatMoney(reportData.supplierTotals.paid)}</p></div>
                <div style={s.kpiCard}><p style={s.kpiLabel}>Outstanding</p><p style={s.kpiValue}>{formatMoney(reportData.supplierTotals.outstanding)}</p></div>
              </div>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Date</th>
                      <th style={s.th}>Transaction</th>
                      <th style={s.th}>Supplier</th>
                      <th style={s.th}>Status</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Total</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Paid</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.supplierRows.map((row) => (
                      <tr key={row.transactionId} style={s.tr}>
                        <td style={s.td}>{row.date}</td>
                        <td style={s.td}>{row.transactionId}</td>
                        <td style={s.td}>{row.supplierName}</td>
                        <td style={s.td}>{row.status}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.totalCost)}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.paid)}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.outstanding)}</td>
                      </tr>
                    ))}
                    {reportData.supplierRows.length === 0 ? <tr><td style={s.emptyCell} colSpan={7}>No supplier transactions in selected period.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {activeReport === 'customer-ledger' ? (
            <>
              <div style={s.kpiGrid}>
                <div style={s.kpiCard}><p style={s.kpiLabel}>Total Sales</p><p style={s.kpiValue}>{formatMoney(reportData.customerTotals.sales)}</p></div>
                <div style={s.kpiCard}><p style={s.kpiLabel}>Collected</p><p style={s.kpiValue}>{formatMoney(reportData.customerTotals.collected)}</p></div>
                <div style={s.kpiCard}><p style={s.kpiLabel}>Outstanding</p><p style={s.kpiValue}>{formatMoney(reportData.customerTotals.outstanding)}</p></div>
              </div>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Date</th>
                      <th style={s.th}>Transaction</th>
                      <th style={s.th}>Customer</th>
                      <th style={s.th}>Status</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Sale</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Collected</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.customerRows.map((row) => (
                      <tr key={row.transactionId} style={s.tr}>
                        <td style={s.td}>{row.date}</td>
                        <td style={s.td}>{row.transactionId}</td>
                        <td style={s.td}>{row.customerName}</td>
                        <td style={s.td}>{row.status}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.totalSale)}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.collected)}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.outstanding)}</td>
                      </tr>
                    ))}
                    {reportData.customerRows.length === 0 ? <tr><td style={s.emptyCell} colSpan={7}>No customer transactions in selected period.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {activeReport === 'general-ledger' ? (
            <>
              <div style={s.kpiGrid}>
                <div style={s.kpiCard}><p style={s.kpiLabel}>Opening Balance</p><p style={s.kpiValue}>{formatMoney(reportData.generalLedger.openingBalance)}</p></div>
                <div style={s.kpiCard}><p style={s.kpiLabel}>Total Debit</p><p style={s.kpiValue}>{formatMoney(reportData.generalLedger.totals.debit)}</p></div>
                <div style={s.kpiCard}><p style={s.kpiLabel}>Total Credit</p><p style={s.kpiValue}>{formatMoney(reportData.generalLedger.totals.credit)}</p></div>
                <div style={s.kpiCard}><p style={s.kpiLabel}>Closing Balance</p><p style={s.kpiValue}>{formatMoney(reportData.generalLedger.totals.closing)}</p></div>
              </div>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Date</th>
                      <th style={s.th}>Voucher</th>
                      <th style={s.th}>Source</th>
                      <th style={s.th}>Description</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Debit</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Credit</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.generalLedger.rows.map((row) => (
                      <tr key={`${row.voucherNo}-${row.date}-${row.debit}-${row.credit}`} style={s.tr}>
                        <td style={s.td}>{row.date}</td>
                        <td style={s.td}>{row.voucherNo}</td>
                        <td style={s.td}>{row.source}</td>
                        <td style={s.td}>{row.description}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.debit)}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.credit)}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{formatMoney(row.runningBalance)}</td>
                      </tr>
                    ))}
                    {reportData.generalLedger.rows.length === 0 ? <tr><td style={s.emptyCell} colSpan={7}>No ledger rows for selected account/period.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          </div>
        </section>
      </div>

      <style jsx global>{`
        .print-only {
          display: none !important;
        }

        .screen-report {
          display: block;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          aside,
          main > header,
          .no-print {
            display: none !important;
          }

          main {
            padding-left: 0 !important;
          }

          [data-panel-content='account'] {
            padding: 0 !important;
            margin: 0 !important;
          }

          [data-panel-content='account'] > div {
            gap: 8px !important;
          }

          .print-only {
            display: block !important;
          }
          .screen-report {
            display: none !important;
          }

          section {
            box-shadow: none !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }

          th,
          td {
            overflow-wrap: break-word !important;
            word-break: normal !important;
          }

          th {
            line-height: 1.15 !important;
          }

          .print-wide-report th {
            font-size: 7.3px !important;
            padding: 4px 4px !important;
            letter-spacing: 0 !important;
          }

          .print-wide-report td {
            font-size: 7.5px !important;
            padding: 4px 4px !important;
            line-height: 1.16 !important;
          }

          .print-standard-report th {
            font-size: 9px !important;
            padding: 6px 6px !important;
          }

          .print-standard-report td {
            font-size: 9.3px !important;
            padding: 6px 6px !important;
          }

          thead {
            display: table-header-group;
          }

          tfoot {
            display: table-footer-group;
          }

          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }
      `}</style>
    </AccountLayout>
  )
}

const s = {
  page: { width: '100%', display: 'flex', flexDirection: 'column', gap: 16 },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    background: 'linear-gradient(120deg, #f0fdf4 0%, #ecfeff 100%)',
    border: '1px solid #d1fae5',
    borderRadius: 16,
    padding: 'clamp(12px, 2.4vw, 16px) clamp(12px, 2.6vw, 18px)',
  },
  heroLeft: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 320px' },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: '#dcfce7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { margin: 0, color: '#14532d', fontSize: 'clamp(18px, 3.2vw, 22px)', fontWeight: 800 },
  subtitle: { margin: '4px 0 0', color: '#166534', fontSize: 12.5 },
  heroMeta: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaChip: {
    background: '#ffffff',
    border: '1px solid #bae6fd',
    color: '#0f766e',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 600,
  },
  noticeText: {
    margin: 0,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #a7f3d0',
    background: '#ecfdf5',
    color: '#065f46',
    fontSize: 12.5,
    fontWeight: 600,
  },
  errorText: {
    margin: 0,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: 12.5,
    fontWeight: 600,
  },
  toolbar: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  reportTabs: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tabBtn: {
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#374151',
    borderRadius: 999,
    padding: '7px 11px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  tabBtnActive: {
    background: '#14532d',
    color: '#ffffff',
    border: '1px solid #14532d',
  },
  controlGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 10,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 11, color: '#4b5563', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 },
  input: {
    border: '1px solid #d1d5db',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 12.5,
    color: '#111827',
    outline: 'none',
    background: '#ffffff',
    fontFamily: 'inherit',
  },
  actionRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  btnGhost: {
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#374151',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  btnPrimary: {
    border: '1px solid #0f766e',
    background: '#0f766e',
    color: '#ffffff',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  btnPrimaryAlt: {
    border: '1px solid #1d4ed8',
    background: '#1d4ed8',
    color: '#ffffff',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  reportCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  printHead: {
    background: '#123416',
    color: '#ffffff',
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  printBrandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  printLogoFrame: {
    width: 92,
    height: 58,
    background: 'transparent',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printBrandText: {
    minHeight: 58,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  printLogo: {
    display: 'block',
    maxWidth: '100%',
    maxHeight: '100%',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
  },
  printBrand: {
    margin: 0,
    fontSize: 21,
    fontWeight: 800,
    color: '#ffffff',
  },
  printCompanySuffix: {
    margin: '4px 0 0',
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.82)',
  },
  printTitleBlock: {
    textAlign: 'right',
  },
  printEyebrow: {
    margin: '0 0 5px',
    color: 'rgba(255,255,255,0.76)',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  printTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: '#ffffff',
  },
  printedBy: {
    margin: '7px 0 0',
    fontSize: 11,
    fontWeight: 700,
    color: '#ffffff',
  },
  printMetaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 8,
    marginTop: 12,
  },
  printMetaBox: {
    border: '1px solid #cfe0d0',
    borderLeft: '4px solid #2d7a33',
    background: '#f8fbf8',
    padding: '8px 10px',
  },
  printMetaLabel: {
    display: 'block',
    color: '#637463',
    fontSize: 9.5,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  printMetaValue: {
    display: 'block',
    marginTop: 4,
    color: '#1e2d20',
    fontSize: 11.5,
    fontWeight: 800,
  },
  printMeta: {
    margin: '3px 0 0',
    fontSize: 11.5,
    color: '#334155',
    fontWeight: 500,
  },
  printTableWrap: {
    border: '1px solid #000000',
    borderRadius: 0,
    overflow: 'hidden',
    marginTop: 12,
  },
  printSummaryTd: {
    padding: '9px 10px',
    fontSize: 12.5,
    color: '#0f172a',
    verticalAlign: 'top',
    fontWeight: 800,
    background: '#eff6fc',
    borderRight: '1px solid #000000',
  },
  reportHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: 10,
  },
  reportTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' },
  reportSub: { margin: 0, fontSize: 12.5, color: '#6b7280' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 },
  kpiCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '10px 12px',
  },
  kpiLabel: { margin: 0, fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' },
  kpiValue: { margin: '6px 0 0', fontSize: 18, color: '#0f172a', fontWeight: 800 },
  dualGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 },
  panel: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  panelTitle: { margin: 0, fontSize: 13.5, fontWeight: 800, color: '#0f172a' },
  rowSplit: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: 12.5,
    color: '#334155',
    padding: '6px 0',
    borderBottom: '1px dashed #cbd5e1',
  },
  totalRow: {
    marginTop: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 13,
    fontWeight: 800,
    color: '#0f172a',
    paddingTop: 8,
  },
  emptyText: { margin: 0, color: '#6b7280', fontSize: 12.5 },
  netCard: {
    border: '1px solid #d1d5db',
    borderRadius: 12,
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 15,
    fontWeight: 800,
  },
  tableWrap: {
    overflow: 'auto',
    border: '1px solid #000000',
    borderRadius: 12,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 840,
  },
  th: {
    background: '#f8fafc',
    color: '#0f172a',
    fontSize: 11,
    textTransform: 'none',
    letterSpacing: 0,
    fontWeight: 800,
    textAlign: 'left',
    padding: '10px 10px',
    border: '1px solid #000000',
  },
  tr: { borderTop: '1px solid #000000' },
  td: {
    padding: '9px 10px',
    fontSize: 12.5,
    color: '#273529',
    verticalAlign: 'top',
    border: '1px solid #000000',
  },
  tFoot: { background: '#eff6fc', borderTop: '1px solid #000000', fontWeight: 800 },
  emptyCell: {
    padding: '16px 10px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 12.5,
  },
}
