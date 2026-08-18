import { motion } from "framer-motion";
import { getToy } from "../data/toys";
import type { ToyId, ToyPropMotion } from "../types";

type ToyPropProps = {
  toyId: ToyId;
  /** Replays the animation from the start when the same toy is used again. */
  animationKey: number;
  reducedMotion: boolean;
};

type PropSpec = {
  /** Resting place in the room, as percentages of the scene. */
  leftPercent: number;
  bottomPercent: number;
  /** Extra copies, staggered, for toys that read better as a group. */
  copies: number;
  durationSeconds: number;
  animate: Record<string, number[]>;
};

/**
 * Where each toy lives while she plays with it. Positions sit to her right and
 * low in the room so the prop reads as an object on the floor she is playing
 * with, rather than a label pinned to her.
 */
const PROP_SPECS: Readonly<Record<ToyPropMotion, PropSpec>> = {
  bounce: {
    leftPercent: 62,
    bottomPercent: 10,
    copies: 1,
    durationSeconds: 1.9,
    animate: {
      x: [-40, 10, -18, 6, 0],
      y: [0, -70, 0, -34, 0],
      rotate: [0, 180, 360, 480, 540],
    },
  },
  arc: {
    leftPercent: 60,
    bottomPercent: 34,
    copies: 1,
    durationSeconds: 1.9,
    animate: {
      x: [-150, -40, 60, 120],
      y: [30, -40, -22, 26],
      rotate: [0, 360, 720, 1_080],
    },
  },
  float: {
    leftPercent: 64,
    bottomPercent: 16,
    copies: 3,
    durationSeconds: 1.9,
    animate: {
      x: [0, 14, -8, 10],
      y: [10, -40, -80, -120],
      scale: [0.5, 1, 0.9, 0.4],
      opacity: [0, 1, 0.9, 0],
    },
  },
  sit: {
    leftPercent: 66,
    bottomPercent: 8,
    copies: 1,
    durationSeconds: 1.9,
    animate: {
      y: [0, -6, 0, -6, 0],
      rotate: [-5, 5, -5, 5, -5],
      scale: [1, 1.06, 1, 1.06, 1],
    },
  },
  swing: {
    leftPercent: 64,
    bottomPercent: 30,
    copies: 1,
    durationSeconds: 1.9,
    animate: {
      x: [-26, 26, -20, 20, 0],
      y: [0, -10, 0, -8, 0],
      rotate: [-16, 16, -12, 12, 0],
    },
  },
};

/**
 * The toy she is playing with, drawn into the room as a real object.
 *
 * Play used to be represented only by a small emoji floating over her face for
 * a moment, which read as "no toy appeared" — the toy is the point of the
 * interaction, so it belongs in the scene at her scale.
 */
export function ToyProp({ toyId, animationKey, reducedMotion }: ToyPropProps) {
  const toy = getToy(toyId);
  if (!toy) return null;
  const spec = PROP_SPECS[toy.propMotion];

  return (
    <div
      className="pointer-events-none absolute z-[25] size-0"
      style={{
        left: `${spec.leftPercent}%`,
        bottom: `${spec.bottomPercent}%`,
      }}
      data-toy-prop={toyId}
      aria-hidden="true"
    >
      {Array.from({ length: spec.copies }, (_, index) => (
        <motion.span
          // Anchored by its own bottom edge so the toy rests on the point
          // above, rather than hanging below it and off the bottom of the room.
          key={`${toyId}-${animationKey}-${index}`}
          className="absolute bottom-0 left-0 block text-4xl drop-shadow-[0_6px_5px_rgba(41,89,126,0.25)] sm:text-5xl"
          initial={reducedMotion ? { opacity: 1 } : undefined}
          animate={reducedMotion ? { opacity: 1 } : spec.animate}
          transition={{
            duration: spec.durationSeconds,
            delay: reducedMotion ? 0 : index * 0.22,
            ease: "easeInOut",
          }}
        >
          {toy.propEmoji}
        </motion.span>
      ))}
    </div>
  );
}
