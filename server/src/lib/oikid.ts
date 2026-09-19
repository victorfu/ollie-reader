import { CookieJar } from "tough-cookie";
import { ApiError, readLimited } from "./api";

const BASE = "https://www.oikid.com";
const FIELDS = ["Level", "ClassVersion", "CoursesName", "ClassTime", "TeacherName", "OpenName"] as const;

export async function bookingRecords(signal: AbortSignal): Promise<Record<string, unknown>> {
  const username = process.env.OIKID_USERNAME;
  const password = process.env.OIKID_PASSWORD;
  if (!username || !password) throw new ApiError("Missing OIKID credentials: set OIKID_USERNAME and OIKID_PASSWORD", 500);
  const jar = new CookieJar();
  const deadline = AbortSignal.timeout(90_000);
  const combined = AbortSignal.any([signal, deadline]);
  async function send(path: string, form?: URLSearchParams): Promise<Response> {
    let url = new URL(path, BASE);
    let body = form;
    for (let redirects = 0; redirects <= 10; redirects++) {
      const cookie = await jar.getCookieString(url.href);
      const response = await fetch(url, {
        method: body ? "POST" : "GET", body,
        headers: {
          Cookie: cookie, Origin: BASE, Referer: `${BASE}/?a=Student/Booking2`,
          Accept: "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
        },
        redirect: "manual", cache: "no-store",
        signal: AbortSignal.any([combined, AbortSignal.timeout(30_000)]),
      });
      for (const cookie of response.headers.getSetCookie()) await jar.setCookie(cookie, url.href);
      if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.has("location")) {
        await response.body?.cancel();
        const next = new URL(response.headers.get("location")!, url);
        if (next.origin !== BASE) throw new ApiError("Unexpected OIKID redirect", 502);
        if ([301, 302, 303].includes(response.status)) body = undefined;
        url = next;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new ApiError("OIKID upstream request failed", 502);
      }
      return response;
    }
    throw new ApiError("Too many OIKID redirects", 502);
  }
  try {
    await (await send("/login.php")).body?.cancel();
    const login = await send("/?a=Student/Login&b=Process&t=0.8666370350207129", new URLSearchParams({ Username: username, Password: password }));
    await login.body?.cancel();
    // Match the Python contract: login must issue a session cookie, not merely
    // reuse the anonymous session established by GET /login.php.
    if (!login.headers.getSetCookie().some((cookie) => /^PHPSESSID=[^;\s]+/.test(cookie))) throw new ApiError("OIKID login failed", 502);
    await jar.setCookie("location=zh-tw; Path=/; Secure", BASE);
    const response = await send("/?a=Student/BookingRecord&b=Search", new URLSearchParams({ P: "1" }));
    const data: unknown = JSON.parse(new TextDecoder().decode(await readLimited(response, 4 * 1024 * 1024)));
    if (!data || typeof data !== "object") throw new ApiError("Invalid JSON from OIKID", 502);
    const result = data as Record<string, unknown>;
    const rows = result.Data ?? [];
    if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object")) throw new ApiError("Invalid booking data from OIKID", 502);
    return {
      Token: result.Token ?? "",
      Data: rows.map((row) => ({ id: row.Classroom_id ?? "", ...Object.fromEntries(FIELDS.map((field) => [field, row[field] ?? ""])) })),
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("OIKID request failed or returned invalid data", 502);
  }
}
