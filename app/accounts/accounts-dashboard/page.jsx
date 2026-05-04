'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountLayout from '@/presentation/layouts/AccountLayout'
import {
  BookOpen,
  FileText,
  Users,
  UserCheck,
  Banknote,
  Receipt,
  BarChart3,
  Stamp,
  Settings,
  ChevronRight,
} from 'lucide-react'

const OPERATIONS = [
  { id: 'chart-of-accounts', label: 'Chart of Accounts', sub: 'Manage account heads and hierarchy', path: '/accounts/chart-of-accounts', icon: BookOpen, accent: '#2d7a33', bg: '#eaf5eb' },
  { id: 'general-ledger', label: 'General Ledger', sub: 'View posted entries and balances', path: '/accounts/general-ledger', icon: FileText, accent: '#2a6f31', bg: '#eaf5eb' },
  { id: 'accounts-payable', label: 'Accounts Payable', sub: 'Track supplier bills and payments', path: '/accounts/payable', icon: Users, accent: '#2c7a4a', bg: '#eaf5eb' },
  { id: 'accounts-receivable', label: 'Accounts Receivable', sub: 'Track customer dues and receipts', path: '/accounts/receivable', icon: UserCheck, accent: '#3d9448', bg: '#eaf5eb' },
  { id: 'cash-bank', label: 'Cash & Bank', sub: 'Manage cash books and bank ledgers', path: '/accounts/cash-bank', icon: Banknote, accent: '#25642d', bg: '#eaf5eb' },
  { id: 'expenses', label: 'Expenses', sub: 'Record and classify business expenses', path: '/accounts/expenses', icon: Receipt, accent: '#205628', bg: '#eaf5eb' },
  { id: 'reports', label: 'Financial Reports', sub: 'Profit/Loss, Balance Sheet and statements', path: '/accounts/reports', icon: BarChart3, accent: '#2f8740', bg: '#eaf5eb' },
  { id: 'vouchers', label: 'Vouchers', sub: 'Create receipt, payment and journal vouchers', path: '/accounts/vouchers', icon: Stamp, accent: '#2a6b2a', bg: '#eaf5eb' },
]

const QUICK_ACTIONS = [
  { id: 'general-ledger', label: 'New Journal Entry', path: '/accounts/general-ledger/create' },
  { id: 'vouchers', label: 'Create Voucher', path: '/accounts/vouchers' },
  { id: 'chart-of-accounts', label: 'Add Account Head', path: '/accounts/chart-of-accounts' },
  { id: 'expenses', label: 'Record Expense', path: '/accounts/expenses' },
]

