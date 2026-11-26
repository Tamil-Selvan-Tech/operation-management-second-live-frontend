import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { SalesAdminAdmissionsPage } from './SalesAdminAdmissionsPage'
import { request } from '../services/apiClient'
import '../styles/BranchAdmissionsHub.css'
import '../styles/BranchAdmissionsSourceFilter.css'

function AdmissionSourceSelect({ options, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const selectedOption = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnOutsideClick = (event) => { if (!containerRef.current?.contains(event.target)) setIsOpen(false) }
    const closeOnEscape = (event) => { if (event.key === 'Escape') setIsOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  return <div ref={containerRef} className={`branch-admissions-source-select${isOpen ? ' is-open' : ''}`}>
    <button type="button" className="branch-admissions-source-select__trigger" aria-label="Filter admissions by source" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
      <span>{selectedOption?.label || 'All Admissions'}</span><ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
    </button>
    {isOpen ? <div className="branch-admissions-source-select__menu" role="listbox" aria-label="Admission source options">
      {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'is-selected' : ''} onClick={() => { onChange(option.value); setIsOpen(false) }}>{option.label}</button>)}
    </div> : null}
  </div>
}

export default function BranchAdmissionsHub({ branchData, branchAdminName = '', canViewSalesAdmissionPipeline = true }) {
  const location = useLocation()
  const legacySection = new URLSearchParams(location.search).get('section')
  const legacySource = legacySection === 'sales-crm-admissions' ? 'SALES' : legacySection === 'sales-crm-admitted-students' ? 'BRANCH' : 'ALL'
  const [source, setSource] = useState(legacySource)
  const [salesAdmins, setSalesAdmins] = useState([])
  useEffect(() => {
    if (!canViewSalesAdmissionPipeline) return undefined
    let active = true
    request('/branches/me/sales-admins').then((response) => {
      const result = response?.data || response || {}
      if (active) setSalesAdmins(Array.isArray(result.salesAdmins) ? result.salesAdmins : [])
    }).catch(() => { if (active) setSalesAdmins([]) })
    return () => { active = false }
  }, [canViewSalesAdmissionPipeline])
  const branchName = branchAdminName || branchData?.branchAdminName || 'Branch Admin'
  const sourceOptions = [
    { value: 'ALL', label: 'All Admissions' },
    ...(canViewSalesAdmissionPipeline ? [{ value: 'BRANCH', label: `${branchName} · Branch Admin` }] : []),
    ...(canViewSalesAdmissionPipeline ? salesAdmins.map((admin) => {
      const name = admin.name || admin.userId || admin.id || ''
      return { value: `SALES_ADMIN:${encodeURIComponent(name)}`, label: `${name} · Sales Admin` }
    }).filter((option) => option.label) : []),
  ]
  const selectedSource = sourceOptions.some(({ value }) => value === source) ? source : 'ALL'

  return (
    <section className="branch-admissions-hub">
      <header className="branch-admissions-hub__header">
        <div>
          <span className="branch-admissions-hub__eyebrow">SALES &amp; CRM</span>
          <h1>Admission</h1>
          <p>View and manage branch and Sales Admin admissions from one list.</p>
        </div>
        <div className="branch-admissions-source-filter">
          <label htmlFor="admission-source-filter">Admission source</label>
          <AdmissionSourceSelect options={sourceOptions} value={selectedSource} onChange={setSource} />
        </div>
      </header>
      <SalesAdminAdmissionsPage
        key={`unified-admissions-${branchData?.salesAdminId || 'branch'}-${selectedSource}`}
        salesAdminId={branchData?.salesAdminId || ''}
        unifiedBranchView
        sourceFilter={selectedSource}
        branchAdminName={branchName}
      />
    </section>
  )
}
