const deepClone = (value) => JSON.parse(JSON.stringify(value))

const studentPortalProfiles = [
  {
    studentId: 'STU-024',
    studentName: 'Aarav Mehta',
    email: 'aarav.mehta@cispro.edu',
    loginPassword: 'Aarav@123',
    temporaryPassword: 'Aarav@123',
    branchId: 'BR-01',
    branchName: 'Main Branch',
    branchCode: 'BR01',
    courseName: 'Full Stack Web Development',
    courseCode: 'FSWD-2026',
    courseMode: 'Offline',
    facultyName: 'Dr. Neha Joshi',
    facultyId: 'FAC-014',
    batchName: 'Weekend Batch A',
    batchTiming: 'Sat-Sun | 10:00 AM - 1:00 PM',
    overview: {
      studentName: 'Aarav Mehta',
      studentId: 'STU-024',
      courseName: 'Full Stack Web Development',
      facultyName: 'Dr. Neha Joshi',
      batchName: 'Weekend Batch A',
      courseProgress: 68,
      paymentProgress: 62,
      totalCourseFee: 90000,
      totalPaidAmount: 53000,
      pendingAmount: 32000,
      nextInstallmentDue: '2026-09-18',
    },
    basicDetails: {
      studentId: 'STU-024',
      studentName: 'Aarav Mehta',
      dateOfBirth: '2004-08-12',
      gender: 'Male',
      email: 'aarav.mehta@cispro.edu',
      mobileNumber: '9876543210',
      alternateMobileNumber: '9876500044',
      address: '12 Lake View Road',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380015',
    },
    educationDetails: {
      qualification: '12th / HSC',
      degreeCourse: 'B.Com',
      institutionName: 'Alpha College of Commerce',
      universityBoard: 'Gujarat Board',
      yearOfPassing: '2022',
      percentageCgpa: '82%',
    },
    courseDetails: {
      courseName: 'Full Stack Web Development',
      courseCode: 'FSWD-2026',
      courseMode: 'Offline',
      duration: '6 Months',
      totalHours: 240,
      facultyName: 'Dr. Neha Joshi',
      batchName: 'Weekend Batch A',
      batchTiming: 'Sat-Sun | 10:00 AM - 1:00 PM',
      courseStartDate: '2026-07-01',
      expectedEndDate: '2026-12-31',
      courseProgress: 68,
    },
    modules: [
      {
        id: 'module-1',
        name: 'Programming Foundations',
        submodules: [
          { id: 'module-1-1', name: 'HTML Basics', status: 'Completed' },
          { id: 'module-1-2', name: 'CSS Fundamentals', status: 'Completed' },
          { id: 'module-1-3', name: 'JavaScript Intro', status: 'Completed' },
          { id: 'module-1-4', name: 'Version Control', status: 'Completed' },
        ],
      },
      {
        id: 'module-2',
        name: 'Frontend Development',
        submodules: [
          { id: 'module-2-1', name: 'React Components', status: 'Completed' },
          { id: 'module-2-2', name: 'Hooks and State', status: 'Completed' },
          { id: 'module-2-3', name: 'Routing', status: 'In Progress' },
          { id: 'module-2-4', name: 'State Management', status: 'Not Started' },
        ],
      },
      {
        id: 'module-3',
        name: 'Backend Development',
        submodules: [
          { id: 'module-3-1', name: 'REST APIs', status: 'Completed' },
          { id: 'module-3-2', name: 'Authentication', status: 'In Progress' },
          { id: 'module-3-3', name: 'Database Models', status: 'Not Started' },
        ],
      },
      {
        id: 'module-4',
        name: 'Deployment & Projects',
        submodules: [
          { id: 'module-4-1', name: 'Project Planning', status: 'Completed' },
          { id: 'module-4-2', name: 'Final Project', status: 'In Progress' },
          { id: 'module-4-3', name: 'Deployment Checklist', status: 'Not Started' },
        ],
      },
    ],
    payments: {
      totalCourseFee: 90000,
      registrationFee: 5000,
      discount: 10000,
      finalPayableAmount: 85000,
      totalPaid: 53000,
      remainingAmount: 32000,
      paymentProgress: 62,
      nextInstallmentDue: '2026-09-18',
      installmentSchedule: [
        {
          installmentName: 'Registration',
          amount: 5000,
          dueDate: '2026-07-01',
          paidAmount: 5000,
          status: 'Paid',
          paymentDate: '2026-07-01',
        },
        {
          installmentName: '1st Installment',
          amount: 24000,
          dueDate: '2026-08-18',
          paidAmount: 24000,
          status: 'Paid',
          paymentDate: '2026-08-18',
        },
        {
          installmentName: '2nd Installment',
          amount: 24000,
          dueDate: '2026-09-18',
          paidAmount: 24000,
          status: 'Upcoming',
          paymentDate: '',
        },
        {
          installmentName: '3rd Installment',
          amount: 32000,
          dueDate: '2026-10-20',
          paidAmount: 0,
          status: 'Pending',
          paymentDate: '',
        },
      ],
      paymentHistory: [
        {
          paymentDate: '2026-07-01',
          installment: 'Registration',
          transactionId: 'RCPT-761240',
          amount: 5000,
          paymentMode: 'UPI',
          status: 'Paid',
        },
        {
          paymentDate: '2026-08-18',
          installment: '1st Installment',
          transactionId: 'RCPT-761901',
          amount: 24000,
          paymentMode: 'Net Banking',
          status: 'Paid',
        },
      ],
    },
    faculty: {
      facultyName: 'Dr. Neha Joshi',
      facultyId: 'FAC-014',
      email: 'neha.joshi@cispro.edu',
      assignedCourse: 'Full Stack Web Development',
      batchName: 'Weekend Batch A',
    },
    batch: {
      batchName: 'Weekend Batch A',
      course: 'Full Stack Web Development',
      faculty: 'Dr. Neha Joshi',
      batchDays: 'Saturday, Sunday',
      startTime: '10:00 AM',
      endTime: '1:00 PM',
      courseMode: 'Offline',
      branch: 'Main Branch',
    },
    notifications: [
      {
        title: 'Second installment is due soon',
        message: 'Your next installment is scheduled for 18 Sep 2026.',
        date: '2026-09-07',
        tone: 'warning',
      },
      {
        title: 'Module 2 updated',
        message: 'React routing practice has been assigned in the frontend module.',
        date: '2026-09-05',
        tone: 'info',
      },
    ],
    settings: {
      emailNotifications: true,
      smsAlerts: true,
      darkMode: false,
      language: 'English',
    },
  },
]

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function toFiniteNumber(value, fallback = 0) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : fallback
}

