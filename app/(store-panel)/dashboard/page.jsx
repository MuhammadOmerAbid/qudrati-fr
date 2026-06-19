'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { getTodayStoreEntries } from '@/application/services/store/storeEntryTracker'
import {
  dailyProductionApi,
  dashboardApi,
  finishedGoodsApi,
  gateInwardApi,
  gateOutwardApi,
  inventoryApi,
  productionOrderApi,
  requisitionApi,
} from '@/infrastructure/api/endpoints'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Factory,
  Package,
  BoxIcon,
  Warehouse,
  Plus,
  Settings,
  Shield,
  BookOpen,
  Tag,
  Grid3X3,
  Users,
  Calculator,
  ChevronRight,
} from 'lucide-react'

const OPERATIONS = [
  {
    id: 'gate-inward',
    title: 'Gate Inward',
    subtitle: 'Receive and track incoming raw material',
    path: '/gate-inward',
    icon: ArrowDownToLine,
    accent: '#2d7a33',
    bg: '#eaf5eb',
  },
  {
    id: 'goods-requisition',
    title: 'Goods Requisition',
    subtitle: 'Issue materials and monitor returns',
    path: '/requisition',
    icon: ClipboardList,
    accent: '#2f8740',
    bg: '#eaf5eb',
  },
  {
    id: 'gate-outward',
    title: 'Gate Outward',
    subtitle: 'Dispatch finished goods to customers',
    path: '/gate-outward',
    icon: ArrowUpFromLine,
    accent: '#2c7a4a',
    bg: '#eaf5eb',
  },
  {
    id: 'production-order',
    title: 'Production Order',
    subtitle: 'Plan and release production orders',
    path: '/production-order',
    icon: BoxIcon,
    accent: '#2a6f31',
    bg: '#eaf5eb',
  },
  {
    id: 'daily-production',
    title: 'Daily Production',
    subtitle: 'Record daily production activity',
    path: '/daily-production',
    icon: Factory,
    accent: '#3d9448',
    bg: '#eaf5eb',
  },
  {
    id: 'finished-goods',
    title: 'Finished Goods',
    subtitle: 'Track completed products and output',
    path: '/finished-goods',
    icon: Package,
    accent: '#25642d',
    bg: '#eaf5eb',
  },
  {
    id: 'inventory',
    title: 'Inventory',
    subtitle: 'Monitor stock and current balances',
    path: '/inventory',
    icon: Warehouse,
    accent: '#205628',
    bg: '#eaf5eb',
  },
]

const QUICK_ACTIONS = [
  { id: 'gate-inward', label: 'New Gate Inward Entry', path: '/gate-inward/new' },
  { id: 'goods-requisition', label: 'New Goods Requisition', path: '/requisition/new' },
  { id: 'daily-production', label: 'New Daily Production Entry', path: '/daily-production/new' },
  { id: 'gate-outward', label: 'New Gate Outward Entry', path: '/gate-outward/new' },
]

const SETTINGS_SHORTCUTS = [
  { label: 'Brands', path: '/settings/brands', icon: Tag },
  { label: 'Categories', path: '/settings/categories', icon: Grid3X3 },
  { label: 'Products', path: '/settings/products', icon: Package },
  { label: 'Customers', path: '/settings/customers', icon: Users },
  { label: 'Recipe', path: '/settings/recipe', icon: BookOpen },
  { label: 'CBM Calculator', path: '/settings/cbm-calculator', icon: Calculator },
]

const PROCESS_FLOW = [
  { label: 'Gate Inward', path: '/gate-inward' },
  { label: 'Goods Requisition', path: '/requisition' },
  { label: 'Production Order', path: '/production-order' },
  { label: 'Daily Production', path: '/daily-production' },
  { label: 'Finished Goods', path: '/finished-goods' },
  { label: 'Gate Outward', path: '/gate-outward' },
  { label: 'Inventory', path: '/inventory' },
]

const ENTRY_TRACKED_MODULES = [
  'gate-inward',
  'goods-requisition',
  'gate-outward',
  'production-order',
  'daily-production',
  'finished-goods',
]

const toList = (value) => (Array.isArray(value) ? value : (value?.results || []))
const fmtCount = (value) => Number(value || 0).toLocaleString()
const firstText = (...values) => {
  const found = values.find((value) => String(value ?? '').trim())
  return found || '-'
}

