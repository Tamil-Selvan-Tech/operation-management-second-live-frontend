import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, CreditCard, ReceiptText, Sparkles, WalletCards } from 'lucide-react'

const roleNotificationSections = {
  'operation-manager': [
    {
      label: 'Today',
      items: [
        {
          tone: 'red',
          icon: ReceiptText,
          title: 'Student fee payment updated',
          message: "Varsha's full payment has been saved and marked as completed.",
          time: '5 mins ago',
          categoryLabel: 'Payment',
          unread: true,
        },
        {
          tone: 'yellow',
          icon: CreditCard,
          title: 'Installment payment received',
          message: 'A pending installment for the Next.js course has been collected successfully.',
          time: '15 mins ago',
          categoryLabel: 'Payment',
          unread: true,
        },
        {
          tone: 'amber',
          icon: AlertTriangle,
          title: 'Attendance exception logged',
          message: 'One batch crossed the late check-in threshold and needs a quick follow-up.',
          time: '2 hrs ago',
          categoryLabel: 'Attendance',
          unread: false,
        },
      ],
    },
    {
      label: 'Yesterday',
      items: [
        {
          tone: 'blue',
          icon: Sparkles,
          title: 'New team member onboarded',
          message: 'Nandini has joined the operations team and role access is active.',
          time: 'Yesterday, 10:30 AM',
          categoryLabel: 'HR',
          unread: false,
        },
        {
          tone: 'green',
          icon: CalendarDays,
          title: 'Course batch rescheduled',
          message: 'The Next.js evening batch moved to 7:30 PM after the trainer update.',
          time: 'Yesterday, 09:15 AM',
          categoryLabel: 'Course',
          unread: false,
        },
      ],
    },
    {
      label: 'This Week',
      items: [
        {
          tone: 'blue',
          icon: Sparkles,
          title: 'Monthly revenue report generated',
          message: 'Your monthly revenue report for May 2025 is now available.',
          time: 'May 16, 2025',
          categoryLabel: 'Report',
          unread: false,
        },
      ],
    },
  ],
  'business-owner': [
    {
      label: 'Today',
      items: [
        {
          tone: 'green',
          icon: WalletCards,
          title: 'Revenue milestone reached',
          message: "Today's collections crossed the target and the revenue tracker updated automatically.",
          time: '1 hr ago',
          categoryLabel: 'Payment',
          unread: true,
        },
        {
          tone: 'amber',
          icon: AlertTriangle,
          title: 'Approval awaiting review',
          message: 'Two operational approvals are waiting in your queue before end of day.',
          time: '2 hrs ago',
          categoryLabel: 'Approval',
          unread: true,
        },
        {
          tone: 'blue',
          icon: CalendarDays,
          title: 'Cashflow reminder synced',
          message: "Tomorrow's payment reminders were scheduled for all pending batches.",
          time: '4 hrs ago',
          categoryLabel: 'Reminder',
          unread: false,
        },
      ],
    },
    {
      label: 'Yesterday',
      items: [
        {
          tone: 'blue',
          icon: CheckCircle2,
          title: 'Branch summary ready',
          message: 'The weekly summary for each branch has been attached to your dashboard.',
          time: 'Yesterday',
          categoryLabel: 'Summary',
          unread: false,
        },
        {
          tone: 'red',
          icon: ReceiptText,
          title: 'Fee collection alert resolved',
          message: 'The flagged installment has been matched to the correct student record.',
          time: 'Yesterday',
          categoryLabel: 'Payment',
          unread: false,
        },
      ],
    },
    {
      label: '30 Jun',
      items: [
        {
          tone: 'yellow',
          icon: CreditCard,
          title: 'Monthly report exported',
          message: 'The June finance report is now ready for download and review.',
          time: '30 Jun',
          categoryLabel: 'Report',
          unread: false,
        },
      ],
    },
  ],
}

const fallbackRole = 'operation-manager'

export function getNotificationSections(role) {
  return roleNotificationSections[role] || roleNotificationSections[fallbackRole]
}

export function getNotificationItems(role) {
  return getNotificationSections(role).flatMap((section) => section.items)
}

export function getUnreadNotificationCount(role) {
  return getNotificationItems(role).filter((item) => item.unread).length
}
