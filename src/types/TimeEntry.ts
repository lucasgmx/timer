import type { InvoiceStatus } from "./Invoice";

export type TimeEntryStatus = "running" | "completed" | "invoiced" | "void";

export type TimeEntry = {
  id: string;
  userId: string;
  taskId: string;
  description?: string;
  startTime: Date;
  endTime?: Date | null;
  durationSeconds: number;
  hourlyRateCentsSnapshot: number;
  amountCentsSnapshot: number;
  status: TimeEntryStatus;
  invoiceId?: string | null;
  invoiceStatusSnapshot?: InvoiceStatus | null;
  dateKey: string;
  createdAt: Date;
  updatedAt: Date;
};
