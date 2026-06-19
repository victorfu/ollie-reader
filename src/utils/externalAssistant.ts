export type ExternalAssistantOpenBehavior = "deep-link" | "copy-then-open";

export type ExternalAssistantTargetId = "chatgpt" | "claude" | "gemini";

export type ExternalAssistantTarget = {
  id: ExternalAssistantTargetId;
  label: string;
  behavior: ExternalAssistantOpenBehavior;
  buildUrl: (prompt: string) => string;
};

type BuildPageAssistantPromptOptions = {
  pageNumber: number;
  text: string;
};

type ClipboardWriter = {
  writeText: (text: string) => Promise<void>;
};

type CopyFallbackDocument = {
  body?: {
    appendChild: (node: HTMLElement) => unknown;
  } | null;
  createElement: (tagName: string) => HTMLElement;
  execCommand?: (commandId: string) => boolean;
};

type CopyTextEnvironment = {
  clipboard?: ClipboardWriter;
  document?: CopyFallbackDocument;
  window?: Pick<Window, "focus">;
};

export const externalAssistantTargets: ExternalAssistantTarget[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    behavior: "deep-link",
    buildUrl: (prompt) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
  },
  {
    id: "claude",
    label: "Claude",
    behavior: "deep-link",
    buildUrl: (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
  },
  {
    id: "gemini",
    label: "Gemini",
    behavior: "copy-then-open",
    buildUrl: () => "https://gemini.google.com/",
  },
];

export function getExternalAssistantTarget(
  targetId: string,
): ExternalAssistantTarget {
  return (
    externalAssistantTargets.find((target) => target.id === targetId) ??
    externalAssistantTargets[0]
  );
}

export function buildExternalAssistantUrl(
  targetId: string,
  prompt: string,
): string {
  return getExternalAssistantTarget(targetId).buildUrl(prompt);
}

export function buildPageAssistantPrompt({
  pageNumber,
  text,
}: BuildPageAssistantPromptOptions): string {
  const pageText = text.trim() || "（此頁沒有可用文字）";

  return [
    "請用繁體中文幫我學習這一頁英文內容。",
    "請先用 3 點摘要頁面意思，再列出重要單字與片語，最後給 3 題理解問題。",
    "",
    `Page ${pageNumber}`,
    "",
    pageText,
  ].join("\n");
}

export async function copyTextWithFallback(
  text: string,
  environment: CopyTextEnvironment = {},
): Promise<boolean> {
  const focusWindow =
    environment.window ?? (typeof window !== "undefined" ? window : undefined);
  try {
    focusWindow?.focus();
  } catch {
    // Some embedded browsers block programmatic focus; copy can still proceed.
  }

  const fallbackDocument =
    environment.document ??
    (typeof document !== "undefined" ? document : undefined);

  if (fallbackDocument?.body && fallbackDocument.execCommand) {
    const textarea = fallbackDocument.createElement(
      "textarea",
    ) as HTMLTextAreaElement;
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";

    fallbackDocument.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    try {
      if (fallbackDocument.execCommand("copy")) {
        return true;
      }
    } finally {
      textarea.remove();
    }
  }

  const clipboard =
    environment.clipboard ??
    (typeof navigator !== "undefined" ? navigator.clipboard : undefined);

  if (!clipboard) {
    return false;
  }

  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
