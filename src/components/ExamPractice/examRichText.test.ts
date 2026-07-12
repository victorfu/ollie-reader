import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExamRichText } from "./ExamRichText";
import { fractionLabel, parseExamRichText } from "./examRichTextUtils";

describe("parseExamRichText", () => {
  it("returns plain text untouched", () => {
    expect(parseExamRichText("平行四邊形有幾雙互相平行的對邊？")).toEqual([
      { type: "text", value: "平行四邊形有幾雙互相平行的對邊？" },
    ]);
  });

  it("parses a simple fraction", () => {
    expect(parseExamRichText("睿睿早上喝了{7/20}公升的鮮奶")).toEqual([
      { type: "text", value: "睿睿早上喝了" },
      { type: "fraction", whole: null, numerator: "7", denominator: "20" },
      { type: "text", value: "公升的鮮奶" },
    ]);
  });

  it("parses a mixed number (leading digits belong to the fraction)", () => {
    expect(parseExamRichText("「2.51」用分數表示是2{51/100}")).toEqual([
      { type: "text", value: "「2.51」用分數表示是" },
      { type: "fraction", whole: "2", numerator: "51", denominator: "100" },
    ]);
  });

  it("parses multiple fractions in one line", () => {
    const tokens = parseExamRichText("{3/8}和{6/16}哪個大？");
    expect(tokens).toEqual([
      { type: "fraction", whole: null, numerator: "3", denominator: "8" },
      { type: "text", value: "和" },
      { type: "fraction", whole: null, numerator: "6", denominator: "16" },
      { type: "text", value: "哪個大？" },
    ]);
  });

  it("keeps malformed braces as literal text instead of crashing", () => {
    expect(parseExamRichText("壞資料{3\\8}與{}與{a/b}")).toEqual([
      { type: "text", value: "壞資料{3\\8}與{}與{a/b}" },
    ]);
  });

  it("turns newlines into break tokens", () => {
    expect(parseExamRichText("甲、細碎\n乙、惦起")).toEqual([
      { type: "text", value: "甲、細碎" },
      { type: "break" },
      { type: "text", value: "乙、惦起" },
    ]);
  });

  it("handles a fraction-only string", () => {
    expect(parseExamRichText("{14/5}")).toEqual([
      { type: "fraction", whole: null, numerator: "14", denominator: "5" },
    ]);
  });
});

describe("fractionLabel", () => {
  it("describes simple fractions in spoken Chinese", () => {
    expect(fractionLabel(null, "3", "8")).toBe("8分之3");
  });

  it("describes mixed numbers", () => {
    expect(fractionLabel("2", "51", "100")).toBe("2又100分之51");
  });
});

describe("ExamRichText", () => {
  it("renders a spoken label for a visual fraction", () => {
    const html = renderToStaticMarkup(
      createElement(ExamRichText, { text: "共有2{1/5}公升" }),
    );
    expect(html).toContain('aria-label="2又5分之1"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders explicit line breaks", () => {
    const html = renderToStaticMarkup(
      createElement(ExamRichText, { text: "第一行\n第二行" }),
    );
    expect(html).toContain("第一行<br/>第二行");
  });
});
