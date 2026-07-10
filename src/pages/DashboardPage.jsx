import { useEffect, useState } from 'react'

import { roleDashboards, roleLabels } from '../data/authData'
import { getRevenueSummary } from '../services/dashboardService'

const revenueComparisonData = [
  { month: 'Jan', monthly: 50000, expected: 55000 },
  { month: 'Feb', monthly: 65000, expected: 70000 },
  { month: 'Mar', monthly: 80000, expected: 90000 },
  { month: 'Apr', monthly: 75000, expected: 85000 },
  { month: 'May', monthly: 95000, expected: 100000 },
  { month: 'Jun', monthly: 85000, expected: 90000 },
  { month: 'Jul', monthly: 60000, expected: 55000 },
]

const weeklyRevenueComparisonData = [
  { week: 'Week 1', weekly: 18000, expected: 22000 },
  { week: 'Week 2', weekly: 25000, expected: 28000 },
  { week: 'Week 3', weekly: 32000, expected: 35000 },
  { week: 'Week 4', weekly: 28000, expected: 30000 },
]

const attendanceComparisonData = [
  { month: 'Jan', attendance: 82, students: 240 },
  { month: 'Feb', attendance: 85, students: 250 },
  { month: 'Mar', attendance: 88, students: 265 },
  { month: 'Apr', attendance: 90, students: 270 },
  { month: 'May', attendance: 92, students: 280 },
  { month: 'Jun', attendance: 87, students: 260 },
  { month: 'Jul', attendance: 85, students: 255 },
  { month: 'Aug', attendance: 83, students: 245 },
  { month: 'Sep', attendance: 86, students: 258 },
  { month: 'Oct', attendance: 89, students: 268 },
  { month: 'Nov', attendance: 84, students: 252 },
  { month: 'Dec', attendance: 91, students: 275 },
]

const revenueComparisonTicks = [0, 30000, 60000, 90000, 120000]
const weeklyRevenueMax = 40000
const revenueFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function formatRevenue(value) {
  return revenueFormatter.format(Number(value || 0))
}

function getEdgeAwareTooltipStyle(activeIndex, totalItems) {
  if (activeIndex === null) return null

  if (activeIndex < 2) {
    return { left: '12px', transform: 'none' }
  }

  if (activeIndex > totalItems - 3) {
    return { left: 'auto', right: '12px', transform: 'none' }
  }

  return { left: '50%', transform: 'translateX(-50%)' }
}

function buildRevenueSummaryCards(summary, isLoading) {
  const formatValue = (value) => {
    if (isLoading) return 'Loading...'
    return formatRevenue(value)
  }

  return [
    {
      label: 'Total Revenue',
      value: formatValue(summary?.totalRevenue),
      change: null,
      note: isLoading ? 'Loading student revenue' : `${summary?.totalStudents || 0} students added`,
      accent: 'blue',
      icon: 'wallet',
    },
    {
      label: 'This Month Revenue',
      value: formatValue(summary?.thisMonthRevenue),
      change: null,
      note: isLoading ? 'Loading current month data' : `${summary?.thisMonthStudents || 0} admissions this month`,
      accent: 'green',
      icon: 'calendar',
    },
    {
      label: 'This Week Revenue',
      value: formatValue(summary?.thisWeekRevenue),
      change: null,
      note: isLoading ? 'Loading current week data' : `${summary?.thisWeekStudents || 0} admissions this week`,
      accent: 'purple',
      icon: 'trend',
    },
    {
      label: 'Expected Next Week',
      value: formatValue(summary?.expectedNextWeekRevenue),
      change: null,
      note: isLoading ? 'Loading projection' : 'Projected from student admissions',
      accent: 'orange',
      icon: 'target',
    },
  ]
}

