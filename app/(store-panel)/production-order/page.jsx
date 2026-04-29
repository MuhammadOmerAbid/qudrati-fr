'use client'

import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { ProductionOrderPage } from '@/components/store/StorePages'
import { useAuthStore } from '@/application/state/auth/useAuthStore'

export default function ProductionOrderRoutePage() {
  const { canDelete } = useAuthStore()

  return (
    <DashboardLayout>
      <ProductionOrderPage isSuperUser={canDelete()} />
    </DashboardLayout>
  )
}

