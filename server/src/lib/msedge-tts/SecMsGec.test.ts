import { describe, expect, it } from "vitest";
import { hashSecMsGecV2 } from "./SecMsGec";

describe("Sec-MS-GEC v2", () => {
  it("matches the token upstream recorded for 2026-10-13T10:00:30Z", async () => {
    // Windows file-time ticks, rounded down to the 5-minute window, then the trusted client token.
    const seconds = Date.parse("2026-10-13T10:00:30Z") / 1000 + 11644473600;
    const ticks = (seconds - (seconds % 300)) * 10_000_000;
    expect(await hashSecMsGecV2(`${ticks}6A5AA1D4EAFF4E9FB37E23D68491D6F4`)).toBe(
      "461B5A82FDC12AF5-A89B0EBF2C158E7B404FF47B1F12D5579CB3C7D7B18EC8ADE4A4AD0A8036C8DE",
    );
  });
});
