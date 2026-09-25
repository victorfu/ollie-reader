import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import { STORAGE_BUCKET, supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";
import {
  QUESTION_BANK_STORAGE_FOLDER,
  QUESTION_SOURCES_COLLECTION,
} from "../constants/questionBank";
import type { BankSubject, QuestionSource, SourcePage } from "../types/questionBank";
import type { RenderedPage } from "../utils/pageImageProcessor";
import { deleteQuestionsForSource } from "./bankQuestionService";
import { toQuestionSource } from "./questionBankMappers";
import { requireCurrentUserId } from "./requireCurrentUserId";

export function createQuestionSourcePath(
  userId: string,
  sourceId: string,
  pageIndex: number,
): string {
  return `${QUESTION_BANK_STORAGE_FOLDER}/${userId}/${sourceId}/page-${pageIndex}.jpg`;
}

export function newQuestionSourceId(): string {
  return doc(collection(db, QUESTION_SOURCES_COLLECTION)).id;
}

async function removeStorageFiles(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([...paths]);
    if (error) logger.warn("[questionSource] storage cleanup failed", error);
  } catch (error) {
    logger.warn("[questionSource] storage cleanup failed", error);
  }
}

export interface CreateSourceInput {
  /** 重試時沿用同一個 id；搭配 upsert: true 覆寫殘留檔（spec §7）。 */
  sourceId: string;
  title: string;
  subject: BankSubject;
  pageCount: number;
  /** 依序呼叫：前一頁上傳完成才會要求下一頁，一次只有一頁在記憶體。 */
  renderPage: (pageIndex: number) => Promise<RenderedPage>;
  onProgress?: (uploaded: number, total: number) => void;
}

export async function createSource(input: CreateSourceInput): Promise<QuestionSource> {
  const userId = requireCurrentUserId();
  const pages: SourcePage[] = [];
  const uploadedPaths: string[] = [];

  try {
    for (let pageIndex = 0; pageIndex < input.pageCount; pageIndex += 1) {
      const rendered = await input.renderPage(pageIndex);
      const storagePath = createQuestionSourcePath(userId, input.sourceId, pageIndex);
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, rendered.blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      uploadedPaths.push(storagePath);
      pages.push({ storagePath, width: rendered.width, height: rendered.height, masks: [] });
      input.onProgress?.(pageIndex + 1, input.pageCount);
    }

    const now = Timestamp.now();
    await setDoc(doc(db, QUESTION_SOURCES_COLLECTION, input.sourceId), {
      userId,
      title: input.title,
      subject: input.subject,
      pages,
      createdAt: now,
      updatedAt: now,
    });
    return {
      id: input.sourceId,
      userId,
      title: input.title,
      subject: input.subject,
      pages,
      createdAt: now.toDate(),
      updatedAt: now.toDate(),
    };
  } catch (error) {
    await removeStorageFiles(uploadedPaths);
    throw error;
  }
}

export async function listSources(): Promise<QuestionSource[]> {
  const userId = requireCurrentUserId();
  const snapshot = await getDocs(
    query(
      collection(db, QUESTION_SOURCES_COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs
    .map((item) => toQuestionSource(item.id, item.data()))
    .filter((source): source is QuestionSource => source !== null);
}

function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "permission-denied"
  );
}

export async function getSource(sourceId: string): Promise<QuestionSource | null> {
  const userId = requireCurrentUserId();
  try {
    const snapshot = await getDoc(doc(db, QUESTION_SOURCES_COLLECTION, sourceId));
    if (!snapshot.exists()) return null;
    const source = toQuestionSource(snapshot.id, snapshot.data());
    return source && source.userId === userId ? source : null;
  } catch (error) {
    if (isPermissionDenied(error)) return null;
    throw error;
  }
}

/**
 * 先刪題目、最後才刪來源文件：多批刪除不是原子操作，
 * 中途失敗時來源還在，重按刪除即可接續（spec §10）。
 */
export async function deleteSource(source: QuestionSource): Promise<void> {
  requireCurrentUserId();
  await deleteQuestionsForSource(source.id);
  await deleteDoc(doc(db, QUESTION_SOURCES_COLLECTION, source.id));
  await removeStorageFiles(source.pages.map((page) => page.storagePath));
}
