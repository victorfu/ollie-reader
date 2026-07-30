import cottageRoomEmpty from "../../../../assets/games/cloud-cottage/cloud-cottage-room-empty.webp";
import cinnamoroll from "../../../../assets/games/cloud-cottage/cinnamoroll.webp";
import bookshelf from "../../../../assets/games/cloud-cottage/furniture/bookshelf.webp";
import cloudBed from "../../../../assets/games/cloud-cottage/furniture/cloud-bed.webp";
import cloudFrame from "../../../../assets/games/cloud-cottage/furniture/cloud-frame.webp";
import cloverPlant from "../../../../assets/games/cloud-cottage/furniture/clover-plant.webp";
import curtain from "../../../../assets/games/cloud-cottage/furniture/curtain.webp";
import flowerGift from "../../../../assets/games/cloud-cottage/furniture/flower-gift.webp";
import lamp from "../../../../assets/games/cloud-cottage/furniture/lamp.webp";
import picture from "../../../../assets/games/cloud-cottage/furniture/picture.webp";
import plant from "../../../../assets/games/cloud-cottage/furniture/plant.webp";
import rainbowPicture from "../../../../assets/games/cloud-cottage/furniture/rainbow-picture.webp";
import rug from "../../../../assets/games/cloud-cottage/furniture/rug.webp";
import sofa from "../../../../assets/games/cloud-cottage/furniture/sofa.webp";
import starHanging from "../../../../assets/games/cloud-cottage/furniture/star-hanging.webp";
import table from "../../../../assets/games/cloud-cottage/furniture/table.webp";
import bellCollar from "../../../../assets/games/cloud-cottage/outfits/bell-collar.webp";
import blueScarf from "../../../../assets/games/cloud-cottage/outfits/blue-scarf.webp";
import flowerCrown from "../../../../assets/games/cloud-cottage/outfits/flower-crown.webp";
import goldenBow from "../../../../assets/games/cloud-cottage/outfits/golden-bow.webp";
import rainbowScarf from "../../../../assets/games/cloud-cottage/outfits/rainbow-scarf.webp";
import redRibbon from "../../../../assets/games/cloud-cottage/outfits/red-ribbon.webp";
import sailorHat from "../../../../assets/games/cloud-cottage/outfits/sailor-hat.webp";
import starHeadband from "../../../../assets/games/cloud-cottage/outfits/star-headband.webp";
import strawberryClip from "../../../../assets/games/cloud-cottage/outfits/strawberry-clip.webp";
import type {
  FloorId,
  FurnitureId,
  OutfitId,
  OutfitSlot,
  WallpaperId,
} from "../types";

export const COTTAGE_ROOM_EMPTY_SRC = cottageRoomEmpty;
export const CINNAMOROLL_SRC = cinnamoroll;

export type FurnitureVisual = {
  src: string;
  /** Width as a percentage of the complete 3:2 room canvas. */
  widthPercent: number;
  /** Fine tuning applied after the saved centre-point coordinate. */
  offsetXPercent?: number;
  offsetYPercent?: number;
};

export const FURNITURE_VISUALS: Readonly<Record<FurnitureId, FurnitureVisual>> = {
  "cloud-bed": { src: cloudBed, widthPercent: 34 },
  lamp: { src: lamp, widthPercent: 13 },
  plant: { src: plant, widthPercent: 14 },
  picture: { src: picture, widthPercent: 15 },
  rug: { src: rug, widthPercent: 37, offsetYPercent: 3 },
  table: { src: table, widthPercent: 22 },
  curtain: { src: curtain, widthPercent: 27 },
  sofa: { src: sofa, widthPercent: 33 },
  bookshelf: { src: bookshelf, widthPercent: 19 },
  "flower-gift": { src: flowerGift, widthPercent: 10 },
  "clover-plant": { src: cloverPlant, widthPercent: 11 },
  "star-hanging": { src: starHanging, widthPercent: 11 },
  "rainbow-picture": { src: rainbowPicture, widthPercent: 15 },
  "cloud-frame": { src: cloudFrame, widthPercent: 14 },
};

export type OutfitVisual = {
  src: string;
  slot: OutfitSlot;
  /** Position and width within the square Cinnamoroll image canvas. */
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  rotateDegrees?: number;
};

