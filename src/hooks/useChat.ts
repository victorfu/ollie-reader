import { useCallback, useEffect, useRef } from "react";
import { geminiModel } from "../utils/firebaseUtil";
import type { ChatMessage } from "../types/chat";
import { useAsyncState } from "./useAsyncState";
import type { ChatSession, Content } from "firebase/ai";

export function useChat(pdfContext: string) {
  const {
    data: messages,
    loading: isLoading,
    error,
    setData: setMessages,
    setLoading,
    setError,
    reset,
  } = useAsyncState<ChatMessage[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatSessionRef = useRef<ChatSession | null>(null);
  const pdfContextRef = useRef<string>(pdfContext);

  // Track if PDF context has been sent in this session
  const contextSentRef = useRef<boolean>(false);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Reset chat session when the underlying PDF content changes
  useEffect(() => {
    if (pdfContextRef.current !== pdfContext) {
      abortControllerRef.current?.abort();
      chatSessionRef.current = null;
      contextSentRef.current = false;
      pdfContextRef.current = pdfContext;
      reset();
    }
  }, [pdfContext, reset]);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim()) return;

      // Abort any previous request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Add user message
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      try {
        // Initialize chat session if not exists
        if (!chatSessionRef.current) {
          // Build history from existing messages for session continuity
          const history: Content[] = messages.map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          }));

          chatSessionRef.current = geminiModel.startChat({
            history,
            systemInstruction: {
              role: "user",
              parts: [
                {
                  text: `你是一個 PDF 閱讀助手。以下是 PDF 的內容：

${pdfContext}

請根據上述 PDF 內容回答使用者的問題。如果問題與 PDF 內容無關，請禮貌地告知使用者。`,
                },
              ],
            },
          });
          contextSentRef.current = true;
        }

        // Check if aborted before making API call
        if (controller.signal.aborted) return;

        // Send message using chat session (maintains history automatically)
        const result = await chatSessionRef.current.sendMessage(userMessage);

        // Check if aborted after API call
        if (controller.signal.aborted) return;

        const response = result.response;
        const text = response.text();

        // Add assistant message
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: text,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") return;

        console.error("Error calling Gemini API:", err);
        setError(err instanceof Error ? err.message : "發生錯誤，請稍後再試");

        // Reset chat session on error so it can be re-initialized
        chatSessionRef.current = null;
        contextSentRef.current = false;
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [pdfContext, messages, setMessages, setLoading, setError],
  );

  const clearMessages = useCallback(() => {
    abortControllerRef.current?.abort();
    chatSessionRef.current = null;
    contextSentRef.current = false;
    setMessages([]);
    setError(null);
  }, [setMessages, setError]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
