import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { ZodError } from "zod";
import { adminAuth, adminDb } from "./admin";
import { COLLECTIONS } from "./firestore";
import { authEmailToUsername, parseUsernameList } from "@/lib/auth/usernames";
import { isUserRole } from "@/lib/permissions/roles";
import type { UserRole } from "@/types/User";

export type AuthenticatedUser = {
  uid: string;
  username: string;
  email: string;
  displayName?: string | null;
  role: UserRole;
  active: boolean;
  defaultHourlyRateCents?: number | null;
};

function parseEmailList(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Response("Missing bearer token.", { status: 401 });
  }

  return authorization.slice("Bearer ".length);
}

export async function getAuthenticatedUser(request: Request): Promise<AuthenticatedUser> {
  const decodedToken = await adminAuth().verifyIdToken(getBearerToken(request));
  const email = decodedToken.email?.toLowerCase();

  if (!email) {
    throw new Response("Authenticated user is missing an email.", { status: 401 });
  }

  const db = adminDb();
  const userRef = db.collection(COLLECTIONS.users).doc(decodedToken.uid);
  const userSnap = await userRef.get();

  if (userSnap.exists) {
    const user = userSnap.data();
    const role = user?.role;

    if (!isUserRole(role) || user?.active === false) {
      throw new Response("User is not active.", { status: 403 });
    }

    const username =
      typeof user?.username === "string"
        ? user.username
        : authEmailToUsername(email) ?? email.split("@")[0];

    return {
      uid: decodedToken.uid,
      username,
      email,
      displayName: user?.displayName ?? decodedToken.name ?? username,
      role,
      active: true,
      defaultHourlyRateCents: typeof user?.defaultHourlyRateCents === "number" ? user.defaultHourlyRateCents : null
    };
  }

  const username = authEmailToUsername(email);
  const allowedUsernames = parseUsernameList(process.env.TIMER_ALLOWED_USERNAMES);
  const adminUsernames = parseUsernameList(process.env.TIMER_BOOTSTRAP_ADMIN_USERNAMES);
  const allowedEmails = parseEmailList(process.env.TIMER_ALLOWED_USER_EMAILS);
  const adminEmails = parseEmailList(process.env.TIMER_BOOTSTRAP_ADMIN_EMAILS);
  const usernameAllowed =
    username !== null && (allowedUsernames.has(username) || adminUsernames.has(username));
  const emailAllowed = allowedEmails.has(email) || adminEmails.has(email);

  if (!usernameAllowed && !emailAllowed) {
    throw new Response("User is not allowlisted for Timer.", { status: 403 });
  }

  const role: UserRole =
    (username !== null && adminUsernames.has(username)) || adminEmails.has(email)
      ? "admin"
      : "user";
  const displayName = decodedToken.name ?? username ?? email.split("@")[0];

  await userRef.set({
    username: username ?? email.split("@")[0],
    email,
    displayName,
    role,
    active: true,
    runningTimeEntryId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    uid: decodedToken.uid,
    username: username ?? email.split("@")[0],
    email,
    displayName,
    role,
    active: true
  };
}

export async function requireRole(request: Request, roles: UserRole[]) {
  const user = await getAuthenticatedUser(request);

  if (!roles.includes(user.role)) {
    throw new Response("Insufficient permissions.", { status: 403 });
  }

  return user;
}

export function jsonError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: "Invalid request payload.",
        issues: error.issues
      },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return Response.json({ error: message }, { status: 500 });
}
