import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedUser, jsonError } from "@/lib/firebase/auth";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { updateDefaultRateSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = updateDefaultRateSchema.parse(await request.json());
    const db = adminDb();

    await db
      .collection(COLLECTIONS.users)
      .doc(actor.uid)
      .update({
        defaultHourlyRateCents: body.defaultHourlyRateCents,
        updatedAt: FieldValue.serverTimestamp()
      });

    return Response.json({ defaultHourlyRateCents: body.defaultHourlyRateCents });
  } catch (error) {
    return jsonError(error);
  }
}
