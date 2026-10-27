/**
 * `firebase/firestore`, with every read and write logging its Firestore
 * failure to the console, even when the caller catches it and only shows a
 * friendly message. Import Firestore from here, not from "firebase/firestore".
 *
 * - A missing composite index is logged with Firebase's link to create it.
 * - A security-rules denial is logged with the document or collection path.
 * Errors that are not FirebaseErrors (a transaction's own checks, for
 * example) are left to the caller.
 */
import * as fs from "firebase/firestore";
import { logger } from "./logger";

export * from "firebase/firestore";

type Target = unknown;

function isFirebaseError(error: unknown): error is { code: string; message: string } {
  return (
    error instanceof Error &&
    error.name === "FirebaseError" &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

// Queries expose no public path; the logged stack shows where they came from.
function describe(target: Target): string {
  const path = typeof target === "object" && target !== null ? (target as { path?: unknown }).path : undefined;
  return typeof path === "string" ? path : "query";
}

export function reportFirestoreError(operation: string, target: Target, error: unknown): void {
  if (!isFirebaseError(error)) return;
  const where = `${operation} ${describe(target)}`;
  if (error.code === "failed-precondition" && /index/i.test(error.message)) {
    logger.error(`[Firestore] Missing index for ${where}. ${error.message}`, error);
  } else if (error.code === "permission-denied") {
    logger.error(`[Firestore] Permission denied by security rules for ${where}.`, error);
  } else {
    logger.error(`[Firestore] ${where} failed (${error.code}).`, error);
  }
}

function logged<T>(operation: string, target: Target, run: () => Promise<T>): Promise<T> {
  return Promise.resolve(run()).catch((error: unknown) => {
    reportFirestoreError(operation, target, error);
    throw error;
  });
}

export const getDoc: typeof fs.getDoc = (reference) =>
  logged("getDoc", reference, () => fs.getDoc(reference));

export const getDocFromServer: typeof fs.getDocFromServer = (reference) =>
  logged("getDocFromServer", reference, () => fs.getDocFromServer(reference));

export const getDocs: typeof fs.getDocs = (query) =>
  logged("getDocs", query, () => fs.getDocs(query));

export const getDocsFromServer: typeof fs.getDocsFromServer = (query) =>
  logged("getDocsFromServer", query, () => fs.getDocsFromServer(query));

export const getCountFromServer: typeof fs.getCountFromServer = (query) =>
  logged("getCountFromServer", query, () => fs.getCountFromServer(query));

export const setDoc = ((reference: fs.DocumentReference, ...rest: unknown[]) =>
  logged("setDoc", reference, () =>
    (fs.setDoc as (...args: unknown[]) => Promise<void>)(reference, ...rest),
  )) as typeof fs.setDoc;

export const addDoc: typeof fs.addDoc = (reference, data) =>
  logged("addDoc", reference, () => fs.addDoc(reference, data));

export const updateDoc = ((reference: fs.DocumentReference, ...rest: unknown[]) =>
  logged("updateDoc", reference, () =>
    (fs.updateDoc as (...args: unknown[]) => Promise<void>)(reference, ...rest),
  )) as typeof fs.updateDoc;

export const deleteDoc: typeof fs.deleteDoc = (reference) =>
  logged("deleteDoc", reference, () => fs.deleteDoc(reference));

export const runTransaction: typeof fs.runTransaction = (firestore, update, options) =>
  logged("runTransaction", null, () => fs.runTransaction(firestore, update, options));

export const writeBatch: typeof fs.writeBatch = (firestore) => {
  const batch = fs.writeBatch(firestore);
  const commit = batch.commit.bind(batch);
  batch.commit = () => logged("writeBatch.commit", null, commit);
  return batch;
};

/** Listener errors are logged too; the caller's error callback still runs. */
export const onSnapshot = ((reference: Target, ...rest: unknown[]) => {
  const errorIndex = rest.findIndex((arg) => typeof arg === "function") + 1;
  const onError = rest[errorIndex];
  const reportingOnError = (error: unknown) => {
    reportFirestoreError("onSnapshot", reference, error);
    if (typeof onError === "function") onError(error);
  };
  const args = [...rest];
  if (errorIndex > 0 && (typeof onError === "function" || onError === undefined)) {
    args[errorIndex] = reportingOnError;
  }
  return (fs.onSnapshot as (...a: unknown[]) => fs.Unsubscribe)(reference, ...args);
}) as typeof fs.onSnapshot;
