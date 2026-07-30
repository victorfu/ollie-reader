import { motion } from "framer-motion";
import type { PetSaveV1 } from "../types";
import {
  CINNAMOROLL_SRC,
  OUTFIT_VISUALS,
} from "./cottageAssets";

export type PetAvatarAction =
  | "idle"
  | "intro"
  | "missed"
  | "pet"
  | "earWiggle"
  | "feed"
  | "bath"
  | "play"
  | "playBall"
  | "playFrisbee"
  | "playBubbles"
  | "playMusicBox"
  | "playSwing"
  | "nap"
  | "sleep"
  | "wake"
  | "spin"
  | "dance"
  | "roll"
  | "fly"
  | "cloudBounce"
  | "heartBurst"
  | "celebrate"
  | "admire"
  | "sit"
  | "nestle";

export type PetAvatarProps = {
  equipped: PetSaveV1["equipped"];
  action?: PetAvatarAction;
  actionKey?: number;
  /** When positive, forces a one-shot spin that replays as this key changes. */
  spinKey?: number;
  reducedMotion?: boolean;
  isSleeping?: boolean;
  className?: string;
  imageClassName?: string;
  alt?: string;
};

function animationFor(
  action: PetAvatarAction,
  reducedMotion: boolean,
): Record<string, number | number[]> {
  if (reducedMotion) {
    return action === "sleep" || action === "nap"
      ? { x: 0, y: 8, rotate: -5, scale: 0.94 }
      : { x: 0, y: 0, rotate: 0, scale: 1 };
  }

  switch (action) {
    case "intro":
      return { x: [-260, 18, 0], y: [4, -8, 0], rotate: [-5, 3, 0], scale: 1 };
    case "missed":
      return { x: [-180, 20, 0], y: [0, -18, 0], rotate: [-8, 5, 0], scale: [0.9, 1.12, 1] };
    case "pet":
      return { x: 0, y: [0, -8, 0], rotate: [-3, 3, 0], scale: [1, 1.05, 1] };
    case "earWiggle":
      return { x: 0, y: 0, rotate: [-5, 5, -3, 3, 0], scale: [1, 1.04, 1] };
    case "feed":
      return { x: 0, y: [0, 4, -2, 0], rotate: [-2, 2, -2, 0], scale: [1, 1.04, 1] };
    case "bath":
      return {
        x: [0, -10, 10, -12, 12, 0],
        y: [0, -5, 0, -15, 2, 0],
        rotate: [-3, 7, -9, 11, -6, 0],
        scale: [1, 0.94, 1.08, 0.97, 1.12, 1],
      };
    case "play":
      return { x: [-35, 40, -20, 0], y: [0, -22, 0, -10, 0], rotate: [-6, 8, -4, 0], scale: 1 };
    case "playBall":
      return { x: [-48, 38, -22, 0], y: [0, -30, 0, -18, 0], rotate: [-8, 10, -5, 0], scale: [1, 1.05, 0.98, 1] };
    case "playFrisbee":
      return { x: [-70, 62, 18, 0], y: [0, -42, -12, 0], rotate: [-12, 14, -5, 0], scale: [1, 0.94, 1.06, 1] };
    case "playBubbles":
      return { x: [0, 10, -8, 0], y: [0, -38, -12, -28, 0], rotate: [-4, 6, -3, 0], scale: [1, 1.1, 0.94, 1.05, 1] };
    case "playMusicBox":
      return { x: [-12, 12, -8, 8, 0], y: [0, -10, 0, -10, 0], rotate: [-10, 10, -8, 8, 0], scale: 1 };
    case "playSwing":
      return { x: [-30, 34, -26, 28, 0], y: [4, -24, 2, -18, 0], rotate: [-14, 16, -12, 12, 0], scale: [1, 1.04, 1] };
    case "nap":
      return { x: 0, y: [5, 8, 5], rotate: [-4, -6, -4], scale: [0.96, 0.93, 0.96] };
    case "sleep":
      return { x: 0, y: [7, 10, 7], rotate: -5, scale: 0.92 };
    case "wake":
      return { x: 0, y: [10, -12, 0], rotate: [-5, 4, 0], scale: [0.92, 1.04, 1] };
    case "spin":
      return { x: 0, y: [0, -12, 0], rotate: [0, 360], scale: [1, 1.08, 1] };
    case "dance":
      return { x: [-18, 20, -14, 16, 0], y: [0, -20, 0, -14, 0], rotate: [-8, 10, -7, 8, 0], scale: 1 };
    case "roll":
      return { x: [-45, 48, 0], y: [0, 8, 0], rotate: [0, 360, 0], scale: [1, 0.9, 1] };
    case "fly":
      return { x: [-90, 85, -30, 0], y: [0, -120, -80, 0], rotate: [-5, 6, -3, 0], scale: [1, 0.94, 1] };
    case "cloudBounce":
      return { x: 0, y: [0, -75, 0, -42, 0], rotate: [-4, 4, -2, 0], scale: [1, 1.06, 0.96, 1] };
    case "heartBurst":
      return { x: 0, y: [0, -24, 0], rotate: [-6, 6, 0], scale: [1, 1.14, 1] };
    case "celebrate":
      return { x: 0, y: [0, -32, 0], rotate: [-8, 8, 0], scale: [1, 1.18, 1.06] };
    case "admire":
      return { x: [0, -8, 7, 0], y: [0, -5, 0], rotate: [-2, 3, 0], scale: [1, 1.05, 1] };
    case "sit":
      return { x: 0, y: [0, 5, 5], rotate: 0, scale: [1, 0.94, 0.94] };
    case "nestle":
      return { x: [0, 7, 7], y: [0, 8, 8], rotate: [0, -5, -5], scale: [1, 0.92, 0.92] };
    case "idle":
    default:
      return { x: 0, y: [0, -7, 0], rotate: [0, -1.5, 0, 1.5, 0], scale: 1 };
  }
}

