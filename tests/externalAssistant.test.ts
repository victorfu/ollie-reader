import assert from "node:assert/strict";
import { test } from "vitest";

import {
  buildPageAssistantPrompt,
  copyTextWithFallback,
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
