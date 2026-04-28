export type CalendarDayVisualStatus =
  | "empty"
  | "uninvoiced"
  | "invoiced"
  | "paid"
  | "mixed";

export type CalendarDaySummary = {
  id: string;
  scope: "all" | "user";
  userId?: string | null;
  dateKey: string;
  totalDurationSeconds: number;
  uninvoicedAmountCents: number;
  invoicedUnpaidAmountCents: number;
  paidAmountCents: number;
  voidAmountCents: number;
  status: CalendarDayVisualStatus;
  updatedAt: Date;
};