function SummaryIcon({ kind }) {
  if (kind === 'wallet') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4.5 7.5h13.2c1.5 0 2.8 1.2 2.8 2.8V16c0 1.6-1.3 2.8-2.8 2.8H7.2C5.2 18.8 4 17.4 4 15.6V8c0-.3.2-.5.5-.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16.5 10.2h4v3.6h-4c-1 0-1.8-.8-1.8-1.8s.8-1.8 1.8-1.8Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.8" cy="12" r="0.9" fill="currentColor" />
      </svg>
    )
  }

  if (kind === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4.5" y="5.5" width="15" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 9h15" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 4v3M16 4v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 12h3M13 12h3M8 15h3M13 15h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'trend') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4.5 17.5h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6 16V8M11 16v-4M16 16V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6.5 11.5 10.2 8.8 13.5 10 18 5.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17.2 5.8h1.9v1.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M12 5.5v2.1M12 16.4v2.1M5.5 12h2.1M16.4 12h2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SummaryCardRow({ summary, isLoading }) {
  const cards = buildRevenueSummaryCards(summary, isLoading)

  return (
    <section className="revenue-summary-row" aria-label="Revenue summary">
      {cards.map((card) => (
        <article key={card.label} className="revenue-summary-card">
          <div className={`revenue-summary-icon ${card.accent}`} aria-hidden="true">
            <SummaryIcon kind={card.icon} />
          </div>
          <div className="revenue-summary-content">
            <strong className="revenue-summary-label">{card.label}</strong>
            <div className="revenue-summary-value">{card.value}</div>
            {card.change ? (
              <div className="revenue-summary-change">
                <span className="revenue-summary-pill">
                  <span className="revenue-summary-arrow">↑</span>
                  {card.change}
                </span>
                <span className="revenue-summary-note">{card.note}</span>
              </div>
            ) : (
              <div className="revenue-summary-note revenue-summary-note-alone">{card.note}</div>
            )}
          </div>
        </article>
      ))}
    </section>
  )
}

