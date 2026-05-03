'use client'

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Factory,
  Package,
  Warehouse,
  Settings,
  LogOut,
  LayoutDashboard,
  BoxIcon,
} from 'lucide-react'
import BaseSidebar from '@/components/layout/BaseSidebar'

const NAV_ITEMS_MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'gate-inward', label: 'Gate Inward', icon: ArrowDownToLine, path: '/gate-inward' },
  { id: 'gate-outward', label: 'Gate Outward', icon: ArrowUpFromLine, path: '/gate-outward' },
  { id: 'goods-requisition', label: 'Goods Requisition', icon: ClipboardList, path: '/requisition' },
  { id: 'daily-production', label: 'Daily Production', icon: Factory, path: '/daily-production' },
  { id: 'finished-goods', label: 'Finished Goods', icon: Package, path: '/finished-goods' },
  { id: 'production-order', label: 'Production Order', icon: BoxIcon, path: '/production-order' },
  { id: 'inventory', label: 'Inventory', icon: Warehouse, path: '/inventory' },
]

const NAV_ITEMS_GENERAL = [
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  { id: 'logout', label: 'Logout', icon: LogOut, path: null, isLogout: true },
]

export default function AppSidebar({ collapsed, setCollapsed, isMobile = false, mobileOpen = false, setMobileOpen }) {
  return (
    <BaseSidebar
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      menuItems={NAV_ITEMS_MENU}
      generalItems={NAV_ITEMS_GENERAL}
      alwaysVisibleMenuIds={['dashboard']}
      sidebarScroll="clipped"
      isMobile={isMobile}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
    />
  )
}
