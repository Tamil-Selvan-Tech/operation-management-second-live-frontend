import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Building2, CalendarDays, ChevronRight, CircleUserRound, Clock3, Mail, MapPin, Phone, Save, ShieldCheck, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { request } from '../services/apiClient'
import { useAuth } from '../auth/useAuth'

function displayValue(value) {
  return String(value ?? '').trim() || '—'
}

function formatProfileDate(value, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  }).format(date)
}

function initialsFor(name) {
  return String(name || 'Sales Admin').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'SA'
}

export function SalesAdminProfilePage() {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [form, setForm] = useState({ fullName: '', phone: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await request('/sales-admins/me')
      setProfile(response?.data || null)
    } catch (error) {
      setLoadError(error?.message || 'Unable to load your profile.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) void loadProfile() })
    return () => { active = false }
  }, [loadProfile])

  const profileName = profile?.fullName || profile?.name || 'Sales Admin'
  const branches = Array.isArray(profile?.branches) ? profile.branches : []
  const statusLabel = profile?.active ? 'Active' : 'Inactive'
  const initials = initialsFor(profileName)

  const saveProfile = async (event) => {
    event.preventDefault()
    setFormError('')
    setSuccess('')
    const fullName = form.fullName.trim()
    const phone = form.phone.trim()
    if (!fullName) { setFormError('Full name is required.'); return }
    if (!/^[\p{L}][\p{L} .'-]*$/u.test(fullName)) { setFormError('Enter a valid full name.'); return }
    if (!/^\d{10}$/.test(phone)) { setFormError('Phone number must contain exactly 10 digits.'); return }
    if (form.address.length > 500) { setFormError('Address must be 500 characters or fewer.'); return }

    setSaving(true)
    try {
      const response = await request('/sales-admins/me', {
        method: 'PUT',
        body: JSON.stringify({ fullName, phone, address: form.address.trim() }),
      })
      const updatedProfile = response?.data
      if (!updatedProfile) throw new Error('The server did not return the updated profile.')
      setProfile(updatedProfile)
      setSession((current) => current ? ({
        ...current,
        user: { ...current.user, ...updatedProfile, name: updatedProfile.fullName },
      }) : current)
      setIsEditOpen(false)
      setSuccess('Profile updated successfully.')
    } catch (error) {
      setFormError(error?.message || 'Unable to save profile changes.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <section className="sales-admin-profile-page" aria-label="Loading profile"><div className="sales-admin-profile-skeleton"><i /><i /><i /></div></section>
  if (loadError) return <section className="sales-admin-profile-page"><div className="sales-admin-profile-error" role="alert"><span>{loadError}</span><button type="button" onClick={() => void loadProfile()}>Try again</button></div></section>
  if (!profile) return <section className="sales-admin-profile-page"><div className="sales-admin-profile-empty">Your profile could not be found.</div></section>

  return (
    <section className="sales-admin-profile-page">
      <header className="sales-admin-profile-header">
        <div className="sales-admin-profile-identity">
          <div className="sales-admin-profile-avatar" aria-hidden="true">{initials}</div>
          <div className="sales-admin-profile-heading">
            <p className="sales-admin-profile-eyebrow">ACCOUNT PROFILE</p>
            <h2>{profileName}</h2>
            <div className="sales-admin-profile-meta"><span>{displayValue(profile.userCode)}</span><i /> <span>Sales Admin</span><i /> <span className={`sales-admin-profile-status ${profile.active ? 'is-active' : 'is-inactive'}`}>{statusLabel}</span></div>
          </div>
        </div>
        <button type="button" className="sales-admin-profile-change-password" onClick={() => navigate(`/forgot-password${profile.email ? `?email=${encodeURIComponent(profile.email)}` : ''}`)}>Change Password <ChevronRight size={16} /></button>
      </header>

      {success ? <div className="sales-admin-profile-success" role="status">{success}</div> : null}

      <div className="sales-admin-profile-grid">
        <section className="sales-admin-profile-card" aria-labelledby="sales-admin-personal-heading">
          <header><span><CircleUserRound size={17} /></span><div><h3 id="sales-admin-personal-heading">Personal Information</h3><p>Your contact and account details</p></div></header>
          <div className="sales-admin-profile-fields">
            <ProfileField icon={CircleUserRound} label="Full Name" value={profileName} />
            <ProfileField icon={BadgeCheck} label="Sales Admin ID" value={profile.userCode} />
            <ProfileField icon={Mail} label="Email Address" value={profile.email} />
            <ProfileField icon={Phone} label="Phone Number" value={profile.phone} />
            <ProfileField icon={MapPin} label="Address" value={profile.address} />
            <ProfileField icon={ShieldCheck} label="Account Status" value={statusLabel} />
            <ProfileField icon={CalendarDays} label="Account Created" value={formatProfileDate(profile.createdAt)} />
            <ProfileField icon={Clock3} label="Last Login" value={formatProfileDate(profile.lastLoginAt, true)} />
          </div>
        </section>

        <section className="sales-admin-profile-card" aria-labelledby="sales-admin-branches-heading">
          <header><span><Building2 size={17} /></span><div><h3 id="sales-admin-branches-heading">Assigned Branches</h3><p>{branches.length} {branches.length === 1 ? 'branch' : 'branches'} assigned to your account</p></div></header>
          {branches.length ? <div className="sales-admin-profile-branches">{branches.map((branch) => <article key={branch.id || branch.branchId} className="sales-admin-profile-branch"><span className="sales-admin-profile-branch-icon"><Building2 size={17} /></span><div><strong>{displayValue(branch.branchName)}</strong><small>{displayValue(branch.branchId)}</small></div><span className={`sales-admin-profile-branch-status ${String(branch.status || '').toUpperCase() === 'ACTIVE' ? 'is-active' : 'is-inactive'}`}>{displayValue(branch.status)}</span></article>)}</div> : <div className="sales-admin-profile-empty">No branches are currently assigned.</div>}
        </section>

        <section className="sales-admin-profile-card sales-admin-profile-account-card" aria-labelledby="sales-admin-account-heading">
          <header><span><ShieldCheck size={17} /></span><div><h3 id="sales-admin-account-heading">Account Information</h3><p>Role and access scope</p></div></header>
          <div className="sales-admin-profile-account-rows">
            <div><span>Role</span><strong>Sales Admin</strong></div>
            <div><span>Access</span><strong>Sales CRM for assigned branches</strong></div>
            <div><span>Account status</span><strong>{statusLabel}</strong></div>
            <div><span>Last login</span><strong>{formatProfileDate(profile.lastLoginAt, true)}</strong></div>
          </div>
        </section>
      </div>

      {isEditOpen ? <div className="sales-admin-profile-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setIsEditOpen(false) }}>
        <section className="sales-admin-profile-modal" role="dialog" aria-modal="true" aria-labelledby="sales-admin-edit-heading">
          <header><div><p className="sales-admin-profile-eyebrow">ACCOUNT PROFILE</p><h2 id="sales-admin-edit-heading">Edit Profile</h2><span>Update your name, phone number, or address.</span></div><button type="button" aria-label="Close edit profile" onClick={() => setIsEditOpen(false)} disabled={saving}><X size={18} /></button></header>
          <form onSubmit={saveProfile} noValidate>
            <label>Full Name *<input autoComplete="name" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} maxLength={120} required /></label>
            <label>Phone Number *<input autoComplete="tel-national" inputMode="numeric" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} maxLength={10} required /></label>
            <label>Address<textarea autoComplete="street-address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} maxLength={500} rows={3} /></label>
            {formError ? <div className="sales-admin-profile-form-error" role="alert">{formError}</div> : null}
            <div className="sales-admin-profile-readonly-note"><Mail size={14} /><span>Email, Sales Admin ID, role, status, and assigned branches are read-only.</span></div>
            <footer><button type="button" className="sales-admin-profile-cancel" onClick={() => setIsEditOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="sales-admin-profile-save" disabled={saving}><Save size={15} />{saving ? 'Saving…' : 'Save Changes'}</button></footer>
          </form>
        </section>
      </div> : null}
    </section>
  )
}

function ProfileField({ icon: Icon, label, value }) {
  return <div className="sales-admin-profile-field"><span>{Icon ? <Icon size={12} aria-hidden="true" /> : null}{label}</span><strong>{displayValue(value)}</strong></div>
}
