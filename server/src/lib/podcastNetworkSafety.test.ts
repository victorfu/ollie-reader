import { afterEach, expect, it, vi } from "vitest";
type LookupCallback = (error: Error | null, addresses: unknown, family?: number) => void;
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), socketLookup: undefined as undefined | ((hostname: string, options: { all?: boolean; family?: number }, callback: LookupCallback) => void) }));
vi.mock("node:dns", () => ({ lookup: mocks.lookup }));
vi.mock("undici", () => ({ fetch: vi.fn(), Agent: class {
  constructor(options: { connect: { lookup: NonNullable<typeof mocks.socketLookup> } }) { mocks.socketLookup = options.connect.lookup; }
} }));
import { publicAgent } from "./fetchUrl";
afterEach(() => vi.resetAllMocks());
it("blocks private or mixed DNS answers at socket resolution, including rebinding", () => {
  publicAgent();
  const callback = vi.fn();
  mocks.lookup.mockImplementationOnce((_host, _options, done) => done(null, [{ address: "8.8.8.8", family: 4 }]));
  mocks.socketLookup!("public.example", { all: true }, callback);
  expect(callback).toHaveBeenLastCalledWith(null, [{ address: "8.8.8.8", family: 4 }]);
  mocks.lookup.mockImplementationOnce((_host, _options, done) => done(null, [{ address: "127.0.0.1", family: 4 }]));
  mocks.socketLookup!("public.example", { all: true }, callback);
  expect(callback.mock.calls.at(-1)?.[0]).toBeInstanceOf(Error);
  mocks.lookup.mockImplementationOnce((_host, _options, done) => done(null, [{ address: "8.8.8.8", family: 4 }, { address: "::ffff:10.0.0.1", family: 6 }]));
  mocks.socketLookup!("public.example", { all: true }, callback);
  expect(callback.mock.calls.at(-1)?.[0]).toBeInstanceOf(Error);
});
