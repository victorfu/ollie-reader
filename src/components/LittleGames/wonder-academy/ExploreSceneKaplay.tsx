import kaplay, { type GameObj, type KAPLAYCtx } from "kaplay";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { scheduleKaplayInit, startKaplaySceneWhenReady } from "../kaplayLifecycle";
import { tileAt, type SceneState } from "./sceneMap";
import type { RegionTheme } from "./wonderAcademyRegions";

const TILE = 64;
const PAD = 20;

const dimsOf = (map: string[]) => {
  const cols = map[0].length;
  const rows = map.length;
  const gameW = cols * TILE + PAD * 2;
  const gameH = rows * TILE + PAD * 2;
  return { cols, rows, gameW, gameH, aspect: gameW / gameH };
};

// Only ever one live explore canvas — quit any stale instance (React strict-mode
// double-invoke / HMR) before creating a new one, mirroring the legacy host.
let activeExploreGame: KAPLAYCtx | null = null;

type Props = {
  scene: SceneState;
  map: string[];
  theme: RegionTheme;
  wardenDone: boolean;
  onMove: (dx: number, dy: number) => void;
  onCloseMessage: () => void;
};

type Decor = {
  obj: GameObj;
  kind: "grass" | "chest" | "owl" | "warden" | "exit";
  baseY: number;
  phase: number;
  glow?: GameObj;
};

/**
 * Kaplay-rendered forest exploration. The canvas owns smooth, tile-locked
 * character movement and all the animated vector art; the React reducer stays
 * authoritative for tile effects. Every committed step dispatches the same
 * `sceneMove(dx, dy)` action, so encounters / chests / NPCs / warden / exit
 * behave identically — they just look alive now.
 *
 * The map and palette come from the active region (props), so each region
 * renders its own layout and colour theme. Art is entirely original Kaplay
 * primitives — no sprite assets, no canvas emoji — so nothing async blocks the
 * first frame.
 *
 * Sizing follows the proven host pattern: measure a stage, give the canvas an
 * explicit pixel size, and defer init — Kaplay locks its buffer at init, so it
 * must not start before the element has a real size.
 */
