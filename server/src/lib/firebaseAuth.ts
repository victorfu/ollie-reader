import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { ApiError } from "./api";

export function firebaseAdminApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new ApiError("Firebase project is not configured", 500);
  const name = "ollie-reader-api";
  return getApps().find((app) => app.name === name) || initializeApp({
    projectId,
  }, name);
}

export async function verifyFirebaseToken(request: Request): Promise<DecodedIdToken> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "");
  if (!match) throw new ApiError("Missing authorization header", 401);
  // Signature verification only needs the project ID and Google's public certificates.
  // No Admin private key, Firestore or Storage permissions are needed here.
  const app = firebaseAdminApp();
  try {
    return await getAuth(app).verifyIdToken(match[1]);
  } catch {
    throw new ApiError("Invalid Firebase token", 403);
  }
}
