import "server-only";

import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";

export type StoredPasskey = {
  credentialID: string;
  credentialPublicKey: string; // base64url
  counter: number;
  transports: AuthenticatorTransportFuture[];
  deviceType: string;
  backedUp: boolean;
  aaguid: string;
  createdAt: Date;
};

export type StoredPasskeyWithId = StoredPasskey & { docId: string };

export async function getUserPasskeys(uid: string): Promise<StoredPasskeyWithId[]> {
  const db = adminDb();
  const snap = await db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(SUBCOLLECTIONS.passkeys)
    .get();

  return snap.docs.map((doc) => ({
    docId: doc.id,
    ...(doc.data() as StoredPasskey)
  }));
}

/** Find a passkey by credentialID across all users (for discoverable credential auth). */
export async function findPasskeyByCredentialID(
  credentialID: string
): Promise<{ uid: string; passkey: StoredPasskey } | null> {
  const db = adminDb();
  const snap = await db
    .collectionGroup(SUBCOLLECTIONS.passkeys)
    .where("credentialID", "==", credentialID)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  // Parent path: users/{uid}/passkeys/{docId}
  const uid = doc.ref.parent.parent?.id;
  if (!uid) return null;

  return { uid, passkey: doc.data() as StoredPasskey };
}