export default function ExploreSceneKaplay({
  scene,
  map,
  theme,
  wardenDone,
  onMove,
  onCloseMessage,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  // Bridge so the reducer looting a chest (scene.opened grows) pops the matching
  // chest open in the canvas, without rebuilding the whole world.
  const openChestRef = useRef<((cellId: string) => void) | null>(null);
  const prevOpenedRef = useRef(scene.opened);
  useEffect(() => {
    const prev = new Set(prevOpenedRef.current);
    for (const cell of scene.opened) {
      if (!prev.has(cell)) openChestRef.current?.(cell);
    }
    prevOpenedRef.current = scene.opened;
  }, [scene.opened]);

  // First-render snapshot: the world is built once; later prop changes (a new
  // NPC line) must not rebuild the canvas.
  const buildRef = useRef({
    start: { x: scene.x, y: scene.y },
    opened: scene.opened,
    wardenDone,
    map,
    theme,
  });

  const { gameW, gameH, aspect } = dimsOf(map);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const hasSize = size.width > 0;

  // Measure the stage → explicit pixel canvas size (preserves aspect, caps at
  // native game width). A macrotask kicks the first measure even when rAF is
  // paused (headless / idle 0×0 viewport); ResizeObserver handles later resizes.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame = 0;
    let timer = 0;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      const avail = rect.width > 0 ? rect.width : gameW;
      const width = Math.floor(Math.min(avail, gameW));
      const height = Math.floor(width / aspect);
      setSize((cur) =>
        cur.width === width && cur.height === height ? cur : { width, height },
      );
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
  }, [gameW, aspect]);

  // Build the Kaplay world once the canvas has a real pixel size.
  useEffect(() => {
    if (!hasSize) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const build = buildRef.current;
    const worldMap = build.map;
    const theme = build.theme;
    const dims = dimsOf(worldMap);

    let disposed = false;
    let game: KAPLAYCtx | null = null;

    const cancel = scheduleKaplayInit(() => {
      if (disposed) return;
      try {
        activeExploreGame?.quit();
      } catch {
        // previous instance already gone
      }

      const k = kaplay({
        canvas,
        width: dims.gameW,
        height: dims.gameH,
        stretch: true,
        letterbox: true,
        global: false,
        debug: false,
        focus: true,
        loadingScreen: false,
        background: theme.bg,
        pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
      });
      game = k;
      activeExploreGame = k;

      const openedSet = new Set(build.opened);
      const center = (cx: number, cy: number) =>
        k.vec2(PAD + cx * TILE + TILE / 2, PAD + cy * TILE + TILE / 2);

      k.scene("explore", () => {
        const decor: Decor[] = [];
        const chests = new Map<string, { px: number; py: number; grp: GameObj }>();

        const ground = (px: number, py: number, color: string) =>
          k.add([
            k.rect(TILE - 5, TILE - 5, { radius: 13 }),
            k.pos(px + 2.5, py + 2.5),
            k.color(color),
            k.z(2),
          ]);

        const addPath = (px: number, py: number) => {
          ground(px, py, theme.ground);
          if ((px + py) % 3 === 0) {
            k.add([
              k.circle(3),
              k.pos(px + 20, py + 22),
              k.anchor("center"),
              k.color("#000000"),
              k.opacity(0.06),
              k.z(3),
            ]);
          }
        };

        const addTree = (px: number, py: number) => {
          ground(px, py, theme.treeBase);
          const cx = px + TILE / 2;
          const cy = py + TILE / 2;
          k.add([k.rect(11, 17, { radius: 3 }), k.pos(cx, cy + 11), k.anchor("center"), k.color(theme.trunk), k.z(5)]);
          k.add([k.circle(15), k.pos(cx - 9, cy - 1), k.anchor("center"), k.color(theme.canopyA), k.z(6)]);
          k.add([k.circle(15), k.pos(cx + 9, cy - 1), k.anchor("center"), k.color(theme.canopyA), k.z(6)]);
          k.add([k.circle(17), k.pos(cx, cy - 12), k.anchor("center"), k.color(theme.canopyB), k.z(7)]);
        };

        const addGrass = (px: number, py: number) => {
          ground(px, py, theme.grass);
          const cx = px + TILE / 2;
          const cy = py + TILE / 2;
          const blades: [number, string][] = [
            [-11, theme.treeBase],
            [0, theme.canopyB],
            [11, theme.treeBase],
          ];
          blades.forEach(([ox, col], i) => {
            const blade = k.add([
              k.rect(5, 19, { radius: 3 }),
              k.pos(cx + ox, cy + 13),
              k.anchor("bot"),
              k.rotate(0),
              k.color(col),
              k.z(6),
            ]);
            decor.push({ obj: blade, kind: "grass", baseY: cy, phase: i * 1.1 + (px + py) * 0.03 });
          });
        };

        const addChest = (px: number, py: number, opened: boolean, cellId: string) => {
          ground(px, py, theme.ground);
          const grp = k.add([k.pos(px + TILE / 2, py + TILE / 2), k.z(8)]);
          grp.add([k.rect(34, 22, { radius: 5 }), k.pos(0, 5), k.anchor("center"), k.color(opened ? "#9a7d52" : "#a9743e")]);
          grp.add([
            k.rect(36, 13, { radius: 5 }),
            k.pos(opened ? -2 : 0, opened ? -10 : -7),
            k.anchor("center"),
            k.rotate(opened ? -34 : 0),
            k.color(opened ? "#b3935f" : "#c98a4a"),
          ]);
          if (!opened) {
            grp.add([k.rect(36, 5), k.pos(0, 0), k.anchor("center"), k.color("#f4c542")]);
            grp.add([k.rect(7, 9, { radius: 2 }), k.pos(0, 1), k.anchor("center"), k.color("#f4c542")]);
            decor.push({ obj: grp, kind: "chest", baseY: py + TILE / 2, phase: (px + py) * 0.04 });
            chests.set(cellId, { px, py, grp });
          }
        };

        const addOwl = (px: number, py: number) => {
          ground(px, py, "#e3d3f5");
          const grp = k.add([k.pos(px + TILE / 2, py + TILE / 2), k.z(9)]);
          grp.add([k.polygon([k.vec2(-12, -10), k.vec2(-7, -19), k.vec2(-3, -9)]), k.color("#9b7fd6")]);
          grp.add([k.polygon([k.vec2(12, -10), k.vec2(7, -19), k.vec2(3, -9)]), k.color("#9b7fd6")]);
          grp.add([k.circle(16), k.pos(0, 2), k.anchor("center"), k.color("#9b7fd6")]);
          grp.add([k.circle(10), k.pos(0, 6), k.anchor("center"), k.color("#d6c4f2")]);
          grp.add([k.circle(6), k.pos(-6, -3), k.anchor("center"), k.color("#ffffff")]);
          grp.add([k.circle(6), k.pos(6, -3), k.anchor("center"), k.color("#ffffff")]);
          grp.add([k.circle(2.5), k.pos(-6, -3), k.anchor("center"), k.color("#3a2e57")]);
          grp.add([k.circle(2.5), k.pos(6, -3), k.anchor("center"), k.color("#3a2e57")]);
          grp.add([k.polygon([k.vec2(0, -1), k.vec2(-3, 3), k.vec2(3, 3)]), k.color("#f4a93a")]);
          decor.push({ obj: grp, kind: "owl", baseY: py + TILE / 2, phase: (px + py) * 0.05 });
        };

        const addWarden = (px: number, py: number, done: boolean) => {
          ground(px, py, "#d9c2f5");
          const cx = px + TILE / 2;
          const cy = py + TILE / 2;
          let glow: GameObj | undefined;
          if (!done) {
            glow = k.add([k.circle(27), k.pos(cx, cy), k.anchor("center"), k.color("#ff5b6e"), k.opacity(0.3), k.z(4)]);
          }
          const grp = k.add([k.pos(cx, cy), k.scale(1), k.z(10)]);
          grp.add([k.circle(20), k.pos(0, 3), k.anchor("center"), k.color(done ? "#9ac0e0" : "#7a5fd0")]);
          grp.add([k.circle(13), k.pos(0, 7), k.anchor("center"), k.color(done ? "#c4ddef" : "#9b82e0")]);
          grp.add([k.circle(5), k.pos(-7, -1), k.anchor("center"), k.color("#ffffff")]);
          grp.add([k.circle(5), k.pos(7, -1), k.anchor("center"), k.color("#ffffff")]);
          grp.add([k.circle(2.6), k.pos(-7, -1), k.anchor("center"), k.color("#2a2150")]);
          grp.add([k.circle(2.6), k.pos(7, -1), k.anchor("center"), k.color("#2a2150")]);
          grp.add([
            k.polygon([
              k.vec2(-13, -15),
              k.vec2(-7, -25),
              k.vec2(0, -15),
              k.vec2(7, -25),
              k.vec2(13, -15),
            ]),
            k.color("#f4c542"),
          ]);
          decor.push({ obj: grp, kind: "warden", baseY: cy, phase: 0, glow });
        };

        const addExit = (px: number, py: number) => {
          ground(px, py, "#cdb6ef");
          const cx = px + TILE / 2;
          const cy = py + TILE / 2;
          const glow = k.add([k.circle(23), k.pos(cx, cy), k.anchor("center"), k.color("#c9b1f0"), k.opacity(0.5), k.z(4)]);
          const grp = k.add([k.pos(cx, cy), k.scale(1), k.z(8)]);
          grp.add([k.rect(30, 40, { radius: 15 }), k.pos(0, 4), k.anchor("center"), k.color("#8a6fc8")]);
          grp.add([k.rect(19, 29, { radius: 10 }), k.pos(0, 9), k.anchor("center"), k.color("#efe6ff")]);
          grp.add([k.circle(2.5), k.pos(5, 9), k.anchor("center"), k.color("#8a6fc8")]);
          decor.push({ obj: grp, kind: "exit", baseY: cy, phase: 0, glow });
        };

        const addFlower = (px: number, py: number) => {
          ground(px, py, theme.grass);
          const cx = px + TILE / 2;
          const cy = py + TILE / 2;
          const petals = ["#ff9ec4", "#ffd66b", "#fff3b0"];
          [[-10, 6], [12, -4], [2, 14]].forEach(([ox, oy], i) => {
            const col = petals[i % petals.length];
            for (let p = 0; p < 5; p += 1) {
              const a = (p / 5) * Math.PI * 2;
              k.add([k.circle(3.2), k.pos(cx + ox + Math.cos(a) * 4, cy + oy + Math.sin(a) * 4), k.anchor("center"), k.color(col), k.z(6)]);
            }
            k.add([k.circle(2.4), k.pos(cx + ox, cy + oy), k.anchor("center"), k.color("#ffd66b"), k.z(7)]);
          });
        };

        const addPond = (px: number, py: number) => {
          ground(px, py, theme.ground);
          const cx = px + TILE / 2;
          const cy = py + TILE / 2;
          const grp = k.add([k.pos(cx, cy), k.z(5)]);
          grp.add([k.rect(TILE - 12, TILE - 16, { radius: 16 }), k.pos(0, 2), k.anchor("center"), k.color("#5aa6d8")]);
          grp.add([k.rect(TILE - 20, TILE - 26, { radius: 12 }), k.pos(0, 0), k.anchor("center"), k.color("#8fd0ef")]);
          grp.add([k.rect(14, 6, { radius: 3 }), k.pos(-7, -7), k.anchor("center"), k.color("#cdeefb"), k.opacity(0.85)]);
        };

        for (let y = 0; y < dims.rows; y += 1) {
          for (let x = 0; x < dims.cols; x += 1) {
            const t = worldMap[y][x];
            const px = PAD + x * TILE;
            const py = PAD + y * TILE;
            switch (t) {
              case "T":
                addTree(px, py);
                break;
              case "G":
                addGrass(px, py);
                break;
              case "C":
                addChest(px, py, openedSet.has(`${x},${y}`), `${x},${y}`);
                break;
              case "N":
                addOwl(px, py);
                break;
              case "W":
                addWarden(px, py, build.wardenDone);
                break;
              case "X":
                addExit(px, py);
                break;
              case "F":
                addFlower(px, py);
                break;
              case "O":
                addPond(px, py);
                break;
              default:
                addPath(px, py);
            }
          }
        }

        const openChest = (cellId: string) => {
          const c = chests.get(cellId);
          if (!c) return;
          chests.delete(cellId);
          c.grp.destroy();
          const lid = k.add([k.pos(c.px + TILE / 2, c.py + TILE / 2), k.z(8)]);
          lid.add([k.rect(34, 22, { radius: 5 }), k.pos(0, 5), k.anchor("center"), k.color("#9a7d52")]);
          lid.add([k.rect(36, 13, { radius: 5 }), k.pos(-2, -10), k.anchor("center"), k.rotate(-34), k.color("#b3935f")]);
          for (let i = 0; i < 8; i += 1) {
            k.add([
              k.circle(k.rand(2, 4)),
              k.pos(c.px + TILE / 2 + k.rand(-14, 14), c.py + TILE / 2 + k.rand(-10, 6)),
              k.anchor("center"),
              k.color(k.choose(["#ffd66b", "#fff3b0", "#f4c542"])),
              k.opacity(1),
              k.move(k.rand(0, 360), k.rand(30, 70)),
              k.lifespan(0.6, { fade: 0.3 }),
              k.z(46),
            ]);
          }
        };
        openChestRef.current = openChest;

        // ---- player avatar: mover + grounded shadow + bobbing body ----
        let gx = build.start.x;
        let gy = build.start.y;
        let target = center(gx, gy);
        let moving = false;
        const hero = k.add([k.pos(target), k.z(50)]);
        hero.add([k.rect(26, 9, { radius: 5 }), k.pos(0, 18), k.anchor("center"), k.color("#3a2e57"), k.opacity(0.16)]);
        const body = hero.add([k.pos(0, 0)]);
        body.add([k.circle(15), k.pos(0, 0), k.anchor("center"), k.color("#fff3e0")]);
        body.add([k.circle(9), k.pos(0, 5), k.anchor("center"), k.color("#ffe0c2")]);
        body.add([k.polygon([k.vec2(0, -23), k.vec2(-5, -15), k.vec2(5, -15)]), k.color("#ffd66b")]);
        body.add([k.circle(2.3), k.pos(-8, 3), k.anchor("center"), k.color("#ffb3c1"), k.opacity(0.85)]);
        body.add([k.circle(2.3), k.pos(8, 3), k.anchor("center"), k.color("#ffb3c1"), k.opacity(0.85)]);
        body.add([k.circle(2.7), k.pos(-5, -2), k.anchor("center"), k.color("#3a2e57")]);
        body.add([k.circle(2.7), k.pos(5, -2), k.anchor("center"), k.color("#3a2e57")]);

        const spawnDust = (atX: number, atY: number) => {
          for (let i = 0; i < 5; i += 1) {
            k.add([
              k.circle(k.rand(2, 4)),
              k.pos(atX + k.rand(-12, 12), atY + 14),
              k.anchor("center"),
              k.color(k.choose(["#8fd07a", "#bfe39a", "#fff3b0"])),
              k.opacity(0.95),
              k.move(k.rand(205, 335), k.rand(28, 60)),
              k.lifespan(0.5, { fade: 0.25 }),
              k.z(45),
            ]);
          }
        };

        const tryStep = (dx: number, dy: number) => {
          if (moving) return;
          const nx = gx + dx;
          const ny = gy + dy;
          const t = tileAt(worldMap, nx, ny);
          if (!t || t === "T") return;
          gx = nx;
          gy = ny;
          target = center(gx, gy);
          moving = true;
          spawnDust(hero.pos.x, hero.pos.y);
          onMoveRef.current(dx, dy);
        };

        k.onKeyPress(["up", "w"], () => tryStep(0, -1));
        k.onKeyPress(["down", "s"], () => tryStep(0, 1));
        k.onKeyPress(["left", "a"], () => tryStep(-1, 0));
        k.onKeyPress(["right", "d"], () => tryStep(1, 0));

        k.onMousePress(() => {
          const m = k.mousePos();
          const ddx = Math.floor((m.x - PAD) / TILE) - gx;
          const ddy = Math.floor((m.y - PAD) / TILE) - gy;
          if (ddx === 0 && ddy === 0) return;
          if (Math.abs(ddx) >= Math.abs(ddy)) tryStep(Math.sign(ddx), 0);
          else tryStep(0, Math.sign(ddy));
        });

        k.onUpdate(() => {
          const tm = k.time();
          if (moving) {
            hero.pos = hero.pos.lerp(target, Math.min(1, k.dt() * 14));
            if (hero.pos.dist(target) < 0.6) {
              hero.pos = target.clone();
              moving = false;
            }
          }
          body.pos.y = moving ? -Math.abs(Math.sin(tm * 12)) * 4 : Math.sin(tm * 4) * 2.5;
          for (const d of decor) {
            if (!d.obj.exists()) continue;
            if (d.kind === "grass") {
              (d.obj as GameObj).angle = Math.sin(tm * 2.4 + d.phase) * 10;
            } else if (d.kind === "chest" || d.kind === "owl") {
              d.obj.pos.y = d.baseY + Math.sin(tm * (d.kind === "owl" ? 2.4 : 3) + d.phase) * 3;
            } else if (d.kind === "warden") {
              const s = 1 + Math.sin(tm * 3) * 0.08;
              (d.obj as GameObj).scale = k.vec2(s, s);
              if (d.glow) (d.glow as GameObj).opacity = 0.2 + (Math.sin(tm * 3) + 1) * 0.13;
            } else if (d.kind === "exit") {
              const s = 1 + Math.sin(tm * 2.5) * 0.06;
              (d.obj as GameObj).scale = k.vec2(s, s);
              if (d.glow) (d.glow as GameObj).opacity = 0.32 + (Math.sin(tm * 2.5) + 1) * 0.1;
            }
          }
        });
      });

      startKaplaySceneWhenReady(k, "explore");
    });

    return () => {
      disposed = true;
      openChestRef.current = null;
      cancel();
      if (game) {
        if (activeExploreGame === game) activeExploreGame = null;
        try {
          game.quit();
        } catch {
          // already torn down
        }
      }
    };
  }, [hasSize]);

  const frameStyle: CSSProperties = hasSize
    ? { position: "relative", width: size.width, height: size.height, margin: "0 auto", borderRadius: 18, overflow: "hidden", boxShadow: "0 6px 18px rgba(80,50,130,.14)" }
    : { position: "relative", width: "100%", aspectRatio: `${gameW} / ${gameH}`, maxWidth: gameW, margin: "0 auto", borderRadius: 18, overflow: "hidden", boxShadow: "0 6px 18px rgba(80,50,130,.14)" };

  return (
    <div>
      <div style={headerRow}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>探索中</h1>
        <span style={{ fontSize: 12, color: "#8a83a3" }}>
          方向鍵 / 點格子移動 · 踩草叢 🌿 會遇到寵物 · 🚪 回學院
        </span>
      </div>
      <div ref={stageRef} style={{ width: "100%" }}>
        <div style={frameStyle}>
          <canvas ref={canvasRef} style={canvasStyle} />
          {scene.message && (
            <div onClick={onCloseMessage} style={messageBar}>
              {scene.message} <span style={{ color: "#cdbff0", fontSize: 12 }}>(點一下關閉)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
  flexWrap: "wrap",
  gap: 6,
};

const canvasStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  touchAction: "none",
};

const messageBar: CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: 14,
  transform: "translateX(-50%)",
  width: "min(86%, 460px)",
  background: "rgba(44,42,63,.92)",
  color: "#fdfcff",
  borderRadius: 14,
  padding: "11px 16px",
  fontSize: 14,
  lineHeight: 1.5,
  cursor: "pointer",
  boxShadow: "0 8px 22px rgba(40,25,70,.34)",
};
