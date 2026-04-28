import { FieldValue } from "firebase-admin/firestore";
import { calculateAmountCents, calculateTotalAmountCents, secondsToDecimalHours } from "@/lib/billing/formatDuration";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, requireRole } from "@/lib/firebase/auth";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import {
  applyCalendarSummaryDeltas,
  writeAuditLog
} from "@/lib/firebase/serverWrites";
import { updateInvoiceLineItemsSchema } from "@/lib/validation/schemas";
import type { InvoiceLineItem } from "@/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireRole(request, ["admin"]);
    const body = updateInvoiceLineItemsSchema.parse(await request.json());
    const db = adminDb();

    const result = await db.runTransaction(async (transaction) => {
      const invoiceRef = db.collection(COLLECTIONS.invoices).doc(body.invoiceId);
      const invoiceSnap = await transaction.get(invoiceRef);

      if (!invoiceSnap.exists) {
        throw new Response("Invoice not found.", { status: 404 });
      }

      const invoiceData = invoiceSnap.data()!;

      if (invoiceData.status !== "unpaid") {
        throw new Response("Only unpaid invoices can be edited.", { status: 409 });
      }

      const existingLineItems = (invoiceData.lineItems ?? []) as InvoiceLineItem[];

      // Index existing line items by timeEntryId for fast lookup
      const existingByEntryId = new Map(
        existingLineItems.map((item) => [item.timeEntryId, item])
      );

      // Validate that submitted line items match the invoice exactly
      const submittedIds = new Set(body.lineItems.map((li) => li.timeEntryId));
      const existingIds = new Set(existingLineItems.map((li) => li.timeEntryId));

      for (const id of submittedIds) {
        if (!existingIds.has(id)) {
          throw new Response(`Time entry ${id} is not part of this invoice.`, { status: 400 });
        }
      }

      for (const id of existingIds) {
        if (!submittedIds.has(id)) {
          throw new Response("All invoice line items must be included in the update.", {
            status: 400
          });
        }
      }

      // Build updated line items, recalculating amounts server-side
      const updatedLineItems: InvoiceLineItem[] = body.lineItems.map((edit) => {
        const existing = existingByEntryId.get(edit.timeEntryId)!;
        const amountCents = calculateAmountCents(edit.durationSeconds, existing.hourlyRateCents);
        return {
          ...existing,
          taskTitle: edit.taskTitle,
          durationSeconds: edit.durationSeconds,
          hoursDecimal: secondsToDecimalHours(edit.durationSeconds),
          amountCents
        };
      });

      const subtotalCents = calculateTotalAmountCents(updatedLineItems);
      const totalCents = subtotalCents;

      // Calendar summary deltas for changed amounts and durations
      const summaryDeltas = updatedLineItems.map((updated) => {
        const old = existingByEntryId.get(updated.timeEntryId)!;
        return {
          dateKey: updated.dateKey,
          userId: updated.userId,
          delta: {
            totalDurationSeconds: updated.durationSeconds - old.durationSeconds,
            invoicedUnpaidAmountCents: updated.amountCents - old.amountCents
          }
        };
      });

      await applyCalendarSummaryDeltas(transaction, db, summaryDeltas);

      // Update invoice document
      transaction.update(invoiceRef, {
        lineItems: updatedLineItems,
        subtotalCents,
        totalCents,
        updatedAt: FieldValue.serverTimestamp()
      });

      // Update each time entry's duration and amount snapshot
      for (const updated of updatedLineItems) {
        const old = existingByEntryId.get(updated.timeEntryId)!;
        if (
          updated.durationSeconds !== old.durationSeconds ||
          updated.amountCents !== old.amountCents
        ) {
          transaction.update(
            db.collection(COLLECTIONS.timeEntries).doc(updated.timeEntryId),
            {
              durationSeconds: updated.durationSeconds,
              amountCentsSnapshot: updated.amountCents,
              updatedAt: FieldValue.serverTimestamp()
            }
          );
        }
      }

      writeAuditLog(
        transaction,
        db,
        actor,
        "invoice.lineItemsEdited",
        COLLECTIONS.invoices,
        body.invoiceId,
        {
          lineItemCount: updatedLineItems.length,
          totalCents
        }
      );

      return { totalCents };
    });

    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