function getStatusLabel(value) {
  const normalized = normalizeText(value)
  if (normalized === 'completed' || normalized === 'paid') return 'Completed'
  if (normalized === 'in progress' || normalized === 'upcoming') return 'In Progress'
  if (normalized === 'not started' || normalized === 'pending') return 'Not Started'
  return value || 'Not Started'
}

function buildModuleProgress(modules = []) {
  return modules.map((module) => {
    const submodules = Array.isArray(module?.submodules) ? module.submodules : []
    const completedSubmodules = submodules.filter((submodule) => normalizeText(submodule?.status) === 'completed').length
    const totalSubmodules = submodules.length
    const inProgressSubmodules = submodules.filter((submodule) => normalizeText(submodule?.status) === 'in progress').length
    const moduleProgress = totalSubmodules > 0 ? Math.round((completedSubmodules / totalSubmodules) * 100) : 0

    return {
      ...module,
      completedSubmodules,
      totalSubmodules,
      moduleProgress,
      status:
        moduleProgress === 100
          ? 'Completed'
          : completedSubmodules > 0 || inProgressSubmodules > 0
            ? 'In Progress'
            : 'Not Started',
      submodules: submodules.map((submodule) => ({
        ...submodule,
        status: getStatusLabel(submodule?.status),
      })),
    }
  })
}

