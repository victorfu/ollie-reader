import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "user-1" } as { uid: string } | null },
}));

vi.mock("../utils/firebaseUtil", () => ({ auth: mocks.auth }));

import { requireCurrentUserId } from "./requireCurrentUserId";

describe("requireCurrentUserId", () => {
  it("returns the signed-in uid", () => {
    mocks.auth.currentUser = { uid: "user-1" };
    expect(requireCurrentUserId()).toBe("user-1");
  });

  it("throws when nobody is signed in", () => {
    mocks.auth.currentUser = null;
    expect(() => requireCurrentUserId()).toThrow("尚未登入");
  });
});
