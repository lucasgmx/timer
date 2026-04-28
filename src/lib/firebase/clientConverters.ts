import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type { CalendarDaySummary, Invoice, Task, TimeEntry } from "@/types";

export function toDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }

  return new Date();
}

export function taskFromDoc(doc: DocumentSnapshot<DocumentData>): Task {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    title: String(data.title ?? "Untitled task"),
    description: data.description ?? null,
    hourlyRateCentsOverride:
      data.hourlyRateCentsOverride === null || data.hourlyRateCentsOverride === undefined
        ? null
        : Number(data.hourlyRateCentsOverride),
    status: data.status === "archived" ? "archived" : "active",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt)
  };
}

export function timeEntryFromDoc(doc: DocumentSnapshot<DocumentData>): TimeEntry {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    userId: String(data.userId ?? ""),
    taskId: String(data.taskId ?? ""),
    description: data.description ?? "",
    startTime: toDate(data.startTime),
    endTime: data.endTime ? toDate(data.endTime) : null,
    durationSeconds: Number(data.durationSeconds ?? 0),
    hourlyRateCentsSnapshot: Number(data.hourlyRateCentsSnapshot ?? 0),
    amountCentsSnapshot: Number(data.amountCentsSnapshot ?? 0),
    status: data.status ?? "completed",
    invoiceId: data.invoiceId ?? null,
    invoiceStatusSnapshot: data.invoiceStatusSnapshot ?? null,
    dateKey: String(data.dateKey ?? ""),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt)
  };
}

export function invoiceFromDoc(doc: DocumentSnapshot<DocumentData>): Invoice {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    invoiceNumber: String(data.invoiceNumber ?? doc.id),
    clientName: String(data.clientName ?? "Client"),
    status: data.status ?? "draft",
    dateRange: data.dateRange ?? { start: "", end: "" },
    lineItems: data.lineItems ?? [],
    subtotalCents: Number(data.subtotalCents ?? 0),
    totalCents: Number(data.totalCents ?? 0),
    currency: "USD",
    createdAt: toDate(data.createdAt),
    sentAt: data.sentAt ? toDate(data.sentAt) : null,
    paidAt: data.paidAt ? toDate(data.paidAt) : null,
    dueDate: data.dueDate ?? null
  };
}

export function summaryFromDoc(
  doc: DocumentSnapshot<DocumentData>
): CalendarDaySummary {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    scope: data.scope === "user" ? "user" : "all",
    userId: data.userId ?? null,
    dateKey: String(data.dateKey ?? ""),
    totalDurationSeconds: Number(data.totalDurationSeconds ?? 0),
    uninvoicedAmountCents: Number(data.uninvoicedAmountCents ?? 0),
    invoicedUnpaidAmountCents: Number(data.invoicedUnpaidAmountCents ?? 0),
    paidAmountCents: Number(data.paidAmountCents ?? 0),
    voidAmountCents: Number(data.voidAmountCents ?? 0),
    status: data.status ?? "empty",
    updatedAt: toDate(data.updatedAt)
  };
}
