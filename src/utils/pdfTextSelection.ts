export type WordBounds = {
  start: number;
  end: number;
};

type CaretPositionLike = {
  offsetNode: Node;
  offset: number;
};

type DocumentWithCaretApis = Document & {
  caretPositionFromPoint?: (
    x: number,
    y: number,
  ) => CaretPositionLike | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

const WORD_PATTERN =
  /[\p{L}\p{M}]+(?:['’\-‐-―][\p{L}\p{M}]+)*/gu;

export function findWordBounds(
  text: string,
  caretOffset: number,
): WordBounds | null {
  const offset = Math.max(0, Math.min(caretOffset, text.length));
  WORD_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = WORD_PATTERN.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (
      (offset >= start && offset < end) ||
      (offset === end && end > start)
    ) {
      return { start, end };
    }
  }

  return null;
}

function caretNodeAndOffset(
  document: DocumentWithCaretApis,
  x: number,
  y: number,
): { node: Text; offset: number } | null {
  const position = document.caretPositionFromPoint?.(x, y);
  if (position?.offsetNode.nodeType === Node.TEXT_NODE) {
    return {
      node: position.offsetNode as Text,
      offset: position.offset,
    };
  }

  const range = document.caretRangeFromPoint?.(x, y);
  if (range?.startContainer.nodeType === Node.TEXT_NODE) {
    return {
      node: range.startContainer as Text,
      offset: range.startOffset,
    };
  }

  return null;
}

export function selectWordAtPoint(
  pageRoot: HTMLElement,
  x: number,
  y: number,
  ownerDocument: Document = pageRoot.ownerDocument,
): string | null {
  const document = ownerDocument as DocumentWithCaretApis;
  const caret = caretNodeAndOffset(document, x, y);
  if (!caret) return null;

  const parent = caret.node.parentElement;
  const textLayer = parent?.closest(".textLayer");
  if (!textLayer || !pageRoot.contains(textLayer)) return null;

  const bounds = findWordBounds(caret.node.data, caret.offset);
  if (!bounds) return null;

  const range = document.createRange();
  range.setStart(caret.node, bounds.start);
  range.setEnd(caret.node, bounds.end);

  const selection = document.defaultView?.getSelection();
  if (!selection) return null;
  selection.removeAllRanges();
  selection.addRange(range);
  return range.toString();
}