function normalizeSchedule(schedule = []) {
  return schedule.map((item) => ({
    ...item,
    amount: toFiniteNumber(item?.amount),
    paidAmount: toFiniteNumber(item?.paidAmount),
    status: getStatusLabel(item?.status),
  }))
}

function normalizeHistory(history = []) {
  return history.map((item) => ({
    ...item,
    amount: toFiniteNumber(item?.amount),
    status: getStatusLabel(item?.status),
  }))
}

function normalizeProfile(profile = {}) {
  const overview = profile.overview || {}
  const payments = profile.payments || {}
  const basicDetails = profile.basicDetails || {}
  const courseDetails = profile.courseDetails || {}
  const faculty = profile.faculty || {}
  const batch = profile.batch || {}
  const modules = Array.isArray(profile.modules) ? buildModuleProgress(profile.modules) : []
  const installmentSchedule = normalizeSchedule(payments.installmentSchedule || [])
  const paymentHistory = normalizeHistory(payments.paymentHistory || [])
  const totalPaid = toFiniteNumber(payments.totalPaid, toFiniteNumber(overview.totalPaidAmount, 0))
  const finalPayableAmount = toFiniteNumber(
    payments.finalPayableAmount,
    toFiniteNumber(overview.totalCourseFee, 0) - toFiniteNumber(payments.discount, 0),
  )

  return {
    ...deepClone(profile),
    overview: {
      studentName: overview.studentName || profile.studentName || '',
      studentId: overview.studentId || profile.studentId || '',
      courseName: overview.courseName || courseDetails.courseName || '',
      facultyName: overview.facultyName || faculty.facultyName || '',
      batchName: overview.batchName || batch.batchName || '',
      courseProgress: toFiniteNumber(overview.courseProgress, courseDetails.courseProgress || 0),
      paymentProgress: toFiniteNumber(overview.paymentProgress, payments.paymentProgress || 0),
      totalCourseFee: toFiniteNumber(overview.totalCourseFee, payments.totalCourseFee || 0),
      totalPaidAmount: toFiniteNumber(overview.totalPaidAmount, totalPaid),
      pendingAmount: toFiniteNumber(overview.pendingAmount, Math.max(finalPayableAmount - totalPaid, 0)),
      nextInstallmentDue: overview.nextInstallmentDue || payments.nextInstallmentDue || '',
    },
    basicDetails,
    educationDetails: profile.educationDetails || {},
    courseDetails: {
      ...courseDetails,
      courseProgress: toFiniteNumber(courseDetails.courseProgress, overview.courseProgress || 0),
    },
    modules,
    payments: {
      ...payments,
      totalCourseFee: toFiniteNumber(payments.totalCourseFee, overview.totalCourseFee || 0),
      registrationFee: toFiniteNumber(payments.registrationFee),
      discount: toFiniteNumber(payments.discount),
      finalPayableAmount,
      totalPaid,
      remainingAmount: toFiniteNumber(payments.remainingAmount, Math.max(finalPayableAmount - totalPaid, 0)),
      paymentProgress: toFiniteNumber(payments.paymentProgress, overview.paymentProgress || 0),
      nextInstallmentDue: payments.nextInstallmentDue || overview.nextInstallmentDue || '',
      installmentSchedule,
      paymentHistory,
    },
    faculty,
    batch,
    notifications: Array.isArray(profile.notifications) ? deepClone(profile.notifications) : [],
    settings: profile.settings || {},
  }
}

function matchesIdentifier(profile, identifier) {
  const normalizedIdentifier = normalizeText(identifier)
  if (!normalizedIdentifier) return false

  return [
    profile.studentId,
    profile.email,
    profile.basicDetails?.email,
    profile.basicDetails?.studentId,
  ]
    .map(normalizeText)
    .includes(normalizedIdentifier)
}

