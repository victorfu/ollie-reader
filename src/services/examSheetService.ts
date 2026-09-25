import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import { EXAM_SHEETS_COLLECTION } from "../constants/questionBank";
import type { ExamSheet } from "../types/questionBank";
import { isPermissionDenied } from "./firestoreErrors";
import { toExamSheet } from "./questionBankMappers";
import { requireCurrentUserId } from "./requireCurrentUserId";

export interface SheetInput {
  title: string;
  questionIds: readonly string[];
}

export async function listSheets(): Promise<ExamSheet[]> {
  const userId = requireCurrentUserId();
  const snapshot = await getDocs(
    query(
      collection(db, EXAM_SHEETS_COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs
    .map((item) => toExamSheet(item.id, item.data()))
    .filter((sheet): sheet is ExamSheet => sheet !== null);
}

export async function getSheet(sheetId: string): Promise<ExamSheet | null> {
  const userId = requireCurrentUserId();
  try {
    const snapshot = await getDoc(doc(db, EXAM_SHEETS_COLLECTION, sheetId));
    if (!snapshot.exists()) return null;
    const sheet = toExamSheet(snapshot.id, snapshot.data());
    return sheet && sheet.userId === userId ? sheet : null;
  } catch (error) {
    if (isPermissionDenied(error)) return null;
    throw error;
  }
}

export async function createSheet(input: SheetInput): Promise<ExamSheet> {
  const userId = requireCurrentUserId();
  const now = Timestamp.now();
  const questionIds = [...input.questionIds];
  const ref = await addDoc(collection(db, EXAM_SHEETS_COLLECTION), {
    userId,
    title: input.title,
    questionIds,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id: ref.id,
    userId,
    title: input.title,
    questionIds,
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
  };
}

export async function updateSheet(sheetId: string, input: SheetInput): Promise<void> {
  requireCurrentUserId();
  await updateDoc(doc(db, EXAM_SHEETS_COLLECTION, sheetId), {
    title: input.title,
    questionIds: [...input.questionIds],
    updatedAt: Timestamp.now(),
  });
}

export async function deleteSheet(sheetId: string): Promise<void> {
  requireCurrentUserId();
  await deleteDoc(doc(db, EXAM_SHEETS_COLLECTION, sheetId));
}
