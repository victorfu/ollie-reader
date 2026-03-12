import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useDebounce } from "./useDebounce";
import { searchUserVocabulary } from "../services/vocabularyService";
import { logger } from "../utils/logger";
import type { VocabularyWord } from "../types/vocabulary";

export function useVocabularySearch() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VocabularyWord[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchRequestIdRef = useRef(0);

  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    if (!user || !debouncedQuery.trim()) {
      searchRequestIdRef.current += 1;
      setResults(null);
      setIsSearching(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);

    const performSearch = async () => {
      try {
        const searchResults = await searchUserVocabulary(
          user.uid,
          debouncedQuery.trim(),
          { mode: "prefix", limit: 20 },
        );
        if (requestId !== searchRequestIdRef.current) return;
        setResults(searchResults);
      } catch (error) {
        logger.error("Vocabulary search failed:", error);
        if (requestId !== searchRequestIdRef.current) return;
        setResults([]);
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    };

    performSearch();
  }, [user, debouncedQuery]);

  const clearSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    setQuery("");
    setResults(null);
    setIsSearching(false);
  }, []);

  return { query, setQuery, results, isSearching, clearSearch };
}
