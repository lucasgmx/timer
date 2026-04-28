import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { jsonError } from "@/lib/firebase/auth";
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";
import { getPasskeyConfig } from "@/lib/passkeys/config";
import { consumeChallenge } from "@/lib/passkeys/challenges";
import { findPasskeyByCredentialID, getUserPasskeys } from "@/lib/passkeys/store";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  challengeId: z.string().min(1),
  response: z.unknown()
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const { challengeId, response } = schema.parse(body);
    const { rpID, origin } = getPasskeyConfig();

    const { challenge, userId } = await consumeChallenge(challengeId, "authentication");
    const authResponse = response as AuthenticationResponseJSON;
    const credentialID = authResponse.id;

    // Find the passkey — by userId if known, otherwise by collection group scan
    let uid: string;
    let storedPasskey: import("@/lib/passkeys/store").StoredPasskey;

    if (userId) {
      const passkeys = await getUserPasskeys(userId);
      const found = passkeys.find((p) => p.credentialID === credentialID);
      if (!found) {
        return Response.json({ error: "Passkey not found for this user." }, { status: 401 });
      }
      uid = userId;
      storedPasskey = found;
    } else {
      const result = await findPasskeyByCredentialID(credentialID);
      if (!result) {
        return Response.json({ error: "Passkey not found." }, { status: 401 });
      }
      uid = result.uid;
      storedPasskey = result.passkey;
    }

    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: storedPasskey.credentialID,
        publicKey: Buffer.from(storedPasskey.credentialPublicKey, "base64url"),
        counter: storedPasskey.counter,
        transports: storedPasskey.transports
      }
    });

    if (!verified) {
      return Response.json({ error: "Passkey verification failed." }, { status: 401 });
    }

    // Update counter
    await adminDb()
      .collection(COLLECTIONS.users)
      .doc(uid)
      .collection(SUBCOLLECTIONS.passkeys)
      .doc(storedPasskey.credentialID)
      .update({
        counter: authenticationInfo.newCounter,
        lastUsedAt: FieldValue.serverTimestamp()
      });

    // Issue a Firebase custom token so the client can sign in
    const customToken = await adminAuth().createCustomToken(uid);
    return Response.json({ customToken });
  } catch (error) {
    return jsonError(error);
  }
}
