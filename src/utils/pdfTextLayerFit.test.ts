import { afterEach, describe, expect, it, vi } from "vitest";
import {
  advancesFromStore,
  buildAdvanceMap,
  computeSegmentShares,
  fitTextLayerRuns,
} from "./pdfTextLayerFit";

// Glyph advances (1/1000 em) of the title font in "The King's New Suit".
const TITLE_ADVANCES = new Map<string, number>([
  ["T", 696],
  ["h", 578],
  ["e", 559],
  [" ", 434],
  ["K", 611],
  ["i", 280],
  ["n", 523],
  ["g", 531],
  ["’", 226],
  ["s", 487],
  ["N", 813],
  ["w", 684],
  ["S", 693],
  ["u", 520],
  ["t", 471],
]);

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("buildAdvanceMap", () => {
  it("maps each glyph's Unicode text to its advance width", () => {
    const toUnicode = { _map: [] as Array<string | undefined> };
    const widths: Array<number | undefined> = [];
    toUnicode._map[3] = " ";
    widths[3] = 434;
    toUnicode._map[46] = "K";
    widths[46] = 611;

    const advances = buildAdvanceMap({ toUnicode, widths, defaultWidth: 1000 });

    expect(advances?.get(" ")).toBe(434);
    expect(advances?.get("K")).toBe(611);
  });

  it("reads identity ToUnicode maps as character codes", () => {
    const advances = buildAdvanceMap({
      toUnicode: { firstChar: 65, lastChar: 66 },
      widths: { 65: 722, 66: 667 },
    });

    expect(advances?.get("A")).toBe(722);
    expect(advances?.get("B")).toBe(667);
  });

  it("splits a ligature's advance across the characters it stands for", () => {
    const toUnicode = { _map: [] as Array<string | undefined> };
    toUnicode._map[1] = "fi";

    const advances = buildAdvanceMap({ toUnicode, widths: { 1: 556 } });

    expect(advances?.get("f")).toBe(278);
    expect(advances?.get("i")).toBe(278);
  });

  it("gives up on fonts whose widths cannot be trusted", () => {
    const toUnicode = { _map: ["A"] };
    expect(
      buildAdvanceMap({ toUnicode, widths: [500], isType3Font: true }),
    ).toBeNull();
    expect(
      buildAdvanceMap({ toUnicode, widths: [500], vertical: true }),
    ).toBeNull();
    expect(buildAdvanceMap({ widths: [500] })).toBeNull();
    expect(buildAdvanceMap(undefined)).toBeNull();
  });
});

describe("advancesFromStore", () => {
  it("reads a loaded font once and waits for fonts not loaded yet", () => {
    const font = { toUnicode: { _map: ["A"] }, widths: [722] };
    const get = (name: string) => (name === "g_d0_f1" ? font : undefined);
    const store = { has: (name: string) => name === "g_d0_f1", get };

    const first = advancesFromStore(store, "g_d0_f1");
    expect(first?.get("A")).toBe(722);
    expect(advancesFromStore(store, "g_d0_f1")).toBe(first);
    expect(advancesFromStore(store, "g_d0_f2")).toBeNull();
  });
});

describe("computeSegmentShares", () => {
  it("gives each word and gap its share of the run by real advances", () => {
    const shares = computeSegmentShares(
      "The King’s New Suit",
      TITLE_ADVANCES,
      9819,
    );

    expect(shares?.map((segment) => segment.text)).toEqual([
      "The",
      " ",
      "King’s",
      " ",
      "New",
      " ",
      "Suit",
    ]);
    const total = 1833 + 434 + 2658 + 434 + 2056 + 434 + 1964;
    expect(shares?.[0].share).toBeCloseTo(1833 / total);
    expect(shares?.[2].share).toBeCloseTo(2658 / total);
    expect(shares?.reduce((sum, segment) => sum + segment.share, 0)).toBeCloseTo(
      1,
    );
  });

  it("derives gaps the font has no space glyph for from the run width", () => {
    const advances = new Map([
      ["a", 500],
      ["b", 500],
    ]);

    // PDF.js inserts these spaces from positioning gaps; the run is 3000 wide.
    const shares = computeSegmentShares("a  b", advances, 3000);

    expect(shares?.map((segment) => segment.share)).toEqual([
      500 / 3000,
      2000 / 3000,
      500 / 3000,
    ]);
  });

  it("leaves runs it cannot measure, or need not split, alone", () => {
    expect(computeSegmentShares("Suit", TITLE_ADVANCES, 1964)).toBeNull();
    expect(computeSegmentShares("The Kzng", TITLE_ADVANCES, 4000)).toBeNull();
    expect(computeSegmentShares("", TITLE_ADVANCES, 0)).toBeNull();
    // No space glyph and no room left for the gap.
    expect(
      computeSegmentShares("a b", new Map([["a", 500], ["b", 500]]), 900),
    ).toBeNull();
  });
});

