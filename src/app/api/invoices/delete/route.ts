import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, requireRole } from "@/lib/firebase/auth";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import {
  applyCalendarSummaryDeltas,
  writeAuditLog
} from "@/lib/firebase/serverWrites";
import { invoiceStatusSchema } from "@/lib/validation/schemas";
import type { InvoiceLineItem } from "@/types/Invoice";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireRole(request, ["admin"]);
    const body = invoiceStatusSchema.parse(await request.json());
    const db = adminDb();

    const result = await db.runTransaction(async (transaction) => {
      const invoiceRef = db.collection(COLLECTIONS.invoices).doc(body.invoiceId);
      const invoiceSnap = await transaction.get(invoiceRef);

      if (!invoiceSnap.exists) {
        throw new Response("Invoice was not found.", { status: 404 });
      }

      const invoice = invoiceSnap.data();
      const invoiceStatus = String(invoice?.status ?? "");

      if (invoiceStatus === "paid") {
        throw new Response("Paid invoices cannot be deleted. Mark the invoice as unpaid first.", {
          status: 409
        });
      }

      const entriesSnap = await transaction.get(
        db.collection(COLLECTIONS.timeEntries).where("invoiceId", "==", body.invoiceId)
      );
      const lineItems = (invoice?.lineItems ?? []) as InvoiceLineItem[];

      if (invoiceStatus !== "void") {
        const oldBucket =
          invoiceStatus === "paid" ? "paidAmountCents" : "invoicedUnpaidAmountCents";

        await applyCalendarSummaryDeltas(
          transaction,
          db,
          lineItems.map((lineItem) => ({
            dateKey: lineItem.dateKey,
            userId: lineItem.userId,
            delta: {
              [oldBucket]: -lineItem.amountCents,
              uninvoicedAmountCents: lineItem.amountCents
            }
          }))
        );
      }

      entriesSnap.docs.forEach((doc) => {
        transaction.update(doc.ref, {
          status: "completed",
          invoiceId: null,
          invoiceStatusSnapshot: null,
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      transaction.delete(invoiceRef);

      writeAuditLog(
        transaction,
        db,
        actor,
        "invoice.deleted",
        COLLECTIONS.invoices,
        body.invoiceId,
        {
          invoiceNumber: invoice?.invoiceNumber,
          previousStatus: invoice?.status,
          totalCents: invoice?.totalCents
        }
      );

      return { id: body.invoiceId, deleted: true };
    });

    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
