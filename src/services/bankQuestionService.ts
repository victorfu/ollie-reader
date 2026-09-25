import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import {
  BANK_QUESTIONS_COLLECTION,
  FIRESTORE_BATCH_LIMIT,
  QUESTION_SOURCES_COLLECTION,
} from "../constants/questionBank";
import type { BankQuestion, QuestionSource } from "../types/questionBank";
import {
  toBankQuestion,
  toFirestorePages,
  toFirestoreQuestion,
} from "./questionBankMappers";
import { requireCurrentUserId } from "./requireCurrentUserId";

type BatchOperation = (batch: WriteBatch) => void;

export function newBankQuestionId(): string {
  return doc(collection(db, BANK_QUESTIONS_COLLECTION)).id;
}

function mapQuestions(docs: readonly QueryDocumentSnapshot<DocumentData>[]): BankQuestion[] {
  return docs
    .map((snapshot) => toBankQuestion(snapshot.id, snapshot.data()))
    .filter((question): question is BankQuestion => question !== null);
}

async function commitInChunks(operations: readonly BatchOperation[]): Promise<void> {
  for (let start = 0; start < operations.length; start += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    operations
      .slice(start, start + FIRESTORE_BATCH_LIMIT)
      .forEach((operation) => operation(batch));
    await batch.commit();
  }
}

/** 全量載入（題庫預期數百題），排序交給前端（spec §4、§15）。 */
export async function listBankQuestions(): Promise<BankQuestion[]> {
  const userId = requireCurrentUserId();
  const snapshot = await getDocs(
    query(collection(db, BANK_QUESTIONS_COLLECTION), where("userId", "==", userId)),
  );
  return mapQuestions(snapshot.docs);
}

export async function listQuestionsForSource(sourceId: string): Promise<BankQuestion[]> {
  const userId = requireCurrentUserId();
  const snapshot = await getDocs(
    query(
      collection(db, BANK_QUESTIONS_COLLECTION),
      where("userId", "==", userId),
      where("sourceId", "==", sourceId),
    ),
  );
  return mapQuestions(snapshot.docs);
}

export async function deleteQuestionsForSource(sourceId: string): Promise<void> {
  const userId = requireCurrentUserId();
  const snapshot = await getDocs(
    query(
      collection(db, BANK_QUESTIONS_COLLECTION),
      where("userId", "==", userId),
      where("sourceId", "==", sourceId),
    ),
  );
  await commitInChunks(
    snapshot.docs.map((item) => (batch: WriteBatch) => batch.delete(item.ref)),
  );
}

export interface EditorCommit {
  upserts: readonly BankQuestion[];
  deleteIds: readonly string[];
  /** 遮蓋或標題有變更時才帶。 */
  source: Pick<QuestionSource, "id" | "title" | "pages"> | null;
}

/** 裁題畫面的自動儲存（spec §8.4）。來源的 update 永遠排在最後。 */
export async function commitEditorChanges(commit: EditorCommit): Promise<void> {
  requireCurrentUserId();
  const operations: BatchOperation[] = [
    ...commit.upserts.map(
      (question) => (batch: WriteBatch) =>
        batch.set(doc(db, BANK_QUESTIONS_COLLECTION, question.id), toFirestoreQuestion(question)),
    ),
    ...commit.deleteIds.map(
      (id) => (batch: WriteBatch) => batch.delete(doc(db, BANK_QUESTIONS_COLLECTION, id)),
    ),
  ];
  const { source } = commit;
  if (source) {
    operations.push((batch: WriteBatch) =>
      batch.update(doc(db, QUESTION_SOURCES_COLLECTION, source.id), {
        title: source.title,
        pages: toFirestorePages(source.pages),
        updatedAt: Timestamp.now(),
      }),
    );
  }
  if (operations.length === 0) return;
  await commitInChunks(operations);
}
