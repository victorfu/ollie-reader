import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type { PracticeRecord, PracticeFilters } from "../types/speechPractice";
import { DEFAULT_PRACTICE_PAGE_SIZE } from "../types/speechPractice";
import { deletePracticeAudio } from "./audioStorageService";

const COLLECTION_NAME = "speechPracticeRecords";
const SCRIPTS_COLLECTION_NAME = "speechScripts";

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
): Promise<PracticeRecord[]> => {
  try {
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

    // Add ordering and limit
    q = query(q, orderBy(sortField, sortDirection), limit(pageSize));

    const querySnapshot = await getDocs(q);

    const records = querySnapshot.docs.map(
      (doc: QueryDocumentSnapshot<DocumentData>) => {
        return convertToPracticeRecord(doc.id, doc.data());
      },
    );

    return records;
  } catch (error) {
    console.error("Error getting user practice records:", error);
    throw error;
  }
};

// Delete a practice record and its associated audio file
export const deletePracticeRecord = async (
  recordId: string,
  userId: string,
): Promise<void> => {
  // Delete audio file from storage (ignore errors if file doesn't exist)
  try {
    await deletePracticeAudio(userId, recordId);
  } catch (error) {
    console.warn("Failed to delete audio file (may not exist):", error);
  }

  // Delete Firestore document
  const docRef = doc(db, COLLECTION_NAME, recordId);
  await deleteDoc(docRef);
};

// Update practice record with recording URL
export const updatePracticeRecordUrl = async (
  recordId: string,
  recordingUrl: string,
): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, recordId);
  await updateDoc(docRef, { recordingUrl });
};

// Get practice count by topic for a user
// Note: For large datasets, consider implementing server-side aggregation
export const getPracticeCountByTopic = async (
  userId: string,
): Promise<Map<string, number>> => {
  const records = await getUserPracticeRecords(userId, { limit: 500 });
  const countMap = new Map<string, number>();

  records.forEach((record) => {
    const count = countMap.get(record.topicId) || 0;
    countMap.set(record.topicId, count + 1);
  });

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
): Promise<string> => {
  const now = Timestamp.now();

  // Check if script already exists
  const existingScript = await getTopicScript(userId, topicId);

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
