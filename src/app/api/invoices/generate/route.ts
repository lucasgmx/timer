import { FieldValue } from "firebase-admin/firestore";
import { calculateInvoiceLineItems } from "@/lib/billing/calculateInvoice";
import { formatInvoiceNumber } from "@/lib/billing/invoiceNumbers";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, requireRole } from "@/lib/firebase/auth";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import {
  applyCalendarSummaryDeltas,
  writeAuditLog
} from "@/lib/firebase/serverWrites";
import { generateInvoiceSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

type BillableEntryDoc = {
  id: string;
  userId: string;
  taskId: string;
  description?: string;
  dateKey: string;
  durationSeconds: number;
  hourlyRateCentsSnapshot?: number;
  amountCentsSnapshot?: number;
  status?: string;
  invoiceId?: string | null;
};

export async function POST(request: Request) {
  try {
    const actor = await requireRole(request, ["admin"]);
    const body = generateInvoiceSchema.parse(await request.json());
    const db = adminDb();

    const result = await db.runTransaction(async (transaction) => {
      const entriesQuery = db
        .collection(COLLECTIONS.timeEntries)
        .where("status", "==", "completed")
        .where("dateKey", ">=", body.dateRange.start)
        .where("dateKey", "<=", body.dateRange.end);

      const entriesSnap = await transaction.get(entriesQuery);
      const requestedIds = body.timeEntryIds ? new Set(body.timeEntryIds) : null;
      const billableEntries = entriesSnap.docs
        .filter((doc) => !requestedIds || requestedIds.has(doc.id))
        .map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as BillableEntryDoc[];

      if (requestedIds && billableEntries.length !== requestedIds.size) {
        throw new Response("One or more selected entries are no longer billable.", {
          status: 409
        });
      }

      if (billableEntries.length === 0) {
        throw new Response("No completed uninvoiced time entries were found.", {
          status: 400
        });
      }

      const invalidEntry = billableEntries.find(
        (entry) => entry.status !== "completed" || entry.invoiceId || entry.durationSeconds <= 0
      );

      if (invalidEntry) {
        throw new Response("Selected entries must be completed and uninvoiced.", {
          status: 409
        });
      }

      const taskIds = Array.from(new Set(billableEntries.map((entry) => entry.taskId)));

      const taskSnaps = await Promise.all(
        taskIds.map((taskId) =>
          transaction.get(db.collection(COLLECTIONS.tasks).doc(String(taskId)))
        )
      );

      const now = new Date();
      const year = now.getUTCFullYear();
      const counterRef = db.collection(COLLECTIONS.invoiceCounters).doc(String(year));
      const counterSnap = await transaction.get(counterRef);
      const sequence = counterSnap.exists
        ? Number(counterSnap.data()?.nextSequence ?? 1)
        : 1;
      const invoiceNumber = formatInvoiceNumber(year, sequence);

      const tasks = new Map(
        taskSnaps
          .filter((snap) => snap.exists)
          .map((snap) => [
            snap.id,
            {
              id: snap.id,
              title: String(snap.data()?.title ?? "Untitled task"),
              hourlyRateCentsOverride:
                snap.data()?.hourlyRateCentsOverride === undefined
                  ? null
                  : Number(snap.data()?.hourlyRateCentsOverride)
            }
          ])
      );

      const invoiceSnapshot = calculateInvoiceLineItems(
        billableEntries.map((entry) => ({
          id: entry.id,
          userId: String(entry.userId),
          taskId: String(entry.taskId),
          description: entry.description ? String(entry.description) : undefined,
          dateKey: String(entry.dateKey),
          durationSeconds: Number(entry.durationSeconds),
          hourlyRateCentsSnapshot: Number(entry.hourlyRateCentsSnapshot ?? 0)
        })),
        tasks
      );

      const invoiceRef = db.collection(COLLECTIONS.invoices).doc();

      await applyCalendarSummaryDeltas(
        transaction,
        db,
        invoiceSnapshot.lineItems.map((lineItem) => ({
          dateKey: lineItem.dateKey,
          userId: lineItem.userId,
          delta: {
            uninvoicedAmountCents: -lineItem.amountCents,
            invoicedUnpaidAmountCents: lineItem.amountCents
          }
        }))
      );

      transaction.set(invoiceRef, {
        invoiceNumber,
        clientName: body.clientName,
        status: "unpaid",
        dateRange: body.dateRange,
        lineItems: invoiceSnapshot.lineItems,
        subtotalCents: invoiceSnapshot.subtotalCents,
        totalCents: invoiceSnapshot.totalCents,
        currency: "USD",
        createdAt: FieldValue.serverTimestamp(),
        sentAt: null,
        paidAt: null,
        dueDate: body.dueDate ?? null,
        createdByUserId: actor.uid
      });

      for (const lineItem of invoiceSnapshot.lineItems) {
        transaction.update(db.collection(COLLECTIONS.timeEntries).doc(lineItem.timeEntryId), {
          status: "invoiced",
          invoiceId: invoiceRef.id,
          invoiceStatusSnapshot: "unpaid",
          amountCentsSnapshot: lineItem.amountCents,
          hourlyRateCentsSnapshot: lineItem.hourlyRateCents,
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      transaction.set(
        counterRef,
        {
          year,
          nextSequence: sequence + 1,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      writeAuditLog(
        transaction,
        db,
        actor,
        "invoice.created",
        COLLECTIONS.invoices,
        invoiceRef.id,
        {
          invoiceNumber,
          lineItemCount: invoiceSnapshot.lineItems.length,
          totalCents: invoiceSnapshot.totalCents,
          dateRange: body.dateRange
        }
      );

      return {
        id: invoiceRef.id,
        invoiceNumber,
        totalCents: invoiceSnapshot.totalCents
      };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