function MonthlyRevenueChart() {
  const [activeIndex, setActiveIndex] = useState(null)
  const chartMax = revenueComparisonTicks[revenueComparisonTicks.length - 1]
  const activePoint = activeIndex === null ? null : revenueComparisonData[activeIndex]
  const tooltipStyle = getEdgeAwareTooltipStyle(activeIndex, revenueComparisonData.length)

  return (
    <article className="panel-card revenue-comparison-card revenue-monthly-card">
      <div className="revenue-comparison-header">
        <div>
          <h3>Monthly Revenue vs Expected Revenue (Next Month)</h3>
          <p>Comparison of actual monthly revenue and expected revenue for the next month.</p>
        </div>
        <div className="revenue-legend" aria-hidden="true">
          <span className="revenue-legend-item">
            <span className="revenue-legend-swatch monthly" />
            Monthly Revenue
          </span>
          <span className="revenue-legend-item">
            <span className="revenue-legend-swatch expected" />
            Expected Revenue
          </span>
        </div>
      </div>

      <div className="revenue-comparison-body">
        <div className="revenue-axis-y" aria-hidden="true">
          {revenueComparisonTicks
            .slice()
            .reverse()
            .map((tick) => (
              <span key={tick}>{formatRevenue(tick)}</span>
            ))}
        </div>

        <div className="revenue-plot" onMouseLeave={() => setActiveIndex(null)}>
          <div className="revenue-grid-lines" aria-hidden="true">
            {revenueComparisonTicks.slice(1).map((tick) => (
              <span key={tick} />
            ))}
          </div>

          {activePoint ? (
            <div className="revenue-tooltip" style={tooltipStyle || undefined}>
              <strong>{activePoint.month}</strong>
              <div className="revenue-tooltip-row">
                <span className="revenue-tooltip-label">
                  <span className="revenue-tooltip-dot monthly" />
                  Monthly Revenue
                </span>
                <span className="revenue-tooltip-value">{formatRevenue(activePoint.monthly)}</span>
              </div>
              <div className="revenue-tooltip-row">
                <span className="revenue-tooltip-label">
                  <span className="revenue-tooltip-dot expected" />
                  Expected Revenue
                </span>
                <span className="revenue-tooltip-value">{formatRevenue(activePoint.expected)}</span>
              </div>
            </div>
          ) : null}

          <div className="revenue-groups">
            {revenueComparisonData.map((item, index) => {
              const monthlyHeight = `${(item.monthly / chartMax) * 100}%`
              const expectedHeight = `${(item.expected / chartMax) * 100}%`
              const isActive = index === activeIndex

              return (
                <button
                  key={item.month}
                  type="button"
                  className={`revenue-month-group ${isActive ? 'is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                  aria-label={`${item.month}. Monthly Revenue ${formatRevenue(item.monthly)}. Expected Revenue ${formatRevenue(item.expected)}.`}
                >
                  <span className="revenue-bars" aria-hidden="true">
                    <span className="revenue-bar monthly" style={{ height: monthlyHeight }} />
                    <span className="revenue-bar expected" style={{ height: expectedHeight }} />
                  </span>
                  <span className="revenue-month-label">{item.month}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </article>
  )
}

function WeeklyRevenueChart() {
  const [activeIndex, setActiveIndex] = useState(null)
  const activePoint = activeIndex === null ? null : weeklyRevenueComparisonData[activeIndex]
  const tooltipTop =
    activeIndex === null
      ? '50%'
      : `${Math.min(82, Math.max(18, ((activeIndex + 0.5) / weeklyRevenueComparisonData.length) * 100))}%`

  return (
    <article className="panel-card revenue-comparison-card revenue-weekly-card">
      <div className="revenue-comparison-header">
        <div>
          <h3>Weekly Revenue vs Expected Revenue (Next Week)</h3>
          <p>Comparison of actual weekly revenue and expected revenue for the next week.</p>
        </div>
      </div>

      <div className="revenue-legend revenue-weekly-legend" aria-hidden="true">
        <span className="revenue-legend-item">
          <span className="revenue-legend-swatch monthly" />
          Weekly Revenue
        </span>
        <span className="revenue-legend-item">
          <span className="revenue-legend-swatch expected" />
          Expected Next Week
        </span>
      </div>

      <div className="revenue-weekly-body">
        <div className="revenue-weekly-axis-y" aria-hidden="true">
          {weeklyRevenueComparisonData.map((item) => (
            <span key={item.week}>{item.week}</span>
          ))}
        </div>

        <div className="revenue-weekly-plot" onMouseLeave={() => setActiveIndex(null)}>
          <div className="revenue-weekly-grid-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>

          {activePoint ? (
            <div className="revenue-tooltip revenue-weekly-tooltip" style={{ top: tooltipTop }}>
              <strong>{activePoint.week}</strong>
              <div className="revenue-tooltip-row">
                <span className="revenue-tooltip-label">
                  <span className="revenue-tooltip-dot monthly" />
                  Weekly Revenue
                </span>
                <span className="revenue-tooltip-value">{formatRevenue(activePoint.weekly)}</span>
              </div>
              <div className="revenue-tooltip-row">
                <span className="revenue-tooltip-label">
                  <span className="revenue-tooltip-dot expected" />
                  Expected Revenue
                </span>
                <span className="revenue-tooltip-value">{formatRevenue(activePoint.expected)}</span>
              </div>
            </div>
          ) : null}

          <div className="revenue-weekly-groups">
            {weeklyRevenueComparisonData.map((item, index) => {
              const weeklyWidth = `${(item.weekly / weeklyRevenueMax) * 100}%`
              const expectedWidth = `${(item.expected / weeklyRevenueMax) * 100}%`
              const isActive = index === activeIndex

              return (
                <button
                  key={item.week}
                  type="button"
                  className={`revenue-week-row ${isActive ? 'is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                  aria-label={`${item.week}. Weekly Revenue ${formatRevenue(item.weekly)}. Expected Revenue ${formatRevenue(item.expected)}.`}
                >
                  <span className="revenue-week-bars" aria-hidden="true">
                    <span className="revenue-week-bar monthly" style={{ width: weeklyWidth }} />
                    <span className="revenue-week-bar expected" style={{ width: expectedWidth }} />
                  </span>
                  <span className="revenue-week-values">
                    <strong>{formatRevenue(item.weekly)}</strong>
                    <span>{formatRevenue(item.expected)}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </article>
  )
}

function RevenueDashboards() {
  return (
    <div className="revenue-comparison-grid">
      <WeeklyRevenueChart />
      <MonthlyRevenueChart />
    </div>
  )
}

function AttendanceComparisonChart() {
  return (
    <article className="panel-card attendance-card">
      <div className="attendance-header">
        <div className="attendance-axis-title attendance-axis-left">Attendance (%)</div>
        <div className="attendance-legend" aria-hidden="true">
          <span className="revenue-legend-item">
            <span className="attendance-legend-swatch attendance" />
            Attendance (%)
          </span>
          <span className="revenue-legend-item">
            <span className="attendance-legend-swatch students" />
            Present Students
          </span>
        </div>
        <div className="attendance-axis-title attendance-axis-right">No. of Students</div>
      </div>

      <div className="attendance-chart" aria-label="Attendance comparison chart">
        <div className="attendance-left-axis">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>

        <div className="attendance-plot">
          <div className="attendance-grid-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="attendance-bars-row">
            {attendanceComparisonData.map((item) => (
              <div key={item.month} className="attendance-group">
                <div className="attendance-series">
                  <strong className="attendance-series-value">{item.attendance}%</strong>
                  <div className="attendance-bar attendance" style={{ height: `${item.attendance}%` }} />
                </div>
                <div className="attendance-series">
                  <strong className="attendance-series-value">{item.students}</strong>
                  <div className="attendance-bar students" style={{ height: `${(item.students / 500) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="attendance-months-row">
            {attendanceComparisonData.map((item) => (
              <span key={item.month}>{item.month}</span>
            ))}
          </div>
        </div>

        <div className="attendance-right-axis">
          <span>500</span>
          <span>375</span>
          <span>250</span>
          <span>125</span>
          <span>0</span>
        </div>
      </div>
    </article>
  )
}

function DashboardTopbar({ dashboard, title, subtitle, roleCode, email }) {
  return (
    <div className="business-topbar">
      <div>
        <p className="eyebrow">{title}</p>
        <h2>{dashboard.title}</h2>
        <p>{subtitle || dashboard.summary}</p>
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
          <div className="profile-avatar">{roleCode}</div>
          <div>
            <strong>{title}</strong>
            <span>{email}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function BusinessOwnerDashboard({ dashboard, revenueSummary, isRevenueLoading }) {
  return (
    <section className="business-owner-dashboard">
      <DashboardTopbar
        dashboard={dashboard}
        title="Business Owner"
        subtitle={dashboard.summary}
        roleCode="BH"
        email="business.owner@cispro.com"
      />
      <SummaryCardRow summary={revenueSummary} isLoading={isRevenueLoading} />
      <RevenueDashboards />
      <AttendanceComparisonChart />
    </section>
  )
}

function OperationManagerDashboard({ dashboard, revenueSummary, isRevenueLoading }) {
  return (
    <section className="business-owner-dashboard operation-manager-dashboard">
      <DashboardTopbar
        dashboard={dashboard}
        title="Operation Manager"
        subtitle="Revenue is calculated from students added in the backend."
        roleCode="OM"
        email="operation.manager@cispro.com"
      />
      <SummaryCardRow summary={revenueSummary} isLoading={isRevenueLoading} />
      <RevenueDashboards />
      <AttendanceComparisonChart />
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
  const [revenueSummary, setRevenueSummary] = useState(null)
  const [isRevenueLoading, setIsRevenueLoading] = useState(false)

  useEffect(() => {
    let active = true

    const loadRevenueSummary = async () => {
      if (role !== 'business-owner' && role !== 'operation-manager') {
        return
      }

      setIsRevenueLoading(true)

      try {
        const summary = await getRevenueSummary()
        if (active) {
          setRevenueSummary(summary)
        }
      } catch {
        if (active) {
          setRevenueSummary(null)
        }
      } finally {
        if (active) {
          setIsRevenueLoading(false)
        }
      }
    }

    void loadRevenueSummary()

    return () => {
      active = false
    }
  }, [role])

  if (role === 'business-owner') {
    return <BusinessOwnerDashboard dashboard={dashboard} revenueSummary={revenueSummary} isRevenueLoading={isRevenueLoading} />
  }

  if (role === 'operation-manager') {
    return <OperationManagerDashboard dashboard={dashboard} revenueSummary={revenueSummary} isRevenueLoading={isRevenueLoading} />
  }

  return <GenericDashboard role={role} />
}
