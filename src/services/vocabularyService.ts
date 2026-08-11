import {
  collection,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
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
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import { shuffleArray } from "../utils/arrayUtils";
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
): VocabularyWord => {
  return {
    id,
    word: data.word,
    userId: data.userId,
    emoji: data.emoji,
    definitions: data.definitions || [],
    examples: data.examples || [],
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
    lastReviewedAt: data.lastReviewedAt?.toDate(),
  };
};

async function reuseLegacyVocabularyDocument(
  document: QueryDocumentSnapshot<DocumentData>,
  normalizedWord: string,
): Promise<VocabularyWord | null> {
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

async function findLegacyVocabularyWordForAdd(
  userId: string,
  normalizedWord: string,
): Promise<QueryDocumentSnapshot<DocumentData> | null> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
    ),
  );

  return (
    snapshot.docs.find(
      (document: QueryDocumentSnapshot<DocumentData>) =>
        normalizeUniqueText(String(document.data().word ?? "")) ===
        normalizedWord,
    ) ?? null
  );
}

// Add a new word to vocabulary
export const addVocabularyWord = async (
  word: Omit<VocabularyWord, "id" | "createdAt" | "updatedAt" | "reviewCount">,
): Promise<{ id: string; created: boolean; word?: VocabularyWord }> => {
  const now = Timestamp.now();

  const docData = removeUndefinedFields({
    ...word,
    normalizedWord: normalizeUniqueText(word.word),
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

  // Existing releases used random document ids and did not store a normalized
  // value. Scan only on the actual add path, then reuse/backfill an equivalent
  // legacy record instead of creating a second deterministic document.
  const normalizedWord = normalizeUniqueText(word.word);
  const legacyDocument = await findLegacyVocabularyWordForAdd(
    word.userId,
    normalizedWord,
  );
  if (legacyDocument) {
    const legacyWord = await reuseLegacyVocabularyDocument(
      legacyDocument,
      normalizedWord,
    );
    if (legacyWord) {
      return {
        id: legacyDocument.id,
        created: false,
        word: legacyWord,
      };
    }
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
  const normalizedQuery = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
    where("normalizedWord", "==", normalizedWord),
    limit(1),
  );
  const normalizedSnapshot = await getDocs(normalizedQuery);
  if (!normalizedSnapshot.empty) {
    const document = normalizedSnapshot.docs[0];
    return convertToVocabularyWord(document.id, document.data());
  }

  // Preserve the cheap exact lookup for unmigrated legacy records. The full
  // normalized legacy scan is intentionally reserved for addVocabularyWord.
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

// Get all unique tags for a user (optimized: only fetches tags field)
export const getUserTags = async (userId: string): Promise<string[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
    );

    const querySnapshot = await getDocs(q);
    const tagsSet = new Set<string>();

    querySnapshot.docs.forEach((doc) => {
      const tags = doc.data().tags;
      if (Array.isArray(tags)) {
        tags.forEach((tag: string) => tagsSet.add(tag));
      }
    });

    return Array.from(tagsSet).sort();
  } catch (error) {
    console.error("Error getting user tags:", error);
    return [];
  }
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