function buildProfileFromRecord(record = {}, fallbackProfile = null) {
  const base = normalizeProfile(fallbackProfile || studentPortalProfiles[0])
  const totalCourseFee =
    record.afterDiscount || record.totalAmount || record.actualFees || base.overview.totalCourseFee
  const totalPaid = record.totalPaidAmount || record.paidAmount || base.payments.totalPaid
  const pendingAmount = Math.max(Number(totalCourseFee) - Number(totalPaid), 0)
  const courseName = record.courseName || record.courseInterested || base.courseDetails.courseName
  const facultyName = record.facultyName || base.faculty.facultyName
  const batchName = record.batchName || record.batch || base.batch.batchName
  const batchTiming = record.batchTiming || base.courseDetails.batchTiming
  const email = record.emailAddress || record.email || base.basicDetails.email
  const studentId = record.studentId || base.studentId

  return normalizeProfile({
    ...base,
    studentId,
    studentName: record.studentName || base.studentName,
    email,
    loginPassword: record.loginPassword || record.temporaryPassword || base.loginPassword,
    temporaryPassword: record.loginPassword || record.temporaryPassword || base.temporaryPassword,
    branchId: record.branchId || base.branchId,
    branchName: record.branchName || base.branchName,
    branchCode: record.branchCode || base.branchCode,
    courseName,
    courseCode: record.courseCode || base.courseCode,
    courseMode: record.courseMode || base.courseMode,
    facultyName,
    facultyId: record.facultyId || base.facultyId,
    batchName,
    batchTiming,
    overview: {
      ...base.overview,
      studentName: record.studentName || base.overview.studentName,
      studentId,
      courseName,
      facultyName,
      batchName,
      courseProgress: toFiniteNumber(record.courseProgress, base.overview.courseProgress),
      paymentProgress: toFiniteNumber(record.paymentProgress, base.overview.paymentProgress),
      totalCourseFee: toFiniteNumber(totalCourseFee, base.overview.totalCourseFee),
      totalPaidAmount: toFiniteNumber(totalPaid, base.overview.totalPaidAmount),
      pendingAmount,
      nextInstallmentDue: record.nextInstallmentDue || base.overview.nextInstallmentDue,
    },
    basicDetails: {
      ...base.basicDetails,
      studentId,
      studentName: record.studentName || base.basicDetails.studentName,
      email,
      mobileNumber: record.mobileNumber || base.basicDetails.mobileNumber,
      alternateMobileNumber: record.alternateMobileNumber || record.parentSpouseNumber || base.basicDetails.alternateMobileNumber,
      address: record.address || record.location || base.basicDetails.address,
      city: record.city || base.basicDetails.city,
      state: record.state || base.basicDetails.state,
      pincode: record.pincode || base.basicDetails.pincode,
    },
    educationDetails: {
      ...base.educationDetails,
      qualification: record.qualification || base.educationDetails.qualification,
      degreeCourse: record.degreeCourse || record.designation || base.educationDetails.degreeCourse,
      institutionName: record.institutionName || base.educationDetails.institutionName,
      universityBoard: record.universityBoard || base.educationDetails.universityBoard,
      yearOfPassing: record.yearOfPassing || record.passedOutYear || base.educationDetails.yearOfPassing,
      percentageCgpa: record.percentageCgpa || record.percentage || base.educationDetails.percentageCgpa,
    },
    courseDetails: {
      ...base.courseDetails,
      courseName,
      courseCode: record.courseCode || base.courseDetails.courseCode,
      courseMode: record.courseMode || base.courseDetails.courseMode,
      duration: record.duration || base.courseDetails.duration,
      totalHours: toFiniteNumber(record.totalHours, base.courseDetails.totalHours),
      facultyName,
      batchName,
      batchTiming,
      courseStartDate: record.courseStartDate || record.admissionDate || base.courseDetails.courseStartDate,
      expectedEndDate: record.expectedEndDate || base.courseDetails.expectedEndDate,
      courseProgress: toFiniteNumber(record.courseProgress, base.courseDetails.courseProgress),
    },
    payments: {
      ...base.payments,
      totalCourseFee: toFiniteNumber(totalCourseFee, base.payments.totalCourseFee),
      registrationFee: toFiniteNumber(record.registrationFee || record.registrationFees, base.payments.registrationFee),
      discount: toFiniteNumber(record.discount, base.payments.discount),
      finalPayableAmount: toFiniteNumber(record.finalPayableAmount || record.afterDiscount, Number(totalCourseFee) - Number(record.discount || base.payments.discount)),
      totalPaid: toFiniteNumber(totalPaid, base.payments.totalPaid),
      remainingAmount: pendingAmount,
      paymentProgress: toFiniteNumber(record.paymentProgress, base.payments.paymentProgress),
      nextInstallmentDue: record.nextInstallmentDue || base.payments.nextInstallmentDue,
      installmentSchedule: Array.isArray(record.installmentSchedule) ? normalizeSchedule(record.installmentSchedule) : base.payments.installmentSchedule,
      paymentHistory: Array.isArray(record.paymentHistory) ? normalizeHistory(record.paymentHistory) : base.payments.paymentHistory,
    },
    faculty: {
      ...base.faculty,
      facultyName,
      facultyId: record.facultyId || base.faculty.facultyId,
      email: record.facultyEmail || base.faculty.email,
      assignedCourse: courseName,
      batchName,
    },
    batch: {
      ...base.batch,
      batchName,
      course: courseName,
      faculty: facultyName,
      batchDays: record.batchDays || base.batch.batchDays,
      startTime: record.startTime || base.batch.startTime,
      endTime: record.endTime || base.batch.endTime,
      courseMode: record.courseMode || base.batch.courseMode,
      branch: record.branchName || base.batch.branch,
    },
    notifications: Array.isArray(record.notifications) ? record.notifications : base.notifications,
    settings: {
      ...base.settings,
      ...record.settings,
    },
  })
}

