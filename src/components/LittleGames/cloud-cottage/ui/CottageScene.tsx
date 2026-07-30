import { AnimatePresence, motion } from "framer-motion";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { PetSaveV1 } from "../types";
import { PetAvatar, type PetAvatarAction } from "./PetAvatar";
import { RoomWorld } from "./RoomWorld";

export type CottageTimeOfDay = "morning" | "day" | "evening" | "night";

export type CottageSceneAction = PetAvatarAction;

export type CottageSpeechBubble = {
  en: string;
  zh: string;
};

type PetZone = "ears" | "tummy";

type CottageSceneProps = {
  room: PetSaveV1["room"];
  equipped: PetSaveV1["equipped"];
  timeOfDay: CottageTimeOfDay;
  action: CottageSceneAction;
  actionKey: number;
  isSleeping: boolean;
  speech: CottageSpeechBubble | null;
  wishLabel: string;
  wishProgress?: string;
  actionEmoji?: string;
  reducedMotion: boolean;
  onPet: (zone: PetZone) => void;
  onWake: () => void;
};

const LIGHTING: Record<CottageTimeOfDay, string> = {
  morning: "bg-amber-50/5",
  day: "bg-sky-50/5",
  evening: "bg-gradient-to-b from-amber-200/20 via-rose-200/10 to-indigo-300/15",
  night: "bg-gradient-to-b from-indigo-950/45 via-blue-950/35 to-slate-950/45",
};

const CELEBRATION_BITS = [
  ["💗", "left-[5%] top-[16%]"],
  ["🎉", "left-[14%] top-[52%]"],
  ["💕", "left-[23%] top-[29%]"],
  ["🎀", "left-[32%] top-[68%]"],
  ["💖", "left-[42%] top-[12%]"],
  ["🎊", "left-[52%] top-[48%]"],
  ["💗", "left-[61%] top-[24%]"],
  ["🎀", "left-[70%] top-[70%]"],
  ["💕", "left-[79%] top-[38%]"],
  ["🎉", "left-[89%] top-[14%]"],
  ["💖", "left-[92%] top-[61%]"],
  ["🎊", "left-[10%] top-[76%]"],
] as const;

function effectFor(action: CottageSceneAction, actionEmoji?: string): string[] {
  if (action === "bath") return ["🫧", "💦", "🤧", "✨"];
  if (actionEmoji) return [actionEmoji];
  switch (action) {
    case "missed":
    case "pet":
    case "earWiggle":
    case "heartBurst":
    case "celebrate":
      return action === "heartBurst"
        ? ["💗", "💕", "💖", "✨"]
        : ["💗", "💕", "✨"];
    case "play":
    case "playBall":
    case "playFrisbee":
    case "playBubbles":
    case "playMusicBox":
    case "playSwing":
      return ["⭐", "✨"];
    case "sleep":
    case "nap":
      return ["💤"];
    case "wake":
      return ["☀️", "✨"];
    case "admire":
      return ["✨", "💗"];
    case "sit":
      return ["💕"];
    case "nestle":
      return ["☁️", "💤"];
    default:
      return [];
  }
}

