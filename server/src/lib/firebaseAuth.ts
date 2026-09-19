import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { ApiError } from "./api";

export async function verifyFirebaseToken(request: Request): Promise<void> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "");
  if (!match) throw new ApiError("Missing authorization header", 401);
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new ApiError("Firebase project is not configured", 500);
  // Signature verification only needs the project ID and Google's public certificates.
  // No Admin private key, Firestore or Storage permissions are needed here.
  const name = "ollie-reader-api";
  const app = getApps().find((app) => app.name === name) || initializeApp({ projectId }, name);
  try {
    await getAuth(app).verifyIdToken(match[1]);
  } catch {
    throw new ApiError("Invalid Firebase token", 403);
  }
}
