import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedUser, jsonError } from "@/lib/firebase/auth";
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const db = adminDb();
    const snap = await db
      .collection(COLLECTIONS.users)
      .doc(user.uid)
      .collection(SUBCOLLECTIONS.passkeys)
      .orderBy("createdAt", "asc")
      .get();

    const passkeys = snap.docs.map((doc) => ({
      credentialID: doc.data().credentialID as string,
      deviceType: doc.data().deviceType as string,
      backedUp: doc.data().backedUp as boolean,
      createdAt: (doc.data().createdAt?.toDate?.() as Date | undefined)?.toISOString() ?? null
    }));

    return Response.json({ passkeys });
  } catch (error) {
    return jsonError(error);
  }
}