function latestGateInward(row = {}) {
  const item = Array.isArray(row.items) ? row.items[0] : null
  return firstText(item?.productName, item?.product_name, row.gr_no, row.grNo)
}

function latestRequisition(row = {}) {
  const item = Array.isArray(row.items) ? row.items[0] : null
  return firstText(item?.productName, item?.product_name, row.receiver_name, row.receiverName)
}

function latestGateOutward(row = {}) {
  const item = Array.isArray(row.items) ? row.items[0] : null
  return firstText(item?.productName, item?.product_name, row.customer_name, row.go_no)
}

function latestProductionOrder(row = {}) {
  const item = Array.isArray(row.items) ? row.items[0] : null
  return firstText(row.name, row.product?.name, item?.goods, row.status)
}

function latestDailyProduction(row = {}) {
  const entry = Array.isArray(row.entries) ? row.entries[0] : null
  return firstText(entry?.product, row.production_order?.name, row.date)
}

function latestFinishedGoods(row = {}) {
  const product = Array.isArray(row.products) ? row.products[0] : null
  return firstText(product?.product, row.product?.name, row.brand)
}

function latestInventory(row = {}) {
  return firstText(row.product, row.product_name, row.category, row.brand)
}

function buildOperationSummaries(today = {}, lists = {}) {
  const gateInward = lists.gateInward || []
  const requisitions = lists.requisitions || []
  const gateOutward = lists.gateOutward || []
  const productionOrders = lists.productionOrders || []
  const dailyProduction = lists.dailyProduction || []
  const finishedGoods = lists.finishedGoods || []
  const inventory = lists.inventory || []

  return {
    'gate-inward': [
      { label: 'Today', value: fmtCount(today.gate_inward_today) },
      { label: 'Total', value: fmtCount(gateInward.length) },
      { label: 'Latest', value: latestGateInward(gateInward[0]) },
    ],
    'goods-requisition': [
      { label: 'Today', value: fmtCount(today.requisitions_today) },
      { label: 'Total', value: fmtCount(requisitions.length) },
      { label: 'Latest', value: latestRequisition(requisitions[0]) },
    ],
    'gate-outward': [
      { label: 'Today', value: fmtCount(today.gate_outward_today) },
      { label: 'Total', value: fmtCount(gateOutward.length) },
      { label: 'Latest', value: latestGateOutward(gateOutward[0]) },
    ],
    'production-order': [
      { label: 'Pending', value: fmtCount(today.pending_production_orders) },
      { label: 'Total', value: fmtCount(productionOrders.length) },
      { label: 'Latest', value: latestProductionOrder(productionOrders[0]) },
    ],
    'daily-production': [
      { label: 'Today', value: fmtCount(today.daily_production_today) },
      { label: 'Total', value: fmtCount(dailyProduction.length) },
      { label: 'Latest', value: latestDailyProduction(dailyProduction[0]) },
    ],
    'finished-goods': [
      { label: 'Today', value: fmtCount(today.finished_goods_today) },
      { label: 'Total', value: fmtCount(finishedGoods.length) },
      { label: 'Latest', value: latestFinishedGoods(finishedGoods[0]) },
    ],
    inventory: [
      { label: 'Items', value: fmtCount(today.inventory_items || inventory.length) },
      { label: 'Total Stock', value: fmtCount(inventory.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)) },
      { label: 'Latest', value: latestInventory(inventory[0]) },
    ],
  }
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuthStore()
  const router = useRouter()
  const [globalQuery, setGlobalQuery] = useState('')
  const [todayEntries, setTodayEntries] = useState(0)
  const [dashboardToday, setDashboardToday] = useState({})
  const [operationSummaries, setOperationSummaries] = useState(() => buildOperationSummaries())
  const [dashboardLoading, setDashboardLoading] = useState(false)

  const isSuperuser = user?.role === 'superuser'
  const normalizedQuery = globalQuery.trim().toLowerCase()

  useEffect(() => {
    const onPanelSearch = (event) => {
      const { panel: targetPanel, query } = event.detail || {}
      if (targetPanel !== 'store') return
      setGlobalQuery(String(query || ''))
    }

    window.addEventListener('panel-global-search', onPanelSearch)
    return () => window.removeEventListener('panel-global-search', onPanelSearch)
  }, [])

  const refreshTodayEntries = useCallback(() => {
    const allowedModules = ENTRY_TRACKED_MODULES.filter((moduleId) => (
      isSuperuser || hasPermission(moduleId)
    ))
    setTodayEntries(getTodayStoreEntries(allowedModules))
  }, [hasPermission, isSuperuser])

  useEffect(() => {
    refreshTodayEntries()

    window.addEventListener('store-entries-updated', refreshTodayEntries)
    window.addEventListener('focus', refreshTodayEntries)
    return () => {
      window.removeEventListener('store-entries-updated', refreshTodayEntries)
      window.removeEventListener('focus', refreshTodayEntries)
    }
  }, [refreshTodayEntries])

  const loadDashboardCards = useCallback(async () => {
    setDashboardLoading(true)
    const [
      todayRes,
      gateInwardRes,
      requisitionRes,
      gateOutwardRes,
      productionOrderRes,
      dailyProductionRes,
      finishedGoodsRes,
      inventoryRes,
    ] = await Promise.allSettled([
      dashboardApi.today(),
      gateInwardApi.list(),
      requisitionApi.list(),
      gateOutwardApi.list(),
      productionOrderApi.list(),
      dailyProductionApi.list(),
      finishedGoodsApi.list(),
      inventoryApi.list(),
    ])

    const today = todayRes.status === 'fulfilled' ? (todayRes.value || {}) : {}
    const lists = {
      gateInward: gateInwardRes.status === 'fulfilled' ? toList(gateInwardRes.value) : [],
      requisitions: requisitionRes.status === 'fulfilled' ? toList(requisitionRes.value) : [],
      gateOutward: gateOutwardRes.status === 'fulfilled' ? toList(gateOutwardRes.value) : [],
      productionOrders: productionOrderRes.status === 'fulfilled' ? toList(productionOrderRes.value) : [],
      dailyProduction: dailyProductionRes.status === 'fulfilled' ? toList(dailyProductionRes.value) : [],
      finishedGoods: finishedGoodsRes.status === 'fulfilled' ? toList(finishedGoodsRes.value) : [],
      inventory: inventoryRes.status === 'fulfilled' ? toList(inventoryRes.value) : [],
    }

    setDashboardToday(today)
    setOperationSummaries(buildOperationSummaries(today, lists))
    setDashboardLoading(false)
  }, [])

  useEffect(() => {
    loadDashboardCards()
    window.addEventListener('store-entries-updated', loadDashboardCards)
    window.addEventListener('focus', loadDashboardCards)
    return () => {
      window.removeEventListener('store-entries-updated', loadDashboardCards)
      window.removeEventListener('focus', loadDashboardCards)
    }
  }, [loadDashboardCards])

  const operationCards = useMemo(() => (
    OPERATIONS.map((item) => ({
      ...item,
      fields: operationSummaries[item.id] || [
        { label: 'Today', value: dashboardLoading ? 'Loading' : '0' },
        { label: 'Total', value: dashboardLoading ? 'Loading' : '0' },
        { label: 'Latest', value: dashboardLoading ? 'Loading' : '-' },
      ],
    }))
  ), [dashboardLoading, operationSummaries])

  const visibleOperations = useMemo(() => {
    return operationCards.filter((item) => {
      if (!isSuperuser && !hasPermission(item.id)) return false
      if (!normalizedQuery) return true
      const fieldsText = (item.fields || [])
        .map((field) => `${field.label} ${field.value}`)
        .join(' ')
      const haystack = `${item.title} ${item.subtitle} ${item.id} ${fieldsText}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [hasPermission, isSuperuser, normalizedQuery, operationCards])

  const visibleQuickActions = useMemo(() => {
    return QUICK_ACTIONS.filter((item) => {
      if (!isSuperuser && !hasPermission(item.id)) return false
      if (!normalizedQuery) return true
      return `${item.label} ${item.id} ${item.path}`.toLowerCase().includes(normalizedQuery)
    })
  }, [hasPermission, isSuperuser, normalizedQuery])

  const visibleSettingsShortcuts = useMemo(() => {
    if (!normalizedQuery) return SETTINGS_SHORTCUTS
    return SETTINGS_SHORTCUTS.filter((item) =>
      `${item.label} ${item.path} ${item.id || ''}`.toLowerCase().includes(normalizedQuery)
    )
  }, [normalizedQuery])

  const visibleProcessFlow = useMemo(() => {
    if (!normalizedQuery) return PROCESS_FLOW
    return PROCESS_FLOW.filter((step) =>
      `${step.label} ${step.path}`.toLowerCase().includes(normalizedQuery)
    )
  }, [normalizedQuery])

  const totalEntriesToday = dashboardToday.date
    ? Number(dashboardToday.gate_inward_today || 0)
      + Number(dashboardToday.gate_outward_today || 0)
      + Number(dashboardToday.requisitions_today || 0)
      + Number(dashboardToday.daily_production_today || 0)
      + Number(dashboardToday.finished_goods_today || 0)
    : todayEntries

  const statCards = [
    { label: 'Total Entries Today', value: fmtCount(totalEntriesToday) },
    { label: 'Inventory Items', value: fmtCount(dashboardToday.inventory_items) },
    { label: 'Active Products', value: fmtCount(dashboardToday.active_products) },
    { label: 'Quick Entry Screens', value: String(visibleQuickActions.length) },
  ]

  return (
    <DashboardLayout>
      <div style={s.page}>
        {/* Hero Section with GREEN GRADIENT */}
        <section style={s.hero}>
          <div>
            <h1 style={s.title}>Store Operations Dashboard</h1>
            <p style={s.subtitle}>
              Welcome, {user?.username || 'User'}.
            </p>
          </div>

          <div style={s.heroActions}>
            <button style={s.primaryBtn} onClick={() => router.push('/inventory')}>
              <Warehouse size={15} /> Open Inventory
            </button>
            {isSuperuser && (
              <button style={s.secondaryBtn} onClick={() => router.push('/settings')}>
                <Settings size={15} /> Open Settings
              </button>
            )}
          </div>
        </section>

        <section style={s.statsGrid}>
          {statCards.map((item) => (
            <article key={item.label} style={s.statCard}>
              <p style={s.statLabel}>{item.label}</p>
              <p style={s.statValue}>{item.value}</p>
            </article>
          ))}
        </section>

        <section style={s.section}>
          <div style={s.sectionHead}>
            <h2 style={s.sectionTitle}>Operations</h2>
            <p style={s.sectionSub}>Modules available in your account permissions</p>
          </div>

          <div style={s.operationsGrid}>
            {visibleOperations.map((item) => {
              const Icon = item.icon
              return (
                <article
                  key={item.id}
                  style={s.opCard}
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
                  <div style={s.opTopRow}>
                    <div style={{ ...s.opIcon, backgroundColor: item.bg }}>
                      <Icon size={18} color={item.accent} />
                    </div>
                    <ChevronRight size={14} color="#b0c8b0" />
                  </div>
                  <p style={s.opTitle}>{item.title}</p>
                  <p style={s.opSub}>{item.subtitle}</p>
                  <div style={s.opDivider} />
                  {item.fields.map((field) => (
                    <div key={field.label} style={s.opField}>
                      <span style={s.opFieldLabel}>{field.label}</span>
                      <span style={s.opFieldVal}>{field.value}</span>
                    </div>
                  ))}
                  <button style={{ ...s.opBtn, color: item.accent }} onClick={() => router.push(item.path)}>
                    View Details
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        <section style={s.lowerGrid}>
          <article style={s.panelCard}>
            <div style={s.panelHead}>
              <p style={s.panelTitle}>Quick Actions</p>
              <Plus size={14} color="#2d7a33" />
            </div>

            <div style={s.stack}>
              {visibleQuickActions.length > 0 ? (
                visibleQuickActions.map((action) => (
                  <button key={action.path} style={s.rowBtn} onClick={() => router.push(action.path)}>
                    <span>{action.label}</span>
                    <ChevronRight size={14} color="#90ad90" />
                  </button>
                ))
              ) : (
                <p style={s.emptyText}>No quick actions are available for your current permissions.</p>
              )}
            </div>
          </article>

          <article style={s.panelCard}>
            <div style={s.panelHead}>
              <p style={s.panelTitle}>Process Flow</p>
              <Factory size={14} color="#2d7a33" />
            </div>

            <div style={s.stack}>
              {visibleProcessFlow.length > 0 ? visibleProcessFlow.map((step, idx) => (
                <button key={step.path} style={s.rowBtn} onClick={() => router.push(step.path)}>
                  <span>{idx + 1}. {step.label}</span>
                  <ChevronRight size={14} color="#90ad90" />
                </button>
              )) : <p style={s.emptyText}>No process steps match your search.</p>}
            </div>
          </article>

          <article style={s.panelCard}>
            <div style={s.panelHead}>
              <p style={s.panelTitle}>Settings Shortcuts</p>
              <Shield size={14} color="#2d7a33" />
            </div>

            {isSuperuser ? (
              <div style={s.stack}>
                {visibleSettingsShortcuts.length > 0 ? visibleSettingsShortcuts.map((item) => {
                  const Icon = item.icon
                  return (
                    <button key={item.path} style={s.rowBtn} onClick={() => router.push(item.path)}>
                      <span style={s.rowLeft}><Icon size={13} color="#2d7a33" /> {item.label}</span>
                      <ChevronRight size={14} color="#90ad90" />
                    </button>
                  )
                }) : <p style={s.emptyText}>No settings shortcuts match your search.</p>}
              </div>
            ) : (
              <p style={s.emptyText}>Settings management is available to super users only.</p>
            )}
          </article>
        </section>
      </div>
    </DashboardLayout>
  )
}

const s = {
  page: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },

  // Hero section with GREEN GRADIENT
  hero: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    background: 'linear-gradient(135deg, rgb(26, 61, 31) 0%, rgb(45, 122, 51) 100%)',
    border: '1px solid #2E7D32',
    borderRadius: 28,
    padding: '28px 32px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    margin: '8px 0 0',
    color: '#d4f0d4',
    fontSize: 14,
    fontWeight: 500,
  },
  heroActions: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: 'none',
    background: '#ffffff',
    color: '#1a5c22',
    borderRadius: '999px',
    padding: '10px 24px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: '0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #ffffff',
    background: 'transparent',
    color: '#ffffff',
    borderRadius: '999px',
    padding: '10px 24px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: '0.2s',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 14,
  },
  statCard: {
    background: '#f2f4f2',
    border: '1px solid #e2e8e2',
    borderRadius: 24,
    padding: '18px 20px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
  },
  statLabel: {
    margin: 0,
    fontSize: 12,
    color: '#789478',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  statValue: {
    margin: '8px 0 0',
    fontSize: 28,
    lineHeight: 1,
    color: '#1a3d1f',
    fontWeight: 800,
  },

  section: {
    background: '#f2f4f2',
    border: '1px solid #e2e8e2',
    borderRadius: 28,
    padding: '22px 24px',
  },
  sectionHead: {
    marginBottom: 18,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    color: '#1e3a1e',
    fontWeight: 800,
  },
  sectionSub: {
    margin: '5px 0 0',
    fontSize: 13,
    color: '#7e9a7e',
  },

  operationsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 16,
  },
  opCard: {
    background: '#f2f4f2',
    border: '1px solid #e2e8e2',
    borderRadius: 20,
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    transition: '0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  },
  opTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opTitle: {
    margin: 0,
    color: '#1f3b1f',
    fontWeight: 800,
    fontSize: 15,
  },
  opSub: {
    margin: 0,
    color: '#7c937c',
    fontSize: 12.5,
    lineHeight: 1.4,
  },
  opDivider: { height: 1, backgroundColor: '#e0e0e0', margin: '4px 0 6px' },
  opField: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  opFieldLabel: { fontSize: 12, color: '#819e81', fontWeight: 500 },
  opFieldVal: {
    fontSize: 12,
    fontWeight: 600,
    color: '#2d7a33',
    backgroundColor: '#ffffff',
    padding: '3px 10px',
    borderRadius: 30,
    border: '1px solid #d0d0d0',
  },
  opBtn: {
    marginTop: 8,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #d0d0d0',
    borderRadius: 40,
    background: '#ffffff',
    fontSize: 12.5,
    fontWeight: 600,
    padding: '9px 0',
    cursor: 'pointer',
    color: '#2a6b2a',
  },

  lowerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 18,
  },
  panelCard: {
    background: '#f2f4f2',
    border: '1px solid #e2e8e2',
    borderRadius: 28,
    padding: '18px 20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
  },
  panelHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  panelTitle: {
    margin: 0,
    fontSize: 15,
    color: '#1e3a1e',
    fontWeight: 800,
  },

  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  rowBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    border: '1px solid #d0d0d0',
    borderRadius: 16,
    padding: '10px 14px',
    background: '#ffffff',
    color: '#2c562c',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    transition: '0.15s',
  },
  rowLeft: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    margin: 0,
    fontSize: 13,
    color: '#8aa88a',
    lineHeight: 1.5,
    fontStyle: 'italic',
  },
}

