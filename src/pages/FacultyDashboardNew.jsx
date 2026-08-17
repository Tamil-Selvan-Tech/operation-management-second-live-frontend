import React from 'react';
import '../styles/FacultyDashboardNew.css';

// Simple placeholder dashboard for faculty users.
export default function FacultyDashboardNew() {
  return (
    <div className="faculty-dashboard">
      <h1>Faculty Dashboard</h1>
      <p>This is a dummy dashboard page. Add your widgets and content here.</p>
      <div className="cards-grid">
        <div className="card">
          <h3>Welcome</h3>
          <p>Welcome, faculty member!</p>
        </div>
        <div className="card">
          <h3>Upcoming Classes</h3>
          <p>No classes scheduled.</p>
        </div>
        <div className="card">
          <h3>Messages</h3>
          <p>No new messages.</p>
        </div>
      </div>
    </div>
  );
}
