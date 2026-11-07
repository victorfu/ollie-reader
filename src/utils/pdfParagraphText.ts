/** Semantic text extraction only: never change the selectable PDF DOM. */
export type ParagraphItem = {
  str: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
};

type Run = { text: string; separator: string };
type Line = { items: ParagraphItem[]; runs: Run[] };
const registeredRuns = new WeakMap<Element, Run>();

function size(item: ParagraphItem): number {
  return item.transform ? Math.hypot(item.transform[2], item.transform[3]) : 0;
}

function lineSeparator(previous: Line, next: Line): string {
  const a = previous.items[0];
  const b = next.items[0];
  const height = Math.max(size(a), size(b));
  // Missing/rotated geometry is ambiguous: preserve the original line break.
  if (!height || !a.transform || !b.transform || a.transform[1] || b.transform[1]) return "\n";
  const dy = a.transform[5] - b.transform[5];
  const dx = b.transform[4] - a.transform[4];
  const nextText = next.runs.map(run => run.text).join("");
  const listStart = /^\s*(?:[•●▪◦*-]|\d+[.)])\s+/.test(nextText);
  if (dy <= height * 0.5 || dy > height * 1.6 || Math.abs(dx) > height * 0.8 ||
      Math.abs(size(a) - size(b)) > height * 0.15 || listStart) return "\n\n";
  return " ";
}

export function paragraphRuns(items: readonly ParagraphItem[]): Run[] {
  const lines: Line[] = [];
  let current: Line = { items: [], runs: [] };
  const flush = () => {
    if (current.runs.length) lines.push(current);
    current = { items: [], runs: [] };
  };
  for (const item of items) {
    const prior = current.items.at(-1);
    if (item.str && prior?.transform && item.transform &&
        Math.abs(prior.transform[5] - item.transform[5]) > Math.max(size(prior), size(item)) * 0.5) flush();
    if (item.str) {
      current.items.push(item);
      current.runs.push({ text: item.str, separator: "" });
    }
    if (item.hasEOL) flush();
  }
  flush();
  lines.forEach((line, index) => {
    if (index) line.runs[0].separator = lineSeparator(lines[index - 1], line);
  });
  return lines.flatMap(line => line.runs);
}

export function pdfParagraphText(items: readonly ParagraphItem[]): string {
  return paragraphRuns(items).map(run => run.separator + run.text).join("").trim();
}

export function registerParagraphLayer(layer: HTMLElement, items: readonly ParagraphItem[]): void {
  const spans = [...layer.querySelectorAll("span[role='presentation']")].filter(
    span => !span.parentElement?.closest("span[role='presentation']"),
  );
  const runs = paragraphRuns(items);
  if (spans.length !== runs.length || spans.some((span, i) => span.textContent !== runs[i].text)) return;
  spans.forEach((span, i) => registeredRuns.set(span, runs[i]));
}

/** null means a non-PDF or unregistered selection: leave native behavior intact. */
export function pdfSelectionText(selection: Selection | null): string | null {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  const element = (node: Node) => node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  const startLayer = element(range.startContainer)?.closest(".textLayer");
  const endLayer = element(range.endContainer)?.closest(".textLayer");
  if (!startLayer || !endLayer) return null;
  const doc = startLayer.ownerDocument;
  let text = "";
  let previousLayer: Element | null = null;
  for (const span of doc.querySelectorAll(".textLayer span[role='presentation']")) {
    if (!range.intersectsNode(span)) continue;
    const run = registeredRuns.get(span);
    if (!run) return null;
    const part = doc.createRange();
    part.selectNodeContents(span);
    if (span.contains(range.startContainer)) part.setStart(range.startContainer, range.startOffset);
    if (span.contains(range.endContainer)) part.setEnd(range.endContainer, range.endOffset);
    const value = part.toString();
    if (!value) continue;
    const layer = span.closest(".textLayer");
    text += (previousLayer ? (previousLayer === layer ? run.separator : "\n\n") : "") + value;
    previousLayer = layer;
  }
  return previousLayer ? text.trim() : null;
}
