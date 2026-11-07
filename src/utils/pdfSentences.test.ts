import { afterEach, expect, it } from "vitest";
import { layerSentences, sentenceOffsets } from "./pdfSentences";
import { registerParagraphLayer } from "./pdfParagraphText";
const split = (text: string) => sentenceOffsets(text).map(s => text.slice(s.start, s.end));
afterEach(() => document.body.replaceChildren());
it("keeps abbreviations, decimals, quotes and question/exclamation endings", () => {
  expect(split('Dr. Smith met Mr. Jones at 3.14 pm. “Really?” Yes!')).toEqual([
    'Dr. Smith met Mr. Jones at 3.14 pm.', '“Really?”', 'Yes!',
  ]);
  expect(split('Use e.g. apples. Next sentence.')).toEqual(['Use e.g. apples.', 'Next sentence.']);
});
it("does not merge paragraphs or require a final full stop", () => {
  expect(split('Heading\n\nFirst paragraph\n\nNext paragraph.')).toEqual(['Heading', 'First paragraph', 'Next paragraph.']);
});
it("maps a sentence across fitted runs and wrapped lines without changing selection or DOM", () => {
  const layer = document.createElement('div');
  layer.innerHTML = '<span role="presentation"><span>Fiona knew</span></span><br><span role="presentation"><span>about it.</span><span> Next sentence.</span></span>';
  document.body.append(layer);
  registerParagraphLayer(layer, [
    { str: 'Fiona knew', hasEOL: true, transform: [20,0,0,20,10,100] },
    { str: 'about it. Next sentence.', hasEOL: true, transform: [20,0,0,20,10,76] },
  ]);
  const before = layer.innerHTML;
  const selection = window.getSelection()!;
  const selected = document.createRange();
  selected.selectNodeContents(layer.firstElementChild!);
  selection.addRange(selected);
  const sentences = layerSentences(layer);
  expect(sentences.map(s => s.text)).toEqual(['Fiona knew about it.', 'Next sentence.']);
  expect(sentences[0].ranges.map(r => r.toString()).join('')).toBe('Fiona knewabout it.');
  expect(sentences[1].ranges.map(r => r.toString()).join('')).toBe('Next sentence.');
  expect(layer.innerHTML).toBe(before);
  expect(selection.getRangeAt(0)).toBe(selected);
  selection.removeAllRanges();
});
