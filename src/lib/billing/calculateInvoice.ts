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

export function distributeInvoiceTotalCents(
  lineItems: InvoiceLineItem[],
  totalCents: number
): InvoiceLineItem[] {
  if (lineItems.length === 0) {
    return [];
  }

  const safeTotalCents = Math.max(0, Math.round(totalCents));
  const amountWeightTotal = lineItems.reduce(
    (sum, item) => sum + Math.max(0, item.amountCents),
    0
  );
  const durationWeightTotal = lineItems.reduce(
    (sum, item) => sum + Math.max(0, item.durationSeconds),
    0
  );
  const weights =
    amountWeightTotal > 0
      ? lineItems.map((item) => Math.max(0, item.amountCents))
      : durationWeightTotal > 0
        ? lineItems.map((item) => Math.max(0, item.durationSeconds))
        : lineItems.map(() => 1);
  const weightTotal =
    amountWeightTotal > 0
      ? amountWeightTotal
      : durationWeightTotal > 0
        ? durationWeightTotal
        : lineItems.length;

  const allocations = weights.map((weight) => {
    const raw = (safeTotalCents * weight) / weightTotal;
    return {
      cents: Math.floor(raw),
      remainder: raw - Math.floor(raw)
    };
  });

  let remainingCents =
    safeTotalCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);

  allocations
    .map((allocation, index) => ({ ...allocation, index }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .forEach(({ index }) => {
      if (remainingCents <= 0) return;
      allocations[index].cents += 1;
      remainingCents -= 1;
    });

  return lineItems.map((item, index) => ({
    ...item,
    amountCents: allocations[index].cents
  }));
}
