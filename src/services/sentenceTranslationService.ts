import {
  collection,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDocsFromServer,
  getDoc,
  Timestamp,
  orderBy,
  limit,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
  writeBatch,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type {
  SentenceKeyWord,
  SentenceTranslation,
  SentenceTranslationFilters,
  SentenceTranslationResult,
} from "../types/sentenceTranslation";
import { DEFAULT_PAGE_SIZE } from "../types/sentenceTranslation";
import {
  createOwnedTextDocumentId,
  normalizeUniqueText,
} from "../utils/firestoreIdentity";

const COLLECTION_NAME = "sentenceTranslations";
const legacySentenceIndexPromises = new Map<
  string,
  Promise<Map<string, QueryDocumentSnapshot<DocumentData>>>
>();

function getLegacySentenceIndex(
  userId: string,
): Promise<Map<string, QueryDocumentSnapshot<DocumentData>>> {
  const existing = legacySentenceIndexPromises.get(userId);
  if (existing) return existing;

  // This snapshot is cached for the page lifetime, so it must be authoritative.
  // Caching an offline partial result could later let the deterministic
  // transaction create a duplicate of a legacy auto-id record after reconnect.
  const loading = getDocsFromServer(
    query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
    ),
  )
    .then((snapshot) => {
      const index = new Map<
        string,
        QueryDocumentSnapshot<DocumentData>
      >();
      for (const document of snapshot.docs) {
        const normalized = normalizeUniqueText(
          String(document.data().english ?? ""),
        );
        if (normalized && !index.has(normalized)) {
          index.set(normalized, document);
        }
      }
      return index;
    })
    .catch((error: unknown) => {
      legacySentenceIndexPromises.delete(userId);
      throw error;
    });

  legacySentenceIndexPromises.set(userId, loading);
  return loading;
}

function isMissingDocumentError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "not-found"
  );
}

// Convert Firestore data to SentenceTranslation
const convertToSentenceTranslation = (
  id: string,
  data: DocumentData
): SentenceTranslation => {
  return {
    id,
    userId: data.userId,
    english: data.english,
    chinese: data.chinese,
    keyWords: Array.isArray(data.keyWords)
      ? (data.keyWords as SentenceKeyWord[])
      : undefined,
    sourcePdfName: data.sourcePdfName,
    createdAt: data.createdAt?.toDate() || new Date(),
  };
};

async function reuseLegacyDocument(
  document: QueryDocumentSnapshot<DocumentData>,
  normalizedEnglish: string,
): Promise<SentenceTranslation | null> {
  try {
    await updateDoc(document.ref, { normalizedEnglish });
  } catch (error) {
    // A cached one-time index can outlive a deletion in another tab. Only a
    // confirmed not-found invalidates it; network ambiguity must not create a
    // normalized duplicate of a legacy record that may still exist.
    if (isMissingDocumentError(error)) return null;
  }
  return convertToSentenceTranslation(document.id, document.data());
}

// Check if translation exists and return it (cache lookup)
export const findExistingTranslation = async (
  userId: string,
  english: string
): Promise<SentenceTranslation | null> => {
  const trimmedEnglish = english.trim();
  const normalizedEnglish = normalizeUniqueText(trimmedEnglish);

  if (!normalizedEnglish) return null;

  // New records use a deterministic id, so the common lookup stays O(1) and
  // does not need a collection query.
  const deterministicId = await createOwnedTextDocumentId(
    "sentence-translation",
    userId,
    trimmedEnglish,
  );
  const deterministicSnapshot = await getDoc(
    doc(db, COLLECTION_NAME, deterministicId),
  );
  if (deterministicSnapshot.exists()) {
    const data = deterministicSnapshot.data();
    if (data.userId === userId) {
      return convertToSentenceTranslation(
        deterministicSnapshot.id,
        data,
      );
    }
  }

  // A migrated auto-id record can also use the normalized lookup without a
  // full legacy scan.
  const normalizedQuery = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
    where("normalizedEnglish", "==", normalizedEnglish),
    limit(1),
  );
  const normalizedSnapshot = await getDocs(normalizedQuery);
  if (!normalizedSnapshot.empty) {
    const document = normalizedSnapshot.docs[0];
    return convertToSentenceTranslation(document.id, document.data());
  }

  const q = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
    where("english", "==", trimmedEnglish),
    limit(1)
  );

  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    // Best-effort migration makes later normalized lookups cheap. Failure to
    // backfill must not hide a valid legacy translation from the user.
    void updateDoc(docSnap.ref, { normalizedEnglish }).catch(() => undefined);
    return convertToSentenceTranslation(docSnap.id, docSnap.data());
  }

  // Older auto-id records may differ only by capitalization or whitespace and
  // lack normalizedEnglish. Build this account index at most once per page
  // lifetime so repeated translation lookups do not repeatedly scan the full
  // collection.
  const legacyIndex = await getLegacySentenceIndex(userId);
  const legacyDocument = legacyIndex.get(normalizedEnglish);
  if (legacyDocument) {
    const legacySentence = await reuseLegacyDocument(
      legacyDocument,
      normalizedEnglish,
    );
    if (legacySentence) return legacySentence;
    legacyIndex.delete(normalizedEnglish);
  }

  return null;
};

