import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedUser, jsonError } from "@/lib/firebase/auth";
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";
import { getPasskeyConfig } from "@/lib/passkeys/config";
import { consumeChallenge } from "@/lib/passkeys/challenges";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  challengeId: z.string().min(1),
  response: z.unknown()
});

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const body: unknown = await request.json();
    const { challengeId, response } = schema.parse(body);
    const { rpID, origin } = getPasskeyConfig();

    const { challenge } = await consumeChallenge(challengeId, "registration");

    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false
    });

    if (!verified || !registrationInfo) {
      return Response.json({ error: "Passkey registration failed." }, { status: 400 });
    }

    const { credential, credentialDeviceType, credentialBackedUp, aaguid } = registrationInfo;

    const db = adminDb();
    await db
      .collection(COLLECTIONS.users)
      .doc(user.uid)
      .collection(SUBCOLLECTIONS.passkeys)
      .doc(credential.id)
      .set({
        credentialID: credential.id,
        credentialPublicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: credential.transports ?? [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        aaguid: aaguid ?? "",
        createdAt: FieldValue.serverTimestamp()
      });

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
