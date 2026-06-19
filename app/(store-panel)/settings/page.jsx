'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { settingsTheme } from '@/components/settings/SettingsShared'
import { getStoreResetStats, resetStoreStateOnClient } from '@/application/services/store/storeWorkflow'
import { Tag, Grid3X3, Package, Users, BookOpen, Calculator, ChevronRight, Shield, Ruler, Box, Truck, CheckSquare, AlertTriangle } from 'lucide-react'

const FULL_ACCESS_ROLES = new Set(['superuser', 'admin', 'administrator'])
const hasFullAccessRole = (role) => FULL_ACCESS_ROLES.has(String(role || '').trim().toLowerCase())
const RESET_CONFIRM_PHRASE = 'RESET STORE'

const SETTING_CARDS = [
  {
    id: 'brands',
    label: 'Brands',
    description: 'Manage product brands and labels',
    icon: Tag,
    path: '/settings/brands',
    color: '#2d7a33',
    bg: '#eaf4ea',
  },
  {
    id: 'categories',
    label: 'Categories',
    description: 'Organize products by categories',
    icon: Grid3X3,
    path: '/settings/categories',
    color: '#2d7a33',
    bg: '#eaf4ea',
  },
  {
    id: 'units',
    label: 'Units',
    description: 'Manage measurement units (KG, Litre, Carton…)',
    icon: Ruler,
    path: '/settings/units',
    color: '#2d7a33',
    bg: '#eaf4ea',
  },
  {
    id: 'packaging',
    label: 'Packaging',
    description: 'Manage packaging types',
    icon: Box,
    path: '/settings/packaging',
    color: '#2d7a33',
    bg: '#eaf4ea',
  },
  {
    id: 'supplier',
    label: 'Suppliers',
    description: 'Manage suppliers and their contact details',
    icon: Truck,
    path: '/settings/supplier',
    color: '#2d7a33',
    bg: '#eaf4ea',
  },
  {
    id: 'finished-good-products',
    label: 'Finished Good Products',
    description: 'Product master for finished goods and production orders',
    icon: CheckSquare,
    path: '/settings/finished-good-products',
    color: '#2d7a33',
    bg: '#eaf4ea',
  },
  {
    id: 'products',
    label: 'Products',
    description: 'Add and manage raw material products',
    icon: Package,
    path: '/settings/products',
    color: '#2d7a33',
    bg: '#eaf4ea',
  },
  {
    id: 'customers',
    label: 'Customers',
    description: 'Manage customer accounts',
    icon: Users,
    path: '/settings/customers',
    color: '#2d7a33',
    bg: '#eaf4ea',
  },
  {
    id: 'recipe',
    label: 'Recipe',
    description: 'Define product recipes and ingredients',
    icon: BookOpen,
    path: '/settings/recipe',
    color: '#2d7a33',
    bg: '#eaf4ea',
  },
  {
    id: 'cbm-calculator',
    label: 'CBM Calculator',
    description: 'Plan container loading with CBM and weight',
    icon: Calculator,
    path: '/settings/cbm-calculator',
    color: '#2d7a33',
    bg: '#eaf4ea',
  },
  {
    id: 'users',
    label: 'Users & Permissions',
    description: 'Manage team access and roles',
    icon: Shield,
    path: '/settings/users',
    color: '#2d7a33',
    bg: '#eaf4ea',
  },
]

