import { useEffect, useMemo, useState } from 'react'
import { Building2, Eye, MoreVertical, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UserRound, X } from 'lucide-react'
import { listBranches } from '../services/branchService'
import { createHrAccount, deleteHrAccount, listHrAccounts, updateHrAccount } from '../services/hrService'
import '../styles/HrManagementPage.css'

const initialForm = { fullName: '', email: '', phone: '', designation: 'Placement Officer', allBranches: true, branchIds: [] }
const messageFrom = (error, fallback) => error?.body?.message || error?.message || fallback

export function HrManagementPage() {
  const [accounts, setAccounts] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [search, setSearch] = useState('')
  const [activeMenuId, setActiveMenuId] = useState(null)
  const [editingAccount, setEditingAccount] = useState(null)
  const [viewingAccount, setViewingAccount] = useState(null)
  const [deletingAccount, setDeletingAccount] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [accountResponse, branchResponse] = await Promise.all([listHrAccounts(), listBranches()])
      setAccounts(accountResponse?.data || [])
      setBranches((branchResponse?.data || branchResponse || []).filter((branch) => String(branch.status || 'ACTIVE').toUpperCase() === 'ACTIVE'))
    } catch (reason) { setError(messageFrom(reason, 'Unable to load HR accounts. Please try again.')) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  useEffect(() => {
    const closeMenu = (event) => { if (!event.target.closest?.('.hr-actions')) setActiveMenuId(null) }
    document.addEventListener('pointerdown', closeMenu)
    return () => document.removeEventListener('pointerdown', closeMenu)
  }, [])
  const rows = useMemo(() => accounts.filter((item) => `${item.userCode} ${item.fullName} ${item.email} ${item.designation}`.toLowerCase().includes(search.toLowerCase())), [accounts, search])
  const toggleBranch = (id) => setForm((current) => ({ ...current, branchIds: current.branchIds.includes(id) ? current.branchIds.filter((value) => value !== id) : [...current.branchIds, id] }))
  const openEdit = (account) => { setNotice(''); setError(''); setEditingAccount(account); setForm({ fullName: account.fullName || '', email: account.email || '', phone: account.phone || '', designation: account.designation || 'Placement Officer', allBranches: account.allBranches !== false, branchIds: Array.isArray(account.branchIds) ? account.branchIds : [] }); setFieldErrors({}); setActiveMenuId(null); setIsOpen(true) }
  const close = () => { if (!saving) { setIsOpen(false); setEditingAccount(null); setForm(initialForm); setFieldErrors({}) } }
  const submit = async (event) => {
    event.preventDefault(); setNotice(''); setError('')
    const nextErrors = {}
    if (!form.fullName.trim()) nextErrors.fullName = 'HR name is required.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.'
    if (form.phone && !/^\d{10,15}$/.test(form.phone)) nextErrors.phone = 'Use 10 to 15 digits.'
    if (!form.allBranches && !form.branchIds.length) nextErrors.branchIds = 'Select at least one branch.'
    setFieldErrors(nextErrors); if (Object.keys(nextErrors).length) return
    setSaving(true)
    try {
      if (editingAccount) { await updateHrAccount(editingAccount.id, form); setNotice('HR account updated successfully.') 
      } else { const result = await createHrAccount(form); setNotice(result?.invitationSent === false ? (result.deliveryMessage || 'Account created. Invitation delivery needs attention.') : 'HR account created and secure invitation sent.') }
      close(); await load()
    } catch (reason) { setError(messageFrom(reason, editingAccount ? 'Unable to update the HR account.' : 'Unable to create the HR account.')) }
    finally { setSaving(false) }
  }
  const resend = async (account) => {
    setNotice(''); setError('')
    try { await resendHrInvitation(account.id); setNotice(`A new secure invitation was sent to ${account.email}.`); await load() }
    catch (reason) { setError(messageFrom(reason, 'Invitation could not be sent.')) }
  }
  const toggleActive = async (account) => {
    setNotice(''); setError('')
    try { await updateHrAccount(account.id, { active: !account.active }); setNotice(`${account.fullName}'s account is now ${account.active ? 'inactive' : 'active'}.`); await load() }
    catch (reason) { setError(messageFrom(reason, 'Account status could not be updated.')) }
  }
  const requestDelete = (account) => { setActiveMenuId(null); setNotice(''); setError(''); setDeletingAccount(account) }
  const confirmDelete = async () => {
    if (!deletingAccount || deleting) return
    setDeleting(true); setNotice(''); setError('')
    try { await deleteHrAccount(deletingAccount.id); setDeletingAccount(null); setNotice('HR account deleted successfully.'); await load() }
    catch (reason) { setError(messageFrom(reason, 'Unable to delete the HR account.')) }
    finally { setDeleting(false) }
  }
  return <main className="hr-management-page">
    <header className="hr-management-hero"><div><p>USER &amp; ROLE MANAGEMENT</p><h1>HR Management</h1><span>Create secure HR placement accounts and control their branch access.</span></div><button type="button" className="hr-primary-button" onClick={() => { setNotice(''); setError(''); setIsOpen(true) }}><Plus size={18} />Create HR</button></header>
    {error ? <div className="hr-message is-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button></div> : null}
    {notice ? <div className="hr-message is-success" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><X size={16} /></button></div> : null}
    <section className="hr-account-panel"><div className="hr-account-panel-head"><div><h2>HR accounts</h2><span>Only Super Admin can create, update, activate, or send invitations.</span></div><label className="hr-search"><span className="sr-only">Search HR accounts</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search HR ID, name, or email" /></label></div>
      {loading ? <div className="hr-skeleton-table">{Array.from({ length: 5 }).map((_, index) => <i key={index} />)}</div> : <div className="hr-table-wrap"><table><thead><tr><th>HR account</th><th>Designation</th><th>Branch access</th><th>Activation</th><th>Actions</th></tr></thead><tbody>{rows.map((account, index) => <tr key={account.id}><td><div className="hr-account-name"><span><UserRound size={18} /></span><div><strong>{account.fullName}</strong><small>{account.userCode} Â· {account.email}</small></div></div></td><td>{account.designation || 'Placement Officer'}</td><td>{account.allBranches ? <span className="hr-scope"><Building2 size={14} />All active branches</span> : <span className="hr-scope">{account.branchIds?.length || 0} assigned branch{account.branchIds?.length === 1 ? '' : 'es'}</span>}</td><td><span className={'hr-status ' + (account.active ? 'is-active' : 'is-inactive')}>{account.active ? 'Active' : 'Inactive'}</span></td><td className="hr-action-cell" onClick={(event) => event.stopPropagation()}><div className={'hr-actions ' + (activeMenuId === account.id ? 'is-open' : '') + (index >= rows.length - 2 ? ' is-upward' : '')}><button type="button" className="hr-action-trigger" aria-label={'Open actions for ' + account.fullName} aria-haspopup="menu" aria-expanded={activeMenuId === account.id} onClick={() => setActiveMenuId((current) => current === account.id ? null : account.id)}><MoreVertical size={18} strokeWidth={2.3} /></button><div className="hr-actions-menu" role="menu" aria-label={account.fullName + ' actions'}><button type="button" role="menuitem" onClick={() => { setViewingAccount(account); setActiveMenuId(null) }}><Eye size={15} />View</button><button type="button" role="menuitem" onClick={() => openEdit(account)}><Pencil size={15} />Edit</button><button type="button" role="menuitem" className="is-danger" onClick={() => requestDelete(account)}><Trash2 size={15} />Delete</button></div></div></td></tr>)}{!rows.length ? <tr><td colSpan="5" className="hr-empty"><ShieldCheck size={24} />No HR accounts match this view.</td></tr> : null}</tbody></table></div>}</section>
    {isOpen ? <div className="hr-modal-backdrop" role="presentation" onMouseDown={close}><form className="hr-create-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} noValidate role="dialog" aria-modal="true" aria-labelledby="create-hr-title"><header><div><p>HR PLACEMENT ACCESS</p><h2 id="create-hr-title">{editingAccount ? 'Edit HR account' : 'Create HR account'}</h2><span>{editingAccount ? 'Update account details and branch access.' : 'An email invitation will contain a temporary password and a one-time setup link.'}</span></div><button type="button" onClick={close} aria-label="Close"><X size={20} /></button></header><div className="hr-form-grid"><label>Full name<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} autoFocus />{fieldErrors.fullName ? <small>{fieldErrors.fullName}</small> : null}</label><label>Official email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />{fieldErrors.email ? <small>{fieldErrors.email}</small> : null}</label><label>Phone number <em>Optional</em><input inputMode="numeric" maxLength="15" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, '') })} />{fieldErrors.phone ? <small>{fieldErrors.phone}</small> : null}</label><label>Designation<input value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} /></label></div><fieldset className="hr-scope-picker"><legend>Placement branch access</legend><label className="hr-radio"><input type="radio" checked={form.allBranches} onChange={() => setForm({ ...form, allBranches: true, branchIds: [] })} />All active branches</label><label className="hr-radio"><input type="radio" checked={!form.allBranches} onChange={() => setForm({ ...form, allBranches: false })} />Selected branches only</label>{!form.allBranches ? <div className="hr-branch-checks">{branches.map((branch) => <label key={branch.id}><input type="checkbox" checked={form.branchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} />{branch.branchName}<small>{branch.branchId}</small></label>)}</div> : null}{fieldErrors.branchIds ? <small className="hr-field-error">{fieldErrors.branchIds}</small> : null}</fieldset><footer><button type="button" onClick={close} disabled={saving}>Cancel</button><button className="hr-primary-button" type="submit" disabled={saving}>{saving ? <><RefreshCw size={16} className="hr-spin" />Savingâ€¦</> : editingAccount ? 'Save changes' : 'Create &amp; send invitation'}</button></footer></form></div> : null}
    {viewingAccount ? <div className="hr-modal-backdrop" role="presentation" onMouseDown={() => setViewingAccount(null)}><section className="hr-view-modal" role="dialog" aria-modal="true" aria-labelledby="hr-view-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p>HR ACCOUNT</p><h2 id="hr-view-title">{viewingAccount.fullName}</h2><span>{viewingAccount.userCode} Â· {viewingAccount.email}</span></div><button type="button" onClick={() => setViewingAccount(null)} aria-label="Close"><X size={20} /></button></header><div className="hr-view-grid"><div><span>Phone number</span><strong>{viewingAccount.phone || 'Not provided'}</strong></div><div><span>Designation</span><strong>{viewingAccount.designation || 'Placement Officer'}</strong></div><div><span>Activation</span><strong>{viewingAccount.active ? 'Active' : 'Inactive'}</strong></div><div className="is-wide"><span>Branch access</span><strong>{viewingAccount.allBranches ? 'All active branches' : (viewingAccount.branchIds?.length || 0) + ' assigned branch' + (viewingAccount.branchIds?.length === 1 ? '' : 'es')}</strong></div></div><footer><button type="button" className="hr-primary-button" onClick={() => { setViewingAccount(null); openEdit(viewingAccount) }}><Pencil size={16} />Edit account</button></footer></section></div> : null}
    {deletingAccount ? <div className="hr-modal-backdrop" role="presentation" onMouseDown={() => { if (!deleting) setDeletingAccount(null) }}><section className="hr-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-hr-title" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="hr-confirm-close" onClick={() => setDeletingAccount(null)} disabled={deleting} aria-label="Close"><X size={18} /></button><div className="hr-confirm-icon"><Trash2 size={20} /></div><h2 id="delete-hr-title">Delete HR account?</h2><p>This permanently removes <strong>{deletingAccount.fullName}</strong> and their HR login. This action cannot be undone.</p><footer><button type="button" onClick={() => setDeletingAccount(null)} disabled={deleting}>Cancel</button><button type="button" className="hr-danger-button" onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? <><RefreshCw size={15} className="hr-spin" />Deleting…</> : <><Trash2 size={15} />Delete account</>}</button></footer></section></div> : null}  </main>
}

