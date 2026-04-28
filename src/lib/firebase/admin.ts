import "server-only";

import { cert, getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

export function getFirebaseAdminApp() {
  if (getApps().length) {
    return getApp();
  }

  const serviceAccount = parseServiceAccount();

  return initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    projectId:
      process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}

export function adminAuth() {
  return getAuth(getFirebaseAdminApp());
}

let firestore: FirebaseFirestore.Firestore | undefined;

export function adminDb() {
  if (!firestore) {
    firestore = getFirestore(getFirebaseAdminApp());
  }

  return firestore;
}