export function listStudentPortalProfiles() {
  return studentPortalProfiles.map((profile) => normalizeProfile(profile))
}

export function findStudentPortalProfile(identifier) {
  const profile = studentPortalProfiles.find((entry) => matchesIdentifier(entry, identifier))
  return profile ? normalizeProfile(profile) : null
}

export function validateStudentPortalCredentials(identifier, password) {
  const normalizedPassword = String(password || '').trim()
  const profile = findStudentPortalProfile(identifier)

  if (!profile) {
    return { success: false, error: 'We could not find a student account for that ID or email.' }
  }

  const validPasswords = [profile.loginPassword, profile.temporaryPassword]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  if (!validPasswords.includes(normalizedPassword)) {
    return { success: false, error: 'Invalid student ID, email, or temporary password.' }
  }

  return { success: true, profile }
}

export function resolveStudentPortalProfile(identifierOrRecord, fallbackProfile = null) {
  if (!identifierOrRecord) {
    return normalizeProfile(fallbackProfile || studentPortalProfiles[0])
  }

  if (typeof identifierOrRecord === 'object' && !Array.isArray(identifierOrRecord)) {
    return buildProfileFromRecord(identifierOrRecord, fallbackProfile)
  }

  return findStudentPortalProfile(identifierOrRecord) || normalizeProfile(fallbackProfile || studentPortalProfiles[0])
}

export function buildStudentPortalProfileFromRecord(record, fallbackProfile = null) {
  return buildProfileFromRecord(record, fallbackProfile)
}

export function createStudentPortalSession(profile) {
  const studentProfile = resolveStudentPortalProfile(profile)

  return {
    token: `student-mock-token-${Date.now()}`,
    user: {
      id: studentProfile.studentId,
      name: studentProfile.studentName,
      email: studentProfile.basicDetails?.email || studentProfile.email || '',
      role: 'student',
      studentId: studentProfile.studentId,
      facultyName: studentProfile.faculty?.facultyName || studentProfile.overview?.facultyName || '',
      batchName: studentProfile.batch?.batchName || studentProfile.overview?.batchName || '',
      courseName: studentProfile.courseDetails?.courseName || studentProfile.overview?.courseName || '',
      mustResetPassword: false,
    },
  }
}

export function getStudentPortalLoginHint() {
  const profile = normalizeProfile(studentPortalProfiles[0])

  return {
    studentId: profile.studentId,
    email: profile.basicDetails.email,
    password: profile.loginPassword,
    studentName: profile.studentName,
    facultyName: profile.faculty.facultyName,
    batchName: profile.batch.batchName,
  }
}
