import {
  collection,
  addDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  getDocFromServer,
  runTransaction,
  deleteField,
  Timestamp,
  orderBy,
  limit,
  startAfter,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type {
  PracticeRecord,
  PracticeFilters,
  PracticeRecordPage,
} from "../types/speechPractice";
import { DEFAULT_PRACTICE_PAGE_SIZE } from "../types/speechPractice";
import { deletePracticeAudio } from "./audioStorageService";
import {
  enqueuePracticeAudioCleanup,
  removePracticeAudioCleanup,
  readPracticeAudioCleanupQueue,
  runWithPracticeAudioOperationLock,
  type PendingPracticeAudioCleanup,
  type PracticeAudioCleanupResolution,
} from "./practiceAudioCleanupQueue";

const COLLECTION_NAME = "speechPracticeRecords";
const SCRIPTS_COLLECTION_NAME = "speechScripts";
const PENDING_AUDIO_UPLOAD_FIELD = "pendingRecordingUpload";
const CANCELLED_AUDIO_OPERATIONS_FIELD = "cancelledRecordingOperations";
const PENDING_RECORD_DELETION_FIELD = "pendingRecordDeletion";

export type PracticeAudioReferenceStatus = "referenced" | "unreferenced";

type PendingRecordingUpload = {
  operationId: string;
  path: string;
};

type PendingRecordDeletion = { operationId: string };

type OwnerGuard = () => boolean;

function assertOwnerActive(isOwnerActive: OwnerGuard): void {
  if (!isOwnerActive()) {
    throw new Error("Practice operation owner is no longer active.");
  }
}

function parsePendingRecordingUpload(value: unknown): PendingRecordingUpload | null {
  if (!value || typeof value !== "object") return null;
  const pending = value as Record<string, unknown>;
  return typeof pending.operationId === "string"
    && typeof pending.path === "string"
    ? { operationId: pending.operationId, path: pending.path }
    : null;
}

function parsePendingRecordDeletion(value: unknown): PendingRecordDeletion | null {
  if (!value || typeof value !== "object") return null;
  const pending = value as Record<string, unknown>;
  return typeof pending.operationId === "string" && pending.operationId
    ? { operationId: pending.operationId }
    : null;
}

function parseCancelledRecordingOperations(value: unknown): Set<string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return new Set();
  }
  return new Set(
    Object.entries(value as Record<string, unknown>)
      .filter(([, cancelled]) => cancelled === true)
      .map(([operationId]) => operationId),
  );
}

function addCancelledRecordingOperation(
  value: unknown,
  operationId: string,
): Record<string, true> {
  const cancelled = Object.fromEntries(
    [...parseCancelledRecordingOperations(value)].map((id) => [id, true]),
  ) as Record<string, true>;
  cancelled[operationId] = true;
  return cancelled;
}

