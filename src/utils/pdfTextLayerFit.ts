/**
 * PDF.js draws each text run's selectable copy in a substitute system font and
 * only stretches the whole run to the right width. Inside the run, the
 * substitute's glyph proportions differ from the PDF's own font, so words land
 * left or right of where the canvas drew them — by ~20px on a large title.
 *
 * This re-lays each run word by word from the font's real glyph advances
 * (exposed by PDF.js when the document is loaded with `fontExtraProperties`):
 * every word and gap becomes an inline span whose letter-spacing stretches it
 * to its true share of the run. The run's total width is unchanged, so the
 * scaleX PDF.js computed still applies.
 */

/** Advance widths in 1/1000 em, keyed by the single character they render. */
export type AdvanceMap = Map<string, number>;

type ToUnicodeLike =
  | { _map?: ArrayLike<string | undefined> | Record<number, string> }
  | { firstChar?: number; lastChar?: number };

/** The parts of a PDF.js font object (with extra properties) this reads. */
export type PdfFontLike = {
  toUnicode?: ToUnicodeLike;
  widths?: ArrayLike<number | null | undefined> | Record<number, number>;
  defaultWidth?: number;
  isType3Font?: boolean;
  vertical?: boolean;
};

export type TextItemLike = {
  str: string;
  fontName: string;
  width: number;
  transform: number[];
};

export type SegmentShare = {
  text: string;
  /** Fraction of the run's width this segment should occupy. */
  share: number;
};

/**
 * Natural width, in CSS px, of `text` in `span`'s substitute font, with the
 * generic family resolved under `lang`.
 */
export type MeasureText = (
  text: string,
  span: HTMLElement,
  lang: string,
) => number;

export type FitOptions = {
  /**
   * The lang PDF.js measured the runs under: the PDF's /Lang, or "". Taken
   * from the text content rather than the DOM, which may not carry it yet
   * when the text layer finishes rendering.
   */
  lang?: string;
  measure?: MeasureText;
};

const FIT_MARK = "ollieFit";

export function buildAdvanceMap(
  font: PdfFontLike | null | undefined,
): AdvanceMap | null {
  // Type3 widths are in glyph space, and vertical fonts advance downwards.
  if (!font || font.isType3Font || font.vertical) return null;
  const { toUnicode, widths } = font;
  if (!toUnicode || !widths) return null;

  const widthOf = (code: number): number | undefined => {
    const width = (widths as Record<number, number | null | undefined>)[code];
    if (typeof width === "number" && width > 0) return width;
    return undefined;
  };

  const advances: AdvanceMap = new Map();
  const add = (code: number, unicode: string | undefined) => {
    if (!unicode) return;
    const width = widthOf(code);
    if (width === undefined) return;
    const chars = [...unicode];
    // A ligature glyph ("fi") stands for several characters of the text.
    const each = width / chars.length;
    for (const char of chars) {
      if (!advances.has(char)) advances.set(char, each);
    }
  };

  if ("_map" in toUnicode && toUnicode._map) {
    const map = toUnicode._map as Record<number, string | undefined>;
    for (const key of Object.keys(map)) {
      const code = Number(key);
      if (Number.isInteger(code)) add(code, map[code]);
    }
  } else if (
    "firstChar" in toUnicode &&
    typeof toUnicode.firstChar === "number" &&
    typeof toUnicode.lastChar === "number"
  ) {
    for (let code = toUnicode.firstChar; code <= toUnicode.lastChar; code++) {
      add(code, String.fromCharCode(code));
    }
  }

  return advances.size > 0 ? advances : null;
}

/** A PDF.js page's shared object store, where loaded fonts live. */
export type FontStore = {
  has(name: string): boolean;
  get(name: string): unknown;
};

const advanceCache = new WeakMap<object, AdvanceMap | null>();

/**
 * Advances for a font the page has loaded, or null while it has not — the
 * canvas render loads fonts, so this can lag the text layer.
 */
export function advancesFromStore(
  store: FontStore,
  fontName: string,
): AdvanceMap | null {
  if (!store.has(fontName)) return null;
  const font = store.get(fontName);
  if (!font || typeof font !== "object") return null;
  if (!advanceCache.has(font)) {
    advanceCache.set(font, buildAdvanceMap(font as PdfFontLike));
  }
  return advanceCache.get(font) ?? null;
}

/**
 * Splits a run into words and gaps and gives each its share of the run's
 * width. `runWidthEm` (1/1000 em) prices the gaps the font has no space glyph
 * for — PDF.js inserts those spaces from positioning gaps between glyphs.
 * Returns null when the run cannot be measured or is a single word, which
 * PDF.js's own stretching already fits.
 */
