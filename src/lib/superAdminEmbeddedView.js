export const SUPER_ADMIN_EMBEDDED_VIEW_STORAGE_KEY = 'cispro.super-admin-embedded-view'

export function clearPersistedSuperAdminEmbeddedView() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(SUPER_ADMIN_EMBEDDED_VIEW_STORAGE_KEY)
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}