export default function AccountsDashboardPage() {
  const router = useRouter()
  const { user, panel, hasPermission } = useAuthStore()
  const [globalQuery, setGlobalQuery] = useState('')
  const isSuperuser = user?.role === 'superuser'
  const normalizedQuery = globalQuery.trim().toLowerCase()

  useEffect(() => {
    const onPanelSearch = (event) => {
      const { panel: targetPanel, query } = event.detail || {}
      if (targetPanel !== 'account') return
      setGlobalQuery(String(query || ''))
    }

    window.addEventListener('panel-global-search', onPanelSearch)
    return () => window.removeEventListener('panel-global-search', onPanelSearch)
  }, [])

  const visibleOperations = useMemo(() => {
    return OPERATIONS.filter((item) => {
      if (!isSuperuser && !hasPermission(item.id)) return false
      if (!normalizedQuery) return true
      return `${item.label} ${item.sub} ${item.id} ${item.path}`.toLowerCase().includes(normalizedQuery)
    })
  }, [hasPermission, isSuperuser, normalizedQuery])

  const visibleQuickActions = useMemo(() => {
    return QUICK_ACTIONS.filter((item) => {
      if (!isSuperuser && !hasPermission(item.id)) return false
      if (!normalizedQuery) return true
      return `${item.label} ${item.id} ${item.path}`.toLowerCase().includes(normalizedQuery)
    })
  }, [hasPermission, isSuperuser, normalizedQuery])

  return (
    <AccountLayout>
      <div style={s.page}>
        <section style={s.hero}>
          <div>
            <h1 style={s.title}>Accounts Operations Dashboard</h1>
            <p style={s.subtitle}>Welcome, {user?.username || 'User'}.</p>
          </div>
          <button style={s.heroBtn} onClick={() => router.push('/accounts/reports')}>
            <BarChart3 size={14} /> Open Reports
          </button>
        </section>

        <section style={s.stats}>
          <article style={s.statCard}>
            <p style={s.statLabel}>Assigned Modules</p>
            <p style={s.statVal}>{visibleOperations.length}</p>
          </article>
          <article style={s.statCard}>
            <p style={s.statLabel}>Quick Actions</p>
            <p style={s.statVal}>{visibleQuickActions.length}</p>
          </article>
          <article style={s.statCard}>
            <p style={s.statLabel}>Account Type</p>
            <p style={s.statVal}>{isSuperuser ? 'Super User' : 'User'}</p>
          </article>
          <article style={s.statCard}>
            <p style={s.statLabel}>Active Panel</p>
            <p style={s.statVal}>{panel ? panel[0].toUpperCase() + panel.slice(1) : 'Account'}</p>
          </article>
        </section>

        <section style={s.section}>
          <div style={s.sectionHead}>
            <h2 style={s.sectionTitle}>Operations</h2>
            <p style={s.sectionSub}>Modules available in your account permissions</p>
          </div>
          <div style={s.grid}>
            {visibleOperations.length > 0 ? visibleOperations.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  style={s.card}
                  onClick={() => router.push(item.path)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #edf5ee 0%, #e1efe3 100%)'
                    e.currentTarget.style.borderColor = '#1f5c2a'
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(31, 92, 42, 0.12)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f2f4f2'
                    e.currentTarget.style.borderColor = '#e2e8e2'
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div style={s.cardTop}>
                    <div style={{ ...s.iconWrap, color: item.accent, backgroundColor: item.bg }}>
                      <Icon size={17} />
                    </div>
                    <ChevronRight size={14} color="#8aa88a" />
                  </div>
                  <p style={s.cardTitle}>{item.label}</p>
                  <p style={s.cardSub}>{item.sub}</p>
                </button>
              )
            }) : <p style={s.empty}>No modules match your search.</p>}
          </div>
        </section>

        <section style={s.section}>
          <div style={s.sectionHead}>
            <h2 style={s.sectionTitle}>Quick Actions</h2>
            <p style={s.sectionSub}>Fast links for frequent accounting tasks</p>
          </div>
          <div style={s.quickWrap}>
            {visibleQuickActions.length > 0 ? visibleQuickActions.map((item, index) => (
              <button key={`${item.id}-${item.path}-${index}`} style={s.quickBtn} onClick={() => router.push(item.path)}>
                <span>{item.label}</span>
                <ChevronRight size={14} color="#8aa88a" />
              </button>
            )) : <p style={s.empty}>No quick actions are available for your current permissions.</p>}
          </div>
        </section>

        {isSuperuser ? (
          <section style={s.section}>
            <div style={s.sectionHead}>
              <h2 style={s.sectionTitle}>Administration</h2>
              <p style={s.sectionSub}>Account settings and controls</p>
            </div>
            <button style={s.quickBtn} onClick={() => router.push('/accounts/settings')}>
              <span style={s.adminLeft}><Settings size={13} color="#2d7a33" /> Accounts Settings</span>
              <ChevronRight size={14} color="#8aa88a" />
            </button>
          </section>
        ) : null}
      </div>
    </AccountLayout>
  )
}

const s = {
  page: { width: '100%', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'inherit' },
  hero: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    borderRadius: 24,
    padding: 'clamp(14px, 3vw, 24px)',
    background: 'linear-gradient(135deg, rgb(26, 61, 31) 0%, rgb(45, 122, 51) 100%)',
  },
  title: { margin: 0, fontSize: 'clamp(20px, 4.2vw, 28px)', fontWeight: 800, color: '#fff' },
  subtitle: { margin: '6px 0 0', fontSize: 13.5, color: '#d4dfd4' },
  heroBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    border: 'none',
    borderRadius: 999,
    background: '#fff',
    color: '#1a5c22',
    fontSize: 13,
    fontWeight: 700,
    padding: '10px 18px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 },
  statCard: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 20, padding: '14px 16px' },
  statLabel: { margin: 0, fontSize: 11.5, color: '#7a8a7a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },
  statVal: { margin: '6px 0 0', fontSize: 24, color: '#1a3d1f', fontWeight: 800 },
  section: { background: '#f2f4f2', border: '1px solid #e2e8e2', borderRadius: 20, padding: 'clamp(12px, 2.8vw, 18px) clamp(12px, 3vw, 20px)' },
  sectionHead: { marginBottom: 12 },
  sectionTitle: { margin: 0, fontSize: 16, color: '#1a3d1f', fontWeight: 800 },
  sectionSub: { margin: '4px 0 0', fontSize: 12.5, color: '#7a8a7a' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 },
  card: {
    border: '1px solid #e2e8e2',
    borderRadius: 20,
    padding: '18px',
    background: '#f2f4f2',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    transition: '0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
    fontFamily: 'inherit',
  },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#eaf5eb',
  },
  cardTitle: { margin: '10px 0 4px', color: '#1a3d1f', fontSize: 14, fontWeight: 800 },
  cardSub: { margin: 0, color: '#7a8a7a', fontSize: 12.5, lineHeight: 1.4 },
  quickWrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  quickBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    border: '1px solid #d4dfd4',
    background: '#fff',
    color: '#1a3d1f',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'left',
    padding: '10px 12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  adminLeft: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  empty: { margin: 0, color: '#8aa88a', fontSize: 13 },
}


