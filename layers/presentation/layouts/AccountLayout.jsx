'use client'

import PanelLayout from '@/presentation/layouts/PanelLayout'
import AccountSidebar from '@/components/layout/AccountSidebar'

const ACCOUNT_PANEL_ZOOM = 0.8

export default function AccountLayout({ children }) {
  return (
    <PanelLayout
      panelName="account"
      wrongPanelRedirect="/dashboard"
      SidebarComponent={AccountSidebar}
      panelZoom={ACCOUNT_PANEL_ZOOM}
    >
      {children}
    </PanelLayout>
  )
}

