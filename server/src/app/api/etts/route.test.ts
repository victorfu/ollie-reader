import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ synthesize: vi.fn() }));
vi.mock("../../../lib/edgeTts", () => ({ synthesizeSpeech: mocks.synthesize }));
vi.mock("../../../utils/logger", () => ({ logger: { error: vi.fn() } }));

import { OPTIONS, POST, maxDuration, runtime } from "./route";
import { SpeechError } from "../../../lib/speech";

function post(body: unknown, origin: string | null = "http://localhost:5173") {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin) headers.set("Origin", origin);
  return new Request("http://localhost:3000/api/etts", {
    method: "POST", headers, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("EDGE_TTS_VOICE", "");
  vi.stubEnv("OLLIE_CORS_ORIGINS", "");
  mocks.synthesize.mockReset().mockResolvedValue(new Uint8Array([0xff, 0xfb, 1, 2]));
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/etts", () => {
  it.each([null, "http://localhost:5173", "http://127.0.0.1:5173", "https://ollie-reader.web.app", "https://ollie-reader.firebaseapp.com"])(
    "returns MP3 without authentication for origin %s", async (origin) => {
      const request = post({ text: "hi" }, origin);
      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
      expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="speech.mp3"');
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(response.headers.get("Vary")).toBe("Origin");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xfb, 1, 2]));
      expect(mocks.synthesize).toHaveBeenCalledWith({ text: "hi", speed: 1, voice: "en-US-AriaNeural" }, request.signal);
      expect(runtime).toBe("nodejs");
      expect(maxDuration).toBe(30);
    },
  );

  it("passes a selected voice and speed to synthesis", async () => {
    const request = post({ text: "hello", speed: 0.75, voice: "en-GB-RyanNeural" });
    expect((await POST(request)).status).toBe(200);
    expect(mocks.synthesize).toHaveBeenCalledWith({ text: "hello", speed: 0.75, voice: "en-GB-RyanNeural" }, request.signal);
  });

  it.each([null, [], {}, { text: " " }, { text: 4 }, { text: "hi", speed: "fast" }, { text: "hi", voice: "invalid" }])(
    "rejects invalid input before synthesis: %j", async (body) => {
      const response = await POST(post(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ detail: expect.any(String) });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
      expect(mocks.synthesize).not.toHaveBeenCalled();
    },
  );

  it.each(["malformed", "content-type", "text-length", "body-size"])("handles %s errors", async (kind) => {
    const request = kind === "text-length" ? post({ text: "x".repeat(5001) }) : new Request("http://localhost:3000/api/etts", {
      method: "POST",
      headers: { "Content-Type": kind === "content-type" ? "text/plain" : "application/json" },
      body: kind === "body-size" ? " ".repeat(65537) : "{",
    });
    const response = await POST(request);
    expect(response.status).toBe(["text-length", "body-size"].includes(kind) ? 413 : 400);
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });

  it.each([502, 504])("returns structured %i failures with CORS", async (status) => {
    mocks.synthesize.mockRejectedValue(new SpeechError("請重試", status));
    const response = await POST(post({ text: "hi" }));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ detail: "請重試" });
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not expose unexpected exception details", async () => {
    mocks.synthesize.mockRejectedValue(new Error("internal connection data"));
    const response = await POST(post({ text: "hi" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ detail: "Edge 語音合成失敗" });
  });

  it("handles cancellation before starting synthesis", async () => {
    const response = await POST(new Request(post({ text: "hi" }), { signal: AbortSignal.abort() }));
    expect(response.status).toBe(499);
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });

  it("rejects a disallowed browser origin before doing work", async () => {
    const response = await POST(post({ text: "hi" }, "https://unlisted.example"));
    expect(response.status).toBe(403);
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });
});

describe("CORS preflight", () => {
  function preflight(origin = "http://localhost:5173", method = "POST", headers = "content-type") {
    return new Request("http://localhost:3000/api/etts", {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": headers },
    });
  }

  it("allows the JSON POST preflight without credentials", () => {
    const response = OPTIONS(preflight());
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    expect(response.headers.has("Access-Control-Allow-Credentials")).toBe(false);
  });

  it("accepts explicitly configured additional origins", async () => {
    vi.stubEnv("OLLIE_CORS_ORIGINS", "https://preview.example, http://localhost:4173");
    expect(OPTIONS(preflight("https://preview.example")).status).toBe(204);
    expect((await POST(post({ text: "hi" }, "http://localhost:4173"))).status).toBe(200);
  });

  it.each(["*", "https://*.example", "https://example.com/path", "null"])("rejects invalid CORS configuration %s", (origin) => {
    vi.stubEnv("OLLIE_CORS_ORIGINS", origin);
    expect(OPTIONS(preflight()).status).toBe(500);
  });

  it("rejects unexpected origins, methods and headers", () => {
    expect(OPTIONS(preflight("https://unlisted.example")).status).toBe(403);
    expect(OPTIONS(preflight(undefined, "DELETE")).status).toBe(403);
    expect(OPTIONS(preflight(undefined, "POST", "X-Other")).status).toBe(403);
  });
});
