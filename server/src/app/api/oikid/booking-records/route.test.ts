import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), bookings: vi.fn() }));
vi.mock("../../../../lib/firebaseAuth", () => ({ verifyFirebaseToken: mocks.verify }));
vi.mock("../../../../lib/oikid", () => ({ bookingRecords: mocks.bookings }));
import { GET } from "./route";
import { ApiError } from "../../../../lib/api";
afterEach(() => vi.resetAllMocks());
it("never calls OIKID when Firebase authentication fails", async () => {
  mocks.verify.mockRejectedValue(new ApiError("Invalid Firebase token", 403));
  expect((await GET(new Request("http://localhost"))).status).toBe(403);
  expect(mocks.bookings).not.toHaveBeenCalled();
});
it("returns mapped records with no-store after authentication", async () => {
  mocks.verify.mockResolvedValue(undefined);
  mocks.bookings.mockResolvedValue({ Token: "token", Data: [] });
  const response = await GET(new Request("http://localhost"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ Token: "token", Data: [] });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
