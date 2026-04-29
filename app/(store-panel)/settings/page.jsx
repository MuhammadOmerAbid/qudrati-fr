'use client'

import { useRouter } from 'next/navigation'
import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { settingsTheme } from '@/components/settings/SettingsShared'
import { Tag, Grid3X3, Package, Users, BookOpen, Calculator, ChevronRight, Shield, Ruler, Box, Truck, CheckSquare } from 'lucide-react'

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
    description: 'Manage packaging types (Box, Bag, Carton…)',
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
  const isSuperuser = user?.role === 'superuser'

  if (!isSuperuser) {
    return (
      <DashboardLayout>
        <div style={styles.denied}>
          <Shield size={48} color={settingsTheme.textSubtle} />
          <h2 style={styles.deniedTitle}>Access Restricted</h2>
          <p style={styles.deniedText}>Only super users can access Settings.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Settings</h1>
            <p style={styles.subtitle}>Manage your application configuration</p>
          </div>
        </div>

        <div style={styles.grid}>
          {SETTING_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <button
                key={card.id}
                onClick={() => router.push(card.path)}
                style={styles.card}
              >
                <div style={{ ...styles.iconBox, background: card.bg }}>
                  <Icon size={22} color={card.color} />
                </div>
                <div style={styles.cardBody}>
                  <span style={styles.cardTitle}>{card.label}</span>
                  <span style={styles.cardDesc}>{card.description}</span>
                </div>
                <ChevronRight size={16} color={settingsTheme.textSubtle} />
              </button>
            )
          })}
        </div>
      </div>
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
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