function newAudioOperationId(prefix: string): string {
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

// Convert Firestore data to PracticeRecord
const convertToPracticeRecord = (
  id: string,
  data: DocumentData,
): PracticeRecord => {
  return {
    id,
    topicId: data.topicId,
    topicTitle: data.topicTitle,
    userId: data.userId,
    durationSeconds: data.durationSeconds,
    recordingUrl: data.recordingUrl,
    notes: data.notes,
    script: data.script,
    createdAt: data.createdAt?.toDate() || new Date(),
  };
};

// Add a new practice record
export const addPracticeRecord = async (
  record: Omit<PracticeRecord, "id" | "createdAt">,
): Promise<string> => {
  const now = Timestamp.now();

  // Filter out undefined values to avoid Firestore error
  const docData: Record<string, unknown> = {
    topicId: record.topicId,
    topicTitle: record.topicTitle,
    userId: record.userId,
    durationSeconds: record.durationSeconds,
    createdAt: now,
  };

  // Only add optional fields if they have values
  if (record.recordingUrl !== undefined) {
    docData.recordingUrl = record.recordingUrl;
  }
  if (record.notes !== undefined && record.notes !== "") {
    docData.notes = record.notes;
  }
  if (record.script !== undefined && record.script !== "") {
    docData.script = record.script;
  }

  const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
  return docRef.id;
};

// Get all practice records for a user
export const getUserPracticeRecords = async (
  userId: string,
  filters?: PracticeFilters,
  isOwnerActive: OwnerGuard = () => true,
): Promise<PracticeRecordPage> => {
  try {
    assertOwnerActive(isOwnerActive);
    const pageSize = filters?.limit || DEFAULT_PRACTICE_PAGE_SIZE;
    const sortField = filters?.sortBy || "createdAt";
    const sortDirection = filters?.sortOrder || "desc";

    let q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
    );

    // Apply topic filter
    if (filters?.topicId) {
      q = query(q, where("topicId", "==", filters.topicId));
    }

    q = query(q, orderBy(sortField, sortDirection));

    if (filters?.cursor) {
      const cursorDoc = await getDoc(
        doc(db, COLLECTION_NAME, filters.cursor),
      );
      assertOwnerActive(isOwnerActive);
      if (cursorDoc.exists()) {
        q = query(q, startAfter(cursorDoc));
      }
    }

    // Fetch one extra document so callers know whether another page exists.
    q = query(q, limit(pageSize + 1));

    assertOwnerActive(isOwnerActive);
    const querySnapshot = await getDocs(q);
    assertOwnerActive(isOwnerActive);
    const hasMore = querySnapshot.docs.length > pageSize;
    const docs = hasMore
      ? querySnapshot.docs.slice(0, pageSize)
      : querySnapshot.docs;

    const records = docs.map(
      (doc: QueryDocumentSnapshot<DocumentData>) => {
        return convertToPracticeRecord(doc.id, doc.data());
      },
    );

    return {
      records,
      hasMore,
      lastDocId: docs.at(-1)?.id,
    };
  } catch (error) {
    console.error("Error getting user practice records:", error);
    throw error;
  }
};

// Delete a practice record and its associated audio file
export const deletePracticeRecord = async (
  recordId: string,
  userId: string,
  isOwnerActive: OwnerGuard = () => true,
): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, recordId);
  const requestedOperationId = newAudioOperationId("delete");
  assertOwnerActive(isOwnerActive);
  // First serialize a tombstone against begin/complete. Once this commits,
  // neither an existing pending upload nor a future one can finalize a new URL.
  // A later delete attempt may resume the same tombstone after a crash.
  const deletion = await runTransaction(db, async (transaction) => {
    assertOwnerActive(isOwnerActive);
    const snapshot = await transaction.get(docRef);
    assertOwnerActive(isOwnerActive);
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    if (data.userId !== userId) {
      throw new Error("Practice record does not belong to the current user.");
    }
    const existing = parsePendingRecordDeletion(
      data[PENDING_RECORD_DELETION_FIELD],
    );
    const operationId = existing?.operationId ?? requestedOperationId;
    if (!existing) {
      transaction.update(docRef, {
        [PENDING_RECORD_DELETION_FIELD]: { operationId },
      });
    }
    const pendingUpload = parsePendingRecordingUpload(
      data[PENDING_AUDIO_UPLOAD_FIELD],
    );
    const paths = [data.recordingUrl, pendingUpload?.path]
      .filter((path): path is string => typeof path === "string" && !!path);
    return { operationId, paths: [...new Set(paths)] };
  });
  if (!deletion) return;

  const cleanups = deletion.paths.map((path, index) => ({
    userId,
    recordId,
    path,
    reason: "deleted-record" as const,
    operationId: `${deletion.operationId}-${index}`,
    leaseExpiresAt: 0,
  }));
  // The tombstone leaves metadata intact, so a marker failure is recoverable:
  // do not delete the document and let the same owner retry the tombstone.
  if (!cleanups.every((cleanup) => enqueuePracticeAudioCleanup(cleanup))) {
    throw new Error("Unable to persist practice audio cleanup marker.");
  }

  assertOwnerActive(isOwnerActive);
  try {
    await runTransaction(db, async (transaction) => {
      assertOwnerActive(isOwnerActive);
      const snapshot = await transaction.get(docRef);
      assertOwnerActive(isOwnerActive);
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.userId !== userId) {
        throw new Error("Practice record does not belong to the current user.");
      }
      const pendingDeletion = parsePendingRecordDeletion(
        data[PENDING_RECORD_DELETION_FIELD],
      );
      if (pendingDeletion?.operationId !== deletion.operationId) {
        throw new Error("Practice record deletion is no longer active.");
      }
      transaction.delete(docRef);
    });
  } catch (deleteError) {
    // A rejected Promise is ambiguous: Firestore may have committed the
    // deletion but the client lost its ACK. Only an authoritative server read
    // may decide whether Storage can now be touched.
    let verification;
    try {
      assertOwnerActive(isOwnerActive);
      verification = await getDocFromServer(docRef);
      assertOwnerActive(isOwnerActive);
    } catch {
      // Keep the marker but leave Storage intact. A later retry can reconcile.
      throw deleteError;
    }
    if (verification.exists()) {
      // Keep the tombstone and its markers. The next same-owner delete resumes
      // this exact operation; background cleanup defers while metadata exists.
      throw deleteError;
    }
  }

  for (const cleanup of cleanups) {
    if (!isOwnerActive()) break;
    try {
      const result = await runWithPracticeAudioOperationLock(
        cleanup,
        async (usedWebLock) => {
          if (!isOwnerActive()) return false;
          if (!usedWebLock) {
            const hasLiveUpload = readPracticeAudioCleanupQueue(userId).some(
              (candidate) => (
                candidate.path === cleanup.path
                && candidate.operationId !== cleanup.operationId
                && candidate.leaseExpiresAt > Date.now()
              ),
            );
            if (hasLiveUpload) return false;
          }
          await deletePracticeAudio(userId, recordId, cleanup.path);
          return true;
        },
      );
      if (result.value) removePracticeAudioCleanup(cleanup);
    } catch (storageError) {
      // Logical deletion already succeeded. Keep its durable marker and let
      // the same owner retry on the next mount/login/online event.
      console.error(
        "Practice record deleted but audio cleanup is pending:",
        storageError,
      );
    }
  }
};

