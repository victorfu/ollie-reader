import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("msedge-tts", () => ({
  MsEdgeTTS: class { constructor() { return mocks.create(); } },
  OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: "mp3" },
}));

import { synthesizeSpeech, SYNTHESIS_TIMEOUT_MS } from "./edgeTts";

function client() {
  const stream = new PassThrough();
  const metadata = new PassThrough();
  return {
    stream, metadata,
    setMetadata: vi.fn().mockResolvedValue(undefined),
    toStream: vi.fn(() => ({ audioStream: stream, metadataStream: metadata })),
    close: vi.fn(),
  };
}

const request = { text: `Hello <world> & "Ollie"`, speed: 1.25, voice: "en-US-AriaNeural" };
let tts: ReturnType<typeof client>;

beforeEach(() => {
  vi.useFakeTimers();
  tts = client();
  mocks.create.mockReset().mockReturnValue(tts);
});
afterEach(() => vi.useRealTimers());

describe("Edge synthesis lifecycle", () => {
  it("collects complete MP3 bytes and always closes resources", async () => {
    const result = synthesizeSpeech(request);
    await Promise.resolve();
    tts.stream.write(Buffer.from([0xff, 0xfb]));
    tts.stream.end(Buffer.from("audio"));
    expect(await result).toEqual(new Uint8Array(Buffer.from([0xff, 0xfb, ...Buffer.from("audio")])));
    expect(tts.setMetadata).toHaveBeenCalledWith(request.voice, "mp3");
    expect(tts.toStream).toHaveBeenCalledWith("Hello &lt;world&gt; &amp; &quot;Ollie&quot;", { rate: "+25%" });
    expect(tts.close).toHaveBeenCalledOnce();
    expect(tts.stream.destroyed).toBe(true);
    expect(tts.metadata.destroyed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("maps upstream 403 errors and clears the timer", async () => {
    tts.setMetadata.mockRejectedValue(new Error("Unexpected server response: 403"));
    await expect(synthesizeSpeech(request)).rejects.toMatchObject({ status: 502, message: expect.stringContaining("msedge-tts") });
    expect(tts.close).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects empty audio", async () => {
    const result = synthesizeSpeech(request);
    const rejected = expect(result).rejects.toMatchObject({ status: 502 });
    await Promise.resolve();
    tts.stream.end();
    await rejected;
  });

  it.each(["error", "close"])("never returns partial audio after stream %s", async (event) => {
    const result = synthesizeSpeech(request);
    const rejected = expect(result).rejects.toMatchObject({ status: 502 });
    await Promise.resolve();
    tts.stream.write("partial");
    tts.stream.destroy(event === "error" ? new Error("interrupted") : undefined);
    await rejected;
    expect(tts.close).toHaveBeenCalledOnce();
  });

  it("bounds buffered audio", async () => {
    const result = synthesizeSpeech(request);
    const rejected = expect(result).rejects.toMatchObject({ status: 502 });
    await Promise.resolve();
    tts.stream.write(Buffer.alloc(4 * 1024 * 1024 + 1));
    await rejected;
    expect(tts.stream.destroyed).toBe(true);
  });

  it("times out both the handshake and audio stream", async () => {
    for (const handshake of [true, false]) {
      tts = client();
      if (handshake) tts.setMetadata.mockImplementation(() => new Promise(() => {}));
      mocks.create.mockReturnValue(tts);
      const result = synthesizeSpeech(request);
      const rejected = expect(result).rejects.toMatchObject({ status: 504 });
      await vi.advanceTimersByTimeAsync(SYNTHESIS_TIMEOUT_MS);
      await rejected;
      expect(tts.close).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    }
  });

  it("does not open a connection for an already-cancelled request", async () => {
    await expect(synthesizeSpeech(request, AbortSignal.abort())).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("cancels synthesis and removes its abort listener", async () => {
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    const result = synthesizeSpeech(request, controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    controller.abort();
    await rejected;
    expect(tts.stream.destroyed).toBe(true);
    expect(tts.close).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("closes a late handshake without starting audio after cancellation", async () => {
    let complete!: () => void;
    tts.setMetadata.mockImplementation(() => new Promise<void>((resolve) => { complete = resolve; }));
    const controller = new AbortController();
    const result = synthesizeSpeech(request, controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejected;
    complete();
    await Promise.resolve();
    expect(tts.toStream).not.toHaveBeenCalled();
    expect(tts.close).toHaveBeenCalledTimes(2);
  });

  it("isolates simultaneous requests and their cancellation", async () => {
    const second = client();
    mocks.create.mockReturnValueOnce(tts).mockReturnValueOnce(second);
    const controller = new AbortController();
    const firstResult = synthesizeSpeech(request, controller.signal);
    const rejected = expect(firstResult).rejects.toMatchObject({ name: "AbortError" });
    const secondResult = synthesizeSpeech({ ...request, voice: "en-GB-RyanNeural" });
    await Promise.resolve();
    controller.abort();
    await rejected;
    expect(second.close).not.toHaveBeenCalled();
    second.stream.end("second audio");
    expect(Buffer.from(await secondResult).toString()).toBe("second audio");
    expect(second.setMetadata).toHaveBeenCalledWith("en-GB-RyanNeural", "mp3");
  });
});
