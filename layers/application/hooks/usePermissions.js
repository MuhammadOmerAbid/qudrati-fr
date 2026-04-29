import { useAuthStore } from '@/application/state/auth/useAuthStore'

export function usePermissions() {
  const { user, hasPermission, isSuperuser, canEdit, canDelete } = useAuthStore()
  return { user, hasPermission, isSuperuser: isSuperuser(), canEdit: canEdit(), canDelete: canDelete() }
}

