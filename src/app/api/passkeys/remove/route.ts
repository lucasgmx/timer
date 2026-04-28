import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedUser, jsonError } from "@/lib/firebase/auth";
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  credentialID: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const body: unknown = await request.json();
    const { credentialID } = schema.parse(body);

    await adminDb()
      .collection(COLLECTIONS.users)
      .doc(user.uid)
      .collection(SUBCOLLECTIONS.passkeys)
      .doc(credentialID)
      .delete();

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
