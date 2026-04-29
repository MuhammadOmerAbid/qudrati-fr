'use client'

import DashboardLayout from '@/presentation/layouts/StorePanelLayout'
import { FinishedGoodsPage } from '@/components/store/StorePages'
import { useAuthStore } from '@/application/state/auth/useAuthStore'

export default function FinishedGoodsRoutePage() {
  const { canDelete } = useAuthStore()

  return (
    <DashboardLayout>
      <FinishedGoodsPage isSuperUser={canDelete()} />
    </DashboardLayout>
  )
}

