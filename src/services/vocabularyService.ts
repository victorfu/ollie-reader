import {
  collection,
  updateDoc,
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
  startAt,
  endAt,
  increment,
  getCountFromServer,
  runTransaction,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import { shuffleArray } from "../utils/arrayUtils";
import { normalizeExamples } from "../utils/normalizeExamples";
import type {
  VocabularyWord,
  VocabularyFilters,
  VocabularyResult,
  ReviewMode,
  VocabularySearchOptions,
} from "../types/vocabulary";
import { DEFAULT_PAGE_SIZE } from "../types/vocabulary";
import {
  createOwnedTextDocumentId,
  normalizeUniqueText,
} from "../utils/firestoreIdentity";

const COLLECTION_NAME = "vocabulary";
// Firestore rejects a write batch with more operations than this.
const MAX_BATCH_WRITES = 500;
const NORMALIZED_ACCOUNT_STORAGE_PREFIX =
  "ollie-reader:vocabulary-normalized-v1:";

type StoredVocabularyWord = VocabularyWord & { id: string };

interface LegacyScan {
  documents: QueryDocumentSnapshot<DocumentData>[];
  backfilled: boolean;
}

// Accounts known to be backfilled while the browser refuses storage.
const normalizedAccountsWithoutStorage = new Set<string>();
const legacyScans = new Map<string, Promise<LegacyScan>>();

function isMissingDocumentError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "not-found"
  );
}

// Helper function to remove undefined values from an object
const removeUndefinedFields = <T extends Record<string, unknown>>(
  obj: T,
): Partial<T> => {
  const result: Partial<T> = {};

  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }

  return result;
};

// Convert Firestore data to VocabularyWord
const convertToVocabularyWord = (
  id: string,
  data: DocumentData,
): StoredVocabularyWord => {
  return {
    id,
    word: data.word,
    userId: data.userId,
    emoji: data.emoji,
    definitions: data.definitions || [],
    examples: normalizeExamples(data.examples),
    synonyms: data.synonyms || [],
    antonyms: data.antonyms || [],
    sourceContext: data.sourceContext,
    sourcePdfName: data.sourcePdfName,
    sourcePage: data.sourcePage,
    tags: data.tags || [],
    difficulty: data.difficulty,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    reviewCount: data.reviewCount || 0,
    rememberedCount: data.rememberedCount ?? 0,
    forgotCount: data.forgotCount ?? 0,
    lastReviewedAt: data.lastReviewedAt?.toDate(),
  };
};

const normalizeStoredWord = (data: DocumentData): string =>
  normalizeUniqueText(String(data.word ?? ""));

function isAccountNormalized(userId: string): boolean {
  if (normalizedAccountsWithoutStorage.has(userId)) return true;
  try {
    return (
      window.localStorage.getItem(NORMALIZED_ACCOUNT_STORAGE_PREFIX + userId) ===
      "1"
    );
  } catch {
    return false;
  }
}

function markAccountNormalized(userId: string): void {
  try {
    window.localStorage.setItem(NORMALIZED_ACCOUNT_STORAGE_PREFIX + userId, "1");
  } catch {
    // Storage is blocked or full: skip the scan for the rest of this page load.
    normalizedAccountsWithoutStorage.add(userId);
  }
}

async function reuseLegacyVocabularyDocument(
  document: QueryDocumentSnapshot<DocumentData>,
  normalizedWord: string,
): Promise<StoredVocabularyWord | null> {
  try {
    await updateDoc(document.ref, { normalizedWord });
  } catch (error) {
    // A legacy record can disappear between the account scan and migration.
    // Only a confirmed missing document permits creating a replacement;
    // ambiguous network failures must not create a duplicate.
    if (isMissingDocumentError(error)) return null;
  }

  return convertToVocabularyWord(document.id, document.data());
}

// Records from releases before normalizedWord have random ids and lack the
// field. The first add in each browser reads the account once, straight from
// the server so an offline cache cannot pass for the whole book, and writes
// normalizedWord (and nothing else) on every record missing it. Once that
// succeeds the account is remembered and later adds skip the scan.
// Concurrent adds share one scan.
function scanLegacyVocabulary(userId: string): Promise<LegacyScan> {
  const pending = legacyScans.get(userId);
  if (pending) return pending;

  const scan = (async (): Promise<LegacyScan> => {
    const snapshot = await getDocsFromServer(
      query(
        collection(db, COLLECTION_NAME),
        where("userId", "==", userId),
      ),
    );
    const backfills = snapshot.docs.flatMap((document) => {
      const data = document.data();
      const normalizedWord = normalizeStoredWord(data);
      return normalizedWord && data.normalizedWord !== normalizedWord
        ? [{ document, normalizedWord }]
        : [];
    });

    try {
      for (let start = 0; start < backfills.length; start += MAX_BATCH_WRITES) {
        const batch = writeBatch(db);
        for (const { document, normalizedWord } of backfills.slice(
          start,
          start + MAX_BATCH_WRITES,
        )) {
          batch.update(document.ref, { normalizedWord });
        }
        await batch.commit();
      }
    } catch (error) {
      // Committed batches keep their field; the next add scans again.
      console.warn("Vocabulary normalizedWord backfill failed:", error);
      return { documents: snapshot.docs, backfilled: false };
    }

    markAccountNormalized(userId);
    return { documents: snapshot.docs, backfilled: true };
  })().finally(() => {
    legacyScans.delete(userId);
  });

  legacyScans.set(userId, scan);
  return scan;
}

