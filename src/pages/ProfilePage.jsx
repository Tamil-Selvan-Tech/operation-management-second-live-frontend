import { roleLabels } from '../data/authData'

export function ProfilePage({ session, onLogout }) {
  return (
    <section className="panel profile-panel">
      <div>
        <p className="eyebrow">Profile</p>
        <h2>{session.user.name}</h2>
        <p>{session.user.email}</p>
      </div>

      <div className="profile-grid">
        <div>
          <span>Role</span>
          <strong>{roleLabels[session.user.role]}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>Active</strong>
        </div>
        <div>
          <span>Session</span>
          <strong>Mock token ready</strong>
        </div>
      </div>

      <button type="button" onClick={onLogout}>
        Logout
      </button>
    </section>
  )
}
