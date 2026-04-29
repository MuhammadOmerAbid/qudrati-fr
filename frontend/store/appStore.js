'use client'
import { create } from 'zustand'

// Separate app-level UI state — NOT auth (that lives in authStore.js)
// Having two stores both named useAuthStore was causing Zustand conflicts and
// redundant re-renders across the app.
export const useAppStore = create((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
}))