describe("fitTextLayerRuns", () => {
  const CHAR_PX = 10;

  function makeLayer(texts: string[]): HTMLDivElement {
    const layer = document.createElement("div");
    layer.className = "textLayer";
    for (const text of texts) {
      const span = document.createElement("span");
      span.setAttribute("role", "presentation");
      span.style.fontSize = "20px";
      span.textContent = text;
      layer.appendChild(span);
    }
    document.body.appendChild(layer);
    return layer;
  }

  // Every character renders CHAR_PX wide in the substitute font.
  function measureByLength(text: string): number {
    return text.length * CHAR_PX;
  }

  const advancesFor = (fontName: string) =>
    fontName === "title" ? TITLE_ADVANCES : null;

  it("spaces each word out to its real width inside the run", () => {
    const layer = makeLayer(["The King’s New Suit"]);

    fitTextLayerRuns(
      layer,
      [{ str: "The King’s New Suit", fontName: "title", width: 392.6, transform: [39.984, 0, 0, 39.984, 0, 0] }],
      advancesFor,
      { measure: measureByLength },
    );

    const span = layer.querySelector("span[role='presentation']")!;
    expect(span.textContent).toBe("The King’s New Suit");
    const segments = [...span.children] as HTMLElement[];
    expect(segments.map((segment) => segment.textContent)).toEqual([
      "The",
      " ",
      "King’s",
      " ",
      "New",
      " ",
      "Suit",
    ]);
    // Total follows PDF geometry rather than the substitute font's 190px.
    const total = 1833 + 434 + 2658 + 434 + 2056 + 434 + 1964;
    const kingTarget = (2658 / total) * (392.6 / 39.984) * 20;
    const kingSpacingPx = (kingTarget - 60) / 6;
    expect(parseFloat(segments[2].style.letterSpacing)).toBeCloseTo(
      kingSpacingPx / 20,
    );
    expect(segments[2].style.letterSpacing).toMatch(/em$/);
    expect(segments.every((segment) => segment.style.position === "static")).toBe(
      true,
    );
  });

  it.each([1, 2])("preserves PDF word positions at CSS scale %s despite different font metrics", (scale) => {
    const layer = makeLayer(["a b"]);
    const span = layer.firstElementChild as HTMLElement;
    span.style.fontSize = `${20 * scale}px`;
    span.style.transform = "rotate(15deg) scaleX(0.8)";
    fitTextLayerRuns(layer, [
      { str: "a b", fontName: "body", width: 30, transform: [20, 0, 0, 20, 0, 0] },
    ], () => new Map([["a", 500], [" ", 500], ["b", 500]]), {
      measure: () => 9 * scale,
    });
    const widths = [...span.children].map(child =>
      9 * scale + parseFloat((child as HTMLElement).style.letterSpacing) * 20 * scale,
    );
    expect(widths[0] * 0.8).toBeCloseTo(10 * scale);
    expect(widths.reduce((sum, width) => sum + width, 0) * 0.8).toBeCloseTo(30 * scale);
    expect(span.textContent).toBe("a b");
  });

  it("measures final inline boxes and fixes each advance to the PDF width", () => {
    const originalGetStyle = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      const style = originalGetStyle(element);
      if ((element as HTMLElement).style.display === "inline-block") {
        Object.defineProperty(style, "width", { value: "8px" });
      }
      return style;
    });
    const layer = makeLayer(["a b"]);
    const span = layer.firstElementChild as HTMLElement;
    span.style.transform = "scaleX(0.8)";
    fitTextLayerRuns(layer, [
      { str: "a b", fontName: "body", width: 30, transform: [20, 0, 0, 20, 0, 0] },
    ], () => new Map([["a", 500], [" ", 500], ["b", 500]]), {
      measure: () => { throw new Error("Must use the rendered width"); },
    });
    const word = span.firstElementChild as HTMLElement;
    expect((8 + parseFloat(word.style.letterSpacing) * 20) * 0.8).toBeCloseTo(10);
    expect(parseFloat(word.style.width) * 20 * 0.8).toBeCloseTo(10);
  });

  it("also fits single-word runs to their PDF width", () => {
    const layer = makeLayer(["what"]);
    const span = layer.firstElementChild as HTMLElement;
    span.style.transform = "scaleX(0.9)";
    fitTextLayerRuns(layer, [
      { str: "what", fontName: "body", width: 50, transform: [20, 0, 0, 20, 0, 0] },
    ], () => new Map([["w", 500]]), { measure: measureByLength });
    const word = span.firstElementChild as HTMLElement;
    expect((40 + parseFloat(word.style.letterSpacing) * 20 * 4) * 0.9).toBeCloseTo(50);
  });

  it("fits each run once, even when called again", () => {
    const layer = makeLayer(["The King’s New Suit"]);
    const items = [
      { str: "The King’s New Suit", fontName: "title", width: 392.6, transform: [39.984, 0, 0, 39.984, 0, 0] },
    ];

    fitTextLayerRuns(layer, items, advancesFor, { measure: measureByLength });
    fitTextLayerRuns(layer, items, advancesFor, { measure: measureByLength });

    const span = layer.querySelector("span[role='presentation']")!;
    expect(span.children).toHaveLength(7);
    expect(span.querySelector(":scope > span > span")).toBeNull();
  });

  it("skips runs whose font is not loaded yet so a later pass can fit them", () => {
    const layer = makeLayer(["The King’s New Suit"]);
    const items = [
      { str: "The King’s New Suit", fontName: "title", width: 392.6, transform: [39.984, 0, 0, 39.984, 0, 0] },
    ];

    fitTextLayerRuns(layer, items, () => null, { measure: measureByLength });
    const span = layer.querySelector("span[role='presentation']")!;
    expect(span.children).toHaveLength(0);

    fitTextLayerRuns(layer, items, advancesFor, { measure: measureByLength });
    expect(span.children).toHaveLength(7);
  });

  it("measures under the PDF's lang, not whatever the DOM carries yet", () => {
    const layer = makeLayer(["The King’s New Suit"]);
    const langs: string[] = [];

    fitTextLayerRuns(
      layer,
      [{ str: "The King’s New Suit", fontName: "title", width: 392.6, transform: [39.984, 0, 0, 39.984, 0, 0] }],
      advancesFor,
      {
        lang: "zh-TW",
        measure: (text, _span, lang) => {
          langs.push(lang);
          return measureByLength(text);
        },
      },
    );

    expect(new Set(langs)).toEqual(new Set(["zh-TW"]));
  });

  it("pairs spans with non-empty items, since PDF.js skips line-end items", () => {
    const layer = makeLayer(["The King’s New Suit", "Lv 5-2"]);
    const title = { str: "The King’s New Suit", fontName: "title", width: 392.6, transform: [39.984, 0, 0, 39.984, 0, 0] };
    const lineEnd = { str: "", fontName: "title", width: 0, transform: [39.984, 0, 0, 39.984, 0, 0] };
    const level = { str: "Lv 5-2", fontName: "other", width: 120, transform: [39.984, 0, 0, 39.984, 0, 0] };

    fitTextLayerRuns(layer, [title, lineEnd, level], advancesFor, { measure: measureByLength });

    const [titleSpan] = layer.querySelectorAll("span[role='presentation']");
    expect(titleSpan.children).toHaveLength(7);
  });

  it("does nothing when the layer and the text items disagree", () => {
    const layer = makeLayer(["Something else entirely"]);

    fitTextLayerRuns(
      layer,
      [{ str: "The King’s New Suit", fontName: "title", width: 392.6, transform: [39.984, 0, 0, 39.984, 0, 0] }],
      advancesFor,
      { measure: measureByLength },
    );

    expect(layer.querySelector("span span")).toBeNull();
  });
});
