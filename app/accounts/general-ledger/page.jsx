'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import AccountLayout from '@/presentation/layouts/AccountLayout'
import {
  adjustBalanceByEntryType,
  deleteJournalVoucher,
  getLedgerAccountDropdownGroups,
  isPostableAccount,
  loadChartAccountsFromStorage,
  loadLedgerEntriesFromStorage,
  updateJournalVoucher,
} from '@/application/services/accounts/accountsWorkflow'

const CATEGORY_CONFIG = [
  {
    key: 'Assets',
    label: 'Assets',
    subgroups: [
      { key: 'Current Assets', label: 'Current Assets' },
      { key: 'Non-Current Assets', label: 'Non-Current Assets' },
    ],
  },
  {
    key: 'Liabilities',
    label: 'Liabilities',
    subgroups: [
      { key: 'Current Liabilities', label: 'Current Liabilities' },
      { key: 'Non-Current Liabilities', label: 'Non-Current Liabilities' },
    ],
  },
  { key: 'Equity', label: 'Equity', subgroups: [] },
  { key: 'Revenue', label: 'Revenues', subgroups: [] },
  { key: 'Expenses', label: 'Expenses', subgroups: [] },
]

const blankRow = () => ({ accountCode: '', debit: '', credit: '' })

function getSubgroupKey(account) {
  if (account.type === 'Assets') {
    return account.subcategory === 'Non-Current Assets' ? 'Non-Current Assets' : 'Current Assets'
  }

  if (account.type === 'Liabilities') {
    return account.subcategory === 'Non-Current Liabilities' ? 'Non-Current Liabilities' : 'Current Liabilities'
  }

  return ''
}

function getOpeningDebitCredit(type, openingBalance) {
  const amount = Number(openingBalance) || 0
  if (amount === 0) return { debit: 0, credit: 0 }
  const debitIncrease = type === 'Assets' || type === 'Expenses'

  if (amount > 0) {
    return debitIncrease ? { debit: amount, credit: 0 } : { debit: 0, credit: amount }
  }

  const absolute = Math.abs(amount)
  return debitIncrease ? { debit: 0, credit: absolute } : { debit: absolute, credit: 0 }
}

function sortLedgerEntries(a, b) {
  if (a.date !== b.date) return String(a.date).localeCompare(String(b.date))
  const createdDiff = Date.parse(a.createdAt || '') - Date.parse(b.createdAt || '')
  if (Number.isFinite(createdDiff) && createdDiff !== 0) return createdDiff
  if (a.id !== b.id) return String(a.id).localeCompare(String(b.id))
  return String(a.accountCode).localeCompare(String(b.accountCode))
}

function includesNeedle(value, needle) {
  return String(value || '').toLowerCase().includes(needle)
}