export const OUTFIT_VISUALS: Readonly<Record<OutfitId, OutfitVisual>> = {
  "strawberry-clip": {
    src: strawberryClip,
    slot: "head",
    leftPercent: 61,
    topPercent: 30,
    widthPercent: 15,
    rotateDegrees: 8,
  },
  "sailor-hat": {
    src: sailorHat,
    slot: "head",
    leftPercent: 50,
    topPercent: 18,
    widthPercent: 31,
  },
  "flower-crown": {
    src: flowerCrown,
    slot: "head",
    leftPercent: 50,
    topPercent: 24,
    widthPercent: 34,
  },
  "star-headband": {
    src: starHeadband,
    slot: "head",
    leftPercent: 50,
    topPercent: 22,
    widthPercent: 29,
  },
  "red-ribbon": {
    src: redRibbon,
    slot: "neck",
    leftPercent: 47,
    topPercent: 48,
    widthPercent: 23,
  },
  "blue-scarf": {
    src: blueScarf,
    slot: "neck",
    leftPercent: 47,
    topPercent: 48,
    widthPercent: 25,
  },
  "bell-collar": {
    src: bellCollar,
    slot: "neck",
    leftPercent: 47,
    topPercent: 49,
    widthPercent: 24,
  },
  "rainbow-scarf": {
    src: rainbowScarf,
    slot: "neck",
    leftPercent: 47,
    topPercent: 47,
    widthPercent: 25,
  },
  "golden-bow": {
    src: goldenBow,
    slot: "head",
    leftPercent: 50,
    topPercent: 23,
    widthPercent: 27,
  },
};

/** Literal class maps keep all generated Tailwind utilities discoverable. */
export const WALLPAPER_SURFACE_CLASSES: Readonly<Record<WallpaperId, string>> = {
  "cloud-blue": "bg-gradient-to-b from-sky-100/5 via-blue-100/5 to-white/5",
  "starry-night":
    "bg-[radial-gradient(circle_at_16%_18%,rgba(255,255,255,0.95)_0_1px,transparent_2px),radial-gradient(circle_at_73%_28%,rgba(255,246,180,0.9)_0_1.5px,transparent_2.5px),radial-gradient(circle_at_40%_62%,rgba(255,255,255,0.85)_0_1px,transparent_2px),linear-gradient(180deg,rgba(49,46,129,0.88),rgba(88,80,160,0.7))] bg-[length:68px_68px,94px_94px,52px_52px,100%_100%]",
  "candy-stripes":
    "bg-[repeating-linear-gradient(112deg,rgba(255,255,255,0.72)_0_28px,rgba(251,207,232,0.72)_28px_56px,rgba(186,230,253,0.7)_56px_84px)]",
  forest:
    "bg-[radial-gradient(ellipse_at_18%_88%,rgba(74,142,93,0.72)_0_12%,transparent_13%),radial-gradient(ellipse_at_82%_80%,rgba(98,161,105,0.68)_0_14%,transparent_15%),linear-gradient(180deg,rgba(206,237,204,0.88),rgba(165,215,175,0.78))]",
};

export const FLOOR_SURFACE_CLASSES: Readonly<Record<FloorId, string>> = {
  "cream-wood": "bg-gradient-to-b from-amber-50/5 to-orange-100/5",
  "cloud-carpet":
    "bg-[radial-gradient(ellipse_at_18%_40%,rgba(255,255,255,0.85)_0_13%,transparent_14%),radial-gradient(ellipse_at_48%_66%,rgba(255,255,255,0.8)_0_16%,transparent_17%),radial-gradient(ellipse_at_82%_38%,rgba(255,255,255,0.82)_0_14%,transparent_15%),linear-gradient(180deg,rgba(186,230,253,0.78),rgba(224,242,254,0.88))]",
  "frosting-check":
    "bg-[conic-gradient(from_90deg_at_2px_2px,rgba(255,255,255,0.76)_25%,rgba(251,207,232,0.7)_0_50%,rgba(255,255,255,0.76)_0_75%,rgba(191,219,254,0.7)_0)] bg-[length:38px_38px]",
};