async function findLegacyVocabularyWordForAdd(
  userId: string,
  normalizedWord: string,
): Promise<StoredVocabularyWord | null> {
  const scan = await scanLegacyVocabulary(userId);
  const legacyDocument = scan.documents.find(
    (document) => normalizeStoredWord(document.data()) === normalizedWord,
  );
  if (!legacyDocument) return null;
  if (scan.backfilled) {
    return convertToVocabularyWord(legacyDocument.id, legacyDocument.data());
  }
  return reuseLegacyVocabularyDocument(legacyDocument, normalizedWord);
}

// New records and backfilled legacy records carry normalizedWord, so one
// bounded query finds an equivalent saved word.
async function findNormalizedVocabularyWord(
  userId: string,
  normalizedWord: string,
): Promise<StoredVocabularyWord | null> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
      where("normalizedWord", "==", normalizedWord),
      limit(1),
    ),
  );
  if (snapshot.empty) return null;
  const document = snapshot.docs[0];
  return convertToVocabularyWord(document.id, document.data());
}

// Add a new word to vocabulary
export const addVocabularyWord = async (
  word: Omit<VocabularyWord, "id" | "createdAt" | "updatedAt" | "reviewCount">,
): Promise<{ id: string; created: boolean; word?: VocabularyWord }> => {
  const now = Timestamp.now();
  const normalizedWord = normalizeUniqueText(word.word);

  const docData = removeUndefinedFields({
    ...word,
    normalizedWord,
    createdAt: now,
    updatedAt: now,
    reviewCount: 0,
  });

  const documentId = await createOwnedTextDocumentId(
    "vocabulary",
    word.userId,
    word.word,
  );
  const docRef = doc(db, COLLECTION_NAME, documentId);

  // Reuse an equivalent saved record, including a legacy auto-id one, instead
  // of creating a second deterministic document.
  const existingWord = isAccountNormalized(word.userId)
    ? await findNormalizedVocabularyWord(word.userId, normalizedWord)
    : await findLegacyVocabularyWordForAdd(word.userId, normalizedWord);
  if (existingWord) {
    return { id: existingWord.id, created: false, word: existingWord };
  }

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(docRef);
    if (existing.exists()) {
      return {
        id: existing.id,
        created: false,
        word: convertToVocabularyWord(existing.id, existing.data()),
      };
    }

    transaction.set(docRef, docData);
    return { id: docRef.id, created: true };
  });
};

// Get all vocabulary words for a user with pagination
export const getUserVocabulary = async (
  userId: string,
  filters?: VocabularyFilters,
): Promise<VocabularyResult> => {
  try {
    const pageSize = filters?.limit || DEFAULT_PAGE_SIZE;
    const sortField = filters?.sortBy || "createdAt";
    const sortDirection = filters?.sortOrder || "desc";
    const hasClientFilters = !!(filters?.searchQuery || (filters?.tags && filters.tags.length > 0));

    // Build base query with server-side ordering
    let q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
    );

    // Apply difficulty filter (server-side compound query)
    if (filters?.difficulty) {
      q = query(q, where("difficulty", "==", filters.difficulty));
    }

    // When client-side filters are active, fetch all documents to filter correctly.
    // Pagination only works reliably with server-side filters.
    if (hasClientFilters) {
      q = query(q, orderBy(sortField, sortDirection));
    } else {
      // Add server-side ordering and pagination
      q = query(
        q,
        orderBy(sortField, sortDirection),
        limit(pageSize + 1), // Fetch one extra to check if more exist
      );

      // Apply cursor for pagination
      if (filters?.cursor) {
        const cursorDoc = await getDoc(doc(db, COLLECTION_NAME, filters.cursor));
        if (cursorDoc.exists()) {
          q = query(
            collection(db, COLLECTION_NAME),
            where("userId", "==", userId),
            ...(filters?.difficulty
              ? [where("difficulty", "==", filters.difficulty)]
              : []),
            orderBy(sortField, sortDirection),
            startAfter(cursorDoc),
            limit(pageSize + 1),
          );
        }
      }
    }

    const querySnapshot = await getDocs(q);

    let words = querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
      return convertToVocabularyWord(doc.id, doc.data());
    });

    // Apply client-side filters
    if (filters?.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      words = words.filter((word) =>
        word.word.toLowerCase().includes(searchLower),
      );
    }

    if (filters?.tags && filters.tags.length > 0) {
      words = words.filter((word) =>
        filters.tags!.some((tag) => word.tags.includes(tag)),
      );
    }

    if (hasClientFilters) {
      // Client-side filtered: no pagination, return all matching results
      return {
        words,
        hasMore: false,
        lastDocId: undefined,
      };
    }

    // Server-side pagination: check if there are more results
    const hasMore = words.length > pageSize;
    if (hasMore) {
      words = words.slice(0, pageSize);
    }
    const lastDocId = words.length > 0 ? words[words.length - 1].id : undefined;

    return {
      words,
      hasMore,
      lastDocId,
    };
  } catch (error) {
    console.error("Error getting user vocabulary:", error);
    throw error;
  }
};