export default function SettingsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSuperuser = hasFullAccessRole(user?.role)
  const [isTablet, setIsTablet] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetNotice, setResetNotice] = useState('')
  const [resetError, setResetError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tabletQuery = window.matchMedia('(max-width: 1024px)')
    const mobileQuery = window.matchMedia('(max-width: 640px)')

    const apply = () => {
      setIsTablet(tabletQuery.matches)
      setIsMobile(mobileQuery.matches)
    }

    apply()
    tabletQuery.addEventListener('change', apply)
    mobileQuery.addEventListener('change', apply)
    return () => {
      tabletQuery.removeEventListener('change', apply)
      mobileQuery.removeEventListener('change', apply)
    }
  }, [])

  const resetStats = showResetModal ? getStoreResetStats() : { keys: [], count: 0 }

  const handleResetStoreData = () => {
    if (resetConfirmText !== RESET_CONFIRM_PHRASE) return
    try {
      const result = resetStoreStateOnClient()
      setShowResetModal(false)
      setResetConfirmText('')
      setResetError('')
      setResetNotice(`Store panel data reset complete. Removed ${result.removedCount} key(s).`)
    } catch (error) {
      setResetError(error?.message || 'Unable to reset store panel data')
    }
  }

  if (!isSuperuser) {
    return (
      <DashboardLayout>
        <div
          style={{
            ...styles.denied,
            padding: isMobile ? 36 : 80,
          }}
        >
          <Shield size={48} color={settingsTheme.textSubtle} />
          <h2 style={styles.deniedTitle}>Access Restricted</h2>
          <p style={styles.deniedText}>Only super users can access Settings.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div
        style={{
          ...styles.page,
          maxWidth: isTablet ? '100%' : 980,
          borderRadius: isMobile ? 14 : 20,
          padding: isMobile ? 12 : isTablet ? 16 : 22,
        }}
      >
        <div
          style={{
            ...styles.header,
            marginBottom: isMobile ? 14 : 22,
          }}
        >
          <div>
            <h1
              style={{
                ...styles.title,
                fontSize: isMobile ? 18 : 22,
              }}
            >
              Settings
            </h1>
            <p
              style={{
                ...styles.subtitle,
                fontSize: isMobile ? 12 : 13.5,
              }}
            >
              Manage your application configuration
            </p>
          </div>
        </div>

        <div
          style={{
            ...styles.grid,
            gridTemplateColumns: isMobile
              ? '1fr'
              : isTablet
                ? 'repeat(auto-fit, minmax(260px, 1fr))'
                : 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: isMobile ? 10 : 14,
          }}
        >
          {SETTING_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <button
                key={card.id}
                onClick={() => router.push(card.path)}
                style={{
                  ...styles.card,
                  gap: isMobile ? 12 : 16,
                  padding: isMobile ? '12px 12px' : '18px 20px',
                }}
              >
                <div
                  style={{
                    ...styles.iconBox,
                    width: isMobile ? 40 : 46,
                    height: isMobile ? 40 : 46,
                    background: card.bg,
                  }}
                >
                  <Icon size={isMobile ? 18 : 22} color={card.color} />
                </div>
                <div style={styles.cardBody}>
                  <span
                    style={{
                      ...styles.cardTitle,
                      fontSize: isMobile ? 13.5 : 14.5,
                    }}
                  >
                    {card.label}
                  </span>
                  <span
                    style={{
                      ...styles.cardDesc,
                      fontSize: isMobile ? 11.5 : 12.5,
                    }}
                  >
                    {card.description}
                  </span>
                </div>
                {!isMobile ? <ChevronRight size={16} color={settingsTheme.textSubtle} /> : null}
              </button>
            )
          })}
        </div>

        {resetNotice ? (
          <p style={styles.noticeText} onClick={() => setResetNotice('')}>
            {resetNotice} &times;
          </p>
        ) : null}
        {resetError ? <p style={styles.errorText}>{resetError}</p> : null}

        <div style={styles.resetWrap}>
          <div>
            <p style={styles.resetTitle}>Reset All Store Data</p>
            <p style={styles.resetSub}>
              Clears store drafts, tracker, and outward local/session data to clean initial state.
            </p>
          </div>
          <button
            type="button"
            style={styles.resetBtn}
            onClick={() => {
              setResetError('')
              setShowResetModal(true)
            }}
          >
            Reset Data
          </button>
        </div>
      </div>

      {showResetModal ? (
        <div style={styles.modalOverlay} onClick={() => setShowResetModal(false)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <AlertTriangle size={22} color="#dc2626" />
              <h3 style={styles.modalTitle}>Confirm Store Reset</h3>
            </div>
            <p style={styles.modalSub}>
              This action will reset store panel local data. Detected keys: <strong>{resetStats.count}</strong>.
            </p>
            <div style={styles.field}>
              <label style={styles.label}>Type {RESET_CONFIRM_PHRASE} to confirm</label>
              <input
                style={styles.input}
                value={resetConfirmText}
                onChange={(event) => setResetConfirmText(event.target.value)}
                placeholder={RESET_CONFIRM_PHRASE}
              />
            </div>
            <div style={styles.modalActions}>
              <button type="button" style={styles.cancelBtn} onClick={() => setShowResetModal(false)}>Cancel</button>
              <button
                type="button"
                style={{
                  ...styles.confirmBtn,
                  opacity: resetConfirmText === RESET_CONFIRM_PHRASE ? 1 : 0.45,
                  cursor: resetConfirmText === RESET_CONFIRM_PHRASE ? 'pointer' : 'not-allowed',
                }}
                disabled={resetConfirmText !== RESET_CONFIRM_PHRASE}
                onClick={handleResetStoreData}
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

const styles = {
  page: {
    maxWidth: 980,
    margin: '0 auto',
    background: settingsTheme.pageTint,
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 20,
    padding: 22,
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
  },
  header: {
    marginBottom: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: settingsTheme.text },
  subtitle: { margin: '4px 0 0', fontSize: 13.5, color: settingsTheme.textMuted },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 14,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '18px 20px',
    background: '#fff',
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 14,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    textAlign: 'left',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  cardTitle: { fontSize: 14.5, fontWeight: 700, color: settingsTheme.text },
  cardDesc: { fontSize: 12.5, color: settingsTheme.textMuted },
  noticeText: {
    margin: '14px 0 0',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #bbf7d0',
    background: '#ecfdf5',
    color: '#166534',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
  },
  errorText: {
    margin: '14px 0 0',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: 12.5,
    fontWeight: 700,
  },
  resetWrap: {
    marginTop: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    border: '1px solid #fecaca',
    borderRadius: 12,
    background: '#fff1f2',
    padding: '12px 14px',
  },
  resetTitle: { margin: 0, fontSize: 14, fontWeight: 800, color: '#7f1d1d' },
  resetSub: { margin: '4px 0 0', fontSize: 12.5, color: '#9f1239' },
  resetBtn: {
    border: '1px solid #ef4444',
    borderRadius: 999,
    background: '#dc2626',
    color: '#fff',
    fontSize: 12.5,
    fontWeight: 700,
    padding: '9px 14px',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 150,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    borderRadius: 14,
    border: `1px solid ${settingsTheme.border}`,
    boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
    padding: 16,
  },
  modalHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  modalTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: settingsTheme.text },
  modalSub: { margin: '0 0 10px', fontSize: 12.5, color: settingsTheme.textMuted, lineHeight: 1.5 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 11.5, color: settingsTheme.textSubtle, fontWeight: 700 },
  input: {
    width: '100%',
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 10,
    padding: '9px 10px',
    fontSize: 12.5,
    color: settingsTheme.text,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  modalActions: { marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 },
  cancelBtn: {
    border: `1px solid ${settingsTheme.border}`,
    borderRadius: 999,
    background: '#fff',
    color: settingsTheme.textMuted,
    fontSize: 12.5,
    fontWeight: 700,
    padding: '8px 12px',
    cursor: 'pointer',
  },
  confirmBtn: {
    border: 'none',
    borderRadius: 999,
    background: '#dc2626',
    color: '#fff',
    fontSize: 12.5,
    fontWeight: 700,
    padding: '8px 12px',
  },
  denied: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 80,
    gap: 12,
    textAlign: 'center',
  },
  deniedTitle: { margin: 0, fontSize: 20, fontWeight: 700, color: settingsTheme.text },
  deniedText: { margin: 0, fontSize: 14, color: settingsTheme.textMuted },
}

