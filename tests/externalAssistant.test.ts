import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExternalAssistantUrl,
  buildPageAssistantPrompt,
  copyTextWithFallback,
  externalAssistantTargets,
  getExternalAssistantTarget,
} from "../src/utils/externalAssistant.ts";

test("builds an English-learning prompt for a reader page", () => {
  const prompt = buildPageAssistantPrompt({
    pageNumber: 2,
    text: "People and Their Homes",
  });

  assert.match(prompt, /Page 2/);
  assert.match(prompt, /People and Their Homes/);
  assert.match(prompt, /繁體中文/);
});

test("defaults to ChatGPT and deep-links prompt-capable chat tools", () => {
  assert.equal(externalAssistantTargets[0]?.id, "chatgpt");

  const chatGpt = getExternalAssistantTarget("chatgpt");
  assert.equal(chatGpt.label, "ChatGPT");
  assert.equal(chatGpt.behavior, "deep-link");

  const url = buildExternalAssistantUrl("chatgpt", "Explain this page");
  assert.equal(url, "https://chatgpt.com/?q=Explain%20this%20page");
});

test("opens Gemini homepage because it needs copied text pasted manually", () => {
  const gemini = getExternalAssistantTarget("gemini");

  assert.equal(gemini.label, "Gemini");
  assert.equal(gemini.behavior, "copy-then-open");
  assert.equal(
    buildExternalAssistantUrl("gemini", "Explain this page"),
    "https://gemini.google.com/",
  );
});

test("falls back to a temporary textarea when Clipboard API fails", async () => {
  let selectedText = "";
  let focused = false;
  let selectedRange: [number, number] | null = null;
  let removed = false;
  let command = "";
  let clipboardCalls = 0;
  let windowFocused = false;
  const textarea = {
    value: "",
    style: {},
    focus() {
      focused = true;
    },
    setAttribute() {},
    setSelectionRange(start: number, end: number) {
      selectedRange = [start, end];
    },
    select() {
      selectedText = this.value;
    },
    remove() {
      removed = true;
    },
  };
  const fakeDocument = {
    body: {
      appendChild(node: unknown) {
        assert.equal(node, textarea);
      },
    },
    createElement(tagName: string) {
      assert.equal(tagName, "textarea");
      return textarea;
    },
    execCommand(nextCommand: string) {
      command = nextCommand;
      return true;
    },
  };

  const copied = await copyTextWithFallback("fallback prompt", {
    clipboard: {
      async writeText() {
        clipboardCalls += 1;
        throw new Error("blocked");
      },
    },
    document: fakeDocument,
    window: {
      focus() {
        windowFocused = true;
      },
    },
  });

  assert.equal(copied, true);
  assert.equal(clipboardCalls, 0);
  assert.equal(windowFocused, true);
  assert.equal(command, "copy");
  assert.equal(focused, true);
  assert.equal(selectedText, "fallback prompt");
  assert.deepEqual(selectedRange, [0, "fallback prompt".length]);
  assert.equal(removed, true);
});
