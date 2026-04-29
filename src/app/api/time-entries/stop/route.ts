import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { calculateAmountCents } from "@/lib/billing/formatDuration";
import { dateToDateKey } from "@/lib/dates/dateKeys";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedUser, jsonError } from "@/lib/firebase/auth";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import {
  applyCalendarSummaryDelta,
  writeAuditLog
} from "@/lib/firebase/serverWrites";
import { stopTimerSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = stopTimerSchema.parse(await request.json());
    const db = adminDb();

    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection(COLLECTIONS.users).doc(actor.uid);
      const userSnap = await transaction.get(userRef);
      const timeEntryId = body.timeEntryId ?? userSnap.data()?.runningTimeEntryId;

      if (!timeEntryId) {
        throw new Response("No running timer was found.", { status: 404 });
      }

      const timeEntryRef = db.collection(COLLECTIONS.timeEntries).doc(timeEntryId);
      const timeEntrySnap = await transaction.get(timeEntryRef);

      if (!timeEntrySnap.exists) {
        throw new Response("Time entry was not found.", { status: 404 });
      }

      const entry = timeEntrySnap.data();

      if (entry?.userId !== actor.uid && actor.role !== "admin") {
        throw new Response("Cannot stop another user's timer.", { status: 403 });
      }

      if (entry?.status !== "running") {
        throw new Response("Time entry is not running.", { status: 409 });
      }

      const startTime = entry.startTime;

      if (!(startTime instanceof Timestamp)) {
        throw new Response("Running timer has not finished initializing.", { status: 409 });
      }

      const endTime = Timestamp.now();
      const existingDateKey =
        typeof entry.dateKey === "string" && entry.dateKey ? entry.dateKey : null;
      const dateKey = existingDateKey ?? dateToDateKey(startTime.toDate(), body.timeZone);
      const durationSeconds = Math.max(
        1,
        Math.floor((endTime.toMillis() - startTime.toMillis()) / 1000)
      );
      const amountCentsSnapshot = calculateAmountCents(
        durationSeconds,
        Number(entry.hourlyRateCentsSnapshot ?? 0)
      );

      await applyCalendarSummaryDelta(transaction, db, dateKey, entry.userId, {
        totalDurationSeconds: durationSeconds,
        uninvoicedAmountCents: amountCentsSnapshot
      });

      const taskRef = db.collection(COLLECTIONS.tasks).doc(entry.taskId);
      transaction.update(taskRef, { updatedAt: FieldValue.serverTimestamp() });

      transaction.update(timeEntryRef, {
        endTime,
        durationSeconds,
        amountCentsSnapshot,
        dateKey,
        status: "completed",
        updatedAt: FieldValue.serverTimestamp()
      });

      if (entry.userId === actor.uid) {
        transaction.set(
          userRef,
          {
            runningTimeEntryId: null,
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }

      writeAuditLog(
        transaction,
        db,
        actor,
        "timeEntry.stopped",
        COLLECTIONS.timeEntries,
        timeEntryId,
        {
          durationSeconds,
          amountCentsSnapshot
        }
      );

      return {
        id: timeEntryId,
        durationSeconds,
        amountCentsSnapshot
      };
    });

    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
