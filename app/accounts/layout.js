'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { hydrateAccountsStateFromBackend } from '@/application/services/accounts/accountsWorkflow'

export default function AccountsRouteLayout({ children }) {
  const { hasHydrated, user, token, panel } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!hasHydrated) return

    if (!user || !token || panel !== 'account') {
      setReady(true)
      return
    }

    setReady(false)
    let isMounted = true
    void hydrateAccountsStateFromBackend()
      .finally(() => {
        if (isMounted) setReady(true)
      })

    return () => {
      isMounted = false
    }
  }, [hasHydrated, panel, token, user])

  if (!hasHydrated || !ready) return null
  return children
}

