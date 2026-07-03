import { roleDashboards, roleLabels } from '../data/authData'

const businessKpis = [
  { label: 'Active Students', value: '2,840', change: '+12.4%', tone: 'positive' },
  { label: 'Total Faculty', value: '86', change: '+4.1%', tone: 'positive' },
  { label: 'Total Courses', value: '124', change: '+8.7%', tone: 'positive' },
  { label: 'Pending Payments', value: '$48.2K', change: '-3.8%', tone: 'warning' },
]

const revenueSeries = [32, 41, 38, 50, 58, 55, 66, 74, 69, 78, 85, 92]
const studentAttendanceSeries = [68, 70, 74, 72, 78, 80, 77, 83, 86, 84, 88, 91]
const facultyAttendanceSeries = [61, 64, 66, 69, 72, 74, 73, 76, 78, 79, 81, 84]

const courseTrends = [
  { name: 'Business Analytics', progress: 94, students: 188 },
  { name: 'Digital Marketing', progress: 86, students: 164 },
  { name: 'Finance Foundation', progress: 72, students: 121 },
  { name: 'AI for Managers', progress: 68, students: 98 },
]

const batches = [
  { name: 'Morning', occupied: 78, available: 22 },
  { name: 'Afternoon', occupied: 64, available: 36 },
  { name: 'Evening', occupied: 91, available: 9 },
]

