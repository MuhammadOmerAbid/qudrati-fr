'use client'

import PanelLayout from '@/presentation/layouts/PanelLayout'
import AppSidebar from '@/components/layout/Sidebar'

// Store panel screens are visually denser and were feeling "enlarged" at browser 100%.
// We keep the explicit zoom knob here so this panel can be tuned independently.
const STORE_PANEL_ZOOM = 0.8

export default function DashboardLayout({ children }) {
  return (
    <PanelLayout
      panelName="store"
      wrongPanelRedirect="/accounts/accounts-dashboard"
      SidebarComponent={AppSidebar}
      panelZoom={STORE_PANEL_ZOOM}
    >
      {children}
    </PanelLayout>
  )
}

