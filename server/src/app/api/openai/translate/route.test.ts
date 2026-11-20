import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "../../../../lib/api";
import { translationPrompts } from "../../../../shared/translationPrompts";
import { GET } from "../models/route";
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
  access.mockRejectedValue(new ApiError("denied", 403));
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
it("allows authenticated POST preflights from the frontend", async () => {
  const result = await OPTIONS(new Request("http://localhost", { method: "OPTIONS", headers: {
    Origin: "http://localhost:5173", "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "Authorization,Content-Type,X-Firebase-AppCheck",
  } }));
  expect(result.status).toBe(204);
  expect(result.headers.get("Access-Control-Allow-Headers")).toContain("X-Firebase-AppCheck");
});
it("uses the shared prompt and extracts message text after reasoning items", async () => {
  upstream.mockResolvedValue(Response.json({ status: "completed", output: [
    { type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: "你好！" }] },
  ] }));
  const result = await post(input);
  expect(await result.json()).toEqual({ text: "你好！" });
  expect(JSON.parse(upstream.mock.calls[0][1].body)).toMatchObject({
    model: input.model, input: translationPrompts.translation(input.text), store: false,
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
