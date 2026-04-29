'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      panel: null,
      hasHydrated: false,

      setAuth: (user, token, refreshToken) =>
        set({ user, token, refreshToken }),

      setPanel: (panel) => set({ panel }),

      setHasHydrated: (value) => set({ hasHydrated: value }),

      logout: () => {
        set({ user: null, token: null, refreshToken: null, panel: null })
        if (typeof window !== 'undefined') window.location.href = '/auth/login'
      },

      hasPermission: (perm) => {
        const { user } = get()
        if (!user) return false
        if (user.role === 'superuser') return true
        return user.permissions?.includes(perm) ?? false
      },

      isSuperuser: () => get().user?.role === 'superuser',
      canEdit: () => {
        const u = get().user
        return u?.role === 'superuser' || u?.can_edit === true
      },
      canDelete: () => {
        const u = get().user
        return u?.role === 'superuser' || u?.can_delete === true
      },
    }),
    {
      name: 'qud-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        panel: state.panel,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
