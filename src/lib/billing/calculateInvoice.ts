import type { InvoiceLineItem } from "@/types/Invoice";
import { calculateAmountCents, secondsToDecimalHours } from "./formatDuration";

export type BillableTimeEntrySnapshot = {
  id: string;
  userId: string;
  taskId: string;
  projectId: string;
  description?: string;
  dateKey: string;
  durationSeconds: number;
  hourlyRateCentsSnapshot?: number;
};

export type BillableTaskSnapshot = {
  id: string;
  title: string;
  hourlyRateCentsOverride?: number | null;
};

export type BillableProjectSnapshot = {
  id: string;
  name: string;
  defaultHourlyRateCents: number;
};

export function calculateInvoiceLineItems(
  entries: BillableTimeEntrySnapshot[],
  tasks: Map<string, BillableTaskSnapshot>,
  projects: Map<string, BillableProjectSnapshot>
) {
  const lineItems: InvoiceLineItem[] = entries.map((entry) => {
    const task = tasks.get(entry.taskId);
    const project = projects.get(entry.projectId);

    if (!task) {
      throw new Error(`Task ${entry.taskId} does not exist.`);
    }

    if (!project) {
      throw new Error(`Project ${entry.projectId} does not exist.`);
    }

    const hourlyRateCents =
      entry.hourlyRateCentsSnapshot ??
      task.hourlyRateCentsOverride ??
      project.defaultHourlyRateCents;
    const amountCents = calculateAmountCents(entry.durationSeconds, hourlyRateCents);

    return {
      timeEntryId: entry.id,
      taskId: entry.taskId,
      taskTitle: task.title,
      projectId: entry.projectId,
      projectName: project.name,
      userId: entry.userId,
      ...(entry.description !== undefined && { description: entry.description }),
      dateKey: entry.dateKey,
      durationSeconds: entry.durationSeconds,
      hoursDecimal: secondsToDecimalHours(entry.durationSeconds),
      hourlyRateCents,
      amountCents
    };
  });

  const subtotalCents = lineItems.reduce((total, item) => total + item.amountCents, 0);

  return {
    lineItems,
    subtotalCents,
    totalCents: subtotalCents
  };
}
