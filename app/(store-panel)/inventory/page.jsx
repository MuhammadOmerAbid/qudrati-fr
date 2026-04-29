'use client'

import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { InventoryPage } from '@/components/store/StorePages'
import { useAuthStore } from '@/application/state/auth/useAuthStore'

export default function InventoryRoutePage() {
  const { canDelete } = useAuthStore()

  return (
    <DashboardLayout>
      <InventoryPage isSuperUser={canDelete()} />
    </DashboardLayout>
  )
}

