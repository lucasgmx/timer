export const COLLECTIONS = {
  users: "users",
  tasks: "tasks",
  timeEntries: "timeEntries",
  invoices: "invoices",
  invoiceCounters: "invoiceCounters",
  calendarDaySummaries: "calendarDaySummaries",
  auditLogs: "auditLogs",
  webauthnChallenges: "webauthnChallenges"
} as const;

export const SUBCOLLECTIONS = {
  passkeys: "passkeys"
} as const;

export function userCalendarSummaryId(userId: string, dateKey: string) {
  return `user_${userId}_${dateKey}`;
}

export function allCalendarSummaryId(dateKey: string) {
  return `all_${dateKey}`;
}
