#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadEnvFile(filePath) {
  const fullPath = resolve(filePath);
  if (!existsSync(fullPath)) return;
  const lines = readFileSync(fullPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value.replace(/\\n/g, "\n");
  }
}

function parseServiceAccount() {
  const encoded = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (encoded) return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  if (json) return JSON.parse(json);
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }
  return null;
}

loadEnvFile(".env.local");
loadEnvFile(".env");

if (!getApps().length) {
  const sa = parseServiceAccount();
  initializeApp({
    credential: cert(sa),
    projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = getFirestore();

const snapshot = await db.collection("invoices").get();
if (snapshot.empty) {
  console.log("No invoices found.");
  process.exit(0);
}

const BATCH_SIZE = 500;
let deleted = 0;
const docs = snapshot.docs;
for (let i = 0; i < docs.length; i += BATCH_SIZE) {
  const batch = db.batch();
  docs.slice(i, i + BATCH_SIZE).forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  deleted += Math.min(BATCH_SIZE, docs.length - i);
}

console.log(`Deleted ${deleted} invoice(s).`);
