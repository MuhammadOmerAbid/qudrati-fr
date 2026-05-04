'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const FULL_ACCESS_ROLES = new Set(['superuser', 'admin', 'administrator'])

const normalizeRole = (role) => String(role || '').trim().toLowerCase()
const hasFullAccessRole = (role) => FULL_ACCESS_ROLES.has(normalizeRole(role))
const normalizeAuthUser = (user) => {
  if (!user || typeof user !== 'object') return user
  if (hasFullAccessRole(user.role)) return { ...user, role: 'superuser' }
  return user
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      panel: null,
      hasHydrated: false,

      setAuth: (user, token, refreshToken) =>
        set({ user: normalizeAuthUser(user), token, refreshToken }),

      setPanel: (panel) => set({ panel }),

      setHasHydrated: (value) => set({ hasHydrated: value }),

      logout: () => {
        set({ user: null, token: null, refreshToken: null, panel: null })
        if (typeof window !== 'undefined') window.location.href = '/auth/login'
      },

      hasPermission: (perm) => {
        const { user } = get()
        if (!user) return false
        if (hasFullAccessRole(user.role)) return true
        return user.permissions?.includes(perm) ?? false
      },

      isSuperuser: () => hasFullAccessRole(get().user?.role),
      canEdit: () => {
        const u = get().user
        return hasFullAccessRole(u?.role) || u?.can_edit === true
      },
      canDelete: () => {
        const u = get().user
        return hasFullAccessRole(u?.role) || u?.can_delete === true
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
        if (state?.user) {
          state.user = normalizeAuthUser(state.user)
        }
        state?.setHasHydrated(true)
      },
    }
  )
)
