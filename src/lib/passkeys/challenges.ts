import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/firestore";

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function storeChallenge(
  challenge: string,
  type: "registration" | "authentication",
  userId?: string
): Promise<string> {
  const db = adminDb();
  const id = randomBytes(16).toString("hex");
  await db.collection(COLLECTIONS.webauthnChallenges).doc(id).set({
    challenge,
    type,
    userId: userId ?? null,
    expiresAt: Timestamp.fromMillis(Date.now() + CHALLENGE_TTL_MS),
    createdAt: FieldValue.serverTimestamp()
  });
  return id;
}

export async function consumeChallenge(
  challengeId: string,
  type: "registration" | "authentication"
): Promise<{ challenge: string; userId: string | null }> {
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.webauthnChallenges).doc(challengeId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error("Challenge not found or already used.");
  }

  const data = snap.data()!;

  if (data.type !== type) {
    throw new Error("Challenge type mismatch.");
  }

  const expiresAt = (data.expiresAt as Timestamp).toMillis();
  if (Date.now() > expiresAt) {
    await ref.delete();
    throw new Error("Challenge has expired.");
  }

  await ref.delete();

  return { challenge: data.challenge as string, userId: data.userId as string | null };
}
