import { getParagraphLayer } from "./pdfParagraphText";

export type Sentence = { text: string; ranges: Range[] };

/** English sentence boundaries, keeping common abbreviations and decimals. */
export function sentenceOffsets(text: string): Array<{ start: number; end: number }> {
  const result: Array<{ start: number; end: number }> = [];
  let start = 0;
  const add = (end: number) => {
    while (start < end && /\s/.test(text[start])) start++;
    let trimmed = end;
    while (trimmed > start && /\s/.test(text[trimmed - 1])) trimmed--;
    if (trimmed > start) result.push({ start, end: trimmed });
    start = end;
  };
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") { add(i); start = i + 1; continue; }
    if (!/[.!?。！？]/.test(text[i])) continue;
    if (text[i] === ".") {
      if (/\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? "")) continue;
      const prefix = text.slice(start, i + 1);
      if (/(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc)|\b[A-Z]|\b(?:[A-Za-z]\.)+[A-Za-z])\.$/i.test(prefix)) continue;
      if (text[i + 1] === ".") continue;
    }
    let end = i + 1;
    while (end < text.length && /[.!?。！？”’"')\]]/.test(text[end])) end++;
    if (end === text.length || /\s/.test(text[end])) { add(end); i = end - 1; }
  }
  add(text.length);
  return result;
}

const cache = new WeakMap<object, Sentence[]>();
export function layerSentences(layer: HTMLElement): Sentence[] {
  const binding = getParagraphLayer(layer);
  if (!binding) return [];
  const cached = cache.get(binding);
  if (cached) return cached;
  let text = "";
  const nodes: Array<{ node: Text; start: number; end: number }> = [];
  binding.spans.forEach((span, i) => {
    text += binding.runs[i].separator;
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const start = text.length;
      text += node.textContent;
      nodes.push({ node: node as Text, start, end: text.length });
    }
  });
  const sentences = sentenceOffsets(text).map(({ start, end }) => ({
    text: text.slice(start, end),
    ranges: nodes.filter(n => n.end > start && n.start < end).map(n => {
      const range = document.createRange();
      range.setStart(n.node, Math.max(0, start - n.start));
      range.setEnd(n.node, Math.min(n.end, end) - n.start);
      return range;
    }),
  }));
  cache.set(binding, sentences);
  return sentences;
}

export function sentenceRects(sentence: Sentence): DOMRect[] {
  return sentence.ranges.flatMap(range => [...range.getClientRects()]).filter(r => r.width > 0 && r.height > 0);
}
