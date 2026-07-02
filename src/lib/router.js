export const parseHash = () => {
  const raw = window.location.hash.replace(/^#/, '') || '/login'
  const parts = raw.split('/').filter(Boolean)

  if (parts.length === 0) return { name: 'login' }
  if (parts[0] === 'dashboard' && parts[1]) return { name: 'dashboard', role: parts[1] }
  return { name: parts[0] }
}

export const normalizeHash = (path) => (path.startsWith('#') ? path : `#${path}`)