/**
 * Calculate review priority score for a word
 * Higher score = more urgent to review
 */
const calculateReviewPriority = (word: VocabularyWord): number => {
  let score = 0;

  // Never reviewed: highest priority
  if (!word.lastReviewedAt) {
    score += 100;
  } else {
    // Days since last review (more days = higher priority)
    const daysSinceReview = Math.floor(
      (Date.now() - new Date(word.lastReviewedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    score += daysSinceReview * 5;
  }

  // Forgot count increases priority
  score += (word.forgotCount || 0) * 20;

  // Remembered count decreases priority
  score -= (word.rememberedCount || 0) * 10;

  return score;
};

// Get vocabulary words for review with smart or tag-based selection
export const getVocabularyForReview = async (
  userId: string,
  maxWords: number = 10,
  mode: ReviewMode = "smart",
  selectedTag?: string,
): Promise<VocabularyWord[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
    );

    const querySnapshot = await getDocs(q);

    const words = querySnapshot.docs.map(
      (doc: QueryDocumentSnapshot<DocumentData>) => {
        return convertToVocabularyWord(doc.id, doc.data());
      },
    );

    if (words.length === 0) return [];

    // Tag mode: filter by tag and return all matching words
    if (mode === "tag" && selectedTag) {
      const taggedWords = words.filter((word) => word.tags.includes(selectedTag));
      return shuffleArray(taggedWords);
    }

    // Smart mode: Sort by priority score (highest first) and take top N
    const sorted = words
      .map((word) => ({ word, score: calculateReviewPriority(word) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxWords)
      .map((item) => item.word);

    // Shuffle the selected words so they don't always appear in same order
    return shuffleArray(sorted);
  } catch (error) {
    console.error("Error getting vocabulary for review:", error);
    throw error;
  }
};

// Get every vocabulary word for a user, without filtering or pagination
export const getAllVocabularyWords = async (
  userId: string,
): Promise<VocabularyWord[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(
      (doc: QueryDocumentSnapshot<DocumentData>) => {
        return convertToVocabularyWord(doc.id, doc.data());
      },
    );
  } catch (error) {
    console.error("Error getting all vocabulary words:", error);
    throw error;
  }
};

// Update review statistics for a word (atomic increments)
export const updateReviewStats = async (
  wordId: string,
  remembered: boolean,
): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, wordId);

  const updates: Record<string, unknown> = {
    lastReviewedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    reviewCount: increment(1),
    ...(remembered
      ? { rememberedCount: increment(1) }
      : { forgotCount: increment(1) }),
  };

  await updateDoc(docRef, updates);
};

// Get a single vocabulary word
export const getVocabularyWord = async (
  wordId: string,
): Promise<VocabularyWord | null> => {
  const docRef = doc(db, COLLECTION_NAME, wordId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return convertToVocabularyWord(docSnap.id, docSnap.data());
  }
  return null;
};

// Update a vocabulary word
export const updateVocabularyWord = async (
  wordId: string,
  updates: Partial<VocabularyWord>,
): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, wordId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt, ...updateData } = updates;

  const cleanedData = removeUndefinedFields({
    ...updateData,
    updatedAt: Timestamp.now(),
  });

  await updateDoc(docRef, cleanedData);
};

// Delete a vocabulary word
export const deleteVocabularyWord = async (wordId: string): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, wordId);
  await deleteDoc(docRef);
};

