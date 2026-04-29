'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'

export default function RootPage() {
  const router = useRouter()
  const { user, token, panel, hasHydrated } = useAuthStore()

  useEffect(() => {
    if (!hasHydrated) return

    if (token && user) {
      if (panel) {
        router.replace(panel === 'account' ? '/accounts/accounts-dashboard' : '/dashboard')
      } else {
        router.replace('/panel-selection')
      }
    } else {
      router.replace('/auth/login')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, token, user, panel])

  return (
    <div className="min-h-screen bg-[var(--surface-2)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <img
          src="/qudarti.png"
          alt="Qudarti"
          className="w-10 h-10 rounded-xl object-contain"
        />
        <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

