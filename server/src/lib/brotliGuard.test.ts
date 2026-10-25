import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import zlib from "node:zlib";
import { Agent, fetch } from "undici";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { rejectBrotli } from "./fetchUrl";

// Real undici against a local server: the guard must stop br before fetch builds its decoder.
let server: Server;
let base: string;
let received: IncomingHttpHeaders = {};
beforeAll(async () => {
  server = createServer((request, response) => {
    received = request.headers;
    if (request.url === "/br") response.writeHead(200, { "content-encoding": "br" }).end(zlib.brotliCompressSync("secret"));
    else if (request.url === "/gzip") response.writeHead(200, { "content-encoding": "gzip" }).end(zlib.gzipSync("plain"));
    else response.writeHead(200).end("plain");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
afterEach(() => vi.restoreAllMocks());
const guarded = () => new Agent().compose(rejectBrotli);

it("refuses a Brotli response without ever creating a Brotli decoder", async () => {
  const decoder = vi.spyOn(zlib, "createBrotliDecompress");
  await expect(fetch(`${base}/br`, { dispatcher: guarded() })).rejects.toThrow();
  expect(decoder).not.toHaveBeenCalled();
});

it("stops advertising br upstream, even when the caller asks for it", async () => {
  await (await fetch(`${base}/plain`, { dispatcher: guarded(), headers: { "Accept-Encoding": "br" } })).text();
  expect(received["accept-encoding"]).toBe("gzip, deflate");
});

it("still decodes gzip and passes plain bodies through", async () => {
  expect(await (await fetch(`${base}/gzip`, { dispatcher: guarded() })).text()).toBe("plain");
  expect(await (await fetch(`${base}/plain`, { dispatcher: guarded() })).text()).toBe("plain");
});