// Update practice record with recording URL
export const updatePracticeRecordUrl = async (
  recordId: string,
  recordingUrl: string,
): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, recordId);
  await updateDoc(docRef, { recordingUrl });
};

function validateAudioOperation(
  userId: string,
  recordId: string,
  path: string,
  operationId: string,
): void {
  const expectedPrefix = `speech-practice/${userId}/${recordId}.`;
  if (
    !userId
    || !recordId
    || recordId.includes("/")
    || !operationId
    || operationId.length > 128
    || operationId.includes("/")
    || !path.startsWith(expectedPrefix)
    || path.slice(expectedPrefix.length).includes("/")
  ) {
    throw new RangeError("Practice audio operation is invalid.");
  }
}

/** Reserve an operation token on Firestore before creating the Storage object. */
export async function beginPracticeAudioUpload(
  userId: string,
  recordId: string,
  path: string,
  operationId: string,
  isOwnerActive: OwnerGuard = () => true,
): Promise<void> {
  validateAudioOperation(userId, recordId, path, operationId);
  const docRef = doc(db, COLLECTION_NAME, recordId);
  await runTransaction(db, async (transaction) => {
    assertOwnerActive(isOwnerActive);
    const snapshot = await transaction.get(docRef);
    assertOwnerActive(isOwnerActive);
    if (!snapshot.exists()) throw new Error("Practice record does not exist.");
    const data = snapshot.data();
    if (data.userId !== userId) {
      throw new Error("Practice record does not belong to the current user.");
    }
    if (parsePendingRecordDeletion(data[PENDING_RECORD_DELETION_FIELD])) {
      throw new Error("Practice record is being deleted.");
    }
    if (data.recordingUrl === path) return;
    if (
      parseCancelledRecordingOperations(
        data[CANCELLED_AUDIO_OPERATIONS_FIELD],
      ).has(operationId)
    ) {
      throw new Error("Practice audio operation was cancelled.");
    }
    const pending = parsePendingRecordingUpload(
      data[PENDING_AUDIO_UPLOAD_FIELD],
    );
    if (
      pending
      && (pending.operationId !== operationId || pending.path !== path)
    ) {
      throw new Error("Another practice audio operation is pending.");
    }
    transaction.update(docRef, {
      [PENDING_AUDIO_UPLOAD_FIELD]: { operationId, path },
    });
  });
}