function transitionFor(action: PetAvatarAction, reducedMotion: boolean) {
  if (reducedMotion) return { duration: 0.12 };
  if (action === "idle" || action === "sleep" || action === "nap") {
    return {
      duration: action === "idle" ? 4.2 : action === "nap" ? 2.8 : 3.5,
      repeat: Infinity,
      ease: "easeInOut" as const,
    };
  }
  return {
    duration: action === "fly" ? 2.1 : action === "bath" ? 2.35 : 1.05,
    ease: "easeInOut" as const,
  };
}

export function PetAvatar({
  equipped,
  action = "idle",
  actionKey = 0,
  spinKey,
  reducedMotion = false,
  isSleeping = false,
  className = "",
  imageClassName = "",
  alt = "開心的大耳狗喜拿",
}: PetAvatarProps) {
  const activeAction = spinKey !== undefined && spinKey > 0 ? "spin" : action;
  const headVisual = equipped.head ? OUTFIT_VISUALS[equipped.head] : null;
  const neckVisual = equipped.neck ? OUTFIT_VISUALS[equipped.neck] : null;

  return (
    <motion.span
      key={`${activeAction}-${actionKey}-${spinKey ?? "no-spin"}`}
      animate={animationFor(activeAction, reducedMotion)}
      transition={transitionFor(activeAction, reducedMotion)}
      className={`relative block ${className}`}
      data-pet-avatar
      data-avatar-action={activeAction}
      data-equipped-head={equipped.head ?? ""}
      data-equipped-neck={equipped.neck ?? ""}
    >
      <span className={`relative block ${isSleeping ? "-rotate-6" : ""}`}>
        <img
          src={CINNAMOROLL_SRC}
          alt={alt}
          className={`relative z-0 block h-auto w-full select-none drop-shadow-[0_16px_12px_rgba(41,89,126,0.25)] ${imageClassName}`}
          draggable={false}
        />

        {neckVisual ? (
          <img
            src={neckVisual.src}
            alt=""
            className="pointer-events-none absolute z-10 h-auto select-none drop-shadow-[0_4px_3px_rgba(41,89,126,0.16)]"
            style={{
              left: `${neckVisual.leftPercent}%`,
              top: `${neckVisual.topPercent}%`,
              width: `${neckVisual.widthPercent}%`,
              transform: `translateX(-50%) rotate(${neckVisual.rotateDegrees ?? 0}deg)`,
            }}
            draggable={false}
            data-outfit-layer={equipped.neck}
            data-outfit-slot="neck"
            aria-hidden="true"
          />
        ) : null}

        {headVisual ? (
          <img
            src={headVisual.src}
            alt=""
            className="pointer-events-none absolute z-20 h-auto select-none drop-shadow-[0_4px_3px_rgba(41,89,126,0.16)]"
            style={{
              left: `${headVisual.leftPercent}%`,
              top: `${headVisual.topPercent}%`,
              width: `${headVisual.widthPercent}%`,
              transform: `translateX(-50%) rotate(${headVisual.rotateDegrees ?? 0}deg)`,
            }}
            draggable={false}
            data-outfit-layer={equipped.head}
            data-outfit-slot="head"
            aria-hidden="true"
          />
        ) : null}
      </span>
    </motion.span>
  );
}
