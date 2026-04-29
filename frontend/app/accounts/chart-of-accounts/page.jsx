'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountLayout from '@/presentation/layouts/AccountLayout'
import { Plus, Search, BookOpen, Trash2, Pencil, AlertTriangle } from 'lucide-react'
import {
  ACCOUNT_GROUP_OPTIONS,
  calculateDepreciationForConfig,
  loadChartAccountsFromStorage,
  loadDepreciationConfigsFromStorage,
  loadLedgerEntriesFromStorage,
  shouldShowAccountInMainTable,
  softDeleteChartAccount,
} from '@/application/services/accounts/accountsWorkflow'

const TYPE_COLORS = {
  Assets: { accent: '#2d7a33', bg: '#e8eee8' },
  Liabilities: { accent: '#2a6f31', bg: '#eef2ee' },
  Equity: { accent: '#0f766e', bg: '#f0fdfa' },
  Revenue: { accent: '#16a34a', bg: '#f0fdf4' },
  Expenses: { accent: '#b45309', bg: '#fffbeb' },
}

const methodLabel = (method) => (method === 'reducing-balance' ? 'Reducing Balance Method' : 'Straight Line Method')

function DeleteConfirmModal({ account, onConfirm, onCancel, deleting, deleteError }) {
  if (!account) return null
  return (
    <div style={m.overlay}>
      <div style={m.modal}>
        <div style={m.iconWrap}>
          <AlertTriangle size={28} color="#dc2626" />
        </div>
        <h2 style={m.title}>Delete Account?</h2>
        <p style={m.sub}>
          You are about to delete <strong>{account.code} — {account.name}</strong>.
        </p>
        <div style={m.detailBox}>
          <p style={m.detailRow}><span style={m.detailLabel}>Type</span><span>{account.type}</span></p>
          <p style={m.detailRow}><span style={m.detailLabel}>Subcategory</span><span>{account.subcategory || '—'}</span></p>
          <p style={m.detailRow}><span style={m.detailLabel}>Current Balance</span><span style={{ fontWeight: 700, color: '#1a3d1f' }}>Rs {(Number(account.balance) || 0).toLocaleString()}</span></p>
        </div>
        <p style={m.warning}>
          ⚠ This will soft-delete the account and all its child accounts. Accounts with posted transactions cannot be deleted.
        </p>
        {deleteError ? <p style={m.errorText}>{deleteError}</p> : null}
        <div style={m.actions}>
          <button style={m.cancelBtn} onClick={onCancel} disabled={deleting}>Cancel</button>
          <button style={m.deleteBtn} onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Yes, Delete Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChartOfAccountsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperuser = user?.role === 'superuser'

  const [accounts, setAccounts] = useState([])
  const [configs, setConfigs] = useState([])
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteNotice, setDeleteNotice] = useState('')

  const loadAll = () => {
    setAccounts(loadChartAccountsFromStorage())
    setConfigs(loadDepreciationConfigsFromStorage())
    setLedgerEntries(loadLedgerEntriesFromStorage())
  }

  useEffect(() => { loadAll() }, [])

  const visibleAccounts = useMemo(() => accounts.filter(shouldShowAccountInMainTable), [accounts])
  const filterGroups = useMemo(() => ['All', ...ACCOUNT_GROUP_OPTIONS.map((group) => group.label)], [])

  const filtered = useMemo(() => {
    return visibleAccounts.filter((account) => {
      const matchSearch = `${account.name} ${account.code} ${account.type} ${account.subcategory}`.toLowerCase().includes(search.toLowerCase())
      const matchType = filterType === 'All' || account.type === filterType
      return matchSearch && matchType
    })
  }, [visibleAccounts, filterType, search])

  const isDisposalEntry = (entry) => {
    const source = String(entry?.source || '').trim().toLowerCase()
    if (source === 'disposal') return true
    const text = `${entry?.description || ''} ${entry?.narration || ''} ${entry?.reference || ''}`.toLowerCase()
    return /dispose|disposal|sold|sale/.test(text)
  }

  const depreciationRows = useMemo(() => {
    return configs
      .flatMap((config) => {
        const asset = accounts.find((account) => account.code === config.assetCode && !account.deletedAt)
        if (!asset) return []

        const assetLedger = ledgerEntries.filter((entry) => (
          String(entry.status || '').toLowerCase() === 'posted' &&
          String(entry.accountCode || '').trim() === asset.code
        ))
        const openingBalance = Number(asset.openingBalance) || 0
        const assetCostFromJournal = assetLedger
          .filter((entry) => !isDisposalEntry(entry) && String(entry.source || '').toLowerCase() !== 'depreciation')
          .reduce((sum, entry) => sum + (Number(entry.debit) || 0), 0)
        const disposalRows = assetLedger
          .filter((entry) => isDisposalEntry(entry))
          .map((entry, index) => ({
            id: `${asset.code}-disposal-${entry.id}-${index}`,
            assetCode: config.assetCode,
            assetName: asset.name,
            rowType: 'Disposal',
            date: entry.date || '-',
            voucherNo: entry.id || '-',
            cost: (Number(entry.debit) || 0) - (Number(entry.credit) || 0),
            method: null,
            salvageValue: null,
            usefulLifeYears: null,
            rate: null,
            accumulated: null,
            bookValue: null,
          }))

        const snapshot = calculateDepreciationForConfig(config)
        return [
          {
            id: `${asset.code}-opening`,
            assetCode: config.assetCode,
            assetName: asset.name,
            rowType: 'Opening Balance',
            date: '-',
            voucherNo: '-',
            cost: openingBalance,
            method: null,
            salvageValue: null,
            usefulLifeYears: null,
            rate: null,
            accumulated: null,
            bookValue: null,
            groupEnd: false,
          },
          {
            id: `${asset.code}-asset-cost`,
            assetCode: config.assetCode,
            assetName: asset.name,
            rowType: 'Asset Cost (Journal)',
            date: '-',
            voucherNo: '-',
            cost: assetCostFromJournal,
            method: snapshot.method,
            salvageValue: snapshot.salvageValue,
            usefulLifeYears: snapshot.usefulLifeYears,
            rate: snapshot.rate,
            accumulated: snapshot.totalAccumulated,
            bookValue: snapshot.bookValue,
            groupEnd: disposalRows.length === 0,
          },
          ...disposalRows.map((row, index) => ({
            ...row,
            groupEnd: index === disposalRows.length - 1,
          })),
        ]
      })
  }, [accounts, configs, ledgerEntries])

  const fmt = (numberValue) => `Rs ${Number(numberValue || 0).toLocaleString()}`

  // ── Delete handlers ────────────────────────────────────────────────────────

  const handleDeleteClick = (account) => {
    setDeleteTarget(account)
    setDeleteError('')
  }

  const handleDeleteConfirm = () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      const actor = user?.name || user?.username || 'system'
      softDeleteChartAccount(deleteTarget.code, actor)
      setDeleteNotice(`Account ${deleteTarget.code} — ${deleteTarget.name} deleted successfully.`)
      setDeleteTarget(null)
      loadAll()
    } catch (error) {
      setDeleteError(error?.message || 'Unable to delete account. It may have posted transactions.')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteTarget(null)
    setDeleteError('')
  }

  return (
    <AccountLayout>
      <div style={s.page}>
        {/* Delete confirmation modal */}
        <DeleteConfirmModal
          account={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          deleting={deleting}
          deleteError={deleteError}
        />

        <section style={s.hero}>
          <div style={s.heroLeft}>
            <div style={s.heroIcon}><BookOpen size={22} color="#2d7a33" /></div>
            <div>
              <h1 style={s.title}>Chart of Accounts</h1>
              <p style={s.subtitle}>Financial summary dashboard — create, edit, and manage your accounts.</p>
            </div>
          </div>
          <div style={s.heroActions}>
            {isSuperuser ? (
              <button style={s.addBtn} onClick={() => router.push('/accounts/chart-of-accounts/new')}>
                <Plus size={15} /> Add Account
              </button>
            ) : null}
            <button style={s.journalBtn} onClick={() => router.push('/accounts/general-ledger/create')}>
              <Plus size={15} /> New Journal Entry
            </button>
          </div>
        </section>

        {deleteNotice ? (
          <p style={s.noticeText} onClick={() => setDeleteNotice('')}>{deleteNotice} &times;</p>
        ) : null}

        <div style={s.toolbar}>
          <div style={s.searchWrap}>
            <Search size={14} color="#7a8a7a" />
            <input
              style={s.searchInput}
              placeholder="Search accounts…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div style={s.filterGroup}>
            {filterGroups.map((type) => (
              <button
                key={type}
                style={{ ...s.filterBtn, ...(filterType === type ? s.filterBtnActive : {}) }}
                onClick={() => setFilterType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div style={s.summaryGrid}>
          {ACCOUNT_GROUP_OPTIONS.map((group) => {
            const total = visibleAccounts
              .filter((account) => account.type === group.label)
              .reduce((sum, account) => sum + account.balance, 0)
            const color = TYPE_COLORS[group.label] || TYPE_COLORS[group.type]
            return (
              <div key={group.label} style={{ ...s.summaryCard, background: color.bg, border: `1px solid ${color.accent}22` }}>
                <p style={{ ...s.summaryLabel, color: color.accent }}>{group.label}</p>
                <p style={{ ...s.summaryVal, color: color.accent }}>{fmt(total)}</p>
              </div>
            )
          })}
        </div>

        {/* ── COA Table ── */}
        <div style={s.tableCard}>
          <div style={s.cardHead}>
            <div>
              <h3 style={s.cardTitle}>Chart of Accounts</h3>
              <p style={s.cardSub}>
                Account balances, categories, and management actions. Superusers can edit or delete accounts without posted transactions.
              </p>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={s.th}>Account Code</th>
                  <th style={s.th}>Account Name</th>
                  <th style={s.th}>Category</th>
                  <th style={s.th}>Subcategory</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Total Balance</th>
                  {isSuperuser ? <th style={{ ...s.th, textAlign: 'center' }}>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((account) => (
                  <tr key={account.id} style={s.trow}>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontWeight: 700, color: '#415443' }}>{account.code}</td>
                    <td style={s.td}>
                      <span style={{ paddingLeft: Math.max(0, (account.level - 1) * 16), display: 'inline-block' }}>
                        {account.name}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{
                        ...s.typeBadge,
                        background: (TYPE_COLORS[account.type]?.bg || '#f2f4f2'),
                        color: (TYPE_COLORS[account.type]?.accent || '#415443'),
                      }}>
                        {account.type}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: '#64748b' }}>{account.subcategory || '—'}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>
                      {fmt(account.balance)}
                    </td>
                    {isSuperuser ? (
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <div style={s.actionRow}>
                          <button
                            style={s.editBtn}
                            title="Edit account"
                            onClick={() => router.push(`/accounts/chart-of-accounts/new?edit=${account.code}`)}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            style={s.deleteBtn}
                            title="Delete account"
                            onClick={() => handleDeleteClick(account)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 ? <p style={s.empty}>No accounts match your search.</p> : null}
        </div>

        {/* ── Depreciation Summary ── */}
        <div style={s.tableCard}>
          <div style={s.cardHead}>
            <h3 style={s.cardTitle}>Depreciation Summary</h3>
            <p style={s.cardSub}>Asset-wise impact summary from posted GL depreciation entries.</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={s.th}>Asset</th>
                  <th style={s.th}>Row Type</th>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Voucher</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Cost</th>
                  <th style={s.th}>Method</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Salvage Value</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Useful Life</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Rate</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Accumulated</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Book Value</th>
                </tr>
              </thead>
              <tbody>
                {depreciationRows.map((row) => (
                  <tr key={row.id} style={{ ...s.trow, ...(row.groupEnd ? s.trowGroupEnd : {}) }}>
                    <td style={s.td}>{row.assetCode} — {row.assetName}</td>
                    <td style={s.td}>{row.rowType}</td>
                    <td style={s.td}>{row.date || '-'}</td>
                    <td style={s.td}>{row.voucherNo || '-'}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(row.cost)}</td>
                    <td style={s.td}>{row.method ? methodLabel(row.method) : '-'}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{row.salvageValue != null ? fmt(row.salvageValue) : '-'}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{row.usefulLifeYears > 0 ? `${row.usefulLifeYears} yrs` : '-'}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{row.rate > 0 ? `${row.rate}%` : '-'}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{row.accumulated != null ? fmt(row.accumulated) : '-'}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{row.bookValue != null ? fmt(row.bookValue) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {depreciationRows.length === 0 ? <p style={s.empty}>No depreciation-configured assets found.</p> : null}
        </div>
      </div>
    </AccountLayout>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  page: { width: '100%', display: 'flex', flexDirection: 'column', gap: 20 },
  hero: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
    background: 'linear-gradient(135deg, rgb(26, 61, 31) 0%, rgb(45, 122, 51) 100%)',
    borderRadius: 28, padding: '24px 28px',
  },
  heroLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  heroActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  heroIcon: { width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#d4dfd4' },
  addBtn: { display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', color: '#1a5c22', border: 'none', borderRadius: '999px', padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  journalBtn: { display: 'flex', alignItems: 'center', gap: 8, background: '#1a3d1f', color: '#ffffff', border: '1px solid #ffffff55', borderRadius: '999px', padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  noticeText: { margin: 0, padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, color: '#065f46', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' },
  toolbar: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 40, padding: '8px 16px', flex: '0 1 280px' },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#1a3d1f', flex: 1, fontFamily: 'inherit' },
  filterGroup: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  filterBtn: { padding: '7px 16px', borderRadius: 999, border: '1px solid #e2e8e2', background: '#f2f4f2', color: '#415443', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  filterBtnActive: { background: '#2d7a33', color: '#fff', border: '1px solid #2d7a33' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  summaryCard: { borderRadius: 20, padding: '14px 18px' },
  summaryLabel: { margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' },
  summaryVal: { margin: '6px 0 0', fontSize: 18, fontWeight: 800 },
  tableCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 24, overflow: 'hidden' },
  cardHead: { padding: '14px 16px', borderBottom: '1px solid #e2e8e2', background: '#f7faf7' },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 800, color: '#1a3d1f' },
  cardSub: { margin: '3px 0 0', fontSize: 12, color: '#64748b' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 700 },
  thead: { background: '#e8eee8' },
  th: { padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#415443', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', whiteSpace: 'nowrap' },
  trow: { borderTop: '1px solid #e2e8e2' },
  trowGroupEnd: { borderBottom: '2px solid #c5d4c5' },
  td: { padding: '11px 16px', fontSize: 13, color: '#1a3d1f', verticalAlign: 'middle' },
  typeBadge: { fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 8px' },
  actionRow: { display: 'inline-flex', gap: 6, alignItems: 'center' },
  editBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, border: '1px solid #c8d9c8', borderRadius: 8,
    background: '#fff', color: '#2d7a33', cursor: 'pointer',
  },
  deleteBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, border: '1px solid #fecaca', borderRadius: 8,
    background: '#fff', color: '#dc2626', cursor: 'pointer',
  },
  empty: { textAlign: 'center', padding: 32, color: '#8aa88a', fontSize: 14 },
}

// ── Modal styles ─────────────────────────────────────────────────────────────

const m = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 20, padding: '28px 28px 24px',
    maxWidth: 460, width: '100%', display: 'flex', flexDirection: 'column', gap: 14,
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  iconWrap: { display: 'flex', justifyContent: 'center' },
  title: { margin: 0, fontSize: 20, fontWeight: 800, color: '#1a1a1a', textAlign: 'center' },
  sub: { margin: 0, fontSize: 14, color: '#334155', textAlign: 'center' },
  detailBox: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  detailRow: { margin: 0, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#334155' },
  detailLabel: { fontWeight: 700, color: '#64748b' },
  warning: {
    margin: 0, fontSize: 12.5, color: '#92400e',
    background: '#fffbeb', border: '1px solid #fde68a',
    borderRadius: 10, padding: '9px 12px',
  },
  errorText: {
    margin: 0, fontSize: 12.5, fontWeight: 700,
    color: '#dc2626', background: '#fef2f2',
    border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px',
  },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: {
    border: '1px solid #d4dfd4', borderRadius: 999, background: '#fff',
    color: '#334155', padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  deleteBtn: {
    border: 'none', borderRadius: 999, background: '#dc2626',
    color: '#fff', padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
}

