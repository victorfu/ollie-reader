import { describe, expect, it } from "vitest";
import { resolveAppCheckDebugToken } from "./appCheckDebug";

describe("resolveAppCheckDebugToken", () => {
  it("uses boolean true when no registered token is configured", () => {
    expect(resolveAppCheckDebugToken()).toBe(true);
    expect(resolveAppCheckDebugToken("   ")).toBe(true);
  });

  it("preserves a configured registered debug token", () => {
    expect(resolveAppCheckDebugToken("  registered-token  ")).toBe(
      "registered-token",
    );
  });
});
