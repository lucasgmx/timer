import type { InvoiceLineItem } from "@/types/Invoice";
import { calculateAmountCents, calculateTotalAmountCents, secondsToDecimalHours } from "./formatDuration";

export type BillableTimeEntrySnapshot = {
  id: string;
  userId: string;
  taskId: string;
  dateKey: string;
  durationSeconds: number;
  hourlyRateCentsSnapshot?: number;
};

export type BillableTaskSnapshot = {
  id: string;
  title: string;
  hourlyRateCentsOverride?: number | null;
};

export function calculateInvoiceLineItems(
  entries: BillableTimeEntrySnapshot[],
  tasks: Map<string, BillableTaskSnapshot>
) {
  const lineItems: InvoiceLineItem[] = entries.map((entry) => {
    const task = tasks.get(entry.taskId);

    if (!task) {
      throw new Error(`Task ${entry.taskId} does not exist.`);
    }

    const hourlyRateCents =
      entry.hourlyRateCentsSnapshot ??
      task.hourlyRateCentsOverride ??
      0;
    const amountCents = calculateAmountCents(entry.durationSeconds, hourlyRateCents);

    return {
      timeEntryId: entry.id,
      taskId: entry.taskId,
      taskTitle: task.title,
      userId: entry.userId,
      dateKey: entry.dateKey,
      durationSeconds: entry.durationSeconds,
      hoursDecimal: secondsToDecimalHours(entry.durationSeconds),
      hourlyRateCents,
      amountCents
    };
  });

  const subtotalCents = calculateTotalAmountCents(lineItems);

  return {
    lineItems,
    subtotalCents,
    totalCents: subtotalCents
  };
}