// Add a new sentence translation
export const addSentenceTranslation = async (
  sentence: Omit<SentenceTranslation, "id" | "createdAt">
): Promise<{
  id: string;
  created: boolean;
  sentence?: SentenceTranslation;
}> => {
  const now = Timestamp.now();

  const docData = {
    userId: sentence.userId,
    english: sentence.english.trim(),
    normalizedEnglish: normalizeUniqueText(sentence.english),
    chinese: sentence.chinese,
    keyWords: sentence.keyWords?.length ? sentence.keyWords : undefined,
    sourcePdfName: sentence.sourcePdfName,
    createdAt: now,
  };

  // Remove undefined fields
  const cleanedData = Object.fromEntries(
    Object.entries(docData).filter(([, v]) => v !== undefined)
  );

  const documentId = await createOwnedTextDocumentId(
    "sentence-translation",
    sentence.userId,
    sentence.english,
  );
  const docRef = doc(db, COLLECTION_NAME, documentId);

  // Existing releases used random document ids and preserved the input's
  // capitalization/spacing. The shared legacy index is loaded at most once per
  // page lifetime, so this compatibility check does not repeatedly scan the
  // account.
  const normalizedEnglish = normalizeUniqueText(sentence.english);
  const legacyIndex = await getLegacySentenceIndex(sentence.userId);
  const legacyDocument = legacyIndex.get(normalizedEnglish);
  if (legacyDocument) {
    const legacySentence = await reuseLegacyDocument(
      legacyDocument,
      normalizedEnglish,
    );
    if (legacySentence) {
      return {
        id: legacyDocument.id,
        created: false,
        sentence: legacySentence,
      };
    }
    legacyIndex.delete(normalizedEnglish);
  }

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(docRef);
    if (existing.exists()) {
      const existingData = existing.data();
      if (
        existingData.userId !== sentence.userId ||
        normalizeUniqueText(String(existingData.english ?? "")) !==
          normalizedEnglish
      ) {
        throw new Error("句子唯一識別碼已被不相符的資料占用");
      }
      return {
        id: existing.id,
        created: false,
        sentence: convertToSentenceTranslation(existing.id, existingData),
      };
    }

    transaction.set(docRef, cleanedData);
    return { id: docRef.id, created: true };
  });
};

export const searchUserSentenceTranslations = async (
  userId: string,
  searchText: string,
): Promise<SentenceTranslation[]> => {
  const normalizedSearch = searchText.trim().toLocaleLowerCase("en-US");
  if (!normalizedSearch) return [];

  const snapshot = await getDocs(
    query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    ),
  );

  return snapshot.docs
    .map((document) =>
      convertToSentenceTranslation(document.id, document.data()),
    )
    .filter(
      (sentence) =>
        sentence.english.toLocaleLowerCase("en-US").includes(normalizedSearch) ||
        sentence.chinese.includes(searchText.trim()),
    );
};

// Get user's sentence translations with pagination
export const getUserSentenceTranslations = async (
  userId: string,
  filters?: SentenceTranslationFilters
): Promise<SentenceTranslationResult> => {
  try {
    const pageSize = filters?.limit || DEFAULT_PAGE_SIZE;
    const sortField = filters?.sortBy || "createdAt";
    const sortDirection = filters?.sortOrder || "desc";
    const hasClientSearch = Boolean(filters?.searchQuery?.trim());

    let q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
      orderBy(sortField, sortDirection),
      ...(hasClientSearch ? [] : [limit(pageSize + 1)]),
    );

    // Apply cursor for pagination
    if (filters?.cursor && !hasClientSearch) {
      const cursorDoc = await getDoc(doc(db, COLLECTION_NAME, filters.cursor));
      if (cursorDoc.exists()) {
        q = query(
          collection(db, COLLECTION_NAME),
          where("userId", "==", userId),
          orderBy(sortField, sortDirection),
          startAfter(cursorDoc),
          limit(pageSize + 1)
        );
      }
    }

    const querySnapshot = await getDocs(q);

    const hasMore = !hasClientSearch && querySnapshot.docs.length > pageSize;
    const docs = hasMore
      ? querySnapshot.docs.slice(0, pageSize)
      : querySnapshot.docs;

    let sentences = docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
      return convertToSentenceTranslation(doc.id, doc.data());
    });

    const lastDocId =
      !hasClientSearch && docs.length > 0
        ? docs[docs.length - 1].id
        : undefined;

    // Apply client-side search filter
    if (filters?.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      sentences = sentences.filter(
        (s) =>
          s.english.toLowerCase().includes(searchLower) ||
          s.chinese.includes(filters.searchQuery!)
      );
    }

    return {
      sentences,
      hasMore,
      lastDocId,
    };
  } catch (error) {
    console.error("Error getting sentence translations:", error);
    throw error;
  }
};

// Delete a sentence translation
export const deleteSentenceTranslation = async (id: string): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
  for (const indexPromise of legacySentenceIndexPromises.values()) {
    void indexPromise
      .then((index) => {
        for (const [normalized, document] of index) {
          if (document.id === id) index.delete(normalized);
        }
      })
      .catch(() => undefined);
  }
};

// Delete all sentence translations for a user
export const deleteAllSentenceTranslations = async (
  userId: string
): Promise<void> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId)
  );

  const querySnapshot = await getDocs(q);
  const batch = writeBatch(db);

  querySnapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  await batch.commit();
  legacySentenceIndexPromises.delete(userId);
};
