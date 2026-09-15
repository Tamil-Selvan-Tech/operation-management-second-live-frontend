import { useMemo, useState } from 'react'
import { Camera, Check, KeyRound, MapPin, Pencil, ShieldCheck, UserRound } from 'lucide-react'
import { changePassword } from '../services/apiClient'
import '../styles/AdminProfilePage.css'

const PREFERENCE_TYPES = [
  ['payments', 'Payment Notifications'],
  ['students', 'Student Notifications'],
  ['faculty', 'Faculty Notifications'],
  ['leave', 'Leave Requests'],
  ['editRequests', 'Edit Requests'],
  ['system', 'System Notifications'],
]

const text = (value, fallback = 'Not provided') => String(value || '').trim() || fallback
const formatDate = (value) => {
  if (!value) return 'Not provided'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? text(value) : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function AdminProfilePage({ user, role, branchProfile = null, onProfileUpdated }) {
  const isSuperAdmin = role === 'super-admin'
  const profile = isSuperAdmin ? {
    fullName: user?.name,
    email: user?.email,
    phone: user?.phone || user?.phoneNumber,
    dateOfBirth: user?.dateOfBirth,
    gender: user?.gender,
    address: user?.address,
    location: user?.location,
    createdAt: user?.createdAt || user?.createdOn,
    photo: user?.profilePhoto || user?.avatar,
  } : {
    fullName: branchProfile?.branchAdminName || user?.name,
    email: branchProfile?.branchEmail || user?.email,
    phone: branchProfile?.branchPhone || branchProfile?.phone,
    dateOfBirth: user?.dateOfBirth,
    gender: user?.gender,
    address: branchProfile?.branchAddress || user?.address,
    location: [branchProfile?.branchCity || branchProfile?.branchDistrict, branchProfile?.branchState].filter(Boolean).join(', '),
    createdAt: branchProfile?.createdAt || user?.createdAt,
    photo: user?.profilePhoto || user?.avatar,
  }
  const preferenceKey = `cispro:admin-notification-preferences:${String(user?.id || profile.email || role)}`
  const [isEditing, setIsEditing] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState(profile.photo || '')
  const [form, setForm] = useState({ ...profile })
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)
  const [preferences, setPreferences] = useState(() => {
    try { return { ...Object.fromEntries(PREFERENCE_TYPES.map(([key]) => [key, true])), ...JSON.parse(window.localStorage.getItem(preferenceKey) || '{}') } } catch { return Object.fromEntries(PREFERENCE_TYPES.map(([key]) => [key, true])) }
  })
  const initials = useMemo(() => text(form.fullName, 'Admin').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), [form.fullName])

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const saveProfile = () => {
    if (!String(form.fullName || '').trim() || !/^\S+@\S+\.\S+$/.test(String(form.email || '').trim())) { setError('Enter a valid name and email address.'); return }
    onProfileUpdated?.({ ...form, profilePhoto: photo })
    setIsEditing(false)
    setMessage('Profile updated successfully.')
    setError('')
  }
  const savePreferences = (key, value) => {
    const next = { ...preferences, [key]: value }
    setPreferences(next)
    window.localStorage.setItem(preferenceKey, JSON.stringify(next))
  }
  const uploadPhoto = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setPhoto(String(reader.result || '')); setMessage('Profile photo updated. Save your profile to keep it.') }
    reader.readAsDataURL(file)
  }
  const submitPassword = async (event) => {
    event.preventDefault()
    setError(''); setMessage('')
    if (passwordForm.next.length < 8 || passwordForm.next !== passwordForm.confirm) { setError('New password must be at least 8 characters and match confirmation.'); return }
    setIsPasswordSaving(true)
    try { await changePassword(passwordForm.next); setPasswordForm({ current: '', next: '', confirm: '' }); setIsPasswordOpen(false); setMessage('Password changed successfully.') } catch (passwordError) { setError(passwordError?.message || 'Unable to change password.') } finally { setIsPasswordSaving(false) }
  }

  return <section className="admin-profile-page">
    <div className="admin-profile-heading"><div><p className="admin-profile-kicker">Account</p><h1>Profile</h1><p>Manage your personal information and account preferences.</p></div></div>
    {message ? <div className="admin-profile-alert is-success"><Check size={17} />{message}</div> : null}
    {error ? <div className="admin-profile-alert is-error">{error}</div> : null}
    <div className="admin-profile-summary-card">
      <div className="admin-profile-avatar-wrap"><div className="admin-profile-avatar">{photo ? <img src={photo} alt="Profile" /> : initials}</div><label className="admin-profile-photo-button"><Camera size={15} /> Change photo<input type="file" accept="image/*" onChange={uploadPhoto} /></label></div>
      <div className="admin-profile-summary-copy"><span className="admin-profile-status">Active</span><h2>{text(form.fullName)}</h2><p>{isSuperAdmin ? 'Super Admin' : 'Branch Admin'}</p><div className="admin-profile-summary-meta"><span>{text(form.email)}</span><span>{text(form.phone)}</span><span><MapPin size={14} /> {text(form.location || form.address)}</span><span>Member since {formatDate(form.createdAt)}</span></div></div>
      <button type="button" className="admin-profile-primary-button" onClick={() => { setIsEditing(true); setError('') }}><Pencil size={15} /> Edit Profile</button>
    </div>
    <div className="admin-profile-columns">
      <article className="admin-profile-card admin-profile-personal"><div className="admin-profile-card-heading"><div><span>Personal details</span><h2>Personal Information</h2></div><button type="button" onClick={() => setIsEditing(true)}><Pencil size={14} /> Edit</button></div><div className="admin-profile-fields"><ProfileField label="Full Name" value={form.fullName} /><ProfileField label="Email" value={form.email} />{(!isSuperAdmin || form.phone) ? <ProfileField label="Phone Number" value={form.phone} /> : null}{form.dateOfBirth ? <ProfileField label="Date of Birth" value={form.dateOfBirth} /> : null}{form.gender ? <ProfileField label="Gender" value={form.gender} /> : null}{(!isSuperAdmin || form.address) ? <ProfileField label="Address" value={form.address} /> : null}</div></article>
      <article className="admin-profile-card"><div className="admin-profile-card-heading"><div><span>Access</span><h2>{isSuperAdmin ? 'Role & Organization Information' : 'Role & Branch Information'}</h2></div><ShieldCheck size={20} /></div><div className="admin-profile-fields"><ProfileField label="Role" value={isSuperAdmin ? 'Super Admin' : 'Branch Admin'} /><ProfileField label="Access Level" value={isSuperAdmin ? 'Full Access' : 'Branch Level'} />{isSuperAdmin ? <>{user?.organizationName || user?.organization?.name ? <ProfileField label="Organization Name" value={user.organizationName || user.organization.name} /> : null}{form.createdAt ? <ProfileField label="Account Created Date" value={formatDate(form.createdAt)} /> : null}</> : <><ProfileField label="Branch Name" value={branchProfile?.branchName} /><ProfileField label="Branch ID" value={branchProfile?.branchId || branchProfile?.id} /><ProfileField label="Account Created Date" value={formatDate(form.createdAt)} /></>}</div></article>
      {!isSuperAdmin ? <article className="admin-profile-card"><div className="admin-profile-card-heading"><div><span>Account protection</span><h2>Security</h2></div><KeyRound size={20} /></div><div className="admin-profile-security-row"><span>Password</span><strong>••••••••</strong><button type="button" onClick={() => { setIsPasswordOpen(true); setError('') }}>Change Password</button></div><div className="admin-profile-security-row"><span>Two-Factor Authentication</span><strong>Not available</strong></div><div className="admin-profile-security-row"><span>Last Login</span><strong>{formatDate(user?.lastLoginAt || branchProfile?.lastLoginAt)}</strong></div></article> : null}
      <article className="admin-profile-card"><div className="admin-profile-card-heading"><div><span>Alerts</span><h2>Notification Preferences</h2></div></div>{PREFERENCE_TYPES.map(([key, label]) => <label className="admin-profile-toggle" key={key}><span>{label}</span><input type="checkbox" checked={preferences[key] !== false} onChange={(event) => savePreferences(key, event.target.checked)} /><i /></label>)}</article>
      <article className="admin-profile-card admin-profile-activity"><div className="admin-profile-card-heading"><div><span>Account history</span><h2>Recent Activity</h2></div></div><div className="admin-profile-empty"><UserRound size={20} /><span>No recent activity history is available.</span></div></article>
    </div>
    {isEditing ? <ProfileEditor form={form} setForm={setForm} photo={photo} updateField={updateField} onSave={saveProfile} onClose={() => { setForm({ ...profile }); setPhoto(profile.photo || ''); setIsEditing(false) }} /> : null}
    {isPasswordOpen ? <div className="admin-profile-modal-backdrop"><form className="admin-profile-modal" onSubmit={submitPassword}><h2>Change Password</h2><p>Use a strong password with at least 8 characters.</p>{[['current', 'Current Password'], ['next', 'New Password'], ['confirm', 'Confirm New Password']].map(([key, label]) => <label key={key}>{label}<input type="password" required value={passwordForm[key]} onChange={(event) => setPasswordForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<div className="admin-profile-modal-actions"><button type="button" onClick={() => setIsPasswordOpen(false)}>Cancel</button><button type="submit" disabled={isPasswordSaving}>{isPasswordSaving ? 'Changing...' : 'Change Password'}</button></div></form></div> : null}
  </section>
}

function ProfileField({ label, value }) { return <div><span>{label}</span><strong>{text(value)}</strong></div> }

function ProfileEditor({ form, updateField, onSave, onClose }) {
  return <div className="admin-profile-modal-backdrop"><div className="admin-profile-modal"><h2>Edit Profile</h2><p>Update permitted personal information only.</p><label>Full Name<input value={form.fullName || ''} onChange={(event) => updateField('fullName', event.target.value)} /></label><label>Email<input type="email" value={form.email || ''} onChange={(event) => updateField('email', event.target.value)} /></label><label>Phone Number<input value={form.phone || ''} onChange={(event) => updateField('phone', event.target.value)} /></label><div className="admin-profile-form-grid"><label>Date of Birth<input type="date" value={form.dateOfBirth || ''} onChange={(event) => updateField('dateOfBirth', event.target.value)} /></label><label>Gender<select value={form.gender || ''} onChange={(event) => updateField('gender', event.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></label></div><label>Address<textarea value={form.address || ''} onChange={(event) => updateField('address', event.target.value)} /></label><div className="admin-profile-modal-actions"><button type="button" onClick={onClose}>Cancel</button><button type="button" onClick={onSave}>Save Changes</button></div></div></div>
}
