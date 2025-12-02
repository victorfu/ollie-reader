import { useState, useCallback, useRef, useEffect } from "react";
import { generateSpeechScript } from "../services/aiService";
import type { SpeechPracticeTopic, ScriptState } from "../types/speechPractice";
import { getDefaultScriptPrompt } from "../types/speechPractice";

export function useScriptGenerator(topic: SpeechPracticeTopic | null) {
  const [state, setState] = useState<ScriptState>({
    prompt: topic ? getDefaultScriptPrompt(topic) : "",
    generatedScript: "",
    isGenerating: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Update prompt when topic changes
  useEffect(() => {
    if (topic) {
      setState((prev) => ({
        ...prev,
        prompt: getDefaultScriptPrompt(topic),
        generatedScript: "",
        error: null,
      }));
    }
  }, [topic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const generateScript = useCallback(
    async (customPrompt?: string) => {
      const promptToUse = customPrompt || state.prompt;
      if (!promptToUse.trim()) return;

      // Abort any previous request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState((prev) => ({
        ...prev,
        isGenerating: true,
        error: null,
      }));

      try {
        const text = await generateSpeechScript(promptToUse, controller.signal);

        // Check if aborted after API call
        if (controller.signal.aborted) return;

        if (text) {
          setState((prev) => ({
            ...prev,
            generatedScript: text,
            isGenerating: false,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            error: "產生講稿時發生錯誤，請稍後再試",
          }));
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") return;

        console.error("Error generating script:", err);

        if (!controller.signal.aborted) {
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            error:
              err instanceof Error
                ? err.message
                : "產生講稿時發生錯誤，請稍後再試",
          }));
        }
      }
    },
    [state.prompt],
  );

  const setPrompt = useCallback((prompt: string) => {
    setState((prev) => ({ ...prev, prompt }));
  }, []);

  const setScript = useCallback((generatedScript: string) => {
    setState((prev) => ({ ...prev, generatedScript }));
  }, []);

  const resetState = useCallback(() => {
    abortControllerRef.current?.abort();
    setState({
      prompt: topic ? getDefaultScriptPrompt(topic) : "",
      generatedScript: "",
      isGenerating: false,
      error: null,
    });
  }, [topic]);

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setState((prev) => ({
      ...prev,
      isGenerating: false,
    }));
  }, []);

  return {
    ...state,
    generateScript,
    setPrompt,
    setScript,
    resetState,
    cancelGeneration,
  };
}
