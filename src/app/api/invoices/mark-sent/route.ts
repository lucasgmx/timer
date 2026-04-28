import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, requireRole } from "@/lib/firebase/auth";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { writeAuditLog } from "@/lib/firebase/serverWrites";
import { invoiceStatusSchema } from "@/lib/validation/schemas";

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
        throw new Response("Invoice cannot be marked as sent.", { status: 409 });
      }

      const entriesSnap = await transaction.get(
        db.collection(COLLECTIONS.timeEntries).where("invoiceId", "==", body.invoiceId)
      );

      transaction.update(invoiceRef, {
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      entriesSnap.docs.forEach((doc) => {
        transaction.update(doc.ref, {
          invoiceStatusSnapshot: "sent",
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      writeAuditLog(
        transaction,
        db,
        actor,
        "invoice.sent",
        COLLECTIONS.invoices,
        body.invoiceId,
        {
          previousStatus: invoice?.status
        }
      );

      return { id: body.invoiceId, status: "sent" };
    });

    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
