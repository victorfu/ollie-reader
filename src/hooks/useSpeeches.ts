import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  createSpeech,
  deleteSpeech as deleteSpeechService,
  duplicateSpeech as duplicateSpeechService,
  ensureSpeechesAndMigrate,
  renameSpeech as renameSpeechService,
} from "../services/speechService";
import type { Speech } from "../types/sentencePractice";

const STORAGE_KEY = "ollie:currentSpeechId";

export const useSpeeches = () => {
  const { user } = useAuth();
  const [speeches, setSpeeches] = useState<Speech[]>([]);
  const [currentSpeechId, setCurrentSpeechIdState] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setCurrentSpeechId = useCallback((id: string | null) => {
    setCurrentSpeechIdState(id);
    if (id) {
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const list = await ensureSpeechesAndMigrate(user.uid);
      setSpeeches(list);

      // Pick a current speech: prefer persisted choice, otherwise first.
      let preferred: string | null = null;
      try {
        preferred = localStorage.getItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      const next =
        (preferred && list.find((s) => s.id === preferred)?.id) ||
        list[0]?.id ||
        null;
      setCurrentSpeechId(next);
    } catch (err) {
      console.error("Failed to load speeches:", err);
      setError("載入演講版本失敗");
    } finally {
      setLoading(false);
    }
  }, [user, setCurrentSpeechId]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const create = useCallback(
    async (name: string): Promise<Speech | null> => {
      if (!user) return null;
      const speech = await createSpeech(user.uid, name);
      setSpeeches((prev) => [...prev, speech]);
      setCurrentSpeechId(speech.id);
      return speech;
    },
    [user, setCurrentSpeechId],
  );

  const duplicate = useCallback(
    async (sourceSpeechId: string, newName: string): Promise<Speech | null> => {
      if (!user) return null;
      const speech = await duplicateSpeechService(
        user.uid,
        sourceSpeechId,
        newName,
      );
      setSpeeches((prev) => [...prev, speech]);
      setCurrentSpeechId(speech.id);
      return speech;
    },
    [user, setCurrentSpeechId],
  );

  const rename = useCallback(async (speechId: string, name: string) => {
    await renameSpeechService(speechId, name);
    setSpeeches((prev) =>
      prev.map((s) =>
        s.id === speechId ? { ...s, name, updatedAt: new Date() } : s,
      ),
    );
  }, []);

  const remove = useCallback(
    async (speechId: string) => {
      await deleteSpeechService(speechId);
      setSpeeches((prev) => {
        const next = prev.filter((s) => s.id !== speechId);
        if (currentSpeechId === speechId) {
          setCurrentSpeechId(next[0]?.id || null);
        }
        return next;
      });
    },
    [currentSpeechId, setCurrentSpeechId],
  );

  return {
    speeches,
    currentSpeechId,
    setCurrentSpeechId,
    loading,
    error,
    refresh,
    create,
    duplicate,
    rename,
    remove,
  };
};
