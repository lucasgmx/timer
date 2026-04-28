#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DEFAULT_USERNAME_EMAIL_DOMAIN = "timer.local";
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,30}[a-z0-9])?$/;

function loadEnvFile(filePath) {
  const fullPath = resolve(filePath);

  if (!existsSync(fullPath)) {
    return;
  }

  const lines = readFileSync(fullPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    let value = match[2].trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[match[1]] = value.replace(/\\n/g, "\n");
  }
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }

  return args;
}

function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

function assertValidUsername(value) {
  const username = normalizeUsername(value);

  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      "Usernames must be 1-32 characters and use only letters, numbers, underscores, or hyphens."
    );
  }

  return username;
}

function usernameToAuthEmail(username) {
  const domain = (
    process.env.NEXT_PUBLIC_TIMER_USERNAME_EMAIL_DOMAIN ??
    process.env.TIMER_USERNAME_EMAIL_DOMAIN ??
    DEFAULT_USERNAME_EMAIL_DOMAIN
  )
    .trim()
    .toLowerCase();

  return `${assertValidUsername(username)}@${domain}`;
}

function parseServiceAccount() {
  const encoded = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (encoded) {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  }

  if (json) {
    return JSON.parse(json);
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    };
  }

  return null;
}

function getFirebaseApp() {
  if (getApps().length) {
    return getApps()[0];
  }

  const serviceAccount = parseServiceAccount();

  return initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    projectId:
      process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const args = parseArgs(process.argv.slice(2));
  const username = assertValidUsername(args.username ?? process.env.TIMER_CREATE_USERNAME);
  const password = args.password ?? process.env.TIMER_CREATE_USER_PASSWORD;
  const role = args.admin ? "admin" : String(args.role ?? "user").toLowerCase();
  const active = args.active === undefined ? true : args.active !== "false";

  if (!password) {
    throw new Error(
      "Set TIMER_CREATE_USER_PASSWORD or pass --password when creating a username account."
    );
  }

  if (role !== "admin" && role !== "user") {
    throw new Error("Role must be either admin or user.");
  }

  const app = getFirebaseApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  const email = usernameToAuthEmail(username);

  let userRecord;
  let created = false;

  try {
    userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, {
      displayName: username,
      disabled: !active,
      ...(args["reset-password"] ? { password } : {})
    });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }

    userRecord = await auth.createUser({
      email,
      password,
      displayName: username,
      emailVerified: true,
      disabled: !active
    });
    created = true;
  }

  await auth.setCustomUserClaims(userRecord.uid, { username, role });

  const userRef = db.collection("users").doc(userRecord.uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const userData = {
      username,
      email,
      displayName: username,
      role,
      active,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (snapshot.exists) {
      transaction.set(userRef, userData, { merge: true });
    } else {
      transaction.set(userRef, {
        ...userData,
        runningTimeEntryId: null,
        createdAt: FieldValue.serverTimestamp()
      });
    }
  });

  console.log(`${created ? "Created" : "Updated"} Timer user "${username}" (${role}).`);
  console.log(`UID: ${userRecord.uid}`);
  console.log(`Internal Firebase Auth email: ${email}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
