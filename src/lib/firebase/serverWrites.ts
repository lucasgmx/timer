import "server-only";

import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { AuditAction } from "@/types/AuditLog";
import type { AuthenticatedUser } from "./auth";
import { allCalendarSummaryId, COLLECTIONS, userCalendarSummaryId } from "./firestore";

type SummaryDelta = {
  totalDurationSeconds?: number;
  uninvoicedAmountCents?: number;
  invoicedUnpaidAmountCents?: number;
  paidAmountCents?: number;
  voidAmountCents?: number;
};

type SummaryUpdate = {
  dateKey: string;
  userId: string;
  delta: SummaryDelta;
};

function clamp(value: number) {
  return Math.max(0, Math.round(value));
}

function nextSummaryStatus(values: {
  totalDurationSeconds: number;
  uninvoicedAmountCents: number;
  invoicedUnpaidAmountCents: number;
  paidAmountCents: number;
  voidAmountCents: number;
}) {
  const activeBuckets = [
    values.uninvoicedAmountCents > 0,
    values.invoicedUnpaidAmountCents > 0,
    values.paidAmountCents > 0,
    values.voidAmountCents > 0
  ].filter(Boolean).length;

  if (values.totalDurationSeconds <= 0 || activeBuckets === 0) {
    return "empty";
  }

  if (activeBuckets > 1) {
    return "mixed";
  }

  if (values.uninvoicedAmountCents > 0) {
    return "uninvoiced";
  }

  if (values.invoicedUnpaidAmountCents > 0) {
    return "invoiced";
  }

  if (values.paidAmountCents > 0) {
    return "paid";
  }

  return "mixed";
}

function mergeDelta(left: SummaryDelta, right: SummaryDelta): SummaryDelta {
  return {
    totalDurationSeconds:
      (left.totalDurationSeconds ?? 0) + (right.totalDurationSeconds ?? 0),
    uninvoicedAmountCents:
      (left.uninvoicedAmountCents ?? 0) + (right.uninvoicedAmountCents ?? 0),
    invoicedUnpaidAmountCents:
      (left.invoicedUnpaidAmountCents ?? 0) +
      (right.invoicedUnpaidAmountCents ?? 0),
    paidAmountCents: (left.paidAmountCents ?? 0) + (right.paidAmountCents ?? 0),
    voidAmountCents: (left.voidAmountCents ?? 0) + (right.voidAmountCents ?? 0)
  };
}

export async function applyCalendarSummaryDelta(
  transaction: Transaction,
  db: Firestore,
  dateKey: string,
  userId: string,
  delta: SummaryDelta
) {
  await applyCalendarSummaryDeltas(transaction, db, [{ dateKey, userId, delta }]);
}

export async function applyCalendarSummaryDeltas(
  transaction: Transaction,
  db: Firestore,
  updates: SummaryUpdate[]
) {
  const byId = new Map<
    string,
    {
      base: { scope: "all" | "user"; userId?: string | null; dateKey: string };
      delta: SummaryDelta;
    }
  >();

  for (const update of updates) {
    const summaryTargets = [
      {
        id: userCalendarSummaryId(update.userId, update.dateKey),
        base: { scope: "user" as const, userId: update.userId, dateKey: update.dateKey }
      },
      {
        id: allCalendarSummaryId(update.dateKey),
        base: { scope: "all" as const, userId: null, dateKey: update.dateKey }
      }
    ];

    for (const target of summaryTargets) {
      const current = byId.get(target.id);
      byId.set(target.id, {
        base: target.base,
        delta: current ? mergeDelta(current.delta, update.delta) : update.delta
      });
    }
  }

  const entries = Array.from(byId.entries());
  const refs = entries.map(([id]) =>
    db.collection(COLLECTIONS.calendarDaySummaries).doc(id)
  );
  const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));

  entries.forEach(([id, update], index) => {
    const snap = snapshots[index];
    const current = snap.exists ? snap.data() ?? {} : {};
    const next = {
      totalDurationSeconds: clamp(
        Number(current.totalDurationSeconds ?? 0) +
          (update.delta.totalDurationSeconds ?? 0)
      ),
      uninvoicedAmountCents: clamp(
        Number(current.uninvoicedAmountCents ?? 0) +
          (update.delta.uninvoicedAmountCents ?? 0)
      ),
      invoicedUnpaidAmountCents: clamp(
        Number(current.invoicedUnpaidAmountCents ?? 0) +
          (update.delta.invoicedUnpaidAmountCents ?? 0)
      ),
      paidAmountCents: clamp(
        Number(current.paidAmountCents ?? 0) + (update.delta.paidAmountCents ?? 0)
      ),
      voidAmountCents: clamp(
        Number(current.voidAmountCents ?? 0) + (update.delta.voidAmountCents ?? 0)
      )
    };

    transaction.set(
      db.collection(COLLECTIONS.calendarDaySummaries).doc(id),
      {
        ...update.base,
        ...next,
        status: nextSummaryStatus(next),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });
}

export function writeAuditLog(
  transaction: Transaction,
  db: Firestore,
  actor: AuthenticatedUser,
  action: AuditAction,
  targetCollection: string,
  targetId: string,
  metadata?: Record<string, unknown>
) {
  const auditRef = db.collection(COLLECTIONS.auditLogs).doc();

  transaction.set(auditRef, {
    action,
    actorUserId: actor.uid,
    actorRole: actor.role,
    targetCollection,
    targetId,
    metadata,
    createdAt: FieldValue.serverTimestamp()
  });
}
