import { useState, useCallback } from "react";
import { geminiModel } from "../utils/firebaseUtil";
import type { ChatMessage } from "../types/chat";

export function useChat(pdfContext: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim()) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        // Create prompt with PDF context
        const prompt = `你是一個 PDF 閱讀助手。以下是 PDF 的內容：

${pdfContext}

使用者問題：${userMessage}

請根據上述 PDF 內容回答使用者的問題。如果問題與 PDF 內容無關，請禮貌地告知使用者。`;

        // Call Gemini API
        const result = await geminiModel.generateContent(prompt);
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
        console.error("Error calling Gemini API:", err);
        setError(err instanceof Error ? err.message : "發生錯誤，請稍後再試");
      } finally {
        setIsLoading(false);
      }
    },
    [pdfContext]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
