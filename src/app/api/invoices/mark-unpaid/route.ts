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

      if (invoice?.status !== "paid") {
        throw new Response("Only paid invoices can be marked as unpaid.", { status: 409 });
      }

      const entriesSnap = await transaction.get(
        db.collection(COLLECTIONS.timeEntries).where("invoiceId", "==", body.invoiceId)
      );
      const lineItems = (invoice?.lineItems ?? []) as InvoiceLineItem[];

      await applyCalendarSummaryDeltas(
        transaction,
        db,
        lineItems.map((lineItem) => ({
          dateKey: lineItem.dateKey,
          userId: lineItem.userId,
          delta: {
            paidAmountCents: -lineItem.amountCents,
            invoicedUnpaidAmountCents: lineItem.amountCents
          }
        }))
      );

      transaction.update(invoiceRef, {
        status: "unpaid",
        paidAt: null,
        updatedAt: FieldValue.serverTimestamp()
      });

      entriesSnap.docs.forEach((doc) => {
        transaction.update(doc.ref, {
          invoiceStatusSnapshot: "unpaid",
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      writeAuditLog(
        transaction,
        db,
        actor,
        "invoice.unpaid",
        COLLECTIONS.invoices,
        body.invoiceId,
        {
          previousStatus: invoice?.status
        }
      );

      return { id: body.invoiceId, status: "unpaid" };
    });

    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
