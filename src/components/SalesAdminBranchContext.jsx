import { useEffect, useRef, useState } from 'react'
import { Building2, CheckCircle2, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { request } from '../services/apiClient'

export default function SalesAdminBranchContext({ enabled = true, onChanged }) {
  const location = useLocation()
  const [context, setContext] = useState(null)
  const [dismissedId, setDismissedId] = useState('')
  const signature = useRef(null)
  const changeHandler = useRef(onChanged)
  useEffect(() => { changeHandler.current = onChanged }, [onChanged])
  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    let inFlight = false
    const load = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const response = await request('/sales-admins/me/branch-transfer')
        if (!active) return
        const next = response.data
        const key = (next.branches || []).map((branch) => branch.id).sort().join(':')
        const changed = signature.current !== null && signature.current !== key
        signature.current = key
        setContext(next)
        window.dispatchEvent(new CustomEvent('cispro:sales-branch-context', { detail: { branchIds: (next.branches || []).map((branch) => branch.id) } }))
        if (changed) changeHandler.current?.()
      } catch { /* Existing screens still report their own API errors. */ }
      finally { inFlight = false }
    }
    void load()
    window.addEventListener('focus', load)
    return () => { active = false; window.removeEventListener('focus', load) }
  }, [enabled, location.pathname])
  if (!enabled || !context?.branches?.length) return null
  const transfer = context.latest
  const metadata = transfer?.metadata
  return <div className="sales-admin-branch-context">
    <div className="sales-admin-current-branch"><Building2 size={15} /><span>Current branch{context.branches.length > 1 ? 'es' : ''}: <strong>{context.branches.map((branch) => branch.branchName).join(', ')}</strong></span></div>
    {metadata && dismissedId !== transfer.id ? <div className="sales-admin-transfer-notice" role="status"><CheckCircle2 size={19} /><div><strong>Your branch assignment has changed</strong><p>You moved from {metadata.sourceBranchName} to {metadata.destinationBranchName}. Your {metadata.totalLeads} previous leads were handed over within the original branch. New assignments will appear here.</p></div><button type="button" aria-label="Dismiss branch update" onClick={() => setDismissedId(transfer.id)}><X size={16} /></button></div> : null}
  </div>
}
