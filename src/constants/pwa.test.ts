import { describe, expect, it } from "vitest";
import { NAVIGATE_FALLBACK_DENYLIST } from "./pwa";
import { EXAM_PAPERS } from "../data/exams";

/** 模擬 workbox NavigationRoute 的比對:url.pathname + url.search。 */
const matchesDenylist = (href: string): boolean => {
  const url = new URL(encodeURI(href), "https://ollie.example");
  const pathnameAndSearch = url.pathname + url.search;
  return NAVIGATE_FALLBACK_DENYLIST.some((pattern) =>
    pattern.test(pathnameAndSearch),
  );
};

describe("NAVIGATE_FALLBACK_DENYLIST", () => {
  it("放行每份卷的題目卷/解析卷,不被 SPA fallback 攔截", () => {
    const paperHrefs = Object.values(EXAM_PAPERS).flatMap((paper) =>
      [paper.questionPdf, paper.answerPdf].filter(
        (href): href is string => typeof href === "string",
      ),
    );
    expect(paperHrefs.length).toBeGreaterThan(0);
    for (const href of paperHrefs) {
      expect(matchesDenylist(href), `${href} 應命中 denylist`).toBe(true);
    }
  });

  it("SPA 路由仍走 fallback(不得誤擋)", () => {
    for (const route of ["/", "/exam", "/games/sweetheart", "/reader"]) {
      expect(matchesDenylist(route), `${route} 不應命中 denylist`).toBe(false);
    }
  });
});
