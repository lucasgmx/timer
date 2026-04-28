import { FieldValue } from "firebase-admin/firestore";
import { calculateAmountCents } from "@/lib/billing/formatDuration";
import { dateToDateKey } from "@/lib/dates/dateKeys";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedUser, jsonError } from "@/lib/firebase/auth";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { startTimerSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = startTimerSchema.parse(await request.json());
    const db = adminDb();

    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection(COLLECTIONS.users).doc(actor.uid);
      const userSnap = await transaction.get(userRef);
      const currentRunningId = userSnap.data()?.runningTimeEntryId as string | undefined;

      if (currentRunningId) {
        const currentRunningRef = db
          .collection(COLLECTIONS.timeEntries)
          .doc(currentRunningId);
        const currentRunningSnap = await transaction.get(currentRunningRef);

        if (currentRunningSnap.exists && currentRunningSnap.data()?.status === "running") {
          throw new Response("A timer is already running for this user.", { status: 409 });
        }
      }

      const projectRef = db.collection(COLLECTIONS.projects).doc(body.projectId);
      const taskRef = db.collection(COLLECTIONS.tasks).doc(body.taskId);
      const [projectSnap, taskSnap] = await Promise.all([
        transaction.get(projectRef),
        transaction.get(taskRef)
      ]);

      if (!projectSnap.exists || projectSnap.data()?.status === "archived") {
        throw new Response("Project is not available.", { status: 400 });
      }

      if (!taskSnap.exists || taskSnap.data()?.status === "archived") {
        throw new Response("Task is not available.", { status: 400 });
      }

      const task = taskSnap.data();
      const project = projectSnap.data();

      if (task?.projectId !== body.projectId) {
        throw new Response("Task does not belong to the selected project.", { status: 400 });
      }

      const hourlyRateCentsSnapshot = Number(
        task?.hourlyRateCentsOverride ?? project?.defaultHourlyRateCents ?? 0
      );
      const timeEntryRef = db.collection(COLLECTIONS.timeEntries).doc();

      transaction.set(timeEntryRef, {
        userId: actor.uid,
        taskId: body.taskId,
        projectId: body.projectId,
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

      return {
        id: timeEntryRef.id
      };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
