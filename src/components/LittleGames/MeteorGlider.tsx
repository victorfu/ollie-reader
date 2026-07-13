import { useEffect, useRef, useState } from "react";

type GameState = "menu" | "playing" | "paused" | "gameover";
type InputState = {
  left: boolean;
  right: boolean;
  dashQueued: boolean;
  touchDir: -1 | 0 | 1;
};

type Meteor = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  spin: number;
  angle: number;
  heat: number;
};

type FuelCell = {
  x: number;
  y: number;
  size: number;
  value: number;
  pulse: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

type Star = {
  x: number;
  y: number;
  scale: number;
  speed: number;
};

type GameData = {
  playerX: number;
  vx: number;
  dashFuel: number;
  dashCooldown: number;
  dashActive: number;
  score: number;
  timeAlive: number;
  spawnTimer: number;
  fuelTimer: number;
  shake: number;
  wind: number;
  windTimer: number;
  meteors: Meteor[];
  fuels: FuelCell[];
  particles: Particle[];
  stars: Star[];
  input: InputState;
  lastTime: number;
};

const WIDTH = 480;
const HEIGHT = 720;
const PLAYER_Y = HEIGHT * 0.82;
const PLAYER_RADIUS = 20;
const MOVE_SPEED = 260;
const FRICTION = 0.9;
const DASH_COST = 25;
const DASH_COOLDOWN = 1.2;
const DASH_DURATION = 0.24;
const DASH_SPEED = 480;
const FUEL_MAX = 100;
const BEST_KEY = "meteor-glider-best";

type MeteorGliderProps = {
  onExit?: () => void;
  onPlayBunny?: () => void;
};

export default function MeteorGlider({ onExit, onPlayBunny }: MeteorGliderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const redrawRef = useRef<() => void>(() => {});
  const gameDataRef = useRef<GameData | null>(null);
  const rafRef = useRef<number | null>(null);
  const renderedScoreRef = useRef(0);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [dashFuelUI, setDashFuelUI] = useState(FUEL_MAX);
  const [dashCooldownUI, setDashCooldownUI] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(BEST_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!Number.isNaN(parsed)) setBestScore(parsed);
    }
  }, []);

  // 全螢幕遊戲頁：鎖住頁面捲動（防 macOS 橡皮筋效應）
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // 依視窗大小等比縮放 canvas（letterbox）；renderGame 維持 480×720 邏輯座標
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const applySize = () => {
      const rect = stage.getBoundingClientRect();
      // 底限只避免尺寸歸零；不設高地板，確保 canvas 一定能塞進容器
      const availW = Math.max(rect.width - 32, 1);
      const availH = Math.max(rect.height - 32, 1);
      const scale = Math.max(Math.min(availW / WIDTH, availH / HEIGHT), 0.05);
      const displayW = Math.round(WIDTH * scale);
      const displayH = Math.round(HEIGHT * scale);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;
      canvas.width = Math.round(displayW * dpr);
      canvas.height = Math.round(displayH * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
      }
      // 改尺寸會清空畫布；非遊玩狀態沒有 rAF 迴圈，需補畫一幀
      redrawRef.current();
    };
    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(stage);
    window.addEventListener("resize", applySize);
    const raf = requestAnimationFrame(() => redrawRef.current());
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", applySize);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc 切換暫停 / 繼續
      if (e.key === "Escape") {
        if (gameState === "playing") {
          setGameState("paused");
        } else if (gameState === "paused") {
          if (gameDataRef.current) gameDataRef.current.lastTime = performance.now();
          setGameState("playing");
        }
        return;
      }
      // 遊玩中攔截捲動鍵，避免空白鍵/方向鍵捲動頁面
      if (
        gameState === "playing" &&
        (e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === " ")
      ) {
        e.preventDefault();
      }
      if (!gameDataRef.current) return;
      if (e.key === "ArrowLeft" || e.key === "a") gameDataRef.current.input.left = true;
      if (e.key === "ArrowRight" || e.key === "d") gameDataRef.current.input.right = true;
      if (e.key === " " || e.key.toLowerCase() === "k" || e.key === "Shift") {
        gameDataRef.current.input.dashQueued = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!gameDataRef.current) return;
      if (e.key === "ArrowLeft" || e.key === "a") gameDataRef.current.input.left = false;
      if (e.key === "ArrowRight" || e.key === "d") gameDataRef.current.input.right = false;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!gameDataRef.current) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const isLeft = e.clientX - rect.left < rect.width / 2;
      gameDataRef.current.input.touchDir = isLeft ? -1 : 1;
    };

    const handlePointerUp = () => {
      if (!gameDataRef.current) return;
      gameDataRef.current.input.touchDir = 0;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [gameState]);

  const spawnBurst = (data: GameData, x: number, y: number, color: string, count: number, speed: number) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
      data.particles.push({
        x,
        y,
        vx: Math.cos(angle) * (speed * (0.6 + Math.random() * 0.4)),
        vy: Math.sin(angle) * (speed * (0.6 + Math.random() * 0.4)),
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1,
        color,
        size: 2 + Math.random() * 2,
      });
    }
  };

  const renderGame = (ctx: CanvasRenderingContext2D, data: GameData) => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const shakeX = (Math.random() - 0.5) * data.shake;
    const shakeY = (Math.random() - 0.5) * data.shake;
    data.shake = Math.max(0, data.shake - 0.5);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    skyGrad.addColorStop(0, "#0b1224");
    skyGrad.addColorStop(0.5, "#121d3a");
    skyGrad.addColorStop(1, "#1b294f");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    data.stars.forEach((star) => {
      ctx.beginPath();
      ctx.arc(star.x, star.y, 1.2 * star.scale, 0, Math.PI * 2);
      ctx.fill();
      star.y += star.speed * 0.016;
      if (star.y > HEIGHT) star.y = 0;
    });

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = HEIGHT - (i * HEIGHT) / 8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    data.fuels.forEach((fuel) => {
      const pulse = 1 + Math.sin(performance.now() / 200 + fuel.pulse) * 0.08;
      ctx.save();
      ctx.translate(fuel.x, fuel.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = "rgba(126, 255, 195, 0.9)";
      ctx.strokeStyle = "#8af9d0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -fuel.size);
      ctx.lineTo(fuel.size * 0.8, 0);
      ctx.lineTo(0, fuel.size);
      ctx.lineTo(-fuel.size * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    data.meteors.forEach((meteor) => {
      ctx.save();
      ctx.translate(meteor.x, meteor.y);
      ctx.rotate(meteor.angle);
      const grad = ctx.createRadialGradient(0, 0, meteor.radius * 0.2, 0, 0, meteor.radius);
      grad.addColorStop(0, "rgba(255, 199, 120, 0.9)");
      grad.addColorStop(0.7, "rgba(255, 130, 66, 0.9)");
      grad.addColorStop(1, "rgba(255, 80, 80, 0.8)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, meteor.radius * 1.2, meteor.radius * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    data.particles.forEach((p) => {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color.replace("ALPHA", alpha.toString());
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.save();
    ctx.translate(data.playerX, PLAYER_Y);
    const rotation = (data.vx / MOVE_SPEED) * 0.2;
    drawCinnamoroll(ctx, 0, 0, data.vx, rotation, data.dashActive > 0);
    ctx.restore();

    ctx.restore();
  };

  const endGame = () => {
    const data = gameDataRef.current;
    if (!data) return;
    const finalScore = Math.floor(data.score);
    renderedScoreRef.current = finalScore;
    setScore(finalScore);
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      localStorage.setItem(BEST_KEY, String(finalScore));
    }
    setGameState("gameover");
  };

  const updateGame = (data: GameData, delta: number) => {
    data.timeAlive += delta;
    data.spawnTimer -= delta;
    data.fuelTimer -= delta;
    data.windTimer -= delta;
    if (data.windTimer <= 0) {
      data.wind = (Math.random() - 0.5) * 140;
      data.windTimer = 3 + Math.random() * 2.5;
    }

    const inputDir = (data.input.left ? -1 : 0) + (data.input.right ? 1 : 0) + data.input.touchDir;
    const clampedInput = Math.max(-1, Math.min(1, inputDir));
    const targetVx = clampedInput * MOVE_SPEED + data.wind * 0.25;
    data.vx = data.vx * FRICTION + (targetVx - data.vx) * 0.12;

    if (data.dashActive > 0) {
      data.dashActive -= delta;
      data.vx = data.vx * 0.95 + Math.sign(targetVx || data.vx || 1) * DASH_SPEED * 0.15;
    } else {
      data.dashCooldown = Math.max(0, data.dashCooldown - delta);
    }

    if (data.input.dashQueued && data.dashCooldown <= 0 && data.dashFuel >= DASH_COST) {
      const dashDir =
        clampedInput !== 0 ? clampedInput : Math.sign(data.vx || 1);
      data.vx += dashDir * DASH_SPEED;
      data.dashActive = DASH_DURATION;
      data.dashCooldown = DASH_COOLDOWN;
      data.dashFuel = Math.max(0, data.dashFuel - DASH_COST);
      data.shake = 8;
      data.input.dashQueued = false;
      spawnBurst(data, data.playerX, PLAYER_Y + 8, "rgba(160,200,255,ALPHA)", 8, 90);
    }
    data.input.dashQueued = false;

    data.playerX += data.vx * delta;
    data.playerX = Math.max(30, Math.min(WIDTH - 30, data.playerX));

    const meteorSpeedBoost = Math.min(200, data.timeAlive * 12);
    if (data.spawnTimer <= 0) {
      data.spawnTimer = Math.max(0.35, 0.8 - data.timeAlive * 0.02);
      data.meteors.push({
        x: Math.random() * WIDTH,
        y: -40,
        radius: 18 + Math.random() * 18,
        speed: 160 + Math.random() * 90 + meteorSpeedBoost,
        spin: (Math.random() - 0.5) * 2,
        angle: Math.random() * Math.PI,
        heat: 0,
      });
    }

    if (data.fuelTimer <= 0) {
      data.fuelTimer = 3.5 - Math.min(2.2, data.timeAlive * 0.08);
      data.fuels.push({
        x: Math.random() * (WIDTH - 80) + 40,
        y: -20,
        size: 12,
        value: 28,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    data.meteors.forEach((m) => {
      m.y += (m.speed + 120) * delta;
      m.x += data.wind * delta * 0.6;
      m.angle += m.spin * delta;
    });
    data.meteors = data.meteors.filter((m) => m.y < HEIGHT + m.radius + 10 && m.x > -60 && m.x < WIDTH + 60);

    data.fuels.forEach((f) => {
      f.y += (150 + data.timeAlive * 8) * delta;
      f.pulse += delta;
    });
    data.fuels = data.fuels.filter((f) => f.y < HEIGHT + f.size + 8);

    data.particles.forEach((p) => {
      p.life -= delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
    });
    data.particles = data.particles.filter((p) => p.life > 0);

    data.score += delta * 10;

    // Collisions
    for (const m of data.meteors) {
      const dx = m.x - data.playerX;
      const dy = m.y - PLAYER_Y;
      const distSq = dx * dx + dy * dy;
      const hitRadius = (m.radius + PLAYER_RADIUS) ** 2;
      const nearRadius = (m.radius + PLAYER_RADIUS + 24) ** 2;
      if (distSq <= hitRadius) {
        data.shake = 18;
        spawnBurst(data, m.x, m.y, "rgba(255,120,120,ALPHA)", 24, 220);
        endGame();
        return;
      }
      if (distSq < nearRadius && m.heat < 0.5) {
        m.heat = 1;
        data.shake = Math.max(data.shake, 6);
        data.score += 4;
      }
    }

    for (let i = data.fuels.length - 1; i >= 0; i--) {
      const f = data.fuels[i];
      const dx = f.x - data.playerX;
      const dy = f.y - PLAYER_Y;
      const hitR = (f.size + PLAYER_RADIUS - 2) ** 2;
      if (dx * dx + dy * dy <= hitR) {
        data.fuels.splice(i, 1);
        data.dashFuel = Math.min(FUEL_MAX, data.dashFuel + f.value);
        data.score += 15;
        spawnBurst(data, f.x, f.y, "rgba(140,255,210,ALPHA)", 14, 160);
      }
    }
  };

  // 保持重繪 closure 為最新，供縮放時補畫最後一幀（renderGame 已宣告）
  useEffect(() => {
    redrawRef.current = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const data = gameDataRef.current;
      if (data) renderGame(ctx, data);
    };
  });

  // 進入暫停時清空輸入，避免恢復時角色帶著舊輸入漂移
  useEffect(() => {
    if (gameState !== "paused") return;
    const data = gameDataRef.current;
    if (data) {
      data.input.left = false;
      data.input.right = false;
      data.input.touchDir = 0;
    }
  }, [gameState]);

  // 視窗失焦/分頁切走時自動暫停，中途被叫走也不會繼續墜毀
  useEffect(() => {
    if (gameState !== "playing") return;
    const onVisibility = () => {
      if (document.hidden) setGameState("paused");
    };
    const onBlur = () => setGameState("paused");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState !== "playing") return;
    const loop = (time: number) => {
      const data = gameDataRef.current;
      const ctx = canvasRef.current?.getContext("2d");
      if (!data || !ctx) return;

      const delta = Math.min((time - data.lastTime) / 1000, 0.05);
      data.lastTime = time;

      updateGame(data, delta);
      renderGame(ctx, data);

      if (Math.abs(data.score - renderedScoreRef.current) > 0.5) {
        const next = Math.floor(data.score);
        renderedScoreRef.current = next;
        setScore(next);
      }
      setDashFuelUI(data.dashFuel);
      setDashCooldownUI(Math.max(0, data.dashCooldown));

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [gameState]);

  const initStars = () => {
    const stars: Star[] = [];
    for (let i = 0; i < 48; i++) {
      stars.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        scale: Math.random() * 0.8 + 0.4,
        speed: Math.random() * 20 + 20,
      });
    }
    return stars;
  };

  const startGame = () => {
    gameDataRef.current = {
      playerX: WIDTH / 2,
      vx: 0,
      dashFuel: FUEL_MAX,
      dashCooldown: 0,
      dashActive: 0,
      score: 0,
      timeAlive: 0,
      spawnTimer: 0.6,
      fuelTimer: 2.5,
      shake: 0,
      wind: 0,
      windTimer: 2,
      meteors: [],
      fuels: [],
      particles: [],
      stars: initStars(),
      input: { left: false, right: false, dashQueued: false, touchDir: 0 },
      lastTime: performance.now(),
    };
    renderedScoreRef.current = 0;
    setScore(0);
    setDashFuelUI(FUEL_MAX);
    setDashCooldownUI(0);
    setGameState("playing");
  };

  const pauseToggle = () => {
    if (gameState === "playing") setGameState("paused");
    else if (gameState === "paused") {
      if (gameDataRef.current) gameDataRef.current.lastTime = performance.now();
      setGameState("playing");
    }
  };

  const dashButton = () => {
    if (gameDataRef.current) gameDataRef.current.input.dashQueued = true;
  };

  return (
    <div
      className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(62,105,255,0.15), transparent 40%), radial-gradient(circle at 80% 10%, rgba(255,176,117,0.2), transparent 32%), #0b1020",
      }}
    >
      {onExit && (
        <button
          onClick={onExit}
          className="absolute left-6 top-6 z-20 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl"
          type="button"
        >
          ← 回遊戲列表
        </button>
      )}

      <div
        ref={stageRef}
        className="flex h-full min-h-0 w-full items-center justify-center"
      >
        <div className="relative">
          <canvas
            ref={canvasRef}
            style={{
              borderRadius: "22px",
              boxShadow: "0 28px 70px rgba(12,16,32,0.55)",
              border: "3px solid rgba(255,255,255,0.08)",
              background: "#0b1020",
            }}
          />

        {(gameState === "menu" || gameState === "gameover") && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[90%] max-w-[360px] rounded-3xl border border-white/15 bg-white/10 p-8 backdrop-blur-xl shadow-2xl text-white text-center">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-200">
                Playable
              </p>
              <h1 className="mt-2 text-3xl font-bold">Meteor Glider</h1>
              <p className="mt-3 text-slate-200">
                Weave through falling meteors, dash through gaps, and keep your
                fuel topped up.
              </p>
              {gameState === "gameover" && (
                <div className="mt-4 rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-slate-200">Score</p>
                  <p className="text-4xl font-bold">{score}</p>
                  <p className="text-xs text-slate-300 mt-1">
                    Best: {bestScore}
                  </p>
                </div>
              )}
              <div className="mt-5 flex flex-col gap-3">
                <button
                  onClick={startGame}
                  className="rounded-full bg-amber-400 text-slate-900 font-semibold py-3 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  {gameState === "menu" ? "Start run" : "Play again"}
                </button>
                {onPlayBunny && (
                  <button
                    onClick={onPlayBunny}
                    className="rounded-full border border-white/30 text-white font-semibold py-3 transition hover:-translate-y-0.5 hover:bg-white/10"
                  >
                    Play Bunny Jumper
                  </button>
                )}
              </div>
              <p className="mt-4 text-xs text-slate-200">
                Controls: ←/→ or A/D to steer, Space/Shift to dash. Tap left/right
                halves on mobile; tap Dash to burst through.
              </p>
            </div>
          </div>
        )}

        {gameState === "paused" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur">
            <div className="rounded-2xl bg-white/90 px-6 py-5 text-slate-900 shadow-2xl">
              <p className="text-lg font-semibold">Paused</p>
              <p className="text-sm text-slate-600 mt-1">
                Press resume to keep flying.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={pauseToggle}
                  className="rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-semibold"
                >
                  Resume
                </button>
                <button
                  onClick={() => setGameState("menu")}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
                >
                  Quit
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === "playing" && (
          <div className="pointer-events-none absolute inset-0 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-200">
                  Score
                </span>
                <span className="text-3xl font-bold">{score}</span>
                <span className="text-[11px] text-slate-200">Best {bestScore}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="pointer-events-auto">
                  <button
                    onClick={pauseToggle}
                    className="rounded-full bg-white/20 px-3 py-2 text-xs font-semibold backdrop-blur border border-white/30"
                  >
                    Pause
                  </button>
                </div>
                <div className="flex flex-col gap-1 text-xs text-slate-100">
                  <span>Fuel</span>
                  <div className="h-2 w-32 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-300 transition-[width]"
                      style={{ width: `${(dashFuelUI / FUEL_MAX) * 100}%` }}
                    />
                  </div>
                  <span className="mt-1">Dash</span>
                  <div className="h-2 w-32 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-300 transition-[width]"
                      style={{
                        width: `${100 - Math.min(100, (dashCooldownUI / DASH_COOLDOWN) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pointer-events-auto absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
              <button
                onClick={dashButton}
                className="rounded-full bg-amber-400 text-slate-900 px-6 py-3 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5"
              >
                Dash
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function drawCinnamoroll(ctx: CanvasRenderingContext2D, x: number, y: number, vx: number, rotation: number, isDashing: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // Scale down slightly to fit hitbox
  ctx.scale(0.8, 0.8);

  // Dash aura
  if (isDashing) {
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 20;
  }

  // Tail (Curly Cinnamon Roll)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-14, 6, 8, 0, Math.PI * 2);
  ctx.fill();
  // Tail swirl
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-14, 6, 4, 0, Math.PI * 1.5);
  ctx.stroke();

  // Body (White & Round)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Feet (Tiny white nubs)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-8, 20, 5, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(8, 20, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head (Large White Oval)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(0, -4, 20, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears (Long, Floppy, White)
  // Animate ears based on X velocity (banking)
  const earAngle = Math.min(0.5, Math.max(-0.5, Math.abs(vx) / 1000));
  ctx.fillStyle = "#fff";
  
  // Left Ear
  ctx.save();
  ctx.translate(-16, -10);
  ctx.rotate(-0.2 - earAngle);
  ctx.beginPath();
  ctx.ellipse(-12, 0, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right Ear
  ctx.save();
  ctx.translate(16, -10);
  ctx.rotate(0.2 + earAngle);
  ctx.beginPath();
  ctx.ellipse(12, 0, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Face
  // Eyes (Wide set, blue)
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.ellipse(-8, -2, 2.5, 3.5, 0, 0, Math.PI * 2);
  ctx.ellipse(8, -2, 2.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Highlights
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-9, -4, 1, 0, Math.PI * 2);
  ctx.arc(7, -4, 1, 0, Math.PI * 2);
  ctx.fill();

  // Blush (Pink)
  ctx.fillStyle = "rgba(244, 114, 182, 0.5)";
  ctx.beginPath();
  ctx.ellipse(-12, 2, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(12, 2, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth (Tiny 'w' or smile)
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 1, 3, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}
