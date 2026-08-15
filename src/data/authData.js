export const STORAGE_KEY = 'cispro.session'

export const roleLabels = {
  'business-owner': 'Business Owner',
  'operation-manager': 'Operation Manager',
  'super-admin': 'Super Admin',
  'branch-admin': 'Branch Admin',
  hr: 'HR',
  faculty: 'Faculty',
  student: 'Student',
}

export const roleDashboards = {
  'business-owner': {
    title: 'Business Owner Dashboard',
    summary: '',
    accent: 'Crimson',
    color: '#ef4444',
    cards: ['Revenue overview', 'Company approvals', 'Strategic KPIs'],
  },
  'operation-manager': {
    title: 'Operation Manager Dashboard',
    summary: "Welcome back! Here's what's happening with your business today.",
    accent: 'Amber',
    color: '#f59e0b',
    cards: ['Approvals', 'Team queue', 'Daily KPIs'],
  },
  'super-admin': {
    title: 'Super Admin Dashboard',
    summary: 'System control center for users, roles, and platform visibility.',
    accent: 'Indigo',
    color: '#4f46e5',
    cards: ['User control', 'Role matrix', 'System health'],
  },
  'branch-admin': {
    title: 'Branch Dashboard',
    summary: 'Branch operations, learners, and payment follow-up in one place.',
    accent: 'Teal',
    color: '#0f766e',
    cards: ['Students', 'Courses', 'Payments'],
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
  'super-admin': '/dashboard/super-admin',
  'branch-admin': '/branch-dashboard',
  hr: '/dashboard/hr',
  faculty: '/dashboard/faculty',
  student: '/dashboard/student',
}

export const courseAccessRoles = ['business-owner', 'operation-manager', 'branch-admin']
