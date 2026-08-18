// This is the only file under src/ that touches the filesystem, so Node's
// types are pulled in here rather than widened into tsconfig.app.json.
/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FURNITURE_IDS, OUTFIT_IDS } from "../types";
import {
  FURNITURE_METRICS,
  OUTFIT_METRICS,
  PET_ANATOMY,
  PET_CONTENT,
  PET_SPRITE,
  ROOM_SPRITE,
  type SpriteMetrics,
} from "./spriteMetrics";

// Vite rewrites import.meta.url under the jsdom environment, so resolve from
// the Vitest project root instead.
const ASSET_ROOT = resolve(process.cwd(), "src/assets/games/cloud-cottage");

/**
 * Reads the canvas size straight out of a WebP header. The cottage art uses all
 * three encodings, so all three are handled: extended (VP8X) for the sprites
 * with alpha, lossless (VP8L) for the character, and lossy (VP8) for the room.
 */
function readWebpSize(relativePath: string): SpriteMetrics {
  const buffer = readFileSync(resolve(ASSET_ROOT, relativePath));
  if (
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    throw new Error(`${relativePath} is not a WebP file`);
  }

  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    // 24-bit little-endian canvas dimensions, both stored minus one.
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1,
    };
  }
  if (chunk === "VP8L") {
    // 14 bits of width then 14 bits of height, both minus one, after the
    // one-byte signature at offset 20.
    const packed = buffer.readUInt32LE(21);
    return {
      width: (packed & 0x3fff) + 1,
      height: ((packed >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === "VP8 ") {
    // Key frame header: 14-bit dimensions after the start code.
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  throw new Error(`${relativePath} has an unsupported WebP chunk: ${chunk}`);
}

describe("sprite metrics", () => {
  it.each(FURNITURE_IDS)("matches the %s furniture asset on disk", (id) => {
    expect(FURNITURE_METRICS[id]).toEqual(readWebpSize(`furniture/${id}.webp`));
  });

  it.each(OUTFIT_IDS)("matches the %s outfit asset on disk", (id) => {
    expect(OUTFIT_METRICS[id]).toEqual(readWebpSize(`outfits/${id}.webp`));
  });

  it("matches the character and room assets on disk", () => {
    expect(PET_SPRITE).toEqual(readWebpSize("cinnamoroll.webp"));
    expect(ROOM_SPRITE).toEqual(readWebpSize("cloud-cottage-room-empty.webp"));
  });

  it("keeps the character canvas square so outfit heights stay derivable", () => {
    expect(PET_SPRITE.width).toBe(PET_SPRITE.height);
  });
});

describe("pet anatomy", () => {
  it("orders the landmarks down the canvas", () => {
    expect(PET_ANATOMY.headTopPercent).toBeLessThan(PET_ANATOMY.eyeBand.top);
    expect(PET_ANATOMY.eyeBand.top).toBeLessThan(PET_ANATOMY.eyeBand.bottom);
    expect(PET_ANATOMY.eyeBand.bottom).toBeLessThanOrEqual(
      PET_ANATOMY.faceBand.bottom,
    );
  });

  it("keeps every landmark inside the drawn part of the canvas", () => {
    const top = PET_CONTENT.topFraction * 100;
    const bottom = PET_CONTENT.bottomFraction * 100;
    expect(PET_ANATOMY.headTopPercent).toBeGreaterThanOrEqual(top - 0.1);
    expect(PET_ANATOMY.faceBand.bottom).toBeLessThan(bottom);
  });
});
