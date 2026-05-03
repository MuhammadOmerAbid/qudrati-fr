'use client'

import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Users,
  UserCheck,
  Banknote,
  Receipt,
  BarChart3,
  Stamp,
  Settings,
  LogOut,
} from 'lucide-react'
import BaseSidebar from '@/components/layout/BaseSidebar'

const NAV_ITEMS_MENU = [
  { id: 'accounts-dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/accounts/accounts-dashboard' },
  { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen, path: '/accounts/chart-of-accounts' },
  { id: 'general-ledger', label: 'General Ledger', icon: FileText, path: '/accounts/general-ledger' },
  { id: 'accounts-payable', label: 'Accounts Payable', icon: Users, path: '/accounts/payable' },
  { id: 'accounts-receivable', label: 'Accounts Receivable', icon: UserCheck, path: '/accounts/receivable' },
  { id: 'cash-bank', label: 'Cash & Bank', icon: Banknote, path: '/accounts/cash-bank' },
  { id: 'expenses', label: 'Expenses', icon: Receipt, path: '/accounts/expenses' },
  { id: 'reports', label: 'Financial Reports', icon: BarChart3, path: '/accounts/reports' },
  { id: 'vouchers', label: 'Vouchers', icon: Stamp, path: '/accounts/vouchers' },
]

const NAV_ITEMS_GENERAL = [
  { id: 'accounts-settings', label: 'Settings', icon: Settings, path: '/accounts/settings' },
  { id: 'logout', label: 'Logout', icon: LogOut, path: null, isLogout: true },
]

export default function AccountSidebar({ collapsed, setCollapsed, isMobile = false, mobileOpen = false, setMobileOpen }) {
  return (
    <BaseSidebar
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      menuItems={NAV_ITEMS_MENU}
      generalItems={NAV_ITEMS_GENERAL}
      alwaysVisibleMenuIds={['accounts-dashboard']}
      sidebarScroll="thin"
      isMobile={isMobile}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
    />
  )
}
