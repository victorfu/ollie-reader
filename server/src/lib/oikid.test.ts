import { afterEach, describe, expect, it, vi } from "vitest";
import { bookingRecords } from "./oikid";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function setup() {
  vi.stubEnv("OIKID_USERNAME", "test-user");
  vi.stubEnv("OIKID_PASSWORD", "test-password");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
describe("OIKID", () => {
  it("preserves session cookies and maps booking fields", async () => {
    const fetcher = setup();
    fetcher.mockResolvedValueOnce(new Response("", { headers: { "set-cookie": "AWSALB=load-balancer; Path=/; Secure" } }))
      .mockResolvedValueOnce(new Response("", { headers: { "set-cookie": "PHPSESSID=session; Path=/; Secure" } }))
      .mockResolvedValueOnce(Response.json({ Token: "booking-token", Data: [{ Classroom_id: "123", CoursesName: "English", TeacherName: "Teacher" }] }));
    const result = await bookingRecords(new AbortController().signal);
    expect(result).toEqual({ Token: "booking-token", Data: [{ id: "123", Level: "", ClassVersion: "", CoursesName: "English", ClassTime: "", TeacherName: "Teacher", OpenName: "" }] });
    expect(fetcher.mock.calls[1][1].headers.Cookie).toContain("AWSALB=load-balancer");
    expect(fetcher.mock.calls[1][1].body.get("Username")).toBe("test-user");
    expect(fetcher.mock.calls[2][1].headers.Cookie).toContain("PHPSESSID=session");
    expect(fetcher.mock.calls[2][1].headers.Cookie).toContain("location=zh-tw");
    expect(fetcher.mock.calls[2][1].body.get("P")).toBe("1");
  });
  it("does not query bookings after failed login", async () => {
    const fetcher = setup().mockResolvedValue(new Response(""));
    await expect(bookingRecords(new AbortController().signal)).rejects.toMatchObject({ status: 502 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not treat an anonymous session cookie as a successful login", async () => {
    const fetcher = setup()
      .mockResolvedValueOnce(new Response("", { headers: { "set-cookie": "PHPSESSID=anonymous; Path=/" } }))
      .mockResolvedValueOnce(new Response("login failed"));
    await expect(bookingRecords(new AbortController().signal)).rejects.toMatchObject({ status: 502 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not forward credentials to an off-site login redirect", async () => {
    const fetcher = setup().mockResolvedValueOnce(new Response(""))
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: "https://example.com/" } }));
    await expect(bookingRecords(new AbortController().signal)).rejects.toMatchObject({ status: 502 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed booking data with an upstream error", async () => {
    setup().mockResolvedValueOnce(new Response(""))
      .mockResolvedValueOnce(new Response("", { headers: { "set-cookie": "PHPSESSID=session; Path=/" } }))
      .mockResolvedValueOnce(Response.json({ Data: {} }));
    await expect(bookingRecords(new AbortController().signal)).rejects.toMatchObject({ status: 502 });
  });
  it("checks credentials before accessing the network", async () => {
    const fetcher = setup();
    vi.stubEnv("OIKID_PASSWORD", "");
    await expect(bookingRecords(new AbortController().signal)).rejects.toMatchObject({ status: 500 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
