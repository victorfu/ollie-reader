import type { FurnitureId, OutfitId } from "../types";

/**
 * Intrinsic pixel dimensions of every Cloud Cottage sprite, plus the anatomy
 * landmarks the layout maths needs.
 *
 * Layout percentages are meaningless without the source aspect ratio: an outfit
 * declared `widthPercent: 34` is only 21.6% tall if you know the art is
 * 380x242. Keeping the real numbers here lets `outfitLayout` and `roomLayout`
 * derive heights instead of hard-coding hand-tuned magic offsets.
 *
 * `spriteMetrics.test.ts` re-reads the WebP headers from disk and fails if any
 * value here drifts from the actual asset.
 */
export type SpriteMetrics = {
  width: number;
  height: number;
};

export const FURNITURE_METRICS: Readonly<Record<FurnitureId, SpriteMetrics>> = {
  bookshelf: { width: 277, height: 347 },
  "cloud-bed": { width: 351, height: 324 },
  "cloud-frame": { width: 376, height: 380 },
  "clover-plant": { width: 313, height: 445 },
  curtain: { width: 352, height: 339 },
  "flower-gift": { width: 286, height: 421 },
  lamp: { width: 259, height: 372 },
  picture: { width: 305, height: 307 },
  plant: { width: 269, height: 353 },
  "rainbow-picture": { width: 333, height: 394 },
  rug: { width: 402, height: 258 },
  sofa: { width: 402, height: 304 },
  "star-hanging": { width: 320, height: 468 },
  table: { width: 304, height: 303 },
};

export const OUTFIT_METRICS: Readonly<Record<OutfitId, SpriteMetrics>> = {
  "bell-collar": { width: 337, height: 266 },
  "blue-scarf": { width: 358, height: 301 },
  "flower-crown": { width: 380, height: 242 },
  "golden-bow": { width: 337, height: 331 },
  "rainbow-scarf": { width: 359, height: 339 },
  "red-ribbon": { width: 362, height: 306 },
  "sailor-hat": { width: 376, height: 280 },
  "star-headband": { width: 350, height: 341 },
  "strawberry-clip": { width: 332, height: 231 },
};

/** The Cinnamoroll art is a square canvas, which keeps the outfit maths simple. */
export const PET_SPRITE: SpriteMetrics = { width: 1254, height: 1254 };

export const ROOM_SPRITE: SpriteMetrics = { width: 1536, height: 1024 };

/**
 * Where the drawn character actually sits inside its square canvas, as a
 * fraction of the canvas height. Measured from the alpha channel: opaque pixels
 * run y 280..980 of 1254. The generous transparent margin below the feet is why
 * aligning the pet by its box bottom floats her above the floor.
 */
export const PET_CONTENT = {
  topFraction: 0.2233,
  bottomFraction: 0.7815,
} as const;

/**
 * Landmarks as a percentage of the square avatar canvas, measured from the art.
 *
 * `eyeBand` spans both eyes. They are not level with each other because the
 * pose tilts her head: the left eye occupies y 35.5-40.9% and the right y
 * 39.1-44.5%, so the band covers both. Head accessories are positioned against
 * this band — anything whose ink reaches into it covers her face.
 *
 * `headDomeCenterXPercent` is the centre of the head dome, not the midpoint of
 * the two eyes (48.7%). The head tilt pushes those apart, and a hat tracks the
 * dome, so the dome is the correct anchor.
 */
export const PET_ANATOMY = {
  headTopPercent: 22.3,
  headDomeCenterXPercent: 46,
  eyeBand: { top: 35.5, bottom: 44.5 },
  /** Muzzle and mouth, kept clear for the same reason as the eyes. */
  faceBand: { top: 35.5, bottom: 48 },
} as const;
