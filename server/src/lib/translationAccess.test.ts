import type { DecodedIdToken } from "firebase-admin/auth";
import { afterEach, expect, it, vi } from "vitest";
import { verifyTranslationAccess } from "./translationAccess";

const user = { aud: "demo-project", email: "reader@example.org", email_verified: true } as DecodedIdToken;
const request = new Request("http://localhost", {
  headers: { Authorization: "Bearer test-token", "X-Firebase-AppCheck": "test-app-check" },
});
afterEach(() => vi.unstubAllGlobals());

it("looks up the verified email under the user's Firestore rules and forwards App Check", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetch);
  await verifyTranslationAccess(request, user);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe("https://firestore.googleapis.com/v1/projects/demo-project/databases/(default)/documents/allowedUsers/reader%40example.org");
  expect(options.headers.get("authorization")).toBe("Bearer test-token");
  expect(options.headers.get("X-Firebase-AppCheck")).toBe("test-app-check");
});
it("requires verified email and an existing allow-list entry", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetch);
  await expect(verifyTranslationAccess(request, { ...user, email_verified: false })).rejects.toMatchObject({ status: 403 });
  expect(fetch).not.toHaveBeenCalled();
  await expect(verifyTranslationAccess(request, user)).rejects.toMatchObject({ status: 403 });
});
