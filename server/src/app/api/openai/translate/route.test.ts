import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "../../../../lib/api";
import { translationPrompts } from "../../../../shared/translationPrompts";
import { GET, OPTIONS as modelOptions } from "../models/route";
import { POST, OPTIONS } from "./route";

const { verify, access } = vi.hoisted(() => ({ verify: vi.fn(), access: vi.fn() }));
vi.mock("../../../../lib/translationAccess", () => ({ verifyTranslationAccess: access }));
vi.mock("../../../../lib/firebaseAuth", () => ({ verifyFirebaseToken: verify }));
const upstream = vi.fn();
const input = { model: "test-mini", action: "translation", text: "Hi!" };
function post(body: unknown) {
  return POST(new Request("http://localhost/api/openai/translate", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.stubEnv("OPENAI_MODELS", "test-mini,test-large");
  vi.stubEnv("OPENAI_API_KEY", "dummy");
  vi.stubGlobal("fetch", upstream);
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("lists configured models without disclosing credentials", async () => {
  const result = await GET(new Request("http://localhost/api/openai/models"));
  expect(await result.json()).toEqual({ configured: true, models: ["test-mini", "test-large"] });
});
it("checks sign-in before contacting the provider", async () => {
  verify.mockRejectedValue(new ApiError("unauthorized", 401));
  expect((await post(input)).status).toBe(401);
  expect((await GET(new Request("http://localhost"))).status).toBe(401);
  expect(upstream).not.toHaveBeenCalled();
});
it("rejects a signed-in user outside the app allow-list before spending API credits", async () => {
  vi.stubEnv("OPENAI_MODELS", undefined);
  access.mockRejectedValue(new ApiError("denied", 403));
  expect((await GET(new Request("http://localhost/api/openai/models"))).status).toBe(403);
  expect((await post(input)).status).toBe(403);
  expect(upstream).not.toHaveBeenCalled();
});
it("validates the model, action, body limit, and missing key locally", async () => {
  expect((await post({ ...input, model: "other" })).status).toBe(400);
  expect((await post({ ...input, action: "toString" })).status).toBe(400);
  expect((await post({ ...input, text: "x".repeat(65536) })).status).toBe(413);
  vi.stubEnv("OPENAI_API_KEY", "");
  expect((await post(input)).status).toBe(503);
  expect(upstream).not.toHaveBeenCalled();
});
it.each([["GET", modelOptions], ["POST", OPTIONS]] as const)(
  "allows %s preflights with App Check from the frontend",
  async (method, options) => {
    const result = await options(new Request("http://localhost", { method: "OPTIONS", headers: {
      Origin: "http://localhost:5173", "Access-Control-Request-Method": method,
      "Access-Control-Request-Headers": "Authorization,Content-Type,X-Firebase-AppCheck",
    } }));
    expect(result.status).toBe(204);
    expect(result.headers.get("Access-Control-Allow-Headers")).toContain("X-Firebase-AppCheck");
  },
);
it("uses the shared prompt and extracts message text after reasoning items", async () => {
  upstream.mockResolvedValue(Response.json({ status: "completed", output: [
    { type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: "你好！" }] },
  ] }));
  const result = await post(input);
  expect(await result.json()).toEqual({ text: "你好！" });
  expect(JSON.parse(upstream.mock.calls[0][1].body)).toMatchObject({
    model: input.model, input: translationPrompts.translation(input.text), max_output_tokens: 8192, store: false,
  });
});
it("keeps incomplete output and upstream errors out of the translation cache", async () => {
  upstream.mockResolvedValueOnce(Response.json({ status: "incomplete", output: [
    { type: "message", content: [{ type: "output_text", text: "partial" }] },
  ] })).mockResolvedValueOnce(new Response("private provider details", { status: 429 }));
  expect((await post(input)).status).toBe(502);
  const limited = await post(input);
  expect(limited.status).toBe(429);
  expect(await limited.text()).not.toContain("private provider details");
});

it("discovers GPT models once for the settings UI and the translation request", async () => {
  vi.stubEnv("OPENAI_MODELS", undefined);
  vi.stubEnv("OPENAI_API_KEY", "discovery-test");
  upstream.mockResolvedValueOnce(Response.json({ data: [
    { id: "gpt-6.1-terra" }, { id: "gpt-6.1-terra" }, { id: "gpt-7-mini" },
    { id: "gpt-4.1-mini", shutdown_date: "2000-01-01" },
    { id: "gpt-4o-mini-tts" }, { id: "gpt-5-search-api" }, { id: "gpt-image-1" },
    { id: "text-embedding-3-small" },
  ] }));
  const [a, b] = await Promise.all([GET(new Request("http://localhost")), GET(new Request("http://localhost"))]);
  const catalog = { configured: true, models: ["gpt-7-mini", "gpt-6.1-terra"] };
  expect(await a.json()).toEqual(catalog);
  expect(await b.json()).toEqual(catalog);
  expect(upstream).toHaveBeenCalledExactlyOnceWith("https://api.openai.com/v1/models", expect.objectContaining({
    headers: { Authorization: "Bearer discovery-test" },
  }));
  expect((await post({ ...input, model: "gpt-image-1" })).status).toBe(400);
  upstream.mockResolvedValueOnce(Response.json({ status: "completed", output: [
    { type: "message", content: [{ type: "output_text", text: "你好" }] },
  ] }));
  expect((await post({ ...input, model: "gpt-6.1-terra" })).status).toBe(200);
  expect(upstream).toHaveBeenCalledTimes(2);
});

it("retries a failed catalog read, refreshes after expiry, and handles missing credentials", async () => {
  vi.useFakeTimers();
  try {
    vi.stubEnv("OPENAI_MODELS", undefined);
    vi.stubEnv("OPENAI_API_KEY", "refresh-test");
    upstream.mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: "gpt-5-mini" }] }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: "gpt-6.2-sol" }] }));
    expect((await GET(new Request("http://localhost"))).status).toBe(502);
    expect(await (await GET(new Request("http://localhost"))).json()).toMatchObject({ models: ["gpt-5-mini"] });
    vi.advanceTimersByTime(300_001);
    expect(await (await GET(new Request("http://localhost"))).json()).toMatchObject({ models: ["gpt-6.2-sol"] });
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await (await GET(new Request("http://localhost"))).json()).toEqual({ configured: false, models: [] });
    expect(upstream).toHaveBeenCalledTimes(3);
  } finally {
    vi.useRealTimers();
  }
});

