'use client'
import { create } from 'zustand'

const useToastStore = create((set) => ({
  toasts: [],
  push: (msg, type = 'info') => {
    const id = Date.now() + Math.random()
    set(s => ({ toasts: [...s.toasts, { id, msg, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4200)
  },
  dismiss: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

export function useToast() {
  const { push } = useToastStore()
  return {
    toast: {
      success: (msg) => push(msg, 'success'),
      error:   (msg) => push(msg, 'error'),
      warning: (msg) => push(msg, 'warning'),
      info:    (msg) => push(msg, 'info'),
    },
    push,
  }
}

export { useToastStore }