function buildLinePath(values, width = 100, height = 100, padding = 8) {
  if (!values.length) return ''

  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2

  return values
    .map((value, index) => {
      const x = padding + (usableWidth * index) / Math.max(values.length - 1, 1)
      const normalized = (value - min) / range
      const y = height - padding - normalized * usableHeight
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function buildAreaPath(values, width = 100, height = 100, padding = 8) {
  const line = buildLinePath(values, width, height, padding)
  if (!line) return ''
  const endX = width - padding
  const startX = padding
  const baseline = height - padding
  return `${line} L ${endX} ${baseline} L ${startX} ${baseline} Z`
}

function Sparkline({ values, stroke, fill }) {
  return (
    <svg className="sparkline" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d={buildAreaPath(values)} className="sparkline-area" style={{ fill }} />
      <path d={buildLinePath(values)} className="sparkline-line" style={{ stroke }} />
    </svg>
  )
}

function MiniTrendChart({ pointsA, pointsB, labelA, labelB, accentA, accentB }) {
  return (
    <div className="mini-trend-card">
      <div className="mini-trend-header">
        <div>
          <h3>Attendance Overview</h3>
          <p>Student and faculty presence across the last 12 weeks.</p>
        </div>
        <div className="mini-legend">
          <span style={{ '--legend-color': accentA }}>{labelA}</span>
          <span style={{ '--legend-color': accentB }}>{labelB}</span>
        </div>
      </div>

      <svg className="trend-chart" viewBox="0 0 420 220" role="img" aria-label="Attendance overview chart">
        <defs>
          <linearGradient id="attendanceFillA" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={accentA} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accentA} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="attendanceFillB" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={accentB} stopOpacity="0.24" />
            <stop offset="100%" stopColor={accentB} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={buildAreaPath(pointsA, 420, 220, 16)} fill="url(#attendanceFillA)" />
        <path d={buildAreaPath(pointsB, 420, 220, 16)} fill="url(#attendanceFillB)" />
        <path d={buildLinePath(pointsA, 420, 220, 16)} className="trend-line trend-line-a" />
        <path d={buildLinePath(pointsB, 420, 220, 16)} className="trend-line trend-line-b" />
        {pointsA.map((_, index) => {
          const x = 16 + ((420 - 32) * index) / Math.max(pointsA.length - 1, 1)
          return <line key={index} x1={x} x2={x} y1="16" y2="204" className="trend-grid-line" />
        })}
      </svg>
    </div>
  )
}

function RingMeter({ value, label, tone, subtitle }) {
  const circumference = 2 * Math.PI * 38
  const dashOffset = circumference - (value / 100) * circumference

  return (
    <div className="ring-card">
      <svg viewBox="0 0 100 100" className="ring-chart" aria-hidden="true">
        <circle cx="50" cy="50" r="38" className="ring-track" />
        <circle
          cx="50"
          cy="50"
          r="38"
          className={`ring-progress ring-progress-${tone}`}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="ring-content">
        <strong>{value}%</strong>
        <span>{label}</span>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}

function DashboardMetric({ label, value, change, tone, sparkValues }) {
  return (
    <article className="business-kpi">
      <div className="business-kpi-head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className={`business-kpi-change ${tone}`}>{change}</div>
      <Sparkline
        values={sparkValues}
        stroke={tone === 'warning' ? '#ef4444' : '#16a34a'}
        fill={tone === 'warning' ? 'rgba(239, 68, 68, 0.14)' : 'rgba(22, 163, 74, 0.14)'}
      />
    </article>
  )
}

function BusinessOwnerDashboard({ dashboard }) {
  return (
    <section className="business-owner-dashboard">
      <div className="business-topbar">
        <div>
          <p className="eyebrow">Business Owner</p>
          <h2>{dashboard.title}</h2>
          <p>{dashboard.summary}</p>
        </div>

        <div className="business-topbar-actions">
          <label className="dashboard-search">
            <span aria-hidden="true">⌕</span>
            <input type="search" placeholder="Search..." aria-label="Search dashboard" />
          </label>
          <button className="icon-chip" type="button" aria-label="Calendar">
            <span>◫</span>
          </button>
          <button className="icon-chip notification-chip" type="button" aria-label="Notifications">
            <span>🔔</span>
            <b>1</b>
          </button>
          <div className="profile-chip">
            <div className="profile-avatar">BH</div>
            <div>
              <strong>Business Head</strong>
              <span>business.owner@cispro.com</span>
            </div>
          </div>
        </div>
      </div>

      <div className="kpi-row">
        {businessKpis.map((item, index) => (
          <DashboardMetric
            key={item.label}
            {...item}
            sparkValues={revenueSeries.slice(index, index + 6).concat(revenueSeries.slice(0, 2))}
          />
        ))}
      </div>

      <div className="dashboard-layout">
        <article className="panel-card revenue-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Revenue</p>
              <h3>Revenue Overview</h3>
            </div>
            <div className="growth-pill">+12.8% vs last month</div>
          </div>

          <div className="revenue-summary">
            <strong>$94,127</strong>
            <span>Monthly revenue</span>
          </div>

          <div className="revenue-breakdown">
            <div>
              <span>Collected</span>
              <strong>$78,410</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>$12,930</strong>
            </div>
            <div>
              <span>Forecast</span>
              <strong>$101,200</strong>
            </div>
            <div>
              <span>Refunds</span>
              <strong>$1,260</strong>
            </div>
          </div>

          <Sparkline values={revenueSeries} stroke="#0f7bda" fill="rgba(15, 123, 220, 0.18)" />
        </article>

        <article className="panel-card visitor-card">
          <div className="section-head compact">
            <div>
              <p className="section-kicker">Attendance</p>
              <h3>Student Attendance Overview</h3>
            </div>
            <span className="detail-badge">92.4%</span>
          </div>

          <MiniTrendChart
            pointsA={studentAttendanceSeries}
            pointsB={facultyAttendanceSeries}
            labelA="Students"
            labelB="Faculty"
            accentA="#0f7bda"
            accentB="#84cc16"
          />
        </article>

        <article className="panel-card course-card">
          <div className="section-head compact">
            <div>
              <p className="section-kicker">Trending</p>
              <h3>Trending Courses Overview</h3>
            </div>
            <span className="detail-badge">Top 4</span>
          </div>

          <div className="course-list">
            {courseTrends.map((course) => (
              <div key={course.name} className="course-row">
                <div className="course-row-top">
                  <strong>{course.name}</strong>
                  <span>{course.students} students</span>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${course.progress}%` }} />
                </div>
                <div className="course-row-bottom">
                  <span>Popularity</span>
                  <strong>{course.progress}%</strong>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card batch-card">
          <div className="section-head compact">
            <div>
              <p className="section-kicker">Batch</p>
              <h3>Batch Availability</h3>
            </div>
            <span className="detail-badge">Seats Open</span>
          </div>

          <div className="batch-grid">
            {batches.map((batch) => (
              <div key={batch.name} className="batch-row">
                <div className="batch-name">
                  <strong>{batch.name}</strong>
                  <span>{batch.available}% available</span>
                </div>
                <div className="batch-meter">
                  <span style={{ width: `${batch.occupied}%` }} />
                </div>
                <div className="batch-values">
                  <span>Occupied {batch.occupied}%</span>
                  <span>Free {batch.available}%</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card payments-card">
          <div className="section-head compact">
            <div>
              <p className="section-kicker">Payments</p>
              <h3>Pending Payments</h3>
            </div>
            <span className="detail-badge danger">Needs review</span>
          </div>

          <div className="payments-total">
            <strong>$48,250</strong>
            <span>Outstanding across 148 accounts</span>
          </div>

          <div className="payments-list">
            <div>
              <span>Due this week</span>
              <strong>$19,400</strong>
            </div>
            <div>
              <span>Overdue</span>
              <strong>$11,780</strong>
            </div>
            <div>
              <span>Scheduled</span>
              <strong>$17,070</strong>
            </div>
          </div>

          <div className="payments-note">Follow up with high-value accounts to reduce overdue balance.</div>
        </article>

        <article className="panel-card metrics-card">
          <div className="section-head compact">
            <div>
              <p className="section-kicker">Attendance</p>
              <h3>Faculty Attendance Overview</h3>
            </div>
          </div>

          <div className="ring-grid">
            <RingMeter value={92} label="Faculty present" tone="blue" subtitle="Daily mean attendance" />
            <RingMeter value={81} label="Batch fill rate" tone="green" subtitle="Average occupancy" />
          </div>
        </article>
      </div>
    </section>
  )
}

function GenericDashboard({ role }) {
  const dashboard = roleDashboards[role]

  return (
    <section className="dashboard-grid">
      <article className="hero-card">
        <div>
          <p className="eyebrow">{dashboard.accent} lane</p>
          <h2>{dashboard.title}</h2>
          <p>{dashboard.summary}</p>
        </div>
        <div className="metric" style={{ '--metric-color': dashboard.color }}>
          <span>Access</span>
          <strong>{roleLabels[role]}</strong>
        </div>
      </article>

      {dashboard.cards.map((card) => (
        <article key={card} className="info-card">
          <span className="dot" style={{ backgroundColor: dashboard.color }} />
          <h3>{card}</h3>
          <p>Placeholder card for role-specific work and permissions validation.</p>
        </article>
      ))}
    </section>
  )
}

export function DashboardPage({ role }) {
  const dashboard = roleDashboards[role]

  if (role === 'business-owner') {
    return <BusinessOwnerDashboard dashboard={dashboard} />
  }

  return <GenericDashboard role={role} />
}
