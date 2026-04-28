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

      if (invoice?.status === "void" || invoice?.status === "paid") {
        throw new Response("Invoice cannot be marked as paid.", { status: 409 });
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
            invoicedUnpaidAmountCents: -lineItem.amountCents,
            paidAmountCents: lineItem.amountCents
          }
        }))
      );

      transaction.update(invoiceRef, {
        status: "paid",
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      entriesSnap.docs.forEach((doc) => {
        transaction.update(doc.ref, {
          invoiceStatusSnapshot: "paid",
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      writeAuditLog(
        transaction,
        db,
        actor,
        "invoice.paid",
        COLLECTIONS.invoices,
        body.invoiceId,
        {
          previousStatus: invoice?.status,
          totalCents: invoice?.totalCents
        }
      );

      return { id: body.invoiceId, status: "paid" };
    });

    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