/**
 * Finalize only the exact reserved operation. Transactions are not queued
 * offline, so a cleanup transaction that cancels this token prevents a late
 * client write from ever creating a reference to an already-deleted object.
 */
export async function completePracticeAudioUpload(
  userId: string,
  recordId: string,
  path: string,
  operationId: string,
  isOwnerActive: OwnerGuard = () => true,
): Promise<void> {
  validateAudioOperation(userId, recordId, path, operationId);
  const docRef = doc(db, COLLECTION_NAME, recordId);
  await runTransaction(db, async (transaction) => {
    assertOwnerActive(isOwnerActive);
    const snapshot = await transaction.get(docRef);
    assertOwnerActive(isOwnerActive);
    if (!snapshot.exists()) throw new Error("Practice record does not exist.");
    const data = snapshot.data();
    if (data.userId !== userId) {
      throw new Error("Practice record does not belong to the current user.");
    }
    if (parsePendingRecordDeletion(data[PENDING_RECORD_DELETION_FIELD])) {
      throw new Error("Practice record is being deleted.");
    }
    if (data.recordingUrl === path) return;
    const pending = parsePendingRecordingUpload(
      data[PENDING_AUDIO_UPLOAD_FIELD],
    );
    if (
      !pending
      || pending.operationId !== operationId
      || pending.path !== path
    ) {
      throw new Error("Practice audio operation is no longer active.");
    }
    transaction.update(docRef, {
      recordingUrl: path,
      [PENDING_AUDIO_UPLOAD_FIELD]: deleteField(),
    });
  });
}

/**
 * Resolve one durable marker in the same Firestore serialization order as
 * finalization. Returning deletable means this exact upload token can no
 * longer commit a future recordingUrl reference.
 */
export async function resolvePracticeAudioCleanup(
  cleanup: PendingPracticeAudioCleanup,
  isOwnerActive: OwnerGuard = () => true,
): Promise<PracticeAudioCleanupResolution> {
  const { userId, recordId, path, operationId } = cleanup;
  validateAudioOperation(userId, recordId, path, operationId);
  const docRef = doc(db, COLLECTION_NAME, recordId);
  return runTransaction(db, async (transaction) => {
    assertOwnerActive(isOwnerActive);
    const snapshot = await transaction.get(docRef);
    assertOwnerActive(isOwnerActive);
    if (!snapshot.exists()) return "deletable";

    const data = snapshot.data();
    if (data.userId !== userId) {
      throw new Error("Practice record ownership could not be verified.");
    }
    const pending = parsePendingRecordingUpload(
      data[PENDING_AUDIO_UPLOAD_FIELD],
    );

    if (cleanup.reason === "deleted-record") {
      return data.recordingUrl === path || pending?.path === path
        ? "defer"
        : "deletable";
    }
    if (data.recordingUrl === path) return "referenced";
    if (pending) {
      if (pending.operationId !== operationId || pending.path !== path) {
        return "defer";
      }
      transaction.update(docRef, {
        [PENDING_AUDIO_UPLOAD_FIELD]: deleteField(),
        [CANCELLED_AUDIO_OPERATIONS_FIELD]: addCancelledRecordingOperation(
          data[CANCELLED_AUDIO_OPERATIONS_FIELD],
          operationId,
        ),
      });
      return "deletable";
    }
    if (
      !parseCancelledRecordingOperations(
        data[CANCELLED_AUDIO_OPERATIONS_FIELD],
      ).has(operationId)
    ) {
      transaction.update(docRef, {
        [CANCELLED_AUDIO_OPERATIONS_FIELD]: addCancelledRecordingOperation(
          data[CANCELLED_AUDIO_OPERATIONS_FIELD],
          operationId,
        ),
      });
    }
    return "deletable";
  });
}