function AccountLedgerTable({ ledger, fmt, openEditModal, removeVoucher, openAccountEditor }) {
  return (
    <div style={s.accountTableWrap}>
      <table style={s.table}>
        <thead>
          <tr style={s.thead}>
            <th style={s.th}>Date</th>
            <th style={s.th}>Voucher No</th>
            <th style={s.th}>Description</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Debit</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Credit</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Running Balance</th>
            <th style={{ ...s.th, textAlign: 'center' }}>Lock</th>
            <th style={{ ...s.th, textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {ledger.visibleLines.map((line) => {
            const isOpening = line.lineType === 'opening'
            return (
              <tr key={line.id} style={s.trow}>
                <td style={s.td}>{line.date || '-'}</td>
                <td style={s.td}>
                  {isOpening ? <span style={s.openingTag}>OPEN</span> : <span style={s.voucherTag}>{line.voucherNo}</span>}
                </td>
                <td style={s.td}>{line.description || '-'}</td>
                <td style={{ ...s.td, textAlign: 'right', color: '#2d7a33', fontWeight: 600 }}>{fmt(line.debit)}</td>
                <td style={{ ...s.td, textAlign: 'right', color: '#2a6f31', fontWeight: 600 }}>{fmt(line.credit)}</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{fmt(line.runningBalance)}</td>
                <td style={{ ...s.td, textAlign: 'center' }}>
                  {isOpening ? <span style={{ ...s.badge, background: '#f8fafc', color: '#64748b' }}>Opening</span> : (
                    <span style={{ ...s.badge, background: '#f0fdf4', color: '#166534' }}>Editable</span>
                  )}
                </td>
                <td style={{ ...s.td, textAlign: 'center' }}>
                  {isOpening ? (
                    <button style={s.iconBtn} onClick={() => openAccountEditor(line.accountCode)} title="Edit Account">
                      <Pencil size={13} />
                    </button>
                  ) : (
                    <div style={s.actions}>
                      <button style={s.iconBtn} onClick={() => openEditModal(line.voucherNo)} title="Edit Voucher">
                        <Pencil size={13} />
                      </button>
                      <button style={s.iconBtn} onClick={() => removeVoucher(line.voucherNo)} title="Delete Voucher">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function GeneralLedgerPage() {
  const router = useRouter()
  const [entries, setEntries] = useState([])
  const [accounts, setAccounts] = useState([])
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [editing, setEditing] = useState(null)

  const [expandedTypes, setExpandedTypes] = useState({})
  const [expandedSubgroups, setExpandedSubgroups] = useState({})
  const [expandedAccounts, setExpandedAccounts] = useState({})

  const refreshState = () => {
    setEntries(loadLedgerEntriesFromStorage())
    setAccounts(loadChartAccountsFromStorage())
  }

  useEffect(() => {
    refreshState()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const refresh = () => refreshState()
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('accounts:storage-updated', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('accounts:storage-updated', refresh)
    }
  }, [])

  const accountGroups = useMemo(() => getLedgerAccountDropdownGroups(accounts), [accounts])
  const sortedEntries = useMemo(() => [...entries].sort(sortLedgerEntries), [entries])

  const accountLedgers = useMemo(() => {
    const entriesByAccount = new Map()
    sortedEntries.forEach((entry) => {
      const key = String(entry.accountCode || '').trim()
      if (!key) return
      if (!entriesByAccount.has(key)) entriesByAccount.set(key, [])
      entriesByAccount.get(key).push(entry)
    })

    const postingAccounts = accounts
      .filter((account) => isPostableAccount(account, accounts))
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))

    return postingAccounts.map((account) => {
      const openingBalance = Number(account.openingBalance) || 0
      const opening = getOpeningDebitCredit(account.type, openingBalance)
      const accountEntries = entriesByAccount.get(account.code) || []
      const isPurePlaceholder = openingBalance === 0 && accountEntries.length === 0
      if (isPurePlaceholder) return null
      let runningBalance = openingBalance

      const lines = [
        {
          lineType: 'opening',
          id: `OPEN-${account.code}`,
          voucherNo: 'OPEN',
          date: String(account.createdAt || '').slice(0, 10) || '-',
          description: 'Opening Balance',
          accountCode: account.code,
          debit: opening.debit,
          credit: opening.credit,
          runningBalance,
          locked: true,
        },
      ]

      accountEntries.forEach((entry, index) => {
        runningBalance += adjustBalanceByEntryType(account.type, Number(entry.debit) || 0, Number(entry.credit) || 0)
        lines.push({
          lineType: 'entry',
          id: `${entry.id}-${account.code}-${index}`,
          voucherNo: entry.id,
          date: entry.date,
          description: entry.description || entry.narration || '-',
          accountCode: entry.accountCode,
          debit: Number(entry.debit) || 0,
          credit: Number(entry.credit) || 0,
          runningBalance,
          locked: false,
        })
      })

      return {
        code: account.code,
        name: account.name,
        type: account.type,
        subcategory: account.subcategory,
        subgroupKey: getSubgroupKey(account),
        openingBalance,
        runningBalance,
        lines,
        transactionCount: accountEntries.length,
      }
    }).filter(Boolean)
  }, [accounts, sortedEntries])

  const visibleAccountLedgers = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return accountLedgers.map((item) => ({ ...item, visibleLines: item.lines }))

    return accountLedgers
      .map((ledger) => {
        const accountText = `${ledger.code} ${ledger.name} ${ledger.type} ${ledger.subcategory}`.toLowerCase()
        const accountMatches = accountText.includes(needle)
        const matchedLines = ledger.lines.filter((line) => (
          includesNeedle(line.voucherNo, needle) ||
          includesNeedle(line.date, needle) ||
          includesNeedle(line.description, needle) ||
          includesNeedle(line.debit, needle) ||
          includesNeedle(line.credit, needle)
        ))

        if (!accountMatches && matchedLines.length === 0) return null
        if (accountMatches) return { ...ledger, visibleLines: ledger.lines }

        return {
          ...ledger,
          visibleLines: [ledger.lines[0], ...matchedLines.filter((line) => line.lineType === 'entry')],
        }
      })
      .filter(Boolean)
  }, [accountLedgers, search])

  const hierarchy = useMemo(() => {
    return CATEGORY_CONFIG.map((category) => {
      const categoryAccounts = visibleAccountLedgers.filter((account) => account.type === category.key)
      if (category.subgroups.length === 0) {
        return {
          ...category,
          subgroups: [],
          accounts: categoryAccounts,
          accountCount: categoryAccounts.length,
          totalBalance: categoryAccounts.reduce((sum, account) => sum + account.runningBalance, 0),
        }
      }

      const subgroups = category.subgroups.map((subgroup) => {
        const subgroupAccounts = categoryAccounts.filter((account) => account.subgroupKey === subgroup.key)
        return {
          ...subgroup,
          accounts: subgroupAccounts,
          accountCount: subgroupAccounts.length,
          totalBalance: subgroupAccounts.reduce((sum, account) => sum + account.runningBalance, 0),
        }
      })

      return {
        ...category,
        subgroups,
        accounts: categoryAccounts,
        accountCount: categoryAccounts.length,
        totalBalance: categoryAccounts.reduce((sum, account) => sum + account.runningBalance, 0),
      }
    })
  }, [visibleAccountLedgers])

  const isTypeExpanded = (typeKey) => expandedTypes[typeKey] !== false
  const isSubgroupExpanded = (groupKey) => expandedSubgroups[groupKey] !== false
  const isAccountExpanded = (accountCode) => {
    if (search.trim()) return true
    return expandedAccounts[accountCode] === true
  }

  const toggleType = (typeKey) => {
    setExpandedTypes((prev) => {
      const current = prev[typeKey] !== false
      return { ...prev, [typeKey]: !current }
    })
  }

  const toggleSubgroup = (groupKey) => {
    setExpandedSubgroups((prev) => {
      const current = prev[groupKey] !== false
      return { ...prev, [groupKey]: !current }
    })
  }

  const toggleAccount = (accountCode) => {
    setExpandedAccounts((prev) => ({ ...prev, [accountCode]: !prev[accountCode] }))
  }

  const fmt = (value) => {
    const num = Number(value) || 0
    if (num === 0) return '-'
    const abs = Math.abs(num).toLocaleString()
    return num < 0 ? `-Rs ${abs}` : `Rs ${abs}`
  }

  const openEditModal = (voucherNo) => {
    if (!voucherNo || voucherNo === 'OPEN') return
    const voucherEntries = entries.filter((entry) => entry.id === voucherNo)
    if (voucherEntries.length === 0) return

    setEditing({
      voucherNo,
      date: voucherEntries[0].date || '',
      description: voucherEntries[0].description || voucherEntries[0].narration || '',
      reference: voucherEntries[0].reference || '',
      rows: voucherEntries.map((entry) => ({
        accountCode: entry.accountCode,
        debit: entry.debit > 0 ? String(entry.debit) : '',
        credit: entry.credit > 0 ? String(entry.credit) : '',
      })),
    })
    setFormError('')
  }

  const setEditRow = (index, key, value) => {
    setEditing((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        rows: prev.rows.map((row, idx) => (idx === index ? { ...row, [key]: value } : row)),
      }
    })
  }

  const addEditRow = () => {
    setEditing((prev) => (prev ? { ...prev, rows: [...prev.rows, blankRow()] } : prev))
  }

  const saveEdit = () => {
    if (!editing) return

    const normalizedRows = editing.rows
      .map((row) => ({ accountCode: String(row.accountCode || '').trim(), debit: Number(row.debit) || 0, credit: Number(row.credit) || 0 }))
      .filter((row) => row.accountCode && (row.debit > 0 || row.credit > 0))

    const totalDebit = normalizedRows.reduce((sum, row) => sum + row.debit, 0)
    const totalCredit = normalizedRows.reduce((sum, row) => sum + row.credit, 0)

    if (!editing.date || !editing.description.trim() || normalizedRows.length < 2 || Math.abs(totalDebit - totalCredit) > 0.0001 || totalDebit <= 0) {
      setFormError('Provide date/description, at least two rows, and keep the voucher balanced.')
      return
    }

    try {
      updateJournalVoucher({
        voucherNo: editing.voucherNo,
        date: editing.date,
        description: editing.description.trim(),
        reference: editing.reference.trim(),
        rows: normalizedRows,
      })
      setEditing(null)
      refreshState()
    } catch (error) {
      setFormError(error?.message || 'Unable to update voucher')
    }
  }

  const removeVoucher = (voucherNo) => {
    if (!voucherNo || voucherNo === 'OPEN') return
    if (!window.confirm(`Delete voucher ${voucherNo}?`)) return

    try {
      deleteJournalVoucher(voucherNo)
      refreshState()
    } catch (error) {
      setFormError(error?.message || 'Unable to delete voucher')
    }
  }

  const openAccountEditor = (accountCode) => {
    const code = String(accountCode || '').trim()
    if (!code) return
    router.push(`/accounts/chart-of-accounts/new?edit=${encodeURIComponent(code)}`)
  }

  const renderAccounts = (accountList) => {
    if (accountList.length === 0) return <p style={s.emptySmall}>No accounts in this section.</p>

    return accountList.map((ledger) => {
      const accountExpanded = isAccountExpanded(ledger.code)
      return (
        <div key={ledger.code} style={s.accountWrap}>
          <button style={s.treeLevel3} onClick={() => toggleAccount(ledger.code)}>
            <span style={s.treeToggle}>{accountExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
            <span style={s.treeLabel}>{ledger.code} - {ledger.name}</span>
            <span style={s.treeMeta}>{ledger.transactionCount} entries | Balance {fmt(ledger.runningBalance)}</span>
          </button>
          {accountExpanded ? (
            <AccountLedgerTable
              ledger={ledger}
              fmt={fmt}
              openEditModal={openEditModal}
              removeVoucher={removeVoucher}
              openAccountEditor={openAccountEditor}
            />
          ) : null}
        </div>
      )
    })
  }

  return (
    <AccountLayout>
      <div style={s.page}>
        <section style={s.hero}>
          <div style={s.heroLeft}>
            <div style={s.heroIcon}><FileText size={22} color="#2d7a33" /></div>
            <div>
              <h1 style={s.title}>General Ledger</h1>
              <p style={s.subtitle}>Detailed transaction layer with expandable hierarchy (Category &gt; Subgroup &gt; Account &gt; Transactions).</p>
            </div>
          </div>
          <button style={s.addBtn} onClick={() => router.push('/accounts/general-ledger/create')}>
            <Plus size={15} /> New Journal Entry
          </button>
        </section>

        <div style={s.summaryRow}>
          <div style={s.sumCard}>
            <p style={s.sumLabel}>Total Debits</p>
            <p style={s.sumVal}>Rs {entries.reduce((sum, entry) => sum + (Number(entry.debit) || 0), 0).toLocaleString()}</p>
          </div>
          <div style={s.sumCard}>
            <p style={s.sumLabel}>Total Credits</p>
            <p style={s.sumVal}>Rs {entries.reduce((sum, entry) => sum + (Number(entry.credit) || 0), 0).toLocaleString()}</p>
          </div>
          <div style={{ ...s.sumCard, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <p style={{ ...s.sumLabel, color: '#16a34a' }}>Audit Lock</p>
            <p style={{ ...s.sumVal, color: '#16a34a', fontSize: 16 }}>Disabled</p>
          </div>
        </div>

        <div style={s.toolbar}>
          <div style={s.searchWrap}>
            <Search size={14} color="#7a8a7a" />
            <input style={s.searchInput} placeholder="Search account/voucher/description..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>

        <div style={s.tableCard}>
          <div style={s.cardHead}>
            <h3 style={s.cardTitle}>GL Tree View</h3>
            <p style={s.cardSub}>Accounts appear immediately with opening balance; transactions are nested under each account.</p>
          </div>

          <div style={s.treeWrap}>
            {hierarchy.map((category) => {
              const categoryExpanded = isTypeExpanded(category.key)
              return (
                <div key={category.key} style={s.treeBlock}>
                  <button style={s.treeLevel1} onClick={() => toggleType(category.key)}>
                    <span style={s.treeToggle}>{categoryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                    <span style={s.treeLabel}>{category.label}</span>
                    <span style={s.treeMeta}>{category.accountCount} accounts | {fmt(category.totalBalance)}</span>
                  </button>

                  {categoryExpanded ? (
                    category.subgroups.length > 0 ? (
                      category.subgroups.map((subgroup) => {
                        const subgroupKey = `${category.key}|${subgroup.key}`
                        const subgroupExpanded = isSubgroupExpanded(subgroupKey)
                        return (
                          <div key={subgroupKey} style={s.subgroupWrap}>
                            <button style={s.treeLevel2} onClick={() => toggleSubgroup(subgroupKey)}>
                              <span style={s.treeToggle}>{subgroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                              <span style={s.treeLabel}>{subgroup.label}</span>
                              <span style={s.treeMeta}>{subgroup.accountCount} accounts | {fmt(subgroup.totalBalance)}</span>
                            </button>
                            {subgroupExpanded ? renderAccounts(subgroup.accounts) : null}
                          </div>
                        )
                      })
                    ) : (
                      <div style={s.subgroupWrap}>{renderAccounts(category.accounts)}</div>
                    )
                  ) : null}
                </div>
              )
            })}
          </div>

          {visibleAccountLedgers.length === 0 ? <p style={s.empty}>No accounts or entries match your search.</p> : null}
        </div>

        {formError ? <p style={s.errorText}>{formError}</p> : null}

        {editing ? (
          <div style={s.overlay} onClick={() => setEditing(null)}>
            <div style={s.modal} onClick={(event) => event.stopPropagation()}>
              <h3 style={s.modalTitle}>Edit Voucher {editing.voucherNo}</h3>
              <div style={s.row2}>
                <div style={s.field}>
                  <label style={s.label}>Date</label>
                  <input type="date" style={s.input} value={editing.date} onChange={(event) => setEditing((prev) => (prev ? { ...prev, date: event.target.value } : prev))} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Reference</label>
                  <input style={s.input} value={editing.reference} onChange={(event) => setEditing((prev) => (prev ? { ...prev, reference: event.target.value } : prev))} />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Description</label>
                <input style={s.input} value={editing.description} onChange={(event) => setEditing((prev) => (prev ? { ...prev, description: event.target.value } : prev))} />
              </div>

              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr style={s.thead}>
                      <th style={s.th}>Account</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Debit</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editing.rows.map((row, index) => (
                      <tr key={`${editing.voucherNo}-${index}`} style={s.trow}>
                        <td style={s.td}>
                          <select style={s.input} value={row.accountCode} onChange={(event) => setEditRow(index, 'accountCode', event.target.value)}>
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
                          <input type="number" min="0" step="0.01" style={{ ...s.input, textAlign: 'right' }} value={row.debit} onChange={(event) => setEditRow(index, 'debit', event.target.value)} />
                        </td>
                        <td style={s.td}>
                          <input type="number" min="0" step="0.01" style={{ ...s.input, textAlign: 'right' }} value={row.credit} onChange={(event) => setEditRow(index, 'credit', event.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button style={s.addRowBtn} onClick={addEditRow}>+ Add Row</button>

              <div style={s.modalActions}>
                <button style={s.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
                <button style={s.saveBtn} onClick={saveEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AccountLayout>
  )
}

const s = {
  page: { width: '100%', display: 'flex', flexDirection: 'column', gap: 20 },
  hero: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: 'linear-gradient(135deg, rgb(26, 61, 31) 0%, rgb(45, 122, 51) 100%)', borderRadius: 24, padding: 'clamp(14px, 3vw, 24px)' },
  heroLeft: { display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: '1 1 320px' },
  heroIcon: { width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { margin: 0, fontSize: 'clamp(18px, 3.2vw, 22px)', fontWeight: 800, color: '#fff' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#d4dfd4' },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#ffffff',
    color: '#1a5c22',
    border: 'none',
    borderRadius: '999px',
    padding: '10px 22px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 },
  sumCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 20, padding: '16px 20px' },
  sumLabel: { margin: 0, fontSize: 11, fontWeight: 700, color: '#7a8a7a', textTransform: 'uppercase', letterSpacing: '0.5px' },
  sumVal: { margin: '6px 0 0', fontSize: 22, fontWeight: 800, color: '#1a3d1f' },
  toolbar: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 40, padding: '8px 16px', flex: '0 1 360px' },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#1a3d1f', flex: 1, fontFamily: 'inherit' },
  tableCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 24, overflow: 'hidden' },
  cardHead: { padding: '14px 16px', borderBottom: '1px solid #e2e8e2', background: '#f7faf7' },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 800, color: '#1a3d1f' },
  cardSub: { margin: '3px 0 0', fontSize: 12, color: '#64748b' },
  treeWrap: { padding: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  treeBlock: { border: '1px solid #dce7dc', borderRadius: 14, overflow: 'hidden', background: '#ffffff' },
  treeLevel1: { width: '100%', border: 'none', background: '#e8eee8', color: '#1a3d1f', padding: '10px 12px', display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left' },
  subgroupWrap: { borderTop: '1px solid #edf2ed' },
  treeLevel2: { width: '100%', border: 'none', background: '#f5f9f5', color: '#1a3d1f', padding: '9px 12px 9px 28px', display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left' },
  accountWrap: { borderTop: '1px solid #edf2ed' },
  treeLevel3: { width: '100%', border: 'none', background: '#ffffff', color: '#1a3d1f', padding: '8px 12px 8px 44px', display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left' },
  treeToggle: { width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#4b5f4d' },
  treeLabel: { fontSize: 13, fontWeight: 700 },
  treeMeta: { fontSize: 12, color: '#64748b', fontWeight: 600 },
  accountTableWrap: { padding: '0 12px 12px 56px', background: '#ffffff' },
  tableWrap: { border: '1px solid #e2e8e2', borderRadius: 12, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#e8eee8' },
  th: { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#415443', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' },
  trow: { borderTop: '1px solid #e2e8e2' },
  td: { padding: '10px 12px', fontSize: 12, color: '#1a3d1f' },
  voucherTag: { background: '#e8eee8', color: '#2d7a33', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700 },
  openingTag: { background: '#f1f5f9', color: '#475569', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700 },
  badge: { borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 },
  lockedText: { color: '#64748b', fontSize: 12, fontWeight: 600 },
  actions: { display: 'inline-flex', gap: 6 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid #c5d4c5',
    background: '#ffffff',
    color: '#1a3d1f',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  addRowBtn: { border: '1px dashed #c5d4c5', borderRadius: 999, background: '#ffffff', color: '#2d7a33', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', width: 'fit-content' },
  empty: { textAlign: 'center', padding: 24, color: '#8aa88a', fontSize: 14 },
  emptySmall: { margin: 0, padding: '10px 16px', color: '#8aa88a', fontSize: 13 },
  errorText: { margin: 0, color: '#b91c1c', fontSize: 13, fontWeight: 600 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 },
  modal: { width: '100%', maxWidth: 900, background: '#fff', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  modalTitle: { margin: 0, fontSize: 18, color: '#1a3d1f' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, color: '#415443', fontWeight: 700 },
  input: { border: '1px solid #d4dfd4', borderRadius: 10, background: '#ffffff', color: '#1e2f1f', padding: '10px 12px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  cancelBtn: { padding: '8px 12px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 700, cursor: 'pointer' },
  saveBtn: { padding: '8px 12px', borderRadius: 10, border: 'none', background: '#2d7a33', color: '#fff', fontWeight: 700, cursor: 'pointer' },
}

