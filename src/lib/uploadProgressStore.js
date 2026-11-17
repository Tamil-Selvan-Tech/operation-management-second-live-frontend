const STORAGE_KEY = 'cispro.activeUploadProgress'
const EVENT_NAME = 'cispro:upload-progress-updated'
const listeners = new Set()

function readStored() {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

let uploads = readStored()

function persist() {
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(uploads.slice(0, 20))) } catch { /* best effort */ }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: uploads }))
  }
  listeners.forEach((listener) => listener())
}

function emit() { persist() }

export function getUploadSnapshot() { return uploads }

export function subscribeUploadProgress(listener) {
  listeners.add(listener)
  const handleStorage = (event) => {
    if (event.key !== STORAGE_KEY) {
      return
    }
    uploads = readStored()
    listener()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage)
    window.addEventListener(EVENT_NAME, listener)
  }
  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(EVENT_NAME, listener)
    }
  }
}

function update(id, patch) {
  uploads = uploads.map((item) => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item)
  emit()
}

export function startUpload({ type = 'file', label = 'Upload', total = 0 } = {}) {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  uploads = [{ id, type, label, status: 'RUNNING', progress: 0, processed: 0, total, startedAt: Date.now(), updatedAt: Date.now() }, ...uploads.filter((item) => item.status === 'RUNNING')]
  emit()
  return id
}

export function updateUpload(id, patch = {}) { update(id, { status: 'RUNNING', ...patch }) }

export function completeUpload(id, patch = {}) { update(id, { status: 'COMPLETED', progress: 100, ...patch }) }

export function failUpload(id, patch = {}) { update(id, { status: 'FAILED', ...patch }) }

export function dismissUpload(id) {
  uploads = uploads.filter((item) => item.id !== id)
  emit()
}

export function clearFinishedUploads() {
  uploads = uploads.filter((item) => item.status === 'RUNNING')
  emit()
}