/**
 * Read the authoritative server copy before deleting an upload after an
 * ambiguous metadata-write failure. A cache read is unsafe here: the server
 * may have committed `recordingUrl` even though the client lost its ACK.
 */
export const getPracticeAudioReferenceStatus = async (
  userId: string,
  recordId: string,
  recordingPath: string,
): Promise<PracticeAudioReferenceStatus> => {
  const expectedPrefix = `speech-practice/${userId}/${recordId}.`;
  if (
    !userId
    || !recordId
    || recordId.includes("/")
    || !recordingPath.startsWith(expectedPrefix)
    || recordingPath.slice(expectedPrefix.length).includes("/")
  ) {
    throw new RangeError("Practice audio path is invalid.");
  }

  const snapshot = await getDocFromServer(
    doc(db, COLLECTION_NAME, recordId),
  );
  if (!snapshot.exists()) return "unreferenced";

  const data = snapshot.data();
  if (data.userId !== userId) {
    // Ownership disagreement is not evidence that the upload is orphaned.
    // Refuse to delete until the initiating owner can verify it.
    throw new Error("Practice record ownership could not be verified.");
  }
  return data.recordingUrl === recordingPath
    ? "referenced"
    : "unreferenced";
};

// Get practice count by topic for a user
export const getPracticeCountByTopic = async (
  userId: string,
  isOwnerActive: OwnerGuard = () => true,
): Promise<Map<string, number>> => {
  const countMap = new Map<string, number>();
  let cursor: string | undefined;

  do {
    assertOwnerActive(isOwnerActive);
    const page = await getUserPracticeRecords(userId, {
      limit: 200,
      cursor,
    }, isOwnerActive);
    page.records.forEach((record) => {
      const count = countMap.get(record.topicId) || 0;
      countMap.set(record.topicId, count + 1);
    });
    cursor = page.hasMore ? page.lastDocId : undefined;
  } while (cursor);

  return countMap;
};

// ============ Script Management ============

export interface TopicScript {
  id?: string;
  topicId: string;
  userId: string;
  script: string;
  createdAt: Date;
  updatedAt: Date;
}

// Save or update a script for a topic
export const saveTopicScript = async (
  userId: string,
  topicId: string,
  script: string,
  isOwnerActive: OwnerGuard = () => true,
): Promise<string> => {
  const now = Timestamp.now();

  // Check if script already exists
  assertOwnerActive(isOwnerActive);
  const existingScript = await getTopicScript(userId, topicId);
  assertOwnerActive(isOwnerActive);

  if (existingScript?.id) {
    // Update existing script
    const docRef = doc(db, SCRIPTS_COLLECTION_NAME, existingScript.id);
    await updateDoc(docRef, {
      script,
      updatedAt: now,
    });
    return existingScript.id;
  } else {
    // Create new script
    const docData = {
      topicId,
      userId,
      script,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await addDoc(
      collection(db, SCRIPTS_COLLECTION_NAME),
      docData,
    );
    return docRef.id;
  }
};

// Get script for a specific topic
export const getTopicScript = async (
  userId: string,
  topicId: string,
): Promise<TopicScript | null> => {
  const q = query(
    collection(db, SCRIPTS_COLLECTION_NAME),
    where("userId", "==", userId),
    where("topicId", "==", topicId),
    limit(1),
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const docSnap = querySnapshot.docs[0];
  const data = docSnap.data();

  return {
    id: docSnap.id,
    topicId: data.topicId,
    userId: data.userId,
    script: data.script,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
};

// Get all scripts for a user (returns Map of topicId -> script)
export const getUserScripts = async (
  userId: string,
): Promise<Map<string, string>> => {
  const q = query(
    collection(db, SCRIPTS_COLLECTION_NAME),
    where("userId", "==", userId),
  );

  const querySnapshot = await getDocs(q);
  const scriptsMap = new Map<string, string>();

  querySnapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    scriptsMap.set(data.topicId, data.script);
  });

  return scriptsMap;
};
