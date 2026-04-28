import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

export function formatInvoiceNumber(year: number, sequence: number) {
  return `TMR-${year}-${String(sequence).padStart(4, "0")}`;
}

export async function reserveInvoiceNumber(
  db: Firestore,
  transaction: Transaction,
  now = new Date()
) {
  const year = now.getUTCFullYear();
  const counterRef = db.collection("invoiceCounters").doc(String(year));
  const counterSnap = await transaction.get(counterRef);
  const currentSequence = counterSnap.exists
    ? Number(counterSnap.data()?.nextSequence ?? 1)
    : 1;

  transaction.set(
    counterRef,
    {
      year,
      nextSequence: currentSequence + 1,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return formatInvoiceNumber(year, currentSequence);
}
