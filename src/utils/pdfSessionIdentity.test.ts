import { describe, expect, it, vi } from "vitest";
import {
  choosePdfSessionId,
  claimPdfSessionId,
} from "./pdfSessionIdentity";

describe("PDF tab session identity", () => {
  it("keeps the stored id when no live tab owns it, as on refresh", async () => {
    const probe = vi.fn().mockResolvedValue(false);

    await expect(
      choosePdfSessionId("refresh-session", probe, () => "new-session"),
    ).resolves.toBe("refresh-session");
    expect(probe).toHaveBeenCalledWith("refresh-session");
  });

  it("rekeys a sessionStorage id copied from a live duplicated tab", async () => {
    const probe = vi.fn().mockResolvedValue(true);

    await expect(
      choosePdfSessionId("copied-session", probe, () => "duplicate-session"),
    ).resolves.toBe("duplicate-session");
  });

  it("rekeys conservatively when fallback ownership is ambiguous", async () => {
    const probe = vi.fn().mockResolvedValue(null);

    await expect(
      choosePdfSessionId("ambiguous-session", probe, () => "safe-session"),
    ).resolves.toBe("safe-session");
  });

  it("creates an id without probing when this tab has none", async () => {
    const probe = vi.fn();

    await expect(
      choosePdfSessionId(null, probe, () => "first-session"),
    ).resolves.toBe("first-session");
    expect(probe).not.toHaveBeenCalled();
  });

  it("keeps a refresh session when its exclusive ownership can be claimed", async () => {
    const claim = vi.fn().mockResolvedValue(true);

    await expect(
      claimPdfSessionId("refresh-session", claim, () => "new-session"),
    ).resolves.toBe("refresh-session");
    expect(claim).toHaveBeenCalledWith("refresh-session");
  });

  it("rekeys a copied session when another tab holds its exclusive ownership", async () => {
    const claim = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(
      claimPdfSessionId("copied-session", claim, () => "duplicate-session"),
    ).resolves.toBe("duplicate-session");
    expect(claim.mock.calls).toEqual([
      ["copied-session"],
      ["duplicate-session"],
    ]);
  });

});
