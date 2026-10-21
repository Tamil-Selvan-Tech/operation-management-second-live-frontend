import { useEffect, useState } from 'react'
import { request } from '../services/apiClient'

// All hierarchy weights and installment amounts are computed by the backend.
export function useCourseCalculations(input, enabled = true) {
  const key = JSON.stringify(input)
  const [state, setState] = useState({ key: '', data: null, error: '' })
  useEffect(() => {
    if (!enabled) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      request('/branch-courses/import/calculations', {
        method: 'POST', body: key, signal: controller.signal,
      }).then((response) => {
        if (!controller.signal.aborted) setState({ key, data: response.data, error: '' })
      }).catch((error) => {
        if (!controller.signal.aborted) setState({ key, data: null, error: error.message || 'Unable to calculate course amounts.' })
      })
    }, 200)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [key, enabled])
  return state.key === key ? { ...state, pending: false } : { data: null, error: '', pending: enabled }
}