export function CottageScene({
  room,
  equipped,
  timeOfDay,
  action,
  actionKey,
  isSleeping,
  speech,
  wishLabel,
  wishProgress,
  actionEmoji,
  reducedMotion,
  onPet,
  onWake,
}: CottageSceneProps) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const strokeDistance = useRef(0);
  const strokeHandled = useRef(false);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    pointerStart.current = { x: event.clientX, y: event.clientY };
    strokeDistance.current = 0;
    strokeHandled.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pointerStart.current;
    if (!start || strokeHandled.current || isSleeping) return;
    strokeDistance.current += Math.hypot(
      event.clientX - start.x,
      event.clientY - start.y,
    );
    pointerStart.current = { x: event.clientX, y: event.clientY };
    if (strokeDistance.current < 46) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const zone: PetZone = event.clientY - bounds.top < bounds.height * 0.55
      ? "ears"
      : "tummy";
    strokeHandled.current = true;
    onPet(zone);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    pointerStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const effects = effectFor(action, actionEmoji);
  const anchorFurnitureId = action === "sit"
    ? "sofa"
    : action === "nestle" || isSleeping
      ? "cloud-bed"
      : null;
  const anchorPlacement = anchorFurnitureId
    ? room.placed.find((placement) => placement.id === anchorFurnitureId)
    : undefined;

  return (
    <section
      className="relative isolate aspect-[3/2] min-h-[230px] w-full overflow-hidden rounded-[22px] border border-white/45 bg-sky-100 shadow-[0_24px_70px_rgba(56,115,160,0.22)] sm:aspect-auto sm:h-[min(56dvh,560px)] sm:min-h-[380px]"
      aria-label="大耳狗的雲朵小窩場景"
      data-time-of-day={timeOfDay}
      data-scene-action={action}
    >
      <RoomWorld
        room={room}
        ariaLabel="目前的雲朵小窩佈置"
        className="absolute inset-0 h-full rounded-none border-0 shadow-none"
      />
      <div className={`pointer-events-none absolute inset-0 transition-colors duration-700 ${LIGHTING[timeOfDay]}`} />

      <AnimatePresence>
        {action === "celebrate" ? (
          <motion.div
            key={`room-celebration-${actionKey}`}
            data-celebration-effects
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            aria-hidden="true"
          >
            {CELEBRATION_BITS.map(([symbol, position], index) => (
              <motion.span
                key={`${symbol}-${position}`}
                className={`absolute text-2xl drop-shadow-sm sm:text-4xl ${position}`}
                initial={reducedMotion ? false : { opacity: 0, y: 36, rotate: -18 }}
                animate={reducedMotion
                  ? { opacity: 0.92 }
                  : { opacity: [0, 1, 1], y: [36, -18, 4], rotate: [-18, 14, -6] }}
                transition={{ duration: 1.6, delay: index * 0.06, ease: "easeOut" }}
              >
                {symbol}
              </motion.span>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {timeOfDay === "night" ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(circle_at_50%_25%,rgba(147,197,253,0.12),transparent_58%)]" />
      ) : null}

      <div className="absolute left-3 top-3 z-20 max-w-[54%] sm:left-5 sm:top-5 sm:max-w-[42%]">
        <div className="rounded-[16px] border border-white/70 bg-white/88 px-3 py-2.5 text-xs font-semibold leading-5 text-sky-950 shadow-lg backdrop-blur-md sm:px-4 sm:py-3 sm:text-sm">
          <span className="mr-1" aria-hidden="true">💭</span>
          {wishLabel}
          {wishProgress ? (
            <span className="mt-1 block text-[11px] font-bold text-pink-600 sm:text-xs">
              {wishProgress}
            </span>
          ) : null}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {speech ? (
          <motion.div
            key={`${speech.en}-${actionKey}`}
            initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5, scale: 0.98 }}
            className="absolute right-3 top-4 z-30 max-w-[48%] rounded-[18px] border border-white/70 bg-white/92 px-3 py-2.5 text-center text-sky-950 shadow-xl backdrop-blur-md sm:right-6 sm:top-6 sm:max-w-[38%] sm:px-5 sm:py-3"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-black tracking-tight sm:text-base">{speech.en}</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-600 sm:text-xs">{speech.zh}</p>
            <span className="absolute -bottom-2 right-7 size-4 rotate-45 border-b border-r border-white/70 bg-white/92" aria-hidden="true" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className={`absolute z-20 ${
          anchorPlacement
            ? ""
            : "bottom-[1%] left-1/2 w-[46%] -translate-x-1/2 sm:w-[40%]"
        }`}
        style={anchorPlacement
          ? {
              left: `${anchorPlacement.x}%`,
              top: `${Math.max(24, anchorPlacement.y - 12)}%`,
              width: action === "sit" ? "30%" : "31%",
              transform: "translate(-50%, -50%)",
            }
          : undefined}
      >
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onClick={() => {
            if (strokeHandled.current) {
              strokeHandled.current = false;
              return;
            }
            if (isSleeping) onWake();
            else onPet("ears");
          }}
          className="relative block w-full touch-pan-y rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-300"
          aria-label={isSleeping ? "輕輕叫醒大耳狗" : "摸摸大耳狗；也可以用手指輕撫"}
        >
          <PetAvatar
            equipped={equipped}
            action={action}
            actionKey={actionKey}
            reducedMotion={reducedMotion}
            isSleeping={isSleeping}
          />
        </button>

        <AnimatePresence>
          {effects.length > 0 ? (
            <motion.div
              key={`effects-${action}-${actionKey}`}
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.6, y: 14 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: -12 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -30 }}
              className="pointer-events-none absolute inset-x-0 top-[20%] flex items-center justify-center gap-3 text-3xl sm:text-4xl"
              aria-hidden="true"
            >
              {effects.map((effect, index) => (
                <motion.span
                  key={`${effect}-${index}`}
                  animate={reducedMotion ? undefined : { y: [0, -12, 0], rotate: [-8, 8, -4] }}
                  transition={{ duration: 1.2, delay: index * 0.12, repeat: action === "sleep" ? Infinity : 0 }}
                >
                  {effect}
                </motion.span>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="pointer-events-none absolute inset-x-10 bottom-2 h-8 rounded-[50%] bg-sky-950/10 blur-xl sm:inset-x-[34%]" aria-hidden="true" />
    </section>
  );
}
