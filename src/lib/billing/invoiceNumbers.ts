import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

export function formatInvoiceNumber(dateKey: string, sequence: number) {
  return `${dateKey}-${String(sequence).padStart(2, "0")}`;
}

export async function reserveInvoiceNumber(
  db: Firestore,
  transaction: Transaction,
  now = new Date()
) {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const dateKey = `${yy}${mm}${dd}`;
  const counterRef = db.collection("invoiceCounters").doc(dateKey);
  const counterSnap = await transaction.get(counterRef);
  const currentSequence = counterSnap.exists
    ? Number(counterSnap.data()?.nextSequence ?? 1)
    : 1;

  transaction.set(
    counterRef,
    {
      dateKey,
      nextSequence: currentSequence + 1,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return formatInvoiceNumber(dateKey, currentSequence);
}