it("caps the output budget when selecting the May 2024 GPT-4o snapshot from discovery", async () => {
  vi.stubEnv("OPENAI_MODELS", undefined);
  vi.stubEnv("OPENAI_API_KEY", "snapshot-test");
  const model = "gpt-4o-2024-05-13";
  upstream.mockResolvedValueOnce(Response.json({ data: [{ id: model }] }))
    .mockResolvedValueOnce(Response.json({ status: "completed", output: [
      { type: "message", content: [{ type: "output_text", text: "你好" }] },
    ] }));
  expect((await post({ ...input, model })).status).toBe(200);
  expect(JSON.parse(upstream.mock.calls[1][1].body)).toMatchObject({ model, max_output_tokens: 4096 });
});

it("includes authentication and discovery time in the Responses deadline", async () => {
  vi.useFakeTimers();
  try {
    vi.stubEnv("OPENAI_MODELS", undefined);
    vi.stubEnv("OPENAI_API_KEY", "deadline-test");
    const authenticated = Promise.withResolvers<void>();
    const catalog = Promise.withResolvers<Response>();
    verify.mockReturnValueOnce(authenticated.promise);
    upstream.mockReturnValueOnce(catalog.promise).mockImplementationOnce((_url, { signal }) =>
      new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason))),
    );

    const pending = post({ ...input, model: "gpt-5-mini" });
    await vi.advanceTimersByTimeAsync(8_000);
    authenticated.resolve();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(upstream).toHaveBeenCalledTimes(1);
    catalog.resolve(Response.json({ data: [{ id: "gpt-5-mini" }] }));
    await vi.advanceTimersByTimeAsync(93_999);
    const signal = upstream.mock.calls[1][1].signal;
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    const result = await pending;
    expect(result.status).toBe(504);
    expect(await result.json()).toMatchObject({ detail: expect.stringContaining("逾時") });
  } finally {
    vi.useRealTimers();
  }
});

it("lets a translation time out while another request finishes the shared catalog read", async () => {
  vi.useFakeTimers();
  try {
    vi.stubEnv("OPENAI_MODELS", undefined);
    vi.stubEnv("OPENAI_API_KEY", "shared-deadline-test");
    const authenticated = Promise.withResolvers<void>();
    verify.mockReturnValueOnce(authenticated.promise);
    const catalog = Promise.withResolvers<Response>();
    upstream.mockReturnValueOnce(catalog.promise);
    const pending = post({ ...input, model: "gpt-5-mini" });
    await vi.advanceTimersByTimeAsync(105_000);
    authenticated.resolve();
    await vi.advanceTimersByTimeAsync(0);
    const settings = GET(new Request("http://localhost/api/openai/models"));
    await vi.advanceTimersByTimeAsync(5_000);
    expect((await pending).status).toBe(504);
    catalog.resolve(Response.json({ data: [{ id: "gpt-5-mini" }] }));
    expect(await (await settings).json()).toMatchObject({ models: ["gpt-5-mini"] });
    expect(upstream).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});
