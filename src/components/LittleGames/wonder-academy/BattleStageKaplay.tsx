import kaplay, { type GameObj, type KAPLAYCtx } from "kaplay";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { scheduleKaplayInit, startKaplaySceneWhenReady } from "../kaplayLifecycle";

const GAME_W = 560;
const GAME_H = 240;
const ASPECT = GAME_W / GAME_H;
const HERO = { x: 150, y: 166 };
const WILD = { x: 412, y: 90 };

// One live battle stage at a time (strict-mode / HMR safety).
let activeBattleStage: KAPLAYCtx | null = null;

export type BattleEvent = { kind: string; seq: number };

type Props = {
  wildPortrait: string;
  playerPortrait: string;
  wildSleepy: boolean;
  wildShiny?: boolean;
  heroShiny?: boolean;
  /** Latest battle-log event; `seq` increments each action to retrigger. */
  event: BattleEvent;
};

/**
 * Kaplay battle stage (spec §8): the two creatures and their attack / sleepy /
 * faint 演出 live on a canvas; HP bars, names and the command panel stay in the
 * DOM overlay. Creature art is the existing portrait, loaded as a sprite (with a
 * drawn-circle fallback if it fails). Animations are driven by the latest battle
 * event, bridged from React via a ref — no full rebuild per turn.
 *
 * Sleepy/faint use transforms + drawn particles only (no canvas text — Kaplay's
 * default font can't render CJK or emoji).
 */