// Check if word already exists for user
export const checkWordExists = async (
  userId: string,
  word: string,
): Promise<VocabularyWord | null> => {
  const trimmedWord = word.trim();
  const normalizedWord = normalizeUniqueText(trimmedWord);
  if (!normalizedWord) return null;

  // New records use a deterministic id, so the common lookup is O(1).
  const deterministicId = await createOwnedTextDocumentId(
    "vocabulary",
    userId,
    trimmedWord,
  );
  const deterministicSnapshot = await getDoc(
    doc(db, COLLECTION_NAME, deterministicId),
  );
  if (deterministicSnapshot.exists()) {
    const data = deterministicSnapshot.data();
    if (data.userId === userId) {
      return convertToVocabularyWord(deterministicSnapshot.id, data);
    }
  }

  // Migrated auto-id records are found by their normalized field without an
  // account-wide scan.
  const normalizedMatch = await findNormalizedVocabularyWord(
    userId,
    normalizedWord,
  );
  if (normalizedMatch) return normalizedMatch;

  // Preserve the cheap exact lookup for unmigrated legacy records. The
  // one-time account scan is intentionally reserved for addVocabularyWord.
  const exactQuery = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
    where("word", "==", trimmedWord.toLowerCase()),
    limit(1),
  );

  const querySnapshot = await getDocs(exactQuery);
  if (!querySnapshot.empty) {
    const document = querySnapshot.docs[0];
    void updateDoc(document.ref, { normalizedWord }).catch(() => undefined);
    return convertToVocabularyWord(document.id, document.data());
  }
  return null;
};

// Get the tags of every word, keyed by word id. This reads the whole book, so
// load it once and only when the complete tag list is needed.
export const getUserWordTags = async (
  userId: string,
): Promise<Map<string, string[]>> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
  );

  const querySnapshot = await getDocs(q);

  return new Map(
    querySnapshot.docs.map((doc): [string, string[]] => {
      const tags = doc.data().tags;
      return [doc.id, Array.isArray(tags) ? tags : []];
    }),
  );
};

// Get total vocabulary count for a user
export const getUserVocabularyCount = async (userId: string): Promise<number> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
    );

    const countSnapshot = await getCountFromServer(q);
    return countSnapshot.data().count;
  } catch (error) {
    console.error("Error getting vocabulary count:", error);
    throw error;
  }
};

// Search vocabulary words for a user with configurable mode and limit
export const searchUserVocabulary = async (
  userId: string,
  searchQuery: string,
  options: VocabularySearchOptions = {},
): Promise<VocabularyWord[]> => {
  try {
    if (!searchQuery.trim()) {
      return [];
    }

    const searchLower = searchQuery.toLowerCase().trim();
    const maxResults =
      options.limit === null ? null : (options.limit ?? DEFAULT_PAGE_SIZE);
    const mode = options.mode || "prefix";
    let filteredWords: VocabularyWord[] = [];
    let shouldUseContainsFallback = mode === "contains";

    if (mode === "prefix") {
      try {
        const prefixQuery = query(
          collection(db, COLLECTION_NAME),
          where("userId", "==", userId),
          orderBy("word"),
          startAt(searchLower),
          endAt(`${searchLower}\uf8ff`),
          limit(maxResults ?? DEFAULT_PAGE_SIZE),
        );
        const querySnapshot = await getDocs(prefixQuery);
        filteredWords = querySnapshot.docs.map(
          (doc: QueryDocumentSnapshot<DocumentData>) =>
            convertToVocabularyWord(doc.id, doc.data()),
        );
      } catch (prefixError) {
        console.warn("Prefix search failed, falling back to contains search:", prefixError);
        shouldUseContainsFallback = true;
      }
    }

    if (shouldUseContainsFallback) {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("userId", "==", userId),
      );
      const querySnapshot = await getDocs(q);
      const words = querySnapshot.docs.map(
        (doc: QueryDocumentSnapshot<DocumentData>) =>
          convertToVocabularyWord(doc.id, doc.data()),
      );

      filteredWords = words.filter((word) =>
        word.word.toLowerCase().includes(searchLower),
      );
    }

    // Sort by relevance: exact match first, then starts with, then contains
    filteredWords.sort((a, b) => {
      const aWord = a.word.toLowerCase();
      const bWord = b.word.toLowerCase();

      // Exact match gets highest priority
      if (aWord === searchLower && bWord !== searchLower) return -1;
      if (bWord === searchLower && aWord !== searchLower) return 1;

      // Starts with gets second priority
      const aStartsWith = aWord.startsWith(searchLower);
      const bStartsWith = bWord.startsWith(searchLower);
      if (aStartsWith && !bStartsWith) return -1;
      if (bStartsWith && !aStartsWith) return 1;

      // Alphabetical order for same relevance
      return aWord.localeCompare(bWord);
    });

    return maxResults === null
      ? filteredWords
      : filteredWords.slice(0, maxResults);
  } catch (error) {
    console.error("Error searching user vocabulary:", error);
    throw error;
  }
};
