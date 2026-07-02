export const STORAGE_KEY = 'cispro.session'

export const roleLabels = {
  'business-owner': 'Business Owner',
  'operation-manager': 'Operation Manager',
  hr: 'HR',
  faculty: 'Faculty',
  student: 'Student',
}

export const roleDashboards = {
  'business-owner': {
    title: 'Business Owner Dashboard',
    summary: 'Executive visibility, strategy, and approvals.',
    accent: 'Crimson',
    color: '#ef4444',
    cards: ['Revenue overview', 'Company approvals', 'Strategic KPIs'],
  },
  'operation-manager': {
    title: 'Operation Manager Dashboard',
    summary: 'Operations oversight, approvals, and team health.',
    accent: 'Amber',
    color: '#f59e0b',
    cards: ['Approvals', 'Team queue', 'Daily KPIs'],
  },
  hr: {
    title: 'HR Dashboard',
    summary: 'People operations, policy handling, and employee support.',
    accent: 'Cyan',
    color: '#06b6d4',
    cards: ['Employee records', 'Leave tracking', 'Policy updates'],
  },
  faculty: {
    title: 'Faculty Dashboard',
    summary: 'Class handling, course updates, and academic work.',
    accent: 'Emerald',
    color: '#10b981',
    cards: ['Classes', 'Assignments', 'Student progress'],
  },
  student: {
    title: 'Student Dashboard',
    summary: 'Course access, submissions, and learning status.',
    accent: 'Slate',
    color: '#64748b',
    cards: ['Courses', 'Submissions', 'Timetable'],
  },
}

export const dashboardPathByRole = {
  'business-owner': '/dashboard/business-owner',
  'operation-manager': '/dashboard/operation-manager',
  hr: '/dashboard/hr',
  faculty: '/dashboard/faculty',
  student: '/dashboard/student',
}