export function computeSegmentShares(
  text: string,
  advances: AdvanceMap,
  runWidthEm: number,
): SegmentShare[] | null {
  const segments = text.split(/(\s+)/).filter(Boolean);
  if (segments.length < 2) return null;

  let known = 0;
  let unknownGaps = 0;
  const widths: Array<number | null> = [];
  for (const segment of segments) {
    const isGap = /^\s+$/.test(segment);
    let width = 0;
    let missing = 0;
    for (const char of segment) {
      const advance = advances.get(char);
      if (advance !== undefined) {
        width += advance;
      } else if (isGap) {
        missing++;
      } else {
        return null;
      }
    }
    known += width;
    unknownGaps += missing;
    widths.push(missing > 0 ? -missing : width);
  }

  let gapWidth = 0;
  if (unknownGaps > 0) {
    gapWidth = (runWidthEm - known) / unknownGaps;
    if (!(gapWidth > 0)) return null;
  }

  const resolved = segments.map((segment, index) => {
    const width = widths[index]!;
    if (width >= 0) return width;
    // Gap segments with missing spaces: known part plus derived spaces.
    let total = 0;
    for (const char of segment) total += advances.get(char) ?? gapWidth;
    return total;
  });
  const total = resolved.reduce((sum, width) => sum + width, 0);
  if (!(total > 0)) return null;

  return segments.map((segment, index) => ({
    text: segment,
    share: resolved[index] / total,
  }));
}

const measureContexts = new Map<string, CanvasRenderingContext2D | null>();

/** Measures like PDF.js does: on a canvas carrying the PDF's lang. */
function measureWithCanvas(
  text: string,
  span: HTMLElement,
  lang: string,
): number {
  let context = measureContexts.get(lang);
  if (context === undefined) {
    const canvas = document.createElement("canvas");
    canvas.lang = lang;
    canvas.style.display = "none";
    document.body.append(canvas);
    context = canvas.getContext("2d");
    measureContexts.set(lang, context);
  }
  if (!context) return 0;
  const style = getComputedStyle(span);
  context.font = `${style.fontSize} ${style.fontFamily}`;
  return context.measureText(text).width;
}

/**
 * Re-lays every not-yet-fitted run in a rendered PDF.js text layer. Runs whose
 * font is not loaded yet are left for a later call, so call this again once
 * the page's canvas has finished rendering.
 */
export function fitTextLayerRuns(
  layer: HTMLElement,
  items: readonly TextItemLike[],
  getAdvances: (fontName: string) => AdvanceMap | null,
  { lang = "", measure = measureWithCanvas }: FitOptions = {},
): void {
  const spans = layer.querySelectorAll<HTMLElement>(
    "span[role='presentation']",
  );
  // PDF.js makes one span per non-empty text item, in order (an empty item
  // only marks a line end). If that no longer holds, pairing them up would fit
  // runs to the wrong text.
  const leafSpans = [...spans].filter(
    (span) => !span.parentElement?.closest("span[role='presentation']"),
  );
  const textItems = items.filter((item) => item.str !== "");
  if (leafSpans.length !== textItems.length) return;
  if (
    leafSpans.some(
      (span, index) =>
        !span.dataset[FIT_MARK] && span.textContent !== textItems[index].str,
    )
  ) {
    return;
  }

  leafSpans.forEach((span, index) => {
    if (span.dataset[FIT_MARK]) return;
    const item = textItems[index];
    const advances = getAdvances(item.fontName);
    if (!advances) return;

    const [, , c, d] = item.transform;
    const fontSize = Math.hypot(c, d);
    if (!(fontSize > 0)) return;
    const shares = computeSegmentShares(
      item.str,
      advances,
      (item.width / fontSize) * 1000,
    );
    span.dataset[FIT_MARK] = "1";
    if (!shares) return;

    const fontSizePx = parseFloat(getComputedStyle(span).fontSize);
    const natural = shares.map((segment) =>
      measure(segment.text, span, lang),
    );
    const total = natural.reduce((sum, width) => sum + width, 0);
    if (!(fontSizePx > 0) || !(total > 0)) return;

    const children = shares.map((segment, segmentIndex) => {
      const child = document.createElement("span");
      child.textContent = segment.text;
      // PDF.js positions every span in the layer absolutely; these flow inline.
      child.style.position = "static";
      child.style.transform = "none";
      const target = segment.share * total;
      const spacing =
        (target - natural[segmentIndex]) / [...segment.text].length;
      child.style.letterSpacing = `${(spacing / fontSizePx).toFixed(5)}em`;
      return child;
    });
    span.replaceChildren(...children);
  });
}