export default function BattleStageKaplay({ wildPortrait, playerPortrait, wildSleepy, wildShiny, heroShiny, event }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const playEventRef = useRef<((kind: string) => void) | null>(null);
  const sleepyRef = useRef(wildSleepy);
  useEffect(() => {
    sleepyRef.current = wildSleepy;
  }, [wildSleepy]);

  const buildRef = useRef({ wildPortrait, playerPortrait, wildShiny: !!wildShiny, heroShiny: !!heroShiny });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const hasSize = size.width > 0;

  // Fire the matching animation whenever a new battle event arrives.
  const prevSeqRef = useRef(-1);
  useEffect(() => {
    if (event.seq === prevSeqRef.current) return;
    prevSeqRef.current = event.seq;
    playEventRef.current?.(event.kind);
  }, [event]);

  // Measure → explicit pixel size (macrotask kick survives paused rAF / 0×0).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame = 0;
    let timer = 0;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      const avail = rect.width > 0 ? rect.width : GAME_W;
      const width = Math.floor(Math.min(avail, GAME_W));
      const height = Math.floor(width / ASPECT);
      setSize((cur) => (cur.width === width && cur.height === height ? cur : { width, height }));
    };
    const queue = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const ro = new ResizeObserver(queue);
    ro.observe(stage);
    timer = window.setTimeout(measure, 0);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!hasSize) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const build = buildRef.current;
    // Respect the OS "reduce motion" setting: keep the informative flashes and
    // sleepy pose, but drop the decorative idle bob, lunges and twinkle.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let game: KAPLAYCtx | null = null;

    const cancel = scheduleKaplayInit(() => {
      if (disposed) return;
      try {
        activeBattleStage?.quit();
      } catch {
        // already gone
      }

      const k = kaplay({
        canvas,
        width: GAME_W,
        height: GAME_H,
        stretch: true,
        letterbox: true,
        global: false,
        debug: false,
        focus: false,
        loadingScreen: false,
        background: [228, 238, 248],
        pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
      });
      game = k;
      activeBattleStage = k;

      const failed = new Set<string>();
      k.onLoadError((name) => {
        failed.add(name);
      });
      k.loadSprite("wa-wild", build.wildPortrait);
      k.loadSprite("wa-hero", build.playerPortrait);

      k.scene("battle", () => {
        // soft ground bands
        k.add([k.rect(GAME_W, 92, { radius: 0 }), k.pos(0, GAME_H - 92), k.color("#cde8c9"), k.opacity(0.6), k.z(1)]);
        const shadow = (x: number, y: number, w: number) =>
          k.add([k.rect(w, 12, { radius: 6 }), k.pos(x, y + 36), k.anchor("center"), k.color("#2a2150"), k.opacity(0.14), k.z(2)]);
        shadow(WILD.x, WILD.y, 72);
        shadow(HERO.x, HERO.y, 86);

        const makeCreature = (sprite: string, base: { x: number; y: number }, w: number, flip: boolean, fallback: string, shiny: boolean) => {
          const obj = failed.has(sprite)
            ? k.add([k.circle(w / 2.4), k.pos(base.x, base.y), k.anchor("center"), k.color(shiny ? "#ffe18c" : fallback), k.z(10)])
            : shiny
              ? k.add([k.sprite(sprite, { width: w, height: w }), k.pos(base.x, base.y), k.anchor("center"), k.color("#ffe6a8"), k.z(10)])
              : k.add([k.sprite(sprite, { width: w, height: w }), k.pos(base.x, base.y), k.anchor("center"), k.z(10)]);
          if (flip && !failed.has(sprite)) (obj as GameObj).flipX = true;
          return obj;
        };

        const wild = makeCreature("wa-wild", WILD, 88, false, "#b79be0", build.wildShiny);
        const hero = makeCreature("wa-hero", HERO, 100, true, "#ffd66b", build.heroShiny);
        let heroFading = false;

        const flashAt = (x: number, y: number) => {
          const f = k.add([k.circle(46), k.pos(x, y), k.anchor("center"), k.color("#ffffff"), k.opacity(0.7), k.z(20)]);
          f.onUpdate(() => {
            (f as GameObj).opacity -= k.dt() * 3.5;
            if ((f as GameObj).opacity <= 0) k.destroy(f);
          });
        };
        const sparkleAt = (x: number, y: number) => {
          if (reduced) {
            flashAt(x, y);
            return;
          }
          for (let i = 0; i < 8; i += 1) {
            k.add([
              k.circle(k.rand(2, 4)),
              k.pos(x + k.rand(-16, 16), y + k.rand(-16, 16)),
              k.anchor("center"),
              k.color(k.choose(["#ffd66b", "#fff3b0", "#9be7ff"])),
              k.opacity(1),
              k.move(k.rand(0, 360), k.rand(30, 70)),
              k.lifespan(0.6, { fade: 0.3 }),
              k.z(21),
            ]);
          }
        };

        // shiny creatures twinkle continuously (skipped under reduced motion)
        if (!reduced && (build.wildShiny || build.heroShiny)) {
          k.loop(0.5, () => {
            if (build.wildShiny) sparkleAt(WILD.x, WILD.y - 6);
            if (build.heroShiny) sparkleAt(HERO.x, HERO.y - 6);
          });
        }

        // anim: { actor, t, dur } — a lunge toward the opponent and back.
        let anim: { actor: GameObj; from: { x: number; y: number }; to: { x: number; y: number }; t: number } | null = null;

        const heroHit = () => {
          if (!reduced) anim = { actor: hero, from: HERO, to: WILD, t: 0 };
          flashAt(WILD.x, WILD.y);
        };
        const wildHit = () => {
          if (!reduced) anim = { actor: wild, from: WILD, to: HERO, t: 0 };
          flashAt(HERO.x, HERO.y);
        };
        // A wild response implies the player just acted, so play the player's hit
        // first, then the wild's reply — a satisfying two-beat without the log.
        playEventRef.current = (kind: string) => {
          if (kind === "playerMove") {
            heroHit();
          } else if (kind === "wildMove") {
            heroHit();
            k.wait(0.4, wildHit);
          } else if (kind === "wildSleepy") {
            heroHit();
          } else if (kind === "playerFainted") {
            wildHit();
            k.wait(0.45, () => {
              heroFading = true;
            });
          } else if (kind === "catchAttempt") {
            sparkleAt(WILD.x, WILD.y);
          }
        };

        k.onUpdate(() => {
          const tm = k.time();
          // idle bob — decorative, so flatten it under reduced motion (the
          // sleepy creature keeps its lowered/tilted resting pose).
          if (!anim || anim.actor !== hero) hero.pos.y = reduced ? HERO.y : HERO.y + Math.sin(tm * 3) * 2.5;
          if (!anim || anim.actor !== wild) {
            wild.pos.y = reduced
              ? WILD.y + (sleepyRef.current ? 6 : 0)
              : WILD.y + (sleepyRef.current ? 6 + Math.sin(tm * 1.4) * 1.5 : Math.sin(tm * 3.3) * 2.5);
          }
          (wild as GameObj).angle = sleepyRef.current ? 8 : 0;

          if (anim) {
            anim.t += k.dt();
            const dur = 0.34;
            const p = Math.min(1, anim.t / dur);
            const k2 = Math.sin(p * Math.PI); // 0→1→0
            anim.actor.pos.x = anim.from.x + (anim.to.x - anim.from.x) * 0.28 * k2;
            anim.actor.pos.y = anim.from.y + (anim.to.y - anim.from.y) * 0.28 * k2;
            if (p >= 1) {
              anim.actor.pos.x = anim.from.x;
              anim = null;
            }
          }

          if (heroFading) (hero as GameObj).opacity = Math.max(0.25, ((hero as GameObj).opacity ?? 1) - k.dt() * 1.2);
        });
      });

      startKaplaySceneWhenReady(k, "battle");
    });

    return () => {
      disposed = true;
      playEventRef.current = null;
      cancel();
      if (game) {
        if (activeBattleStage === game) activeBattleStage = null;
        try {
          game.quit();
        } catch {
          // already torn down
        }
      }
    };
  }, [hasSize]);

  const frameStyle: CSSProperties = hasSize
    ? { width: size.width, height: size.height, margin: "0 auto", display: "block" }
    : { width: "100%", aspectRatio: `${GAME_W} / ${GAME_H}`, maxWidth: GAME_W, margin: "0 auto", display: "block" };

  return (
    <div ref={stageRef} style={{ width: "100%" }}>
      <div style={frameStyle}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>
    </div>
  );
}
