import { FieldValue } from "firebase-admin/firestore";
import { calculateAmountCents } from "@/lib/billing/formatDuration";
import { dateToDateKey } from "@/lib/dates/dateKeys";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedUser, jsonError } from "@/lib/firebase/auth";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { writeAuditLog } from "@/lib/firebase/serverWrites";
import { startTimerSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = startTimerSchema.parse(await request.json());
    const db = adminDb();

    // Creating a new task requires admin role
    if (body.taskTitle && !body.taskId && actor.role !== "admin") {
      return jsonError(new Response("Admin role required to create tasks.", { status: 403 }));
    }

    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection(COLLECTIONS.users).doc(actor.uid);

      // Reads must all come before writes in a transaction
      const userSnap = await transaction.get(userRef);
      const currentRunningId = userSnap.data()?.runningTimeEntryId as string | undefined;

      let currentRunningSnap = null;
      if (currentRunningId) {
        const currentRunningRef = db
          .collection(COLLECTIONS.timeEntries)
          .doc(currentRunningId);
        currentRunningSnap = await transaction.get(currentRunningRef);
      }

      let taskSnap = null;
      const taskRef = body.taskId
        ? db.collection(COLLECTIONS.tasks).doc(body.taskId)
        : db.collection(COLLECTIONS.tasks).doc(); // new doc ref for new task

      if (body.taskId) {
        taskSnap = await transaction.get(taskRef);
      }

      // Validate running timer guard
      if (
        currentRunningSnap?.exists &&
        currentRunningSnap.data()?.status === "running"
      ) {
        throw new Response("A timer is already running for this user.", { status: 409 });
      }

      let resolvedTaskId: string;
      let hourlyRateCentsSnapshot: number;

      if (body.taskId) {
        // Existing task path
        if (!taskSnap?.exists || taskSnap.data()?.status === "archived") {
          throw new Response("Task is not available.", { status: 400 });
        }
        hourlyRateCentsSnapshot = Number(taskSnap.data()?.hourlyRateCentsOverride ?? actor.defaultHourlyRateCents ?? 0);
        resolvedTaskId = body.taskId;
      } else {
        // New task path — create it inside this transaction
        transaction.set(taskRef, {
          title: body.taskTitle,
          description: null,
          hourlyRateCentsOverride: null,
          status: "active",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        writeAuditLog(transaction, db, actor, "task.upserted", COLLECTIONS.tasks, taskRef.id, {
          previousRate: null,
          hourlyRateCentsOverride: null,
          status: "active"
        });
        hourlyRateCentsSnapshot = actor.defaultHourlyRateCents ?? 0;
        resolvedTaskId = taskRef.id;
      }

      const timeEntryRef = db.collection(COLLECTIONS.timeEntries).doc();

      transaction.set(timeEntryRef, {
        userId: actor.uid,
        taskId: resolvedTaskId,
        description: body.description ?? "",
        startTime: FieldValue.serverTimestamp(),
        endTime: null,
        durationSeconds: 0,
        hourlyRateCentsSnapshot,
        amountCentsSnapshot: calculateAmountCents(0, hourlyRateCentsSnapshot),
        status: "running",
        invoiceId: null,
        invoiceStatusSnapshot: null,
        dateKey: dateToDateKey(new Date()),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      transaction.set(
        userRef,
        {
          runningTimeEntryId: timeEntryRef.id,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return { id: timeEntryRef.id, taskId: resolvedTaskId };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
