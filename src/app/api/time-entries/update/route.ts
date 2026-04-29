import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { calculateAmountCents } from "@/lib/billing/formatDuration";
import { dateKeyToDate, dateToDateKey } from "@/lib/dates/dateKeys";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedUser, jsonError } from "@/lib/firebase/auth";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import {
  applyCalendarSummaryDelta,
  applyCalendarSummaryDeltas,
  writeAuditLog
} from "@/lib/firebase/serverWrites";
import { timeEntryUpdateSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = timeEntryUpdateSchema.parse(await request.json());
    const db = adminDb();

    const result = await db.runTransaction(async (transaction) => {
      const taskRef = db.collection(COLLECTIONS.tasks).doc(body.taskId);
      const taskSnap = await transaction.get(taskRef);

      if (!taskSnap.exists || taskSnap.data()?.status === "archived") {
        throw new Response("Task is not available.", { status: 400 });
      }

      const hourlyRateCentsSnapshot = Number(taskSnap.data()?.hourlyRateCentsOverride ?? 0);
      const amountCentsSnapshot = calculateAmountCents(
        body.durationSeconds,
        hourlyRateCentsSnapshot
      );

      if (!body.id) {
        const ref = db.collection(COLLECTIONS.timeEntries).doc();
        const startTime = body.startTime
          ? Timestamp.fromDate(new Date(body.startTime))
          : Timestamp.fromDate(dateKeyToDate(body.dateKey, body.timeZone));
        const endTime = body.endTime
          ? Timestamp.fromDate(new Date(body.endTime))
          : Timestamp.fromMillis(startTime.toMillis() + body.durationSeconds * 1000);
        const dateKey = body.startTime && body.timeZone
          ? dateToDateKey(startTime.toDate(), body.timeZone)
          : body.dateKey;

        await applyCalendarSummaryDelta(transaction, db, dateKey, actor.uid, {
          totalDurationSeconds: body.durationSeconds,
          uninvoicedAmountCents: amountCentsSnapshot
        });

        transaction.set(ref, {
          userId: actor.uid,
          taskId: body.taskId,
          startTime,
          endTime,
          durationSeconds: body.durationSeconds,
          hourlyRateCentsSnapshot,
          amountCentsSnapshot,
          status: "completed",
          invoiceId: null,
          invoiceStatusSnapshot: null,
          dateKey,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        writeAuditLog(
          transaction,
          db,
          actor,
          "timeEntry.created",
          COLLECTIONS.timeEntries,
          ref.id,
          {
            durationSeconds: body.durationSeconds,
            amountCentsSnapshot
          }
        );

        return {
          id: ref.id,
          created: true
        };
      }

      const ref = db.collection(COLLECTIONS.timeEntries).doc(body.id);
      const snap = await transaction.get(ref);

      if (!snap.exists) {
        throw new Response("Time entry was not found.", { status: 404 });
      }

      const existing = snap.data();

      if (existing?.userId !== actor.uid && actor.role !== "admin") {
        throw new Response("Cannot edit another user's time entry.", { status: 403 });
      }

      if (existing?.status !== "completed" || existing?.invoiceId) {
        throw new Response("Invoiced or running entries cannot be edited.", { status: 409 });
      }

      const startTime = body.startTime
        ? Timestamp.fromDate(new Date(body.startTime))
        : Timestamp.fromDate(dateKeyToDate(body.dateKey, body.timeZone));
      const endTime = body.endTime
        ? Timestamp.fromDate(new Date(body.endTime))
        : Timestamp.fromMillis(startTime.toMillis() + body.durationSeconds * 1000);
      const dateKey = body.startTime && body.timeZone
        ? dateToDateKey(startTime.toDate(), body.timeZone)
        : body.dateKey;

      await applyCalendarSummaryDeltas(transaction, db, [
        {
          dateKey: existing.dateKey,
          userId: existing.userId,
          delta: {
            totalDurationSeconds: -Number(existing.durationSeconds ?? 0),
            uninvoicedAmountCents: -Number(existing.amountCentsSnapshot ?? 0)
          }
        },
        {
          dateKey,
          userId: existing.userId,
          delta: {
            totalDurationSeconds: body.durationSeconds,
            uninvoicedAmountCents: amountCentsSnapshot
          }
        }
      ]);

      transaction.update(ref, {
        taskId: body.taskId,
        startTime,
        endTime,
        durationSeconds: body.durationSeconds,
        hourlyRateCentsSnapshot,
        amountCentsSnapshot,
        dateKey,
        updatedAt: FieldValue.serverTimestamp()
      });

      writeAuditLog(
        transaction,
        db,
        actor,
        "timeEntry.updated",
        COLLECTIONS.timeEntries,
        body.id,
        {
          totalDurationSeconds: -Number(existing.durationSeconds ?? 0),
          previousDurationSeconds: existing.durationSeconds,
          durationSeconds: body.durationSeconds,
          amountCentsSnapshot
        }
      );

      return {
        id: body.id,
        created: false
      };
    });

    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
