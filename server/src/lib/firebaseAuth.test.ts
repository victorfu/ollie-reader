import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), initialize: vi.fn(() => ({})) }));
vi.mock("firebase-admin/app", () => ({ getApps: () => [], initializeApp: mocks.initialize }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken: mocks.verify }) }));
import { verifyFirebaseToken } from "./firebaseAuth";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("requires a bearer token", async () => {
  await expect(verifyFirebaseToken(new Request("http://localhost"))).rejects.toMatchObject({ status: 401 });
  expect(mocks.verify).not.toHaveBeenCalled();
});
it("uses the configured project and delegates cryptographic verification to Firebase", async () => {
  vi.stubEnv("FIREBASE_PROJECT_ID", "test-project");
  mocks.verify.mockResolvedValue({ uid: "user" });
  await verifyFirebaseToken(new Request("http://localhost", { headers: { Authorization: "Bearer token" } }));
  expect(mocks.initialize).toHaveBeenCalledWith({ projectId: "test-project" }, "ollie-reader-api");
  expect(mocks.verify).toHaveBeenCalledWith("token");
});
it("rejects invalid tokens without leaking SDK error details", async () => {
  vi.stubEnv("FIREBASE_PROJECT_ID", "test-project");
  mocks.verify.mockRejectedValue(new Error("private diagnostic"));
  await expect(verifyFirebaseToken(new Request("http://localhost", { headers: { Authorization: "Bearer invalid" } }))).rejects.toMatchObject({ status: 403, message: "Invalid Firebase token" });
});
