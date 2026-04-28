import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, requireRole } from "@/lib/firebase/auth";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { writeAuditLog } from "@/lib/firebase/serverWrites";
import { projectUpsertSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireRole(request, ["admin"]);
    const body = projectUpsertSchema.parse(await request.json());
    const db = adminDb();

    const result = await db.runTransaction(async (transaction) => {
      const ref = body.id
        ? db.collection(COLLECTIONS.projects).doc(body.id)
        : db.collection(COLLECTIONS.projects).doc();
      const existing = await transaction.get(ref);
      const previousRate = existing.data()?.defaultHourlyRateCents;

      transaction.set(
        ref,
        {
          name: body.name,
          clientName: body.clientName ?? null,
          defaultHourlyRateCents: body.defaultHourlyRateCents,
          currency: "USD",
          status: body.status,
          createdAt: existing.exists
            ? existing.data()?.createdAt
            : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      writeAuditLog(
        transaction,
        db,
        actor,
        "project.upserted",
        COLLECTIONS.projects,
        ref.id,
        {
          previousRate,
          defaultHourlyRateCents: body.defaultHourlyRateCents,
          status: body.status
        }
      );

      return { id: ref.id };
    });

    return Response.json(result, { status: body.id ? 200 : 201 });
  } catch (error) {
    return jsonError(error);
  }
}
