import { useEffect, useRef, useState } from "react";
import { MUSHROOM_CONFIG } from "./lib/constants";
import { type MushroomSettings } from "./lib/types";

type GameState = "menu" | "settings" | "playing" | "win" | "dead";
type Platform = { x: number; y: number; w: number; h: number };
type EnemyType = "normal" | "fast" | "jumper" | "spiked";
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
type Enemy = {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: 1 | -1;
  speed: number;
  alive: boolean;
  vy?: number;
  type: EnemyType;
  jumpTimer?: number;
  // 行為狀態
  baseSpeed?: number; // 原始速度
  isCharging?: boolean; // 是否正在衝刺
  chargeTimer?: number; // 衝刺/暫停計時器
  pauseTimer?: number; // spiked 暫停計時器
};
type Coin = { x: number; y: number; r: number; taken: boolean };
type Flag = { x: number; y: number; h: number };
type PowerType = "star" | "feather" | "boot" | "heart";
type Powerup = {
  x: number;
  y: number;
  r: number;
  type: PowerType;
  taken: boolean;
};
type Level = {
  platforms: Platform[];
  enemies: Enemy[];
  coins: Coin[];
  powerups: Powerup[];
  flag: Flag;
  sky: { top: string; bottom: string };
};
type FloatingText = {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
};

const WIDTH = 960;
const HEIGHT = 540;
const GRAVITY = 1800;
const BASE_SPEED = 320;
const JUMP_SPEED = 720;
const EXTRA_SECTION_BASE = 2400;
const EXTRA_SECTION_STEP = 300;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

// 設定持久化函式
const loadSettings = (): MushroomSettings => {
  try {
    const stored = localStorage.getItem(MUSHROOM_CONFIG.SETTINGS_KEY);
    if (stored) {
      return { ...MUSHROOM_CONFIG.DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch { /* ignore invalid stored settings */ }
  return { ...MUSHROOM_CONFIG.DEFAULT_SETTINGS };
};

const saveSettings = (settings: MushroomSettings) => {
  localStorage.setItem(MUSHROOM_CONFIG.SETTINGS_KEY, JSON.stringify(settings));
};

export default function MushroomAdventure({ onExit }: { onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [, setLives] = useState(3);
  const [, setLevelIndex] = useState(0);
  const [settings, setSettings] = useState<MushroomSettings>(loadSettings);

  const stateRef = useRef({
    player: {
      x: 80,
      y: HEIGHT - 140,
      w: 36,
      h: 48,
      vx: 0,
      vy: 0,
      onGround: false,
      jumps: 0,
    },
    cameraX: 0,
    platforms: LEVELS[0].platforms,
    enemies: LEVELS[0].enemies.map((e) => ({ ...e })),
    coins: LEVELS[0].coins.map((c) => ({ ...c })),
    powerups: LEVELS[0].powerups.map((p) => ({ ...p })),
    flag: LEVELS[0].flag,
    keys: { left: false, right: false, jump: false },
    invincibleTimer: 0,
    speedTimer: 0,
    featherTimer: 0,
    score: 0,
    lives: 3,
    levelIndex: 0,
    floatingTexts: [] as FloatingText[],
    // 連擊系統
    comboCount: 0,
    lastStompTime: 0,
    // 粒子系統
    particles: [] as Particle[],
    // 螢幕震動
    screenShake: { intensity: 0, duration: 0 },
  });

  useEffect(() => {
    const stored = localStorage.getItem(MUSHROOM_CONFIG.BEST_SCORE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!Number.isNaN(parsed)) setBest(parsed);
    }
  }, []);

  // 全螢幕遊戲頁：鎖住頁面捲動（防 macOS 橡皮筋效應）
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // 依視窗大小等比縮放 canvas（letterbox）；update/render 維持 960×540 邏輯座標
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const applySize = () => {
      const rect = stage.getBoundingClientRect();
      const availW = rect.width - 32;
      const availH = rect.height - 32;
      const scale = Math.max(Math.min(availW / WIDTH, availH / HEIGHT), 0.35);
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
      renderRef.current?.();
    };
    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(stage);
    // ResizeObserver 之外再聽 window resize（部分內嵌環境不派送 RO callback）
    window.addEventListener("resize", applySize);
    // 首幀補畫：等 renderRef 於 effect 鏈後段就緒再畫
    const raf = requestAnimationFrame(() => renderRef.current?.());
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", applySize);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const isGameKey = (key: string) =>
      key === "arrowleft" ||
      key === "arrowright" ||
      key === "arrowup" ||
      key === "a" ||
      key === "d" ||
      key === "w" ||
      key === " ";
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // 遊玩中攔截遊戲鍵：空白鍵/方向鍵不捲動頁面、不誤觸 focused 按鈕
      if (gameState === "playing" && isGameKey(key)) e.preventDefault();
      const keys = stateRef.current.keys;
      if (key === "arrowleft" || key === "a") keys.left = true;
      if (key === "arrowright" || key === "d") keys.right = true;
      if (key === "arrowup" || key === "w" || key === " ") keys.jump = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const keys = stateRef.current.keys;
      if (key === "arrowleft" || key === "a") keys.left = false;
      if (key === "arrowright" || key === "d") keys.right = false;
      if (key === "arrowup" || key === "w" || key === " ") keys.jump = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gameState]);

  const loadLevel = (index: number) => {
    const lvl = LEVELS[index];
    stateRef.current = {
      ...stateRef.current,
      player: {
        x: 80,
        y: HEIGHT - 140,
        w: 36,
        h: 48,
        vx: 0,
        vy: 0,
        onGround: false,
        jumps: 0,
      },
      cameraX: 0,
      platforms: lvl.platforms.map((p) => ({ ...p })),
      enemies: lvl.enemies.map((e) => ({
        ...e,
        jumpTimer: Math.random() * 2,
        speed: e.speed * settings.difficultyScale, // 套用難度倍率
      })),
      coins: lvl.coins.map((c) => ({ ...c })),
      powerups: lvl.powerups.map((p) => ({ ...p })),
      flag: lvl.flag,
      invincibleTimer: 0,
      speedTimer: 0,
      featherTimer: 0,
      levelIndex: index,
      floatingTexts: [],
      // 重置連擊和粒子
      comboCount: 0,
      lastStompTime: 0,
      particles: [],
      screenShake: { intensity: 0, duration: 0 },
    };
    setLevelIndex(index);
  };

  const nextLevel = () => {
    const next = stateRef.current.levelIndex + 1;
    if (next >= LEVELS.length) {
      setGameState("win");
      setScore(stateRef.current.score);
      if (stateRef.current.score > best) {
        setBest(stateRef.current.score);
        localStorage.setItem(
          MUSHROOM_CONFIG.BEST_SCORE_KEY,
          String(stateRef.current.score),
        );
      }
    } else {
      loadLevel(next);
      setGameState("playing");
    }
  };

  const hitPlayer = () => {
    const s = stateRef.current;
    if (s.invincibleTimer > 0) return;

    // 觸發螢幕震動
    s.screenShake = {
      intensity: MUSHROOM_CONFIG.SHAKE_INTENSITY,
      duration: MUSHROOM_CONFIG.SHAKE_DURATION,
    };

    // 重置連擊
    s.comboCount = 0;

    s.lives -= 1;
    if (s.lives <= 0) {
      setScore(s.score);
      setLives(0);
      setGameState("dead");
    } else {
      const lvl = LEVELS[s.levelIndex];
      s.player = {
        x: 80,
        y: HEIGHT - 140,
        w: 36,
        h: 48,
        vx: 0,
        vy: 0,
        onGround: false,
        jumps: 0,
      };
      s.cameraX = 0;
      s.enemies = lvl.enemies.map((e) => ({
        ...e,
        jumpTimer: Math.random() * 2,
        speed: e.speed * settings.difficultyScale, // 套用難度倍率
      }));
    }
  };

  const update = (dt: number) => {
    const s = stateRef.current;
    const p = s.player;
    const speedBoost = s.speedTimer > 0 ? 0.35 : 0;
    const move = (s.keys.left ? -1 : 0) + (s.keys.right ? 1 : 0);
    const maxSpeed = 500 * (1 + speedBoost);
    p.vx = clamp(
      p.vx * 0.9 + move * BASE_SPEED * (1 + speedBoost) * dt * 10,
      -maxSpeed,
      maxSpeed,
    );

    const canDouble = s.featherTimer > 0;
    if (s.keys.jump) {
      if (p.onGround) {
        p.vy = -JUMP_SPEED;
        p.onGround = false;
        p.jumps = 1;
      } else if (canDouble && p.jumps < 2) {
        p.vy = -JUMP_SPEED * 0.9;
        p.jumps += 1;
      }
    }

    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // ground
    if (p.y + p.h > HEIGHT - 40) {
      p.y = HEIGHT - 40 - p.h;
      p.vy = 0;
      p.onGround = true;
      p.jumps = 0;
    } else {
      p.onGround = false;
    }

    // platforms
    s.platforms.forEach((plat) => {
      if (aabb(p, plat)) {
        const prevY = p.y - p.vy * dt;
        if (prevY + p.h <= plat.y + 6) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.jumps = 0;
        } else if (prevY >= plat.y + plat.h - 6) {
          p.y = plat.y + plat.h;
          p.vy = 10;
        } else if (p.x < plat.x) {
          p.x = plat.x - p.w;
          p.vx = 0;
        } else {
          p.x = plat.x + plat.w;
          p.vx = 0;
        }
      }
    });

    // enemies
    s.enemies.forEach((e) => {
      if (!e.alive) return;

      // 初始化基礎速度
      if (e.baseSpeed === undefined) e.baseSpeed = e.speed;

      // Gravity
      e.vy = (e.vy || 0) + GRAVITY * dt;
      e.y += e.vy * dt;

      // 計算玩家距離
      const distToPlayer = Math.abs(p.x + p.w / 2 - (e.x + e.w / 2));
      const playerDirection = p.x + p.w / 2 > e.x + e.w / 2 ? 1 : -1;

      // === 不同怪物的獨特行為 ===

      // Normal: 基本巡邏
      if (e.type === "normal") {
        e.x += e.dir * e.speed * dt;
      }

      // Fast: 偵測到玩家時加速衝刺
      if (e.type === "fast") {
        const detectRange = 250;
        if (distToPlayer < detectRange) {
          // 偵測到玩家，朝玩家方向衝刺
          e.isCharging = true;
          e.dir = playerDirection as 1 | -1;
          e.speed = e.baseSpeed * 2.5; // 2.5倍速衝刺
        } else {
          e.isCharging = false;
          e.speed = e.baseSpeed;
        }
        e.x += e.dir * e.speed * dt;
      }

      // Jumper: 跳躍並追蹤玩家方向
      if (e.type === "jumper") {
        e.jumpTimer = (e.jumpTimer || 0) - dt;
        if (e.jumpTimer <= 0 && e.vy === 0) {
          e.vy = -650;
          e.jumpTimer = 1.0 + Math.random() * 1.0;
          // 跳躍時朝玩家方向
          if (distToPlayer < 400) {
            e.dir = playerDirection as 1 | -1;
          }
        }
        e.x += e.dir * e.speed * dt;
      }

      // Spiked: 暫停後突然衝刺
      if (e.type === "spiked") {
        e.pauseTimer = e.pauseTimer ?? 0;
        e.chargeTimer = e.chargeTimer ?? 0;

        if (e.isCharging) {
          // 正在衝刺
          e.chargeTimer -= dt;
          e.speed = e.baseSpeed * 3; // 3倍速衝刺
          e.x += e.dir * e.speed * dt;

          if (e.chargeTimer <= 0) {
            e.isCharging = false;
            e.pauseTimer = 1.5 + Math.random(); // 暫停1.5-2.5秒
            e.speed = e.baseSpeed;
          }
        } else {
          // 暫停中
          e.pauseTimer -= dt;
          if (e.pauseTimer <= 0 && distToPlayer < 300) {
            // 開始衝刺
            e.isCharging = true;
            e.chargeTimer = 0.8; // 衝刺0.8秒
            e.dir = playerDirection as 1 | -1;
          } else if (e.pauseTimer <= 0) {
            // 沒偵測到玩家，緩慢移動
            e.x += e.dir * (e.baseSpeed * 0.3) * dt;
          }
          // 暫停時不移動（或非常慢）
        }
      }

      // Platform collision
      for (const plat of s.platforms) {
        if (aabb(e, plat)) {
          // Check if landing from above (allow some overlap tolerance)
          const prevY = e.y - e.vy * dt;
          if (prevY + e.h <= plat.y + 16 && e.vy >= 0) {
            e.y = plat.y - e.h;
            e.vy = 0;

            // Edge detection (Turn around if at edge)
            if (e.dir === -1 && e.x < plat.x) {
              e.x = plat.x;
              e.dir = 1;
            } else if (e.dir === 1 && e.x + e.w > plat.x + plat.w) {
              e.x = plat.x + plat.w - e.w;
              e.dir = -1;
            }
            break;
          }
        }
      }

      // Kill if fell off world
      if (e.y > HEIGHT + 100) {
        e.alive = false;
        return;
      }

      if (aabb(p, e)) {
        const stomp = p.vy > 120 && p.y + p.h - e.y < 26;
        if ((stomp && e.type !== "spiked") || s.invincibleTimer > 0) {
          e.alive = false;
          p.vy = -JUMP_SPEED * 0.6;

          // 連擊系統
          const now = performance.now();
          if (now - s.lastStompTime <= MUSHROOM_CONFIG.COMBO_WINDOW_MS) {
            s.comboCount += 1;
          } else {
            s.comboCount = 1;
          }
          s.lastStompTime = now;

          // 計算分數：基礎分 + 連擊加成
          const baseScore =
            e.type === "spiked" ? 100 : MUSHROOM_CONFIG.STOMP_BASE_SCORE;
          const comboBonus =
            (s.comboCount - 1) * MUSHROOM_CONFIG.COMBO_BONUS_PER_HIT;
          const totalScore = baseScore + comboBonus;
          s.score += totalScore;

          // 顯示連擊文字
          if (s.comboCount >= 2) {
            s.floatingTexts.push({
              x: e.x + e.w / 2,
              y: e.y - 30,
              text: `連擊 ×${s.comboCount}！+${totalScore}`,
              life: 1.5,
              color:
                s.comboCount >= 5
                  ? "#f59e0b"
                  : s.comboCount >= 3
                  ? "#22c55e"
                  : "#3b82f6",
            });
          }

          // 產生粒子效果
          if (
            settings.enableParticles &&
            s.particles.length < MUSHROOM_CONFIG.MAX_PARTICLES
          ) {
            const particleCount =
              MUSHROOM_CONFIG.PARTICLE_COUNT_MIN +
              Math.floor(
                Math.random() *
                  (MUSHROOM_CONFIG.PARTICLE_COUNT_MAX -
                    MUSHROOM_CONFIG.PARTICLE_COUNT_MIN),
              );
            const colors = [
              "#ef4444",
              "#f59e0b",
              "#22c55e",
              "#3b82f6",
              "#a855f7",
            ];
            for (
              let i = 0;
              i < particleCount &&
              s.particles.length < MUSHROOM_CONFIG.MAX_PARTICLES;
              i++
            ) {
              const angle =
                (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
              const speed = 100 + Math.random() * 150;
              s.particles.push({
                x: e.x + e.w / 2,
                y: e.y + e.h / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 100,
                life: MUSHROOM_CONFIG.PARTICLE_LIFE,
                maxLife: MUSHROOM_CONFIG.PARTICLE_LIFE,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 4 + Math.random() * 4,
              });
            }
          }
        } else {
          hitPlayer();
        }
      }
    });

    // coins
    s.coins.forEach((c) => {
      if (c.taken) return;
      const dx = p.x + p.w / 2 - c.x;
      const dy = p.y + p.h / 2 - c.y;
      if (dx * dx + dy * dy <= (c.r + 12) * (c.r + 12)) {
        c.taken = true;
        s.score += 10;

        // 金幣粒子效果
        if (
          settings.enableParticles &&
          s.particles.length < MUSHROOM_CONFIG.MAX_PARTICLES
        ) {
          for (
            let i = 0;
            i < 5 && s.particles.length < MUSHROOM_CONFIG.MAX_PARTICLES;
            i++
          ) {
            const angle = (Math.PI * 2 * i) / 5;
            s.particles.push({
              x: c.x,
              y: c.y,
              vx: Math.cos(angle) * 80,
              vy: Math.sin(angle) * 80 - 50,
              life: 0.5,
              maxLife: 0.5,
              color: "#f59e0b",
              size: 3 + Math.random() * 2,
            });
          }
        }
      }
    });

    // powerups
    s.powerups.forEach((pu) => {
      if (pu.taken) return;
      const dx = p.x + p.w / 2 - pu.x;
      const dy = p.y + p.h / 2 - pu.y;
      if (dx * dx + dy * dy <= (pu.r + 14) * (pu.r + 14)) {
        pu.taken = true;
        s.score += 20;
        let msg = "";
        let color = "#fff";
        if (pu.type === "star") {
          s.invincibleTimer = 8;
          msg = "無敵!";
          color = "#facc15";
        }
        if (pu.type === "boot") {
          s.speedTimer = 8;
          msg = "加速!";
          color = "#22c55e";
        }
        if (pu.type === "feather") {
          s.featherTimer = 10;
          msg = "二段跳!";
          color = "#a855f7";
        }
        if (pu.type === "heart") {
          s.lives += 1;
          msg = "生命+1";
          color = "#ef4444";
        }

        s.floatingTexts.push({
          x: pu.x,
          y: pu.y - 20,
          text: msg,
          life: 1.5,
          color,
        });

        // 道具粒子效果
        if (
          settings.enableParticles &&
          s.particles.length < MUSHROOM_CONFIG.MAX_PARTICLES
        ) {
          for (
            let i = 0;
            i < 8 && s.particles.length < MUSHROOM_CONFIG.MAX_PARTICLES;
            i++
          ) {
            const angle = (Math.PI * 2 * i) / 8;
            s.particles.push({
              x: pu.x,
              y: pu.y,
              vx: Math.cos(angle) * 100,
              vy: Math.sin(angle) * 100 - 60,
              life: 0.6,
              maxLife: 0.6,
              color,
              size: 4 + Math.random() * 3,
            });
          }
        }
      }
    });

    // 更新粒子
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const particle = s.particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += GRAVITY * 0.5 * dt; // 粒子受輕微重力影響
      if (particle.life <= 0) {
        s.particles.splice(i, 1);
      }
    }

    // floating texts
    for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
      const ft = s.floatingTexts[i];
      ft.life -= dt;
      ft.y -= 20 * dt;
      if (ft.life <= 0) {
        s.floatingTexts.splice(i, 1);
      }
    }

    // 更新螢幕震動
    if (s.screenShake.duration > 0) {
      s.screenShake.duration -= dt;
      if (s.screenShake.duration <= 0) {
        s.screenShake.intensity = 0;
      }
    }

    s.invincibleTimer = Math.max(0, s.invincibleTimer - dt);
    s.speedTimer = Math.max(0, s.speedTimer - dt);
    s.featherTimer = Math.max(0, s.featherTimer - dt);

    // camera
    s.cameraX = clamp(
      p.x - WIDTH / 2 + p.w / 2,
      0,
      Math.max(0, s.flag.x - 200),
    );

    // win
    if (p.x > s.flag.x - 24) {
      const bonus = 150 + Math.max(0, 200 - Math.floor(p.y));
      s.score += bonus;
      nextLevel();
      return;
    }

    // fall death
    if (p.y > HEIGHT + 220) {
      hitPlayer();
    }
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    const lvl = LEVELS[s.levelIndex];

    ctx.save();

    // 螢幕震動效果
    if (s.screenShake.duration > 0) {
      const shakeX = (Math.random() - 0.5) * s.screenShake.intensity * 2;
      const shakeY = (Math.random() - 0.5) * s.screenShake.intensity * 2;
      ctx.translate(shakeX, shakeY);
    }

    ctx.clearRect(-10, -10, WIDTH + 20, HEIGHT + 20);

    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, lvl.sky.top);
    sky.addColorStop(1, lvl.sky.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // clouds - 視差滾動 (0.2 速率)
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    const cloudParallax = s.cameraX * 0.2;
    drawCloud(ctx, 120 - (cloudParallax % 300), 90 - (s.levelIndex % 3) * 10);
    drawCloud(ctx, 380 - (cloudParallax % 400), 60 + (s.levelIndex % 2) * 12);
    drawCloud(ctx, 700 - (cloudParallax % 500), 110);
    drawCloud(ctx, 1000 - (cloudParallax % 600), 80);
    ctx.restore();

    ctx.save();
    ctx.translate(-s.cameraX, 0);

    // hills - 視差滾動 (0.4 速率，創造層次感)
    ctx.save();
    const hillParallax = s.cameraX * 0.4;
    ctx.fillStyle = "rgba(82, 160, 120, 0.25)";
    ctx.beginPath();
    ctx.ellipse(
      260 + hillParallax * 0.6,
      HEIGHT - 20,
      180,
      90,
      0,
      0,
      Math.PI * 2,
    );
    ctx.ellipse(
      740 + hillParallax * 0.6,
      HEIGHT - 10,
      220,
      100,
      0,
      0,
      Math.PI * 2,
    );
    ctx.ellipse(
      1200 + hillParallax * 0.6,
      HEIGHT - 15,
      200,
      95,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    // 前景山丘
    ctx.fillStyle = "rgba(82, 160, 120, 0.35)";
    ctx.beginPath();
    ctx.ellipse(260, HEIGHT - 20, 180, 90, 0, 0, Math.PI * 2);
    ctx.ellipse(740, HEIGHT - 10, 220, 100, 0, 0, Math.PI * 2);
    ctx.fill();

    // ground stripe
    ctx.fillStyle = "#b6e3a8";
    ctx.fillRect(-200, HEIGHT - 40, s.flag.x + 400, 80);

    // platforms
    s.platforms.forEach((p) => {
      ctx.fillStyle = "#8bd17a";
      roundRect(ctx, p.x, p.y, p.w, p.h, 6);
      ctx.fillStyle = "#6ab05f";
      roundRect(ctx, p.x, p.y, p.w, 8, 6);
    });

    // coins
    s.coins.forEach((c) => {
      if (c.taken) return;
      const coinGrad = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r);
      coinGrad.addColorStop(0, "#fef3c7");
      coinGrad.addColorStop(1, "#f59e0b");
      ctx.fillStyle = coinGrad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d97706";
      ctx.stroke();
    });

    // powerups
    s.powerups.forEach((pu) => {
      if (pu.taken) return;
      drawPowerup(ctx, pu);
    });

    // enemies
    s.enemies.forEach((e) => {
      if (!e.alive) return;
      drawMushroomEnemy(ctx, e);
    });

    // flag
    ctx.fillStyle = "#f97316";
    ctx.fillRect(s.flag.x, s.flag.y, 12, s.flag.h);
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.moveTo(s.flag.x + 12, s.flag.y);
    ctx.lineTo(s.flag.x + 70, s.flag.y + 30);
    ctx.lineTo(s.flag.x + 12, s.flag.y + 60);
    ctx.closePath();
    ctx.fill();

    // player
    drawHero(
      ctx,
      s.player,
      s.invincibleTimer > 0,
      s.featherTimer > 0,
      s.keys.left ? -1 : s.keys.right ? 1 : 0,
      s.player.vy,
    );

    // floating texts
    s.floatingTexts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.life);
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.font = "bold 16px system-ui";
      ctx.textAlign = "center";
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // 繪製粒子
    s.particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = particle.life / particle.maxLife;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(
        particle.x,
        particle.y,
        particle.size * (particle.life / particle.maxLife),
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();

    // HUD
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(12, 12, WIDTH - 24, 54);
    ctx.fillStyle = "#0f172a";
    ctx.font = "16px system-ui";
    ctx.fillText(`分數: ${s.score}`, 24, 38);
    ctx.fillText(`生命: ${s.lives}`, 150, 38);
    ctx.fillText(`關卡: ${s.levelIndex + 1}/${LEVELS.length}`, 240, 38);
    ctx.fillText(`最佳: ${best}`, 380, 38);

    // 連擊顯示
    if (s.comboCount >= 2) {
      const comboColor =
        s.comboCount >= 5
          ? "#f59e0b"
          : s.comboCount >= 3
          ? "#22c55e"
          : "#3b82f6";
      ctx.fillStyle = comboColor;
      ctx.font = "bold 18px system-ui";
      ctx.fillText(`連擊 ×${s.comboCount}`, 500, 40);
    }

    if (s.invincibleTimer > 0)
      ctx.fillText(`星星 ${s.invincibleTimer.toFixed(1)}s`, 620, 38);
    if (s.featherTimer > 0)
      ctx.fillText(`二段跳 ${s.featherTimer.toFixed(1)}s`, 740, 38);
    if (s.speedTimer > 0)
      ctx.fillText(`加速 ${s.speedTimer.toFixed(1)}s`, 870, 38);

    ctx.restore(); // 結束螢幕震動 save
  };

  // 保持 renderRef 指向最新 closure，供縮放時補畫
  useEffect(() => {
    renderRef.current = render;
  });

  useEffect(() => {
    if (gameState !== "playing") return;
    let lastTime = performance.now();
    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      update(dt);
      render();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [gameState]);

  const resetGame = () => {
    // 讓滑鼠點過的按鈕失焦，避免開場第一下空白鍵又觸發按鈕
    (document.activeElement as HTMLElement | null)?.blur();
    stateRef.current.score = 0;
    stateRef.current.lives = 3;
    loadLevel(0);
    setScore(0);
    setLives(3);
    setGameState("playing");
  };

  const startGame = () => {
    resetGame();
    setGameState("playing");
  };

  const handleSaveSettings = (newSettings: MushroomSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    setGameState("menu");
  };

  const overlay = () => {
    if (gameState === "menu") {
      return (
        <Overlay>
          <h2 className="text-3xl font-bold text-emerald-800 mb-2">
            森林蘑菇冒險
          </h2>
          <p className="text-slate-700 mb-2">
            可愛橫向平台闘關，踩蘑菇怪、收硬幣、衝旗桿。
          </p>
          <p className="text-slate-600 mb-4 text-sm">
            操作：← → 移動，↑/W/空白鍵
            跳躍，踩怪可得分，星星無敵、羽毛二段跳、靴子加速、愛心補生命。
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={startGame}
              className="rounded-full bg-emerald-500 text-white px-4 py-2 font-semibold shadow hover:bg-emerald-600 transition"
            >
              開始遊戲
            </button>
            <button
              onClick={() => setGameState("settings")}
              className="rounded-full bg-slate-100 text-slate-700 px-4 py-2 font-semibold shadow hover:bg-slate-200 transition"
            >
              ⚙️ 設定
            </button>
          </div>
        </Overlay>
      );
    }

    if (gameState === "settings") {
      return (
        <SettingsOverlay
          settings={settings}
          onSave={handleSaveSettings}
          onCancel={() => setGameState("menu")}
        />
      );
    }

    if (gameState === "win") {
      return (
        <Overlay>
          <h2 className="text-3xl font-bold text-emerald-800 mb-2">
            全部通關！
          </h2>
          <p className="text-slate-700 mb-2">總分 {score}</p>
          <p className="text-xs text-slate-600 mb-4">最佳：{best}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={resetGame}
              className="rounded-full bg-emerald-500 text-white px-4 py-2 font-semibold shadow"
            >
              再玩一次
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="rounded-full bg-white border border-emerald-200 px-4 py-2 font-semibold text-emerald-700 shadow"
              >
                回主選單
              </button>
            )}
          </div>
        </Overlay>
      );
    }

    if (gameState === "dead") {
      return (
        <Overlay>
          <h2 className="text-3xl font-bold text-rose-600 mb-2">失敗了！</h2>
          <p className="text-slate-700 mb-2">分數 {score}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={resetGame}
              className="rounded-full bg-emerald-500 text-white px-4 py-2 font-semibold shadow"
            >
              再試一次
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="rounded-full bg-white border border-emerald-200 px-4 py-2 font-semibold text-emerald-700 shadow"
              >
                回主選單
              </button>
            )}
          </div>
        </Overlay>
      );
    }

    return null;
  };

  return (
    <div
      className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(126,195,148,0.35), transparent 40%), radial-gradient(circle at 80% 10%, rgba(146,187,255,0.3), transparent 35%), #e9fdf3",
      }}
    >
      {onExit && (
        <button
          onClick={onExit}
          className="absolute left-6 top-6 z-20 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl"
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
              boxShadow: "0 24px 60px rgba(16, 78, 50, 0.28)",
              border: "3px solid rgba(255,255,255,0.5)",
              background: "#c8f7e1",
            }}
          />
          {overlay()}
        </div>
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur">
      <div className="rounded-3xl bg-white/95 border border-white/60 shadow-2xl px-6 py-6 text-center max-w-md">
        {children}
      </div>
    </div>
  );
}

function SettingsOverlay({
  settings,
  onSave,
  onCancel,
}: {
  settings: MushroomSettings;
  onSave: (s: MushroomSettings) => void;
  onCancel: () => void;
}) {
  const [localSettings, setLocalSettings] =
    useState<MushroomSettings>(settings);

  const difficultyLabel = (value: number) => {
    if (value <= 0.8) return "簡單";
    if (value <= 1.1) return "普通";
    if (value <= 1.3) return "困難";
    return "地獄";
  };

  const enemyLabel = (value: number) => {
    if (value <= 1) return "正常";
    if (value <= 1.5) return "較多";
    return "超多";
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur">
      <div className="rounded-3xl bg-white/95 border border-white/60 shadow-2xl px-6 py-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-emerald-800 mb-4 text-center">
          ⚙️ 遊戲設定
        </h2>

        {/* 難度滑桿 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            遊戲難度：
            <span className="text-emerald-600 font-bold">
              {difficultyLabel(localSettings.difficultyScale)}
            </span>
          </label>
          <input
            type="range"
            min="0.7"
            max="1.5"
            step="0.1"
            value={localSettings.difficultyScale}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                difficultyScale: parseFloat(e.target.value),
              })
            }
            className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>簡單</span>
            <span>普通</span>
            <span>困難</span>
            <span>地獄</span>
          </div>
        </div>

        {/* 敵人數量 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            敵人數量：
            <span className="text-emerald-600 font-bold">
              {enemyLabel(localSettings.enemyMultiplier)}
            </span>
          </label>
          <div className="flex gap-2">
            {[1, 1.5, 2].map((val) => (
              <button
                key={val}
                onClick={() =>
                  setLocalSettings({ ...localSettings, enemyMultiplier: val })
                }
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  localSettings.enemyMultiplier === val
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {val === 1 ? "×1" : val === 1.5 ? "×1.5" : "×2"}
              </button>
            ))}
          </div>
        </div>

        {/* 道具頻率 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            道具頻率：
            <span className="text-emerald-600 font-bold">
              {(localSettings.powerupFrequency * 100).toFixed(0)}%
            </span>
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.25"
            value={localSettings.powerupFrequency}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                powerupFrequency: parseFloat(e.target.value),
              })
            }
            className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>50%</span>
            <span>100%</span>
            <span>150%</span>
            <span>200%</span>
          </div>
        </div>

        {/* 粒子特效開關 */}
        <div className="mb-6">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-slate-700">粒子特效</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={localSettings.enableParticles}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    enableParticles: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </div>
          </label>
          <p className="text-xs text-slate-500 mt-1">
            開啟後踩敵人和收集道具會有爆炸粒子效果
          </p>
        </div>

        {/* 按鈕 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-full bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
          >
            取消
          </button>
          <button
            onClick={() => onSave(localSettings)}
            className="flex-1 py-2 rounded-full bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition"
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}

function aabb(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function drawHero(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number; w: number; h: number },
  inv: boolean,
  feather: boolean,
  dir: number,
  vy: number,
) {
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);

  // Squash and Stretch
  const stretch = Math.min(0.3, Math.abs(vy) / 1500);
  const scaleX = 1 - stretch * 0.5;
  const scaleY = 1 + stretch;
  ctx.scale(scaleX, scaleY);

  // Bobbing animation (idle)
  if (Math.abs(vy) < 50) {
    const bob = Math.sin(Date.now() / 150) * 2;
    ctx.translate(0, bob);
  }

  // Facing
  if (dir !== 0) {
    ctx.scale(dir, 1);
  }

  // Aura
  if (inv || feather) {
    ctx.fillStyle = inv
      ? "rgba(250, 204, 21, 0.4)"
      : "rgba(168, 85, 247, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Cinnamoroll Style Hero ---

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
  // Animate ears based on Y velocity
  const earAngle = Math.min(0.5, Math.max(-0.5, vy / 1000));
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

function drawPowerup(ctx: CanvasRenderingContext2D, pu: Powerup) {
  ctx.save();
  ctx.translate(pu.x, pu.y);

  // Float animation
  const floatY = Math.sin(Date.now() / 200) * 3;
  ctx.translate(0, floatY);

  // Glow
  const color =
    pu.type === "star"
      ? "#facc15"
      : pu.type === "feather"
      ? "#a855f7"
      : pu.type === "boot"
      ? "#22c55e"
      : "#ef4444";
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, pu.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = color;

  if (pu.type === "star") {
    // Draw Star
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(
        Math.cos(((18 + i * 72) / 180) * Math.PI) * 10,
        -Math.sin(((18 + i * 72) / 180) * Math.PI) * 10,
      );
      ctx.lineTo(
        Math.cos(((54 + i * 72) / 180) * Math.PI) * 4,
        -Math.sin(((54 + i * 72) / 180) * Math.PI) * 4,
      );
    }
    ctx.closePath();
    ctx.fill();
  } else if (pu.type === "heart") {
    // Draw Heart
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-6, -4, -12, 4, 0, 12);
    ctx.bezierCurveTo(12, 4, 6, -4, 0, 4);
    ctx.fill();
  } else if (pu.type === "boot") {
    // Draw Boot
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(4, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(8, 4);
    ctx.quadraticCurveTo(8, 8, 4, 8);
    ctx.lineTo(-4, 8);
    ctx.closePath();
    ctx.fill();
  } else {
    // Draw Feather
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 10, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawMushroomEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2);

  // 衝刺視覺效果
  if (e.isCharging) {
    // 衝刺時的殘影/拖尾效果
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = e.type === "fast" ? "#3b82f6" : "#9333ea";
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(-e.dir * i * 8, 0, 16 - i * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 衝刺時整體放大
    ctx.scale(1.15, 1.15);
  }

  // Stem
  ctx.fillStyle = "#fef3c7";
  roundRect(ctx, -10, 0, 20, 16, 4);

  // Cap Color based on type
  let capColor = "#ef4444"; // Normal (Red)
  if (e.type === "fast") capColor = "#3b82f6"; // Fast (Blue)
  if (e.type === "jumper") capColor = "#22c55e"; // Jumper (Green)
  if (e.type === "spiked") capColor = "#9333ea"; // Spiked (Purple)

  // Cap
  ctx.fillStyle = capColor;
  ctx.beginPath();
  ctx.arc(0, 0, 20, Math.PI, 0); // top half
  ctx.bezierCurveTo(20, 10, -20, 10, -20, 0);
  ctx.fill();

  // Spikes
  if (e.type === "spiked") {
    ctx.fillStyle = "#e9d5ff";
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(-4, -28);
    ctx.lineTo(4, -28);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-14, -14);
    ctx.lineTo(-20, -20);
    ctx.lineTo(-10, -22);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -14);
    ctx.lineTo(20, -20);
    ctx.lineTo(10, -22);
    ctx.fill();
  }

  // Spots
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.arc(-10, -8, 4, 0, Math.PI * 2);
  ctx.arc(10, -6, 3, 0, Math.PI * 2);
  ctx.arc(0, -14, 3, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (Angry if spiked or charging)
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  if (e.type === "spiked" || e.isCharging) {
    // Angry eyes for spiked or charging enemies
    ctx.moveTo(-8, 4);
    ctx.lineTo(-4, 8);
    ctx.lineTo(-8, 8);
    ctx.moveTo(8, 4);
    ctx.lineTo(4, 8);
    ctx.lineTo(8, 8);
    ctx.fill();
    // 衝刺時添加紅色瞳孔
    if (e.isCharging) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(-6, 6, 1.5, 0, Math.PI * 2);
      ctx.arc(6, 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.arc(-6, 6, 2, 0, Math.PI * 2);
    ctx.arc(6, 6, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wings for Jumper
  if (e.type === "jumper") {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-22, -4, 8, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(22, -4, 8, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x, y, 26, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + 26, y - 26, 26, Math.PI, Math.PI * 2);
  ctx.arc(x + 52, y, 26, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
}

function extendLevel(base: Level, idx: number): Level {
  const extraOffset = base.flag.x + 200;
  const extraLength = EXTRA_SECTION_BASE + EXTRA_SECTION_STEP * idx;
  const newFlagX = extraOffset + extraLength;

  // Patterns
  const patterns = [
    // Pattern 0: Flat run with enemies (增加地面敵人)
    (x: number, y: number, diff: number) => {
      const enemies: Enemy[] = [];
      // 大幅增加敵人數量
      const count = 2 + Math.floor(Math.random() * (2 + diff * 0.8));
      for (let i = 0; i < count; i++) {
        // 根據難度選擇敵人類型
        let type: EnemyType = "normal";
        if (diff >= 1 && Math.random() < 0.4) type = "fast";
        if (diff >= 2 && Math.random() < 0.3) type = "jumper";
        if (diff >= 3 && Math.random() < 0.2) type = "spiked";

        const speed = 80 + diff * 15 + Math.random() * 30;
        enemies.push({
          x: x + 80 + i * 100,
          y: y - 32,
          w: 36,
          h: 32,
          dir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
          speed,
          alive: true,
          type,
        });
      }
      return {
        plats: [{ x, y, w: 500, h: 16 }],
        enemies,
        coins: [
          { x: x + 100, y: y - 40, r: 10, taken: false },
          { x: x + 250, y: y - 40, r: 10, taken: false },
          { x: x + 400, y: y - 40, r: 10, taken: false },
        ],
      };
    },
    // Pattern 1: Stairs up
    (x: number, y: number, diff: number) => ({
      plats: [
        { x, y, w: 120, h: 16 },
        { x: x + 160, y: y - 60, w: 120, h: 16 },
        { x: x + 320, y: y - 120, w: 120, h: 16 },
      ],
      enemies: [
        {
          x: x + 360,
          y: y - 120 - 32,
          w: 36,
          h: 32,
          dir: 1,
          speed: 80,
          alive: true,
          type: diff > 2 ? "jumper" : "normal",
        },
      ],
      coins: [
        { x: x + 60, y: y - 40, r: 10, taken: false },
        { x: x + 220, y: y - 100, r: 10, taken: false },
        { x: x + 380, y: y - 160, r: 10, taken: false },
      ],
    }),
    // Pattern 2: Gap jump
    (x: number, y: number, diff: number) => ({
      plats: [
        { x, y, w: 100, h: 16 },
        { x: x + 250, y: y, w: 100, h: 16 },
      ],
      enemies:
        diff > 1
          ? [
              {
                x: x + 270,
                y: y - 32,
                w: 36,
                h: 32,
                dir: 1,
                speed: 120,
                alive: true,
                type: "fast",
              },
            ]
          : [],
      coins: [{ x: x + 175, y: y - 60, r: 10, taken: false }],
    }),
    // Pattern 3: Tunnel (low ceiling)
    (x: number, y: number, diff: number) => ({
      plats: [
        { x, y, w: 400, h: 16 },
        { x, y: y - 100, w: 400, h: 40 }, // Ceiling
      ],
      enemies: [
        {
          x: x + 200,
          y: y - 32,
          w: 36,
          h: 32,
          dir: 1,
          speed: 120,
          alive: true,
          type: diff > 3 ? "spiked" : "fast",
        },
      ],
      coins: [
        { x: x + 50, y: y - 30, r: 10, taken: false },
        { x: x + 350, y: y - 30, r: 10, taken: false },
      ],
    }),
  ];

  const platforms = base.platforms.map((p, i) =>
    i === 0 ? { ...p, w: Math.max(p.w, newFlagX + 400) } : { ...p },
  );

  const enemies: Enemy[] = base.enemies.map((e) => ({
    ...e,
    type: "normal" as EnemyType,
  }));
  const coins: Coin[] = base.coins.map((c) => ({ ...c }));
  const powerups: Powerup[] = base.powerups.map((p) => ({ ...p }));

  let currentX = extraOffset;
  let currentY = HEIGHT - 160;

  while (currentX < newFlagX - 200) {
    // Difficulty scaling
    // Level 0: Pattern 0 only
    // Level 1: Pattern 0, 1
    // Level 2: Pattern 0, 1, 2
    // Level 3+: All patterns
    const availablePatterns = Math.min(patterns.length, idx + 1);
    const patIdx = Math.floor(Math.random() * availablePatterns);

    const pat = patterns[patIdx](currentX, currentY, idx);

    // Add pattern elements
    pat.plats.forEach((p) => platforms.push(p as Platform));
    pat.enemies.forEach((e) => {
      // Randomize enemy type based on level index (difficulty)
      let type: EnemyType = "normal";
      const roll = Math.random();
      if (idx >= 1 && roll < 0.3) type = "fast";
      if (idx >= 2 && roll < 0.2) type = "jumper";
      if (idx >= 3 && roll < 0.15) type = "spiked";
      // Override if pattern specified a type, otherwise use random
      if (e.type === "normal" && type !== "normal") e.type = type;

      enemies.push(e as Enemy);
    });
    pat.coins.forEach((c) => coins.push(c as Coin));

    // Add ground-level enemies to prevent "just run through" strategy
    // Spawn chance increases with difficulty level
    const groundEnemyChance = Math.min(0.25 + idx * 0.1, 0.5); // 25% at level 0, up to 50% at level 3+
    if (Math.random() < groundEnemyChance) {
      // Spawn 1-2 ground enemies per segment
      const groundEnemyCount = 1 + (idx >= 2 && Math.random() < 0.4 ? 1 : 0);
      for (let g = 0; g < groundEnemyCount; g++) {
        // Randomize enemy type based on difficulty
        let groundType: EnemyType = "normal";
        const groundRoll = Math.random();
        if (idx >= 1 && groundRoll < 0.35) groundType = "fast";
        if (idx >= 2 && groundRoll < 0.25) groundType = "jumper";
        if (idx >= 3 && groundRoll < 0.18) groundType = "spiked";

        const groundSpeed = 70 + idx * 10 + Math.random() * 25;
        enemies.push({
          x: currentX + 120 + g * 180, // Spread enemies with 180px gap
          y: HEIGHT - 72, // Ground level (same as BASE_LEVELS enemies)
          w: 36,
          h: 32,
          dir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
          speed: groundSpeed,
          alive: true,
          type: groundType,
        });
      }
    }

    // Chance for powerup
    if (Math.random() < 0.25) {
      const types: PowerType[] = ["boot", "feather", "star", "heart"];
      const type = types[Math.floor(Math.random() * types.length)];
      powerups.push({
        x: currentX + 50,
        y: currentY - 80,
        r: 14,
        type,
        taken: false,
      });
    }

    currentX += 450;
    // Randomize Y slightly for next segment, keep within bounds
    // Expanded range to allow patterns closer to ground (HEIGHT - 60)
    currentY = clamp(
      currentY + (Math.random() > 0.5 ? 50 : -50),
      HEIGHT - 300,
      HEIGHT - 60,
    );
  }

  return {
    ...base,
    platforms,
    enemies,
    coins,
    powerups,
    flag: { ...base.flag, x: newFlagX },
  };
}

const BASE_LEVELS: Level[] = [
  {
    sky: { top: "#c8f7e1", bottom: "#e8f3ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2400, h: 40 },
      { x: 200, y: HEIGHT - 140, w: 120, h: 16 },
      { x: 420, y: HEIGHT - 210, w: 150, h: 16 },
      { x: 680, y: HEIGHT - 180, w: 160, h: 16 },
    ],
    enemies: [
      {
        x: 260,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 70,
        alive: true,
        type: "normal",
      },
      {
        x: 450,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 80,
        alive: true,
        type: "normal",
      },
      {
        x: 650,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 90,
        alive: true,
        type: "fast",
      },
    ],
    coins: [
      { x: 160, y: HEIGHT - 200, r: 10, taken: false },
      { x: 420, y: HEIGHT - 260, r: 10, taken: false },
      { x: 720, y: HEIGHT - 220, r: 10, taken: false },
    ],
    powerups: [{ x: 640, y: HEIGHT - 220, r: 14, type: "boot", taken: false }],
    flag: { x: 950, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#d9f0ff", bottom: "#eef6ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2600, h: 40 },
      { x: 240, y: HEIGHT - 170, w: 140, h: 16 },
      { x: 520, y: HEIGHT - 240, w: 180, h: 16 },
      { x: 840, y: HEIGHT - 180, w: 160, h: 16 },
      { x: 1120, y: HEIGHT - 130, w: 160, h: 16 },
    ],
    enemies: [
      {
        x: 300,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 80,
        alive: true,
        type: "normal",
      },
      {
        x: 500,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 90,
        alive: true,
        type: "fast",
      },
      {
        x: 750,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 85,
        alive: true,
        type: "normal",
      },
      {
        x: 1000,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 75,
        alive: true,
        type: "jumper",
      },
      {
        x: 880,
        y: HEIGHT - 212,
        w: 36,
        h: 32,
        dir: -1,
        speed: 70,
        alive: true,
        type: "normal",
      },
    ],
    coins: [
      { x: 250, y: HEIGHT - 210, r: 10, taken: false },
      { x: 520, y: HEIGHT - 280, r: 10, taken: false },
      { x: 1120, y: HEIGHT - 170, r: 10, taken: false },
    ],
    powerups: [
      { x: 980, y: HEIGHT - 220, r: 14, type: "feather", taken: false },
    ],
    flag: { x: 1280, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#f7e9ff", bottom: "#f2f9ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2600, h: 40 },
      { x: 300, y: HEIGHT - 160, w: 120, h: 16 },
      { x: 520, y: HEIGHT - 220, w: 140, h: 16 },
      { x: 780, y: HEIGHT - 260, w: 160, h: 16 },
      { x: 1040, y: HEIGHT - 200, w: 160, h: 16 },
      { x: 1300, y: HEIGHT - 150, w: 160, h: 16 },
    ],
    enemies: [
      {
        x: 200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 85,
        alive: true,
        type: "normal",
      },
      {
        x: 400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 100,
        alive: true,
        type: "fast",
      },
      {
        x: 650,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 80,
        alive: true,
        type: "jumper",
      },
      {
        x: 900,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 90,
        alive: true,
        type: "normal",
      },
      {
        x: 1150,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 95,
        alive: true,
        type: "spiked",
      },
      {
        x: 560,
        y: HEIGHT - 252,
        w: 36,
        h: 32,
        dir: 1,
        speed: 90,
        alive: true,
        type: "jumper",
      },
      {
        x: 1320,
        y: HEIGHT - 182,
        w: 36,
        h: 32,
        dir: -1,
        speed: 100,
        alive: true,
        type: "fast",
      },
    ],
    coins: [
      { x: 320, y: HEIGHT - 200, r: 10, taken: false },
      { x: 780, y: HEIGHT - 300, r: 10, taken: false },
      { x: 1300, y: HEIGHT - 190, r: 10, taken: false },
    ],
    powerups: [{ x: 900, y: HEIGHT - 320, r: 14, type: "star", taken: false }],
    flag: { x: 1520, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#e4f7e7", bottom: "#f5fff2" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2800, h: 40 },
      { x: 260, y: HEIGHT - 200, w: 140, h: 16 },
      { x: 520, y: HEIGHT - 140, w: 140, h: 16 },
      { x: 760, y: HEIGHT - 190, w: 140, h: 16 },
      { x: 1000, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 1280, y: HEIGHT - 180, w: 160, h: 16 },
      { x: 1520, y: HEIGHT - 130, w: 180, h: 16 },
    ],
    enemies: [
      {
        x: 180,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 90,
        alive: true,
        type: "normal",
      },
      {
        x: 380,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 110,
        alive: true,
        type: "fast",
      },
      {
        x: 540,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 100,
        alive: true,
        type: "jumper",
      },
      {
        x: 850,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 95,
        alive: true,
        type: "normal",
      },
      {
        x: 1100,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 105,
        alive: true,
        type: "spiked",
      },
      {
        x: 1400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "fast",
      },
      {
        x: 1300,
        y: HEIGHT - 212,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "jumper",
      },
    ],
    coins: [
      { x: 280, y: HEIGHT - 240, r: 10, taken: false },
      { x: 760, y: HEIGHT - 230, r: 10, taken: false },
      { x: 1280, y: HEIGHT - 220, r: 10, taken: false },
      { x: 1520, y: HEIGHT - 170, r: 10, taken: false },
    ],
    powerups: [{ x: 1180, y: HEIGHT - 280, r: 14, type: "boot", taken: false }],
    flag: { x: 1760, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#d9f0ff", bottom: "#eef6ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3000, h: 40 },
      { x: 280, y: HEIGHT - 160, w: 160, h: 16 },
      { x: 560, y: HEIGHT - 200, w: 140, h: 16 },
      { x: 840, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 1120, y: HEIGHT - 280, w: 140, h: 16 },
      { x: 1400, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 1680, y: HEIGHT - 200, w: 140, h: 16 },
      { x: 1960, y: HEIGHT - 160, w: 160, h: 16 },
    ],
    enemies: [
      {
        x: 200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 95,
        alive: true,
        type: "normal",
      },
      {
        x: 400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 115,
        alive: true,
        type: "fast",
      },
      {
        x: 700,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "jumper",
      },
      {
        x: 1000,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 110,
        alive: true,
        type: "spiked",
      },
      {
        x: 1300,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 105,
        alive: true,
        type: "normal",
      },
      {
        x: 1550,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 120,
        alive: true,
        type: "fast",
      },
      {
        x: 1850,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "jumper",
      },
      {
        x: 620,
        y: HEIGHT - 232,
        w: 36,
        h: 32,
        dir: -1,
        speed: 120,
        alive: true,
        type: "fast",
      },
      {
        x: 1420,
        y: HEIGHT - 272,
        w: 36,
        h: 32,
        dir: 1,
        speed: 120,
        alive: true,
        type: "jumper",
      },
      {
        x: 1980,
        y: HEIGHT - 192,
        w: 36,
        h: 32,
        dir: -1,
        speed: 100,
        alive: true,
        type: "spiked",
      },
    ],
    coins: [
      { x: 560, y: HEIGHT - 240, r: 10, taken: false },
      { x: 1120, y: HEIGHT - 320, r: 10, taken: false },
      { x: 1680, y: HEIGHT - 240, r: 10, taken: false },
      { x: 1960, y: HEIGHT - 200, r: 10, taken: false },
    ],
    powerups: [{ x: 1520, y: HEIGHT - 300, r: 14, type: "star", taken: false }],
    flag: { x: 2160, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#f7e9ff", bottom: "#f2f9ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3200, h: 40 },
      { x: 260, y: HEIGHT - 120, w: 160, h: 16 },
      { x: 620, y: HEIGHT - 180, w: 180, h: 16 },
      { x: 900, y: HEIGHT - 220, w: 140, h: 16 },
      { x: 1180, y: HEIGHT - 260, w: 140, h: 16 },
      { x: 1460, y: HEIGHT - 210, w: 160, h: 16 },
      { x: 1740, y: HEIGHT - 180, w: 180, h: 16 },
      { x: 2020, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 2300, y: HEIGHT - 200, w: 180, h: 16 },
    ],
    enemies: [
      {
        x: 180,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "normal",
      },
      {
        x: 400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 120,
        alive: true,
        type: "fast",
      },
      {
        x: 650,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 95,
        alive: true,
        type: "jumper",
      },
      {
        x: 950,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 110,
        alive: true,
        type: "spiked",
      },
      {
        x: 1200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 105,
        alive: true,
        type: "normal",
      },
      {
        x: 1500,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 125,
        alive: true,
        type: "fast",
      },
      {
        x: 1800,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "jumper",
      },
      {
        x: 2100,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 115,
        alive: true,
        type: "spiked",
      },
      {
        x: 280,
        y: HEIGHT - 152,
        w: 36,
        h: 32,
        dir: -1,
        speed: 90,
        alive: true,
        type: "normal",
      },
      {
        x: 960,
        y: HEIGHT - 252,
        w: 36,
        h: 32,
        dir: 1,
        speed: 110,
        alive: true,
        type: "fast",
      },
      {
        x: 1760,
        y: HEIGHT - 212,
        w: 36,
        h: 32,
        dir: -1,
        speed: 120,
        alive: true,
        type: "jumper",
      },
    ],
    coins: [
      { x: 620, y: HEIGHT - 220, r: 10, taken: false },
      { x: 1180, y: HEIGHT - 300, r: 10, taken: false },
      { x: 1740, y: HEIGHT - 220, r: 10, taken: false },
      { x: 2020, y: HEIGHT - 280, r: 10, taken: false },
    ],
    powerups: [
      { x: 1320, y: HEIGHT - 320, r: 14, type: "feather", taken: false },
    ],
    flag: { x: 2520, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#e4f7e7", bottom: "#f5fff2" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3400, h: 40 },
      { x: 320, y: HEIGHT - 200, w: 160, h: 16 },
      { x: 620, y: HEIGHT - 140, w: 140, h: 16 },
      { x: 900, y: HEIGHT - 220, w: 160, h: 16 },
      { x: 1160, y: HEIGHT - 260, w: 140, h: 16 },
      { x: 1440, y: HEIGHT - 220, w: 180, h: 16 },
      { x: 1720, y: HEIGHT - 180, w: 160, h: 16 },
      { x: 2000, y: HEIGHT - 160, w: 140, h: 16 },
      { x: 2240, y: HEIGHT - 220, w: 160, h: 16 },
      { x: 2500, y: HEIGHT - 260, w: 140, h: 16 },
    ],
    enemies: [
      {
        x: 200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 105,
        alive: true,
        type: "normal",
      },
      {
        x: 450,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 130,
        alive: true,
        type: "fast",
      },
      {
        x: 750,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 100,
        alive: true,
        type: "jumper",
      },
      {
        x: 1050,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 120,
        alive: true,
        type: "spiked",
      },
      {
        x: 1350,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 110,
        alive: true,
        type: "normal",
      },
      {
        x: 1600,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 135,
        alive: true,
        type: "fast",
      },
      {
        x: 1900,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 105,
        alive: true,
        type: "jumper",
      },
      {
        x: 2150,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 125,
        alive: true,
        type: "spiked",
      },
      {
        x: 2400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 115,
        alive: true,
        type: "fast",
      },
      {
        x: 360,
        y: HEIGHT - 232,
        w: 36,
        h: 32,
        dir: 1,
        speed: 120,
        alive: true,
        type: "jumper",
      },
      {
        x: 1480,
        y: HEIGHT - 252,
        w: 36,
        h: 32,
        dir: -1,
        speed: 130,
        alive: true,
        type: "spiked",
      },
      {
        x: 2260,
        y: HEIGHT - 252,
        w: 36,
        h: 32,
        dir: 1,
        speed: 140,
        alive: true,
        type: "fast",
      },
    ],
    coins: [
      { x: 320, y: HEIGHT - 240, r: 10, taken: false },
      { x: 900, y: HEIGHT - 260, r: 10, taken: false },
      { x: 1720, y: HEIGHT - 220, r: 10, taken: false },
      { x: 2500, y: HEIGHT - 300, r: 10, taken: false },
    ],
    powerups: [{ x: 1860, y: HEIGHT - 320, r: 14, type: "star", taken: false }],
    flag: { x: 2720, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#d9f0ff", bottom: "#eef6ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3600, h: 40 },
      { x: 360, y: HEIGHT - 160, w: 160, h: 16 },
      { x: 680, y: HEIGHT - 210, w: 160, h: 16 },
      { x: 940, y: HEIGHT - 250, w: 160, h: 16 },
      { x: 1200, y: HEIGHT - 190, w: 160, h: 16 },
      { x: 1460, y: HEIGHT - 150, w: 160, h: 16 },
      { x: 1720, y: HEIGHT - 200, w: 180, h: 16 },
      { x: 2000, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 2280, y: HEIGHT - 200, w: 160, h: 16 },
      { x: 2560, y: HEIGHT - 160, w: 160, h: 16 },
    ],
    enemies: [
      {
        x: 200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 110,
        alive: true,
        type: "normal",
      },
      {
        x: 480,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 140,
        alive: true,
        type: "fast",
      },
      {
        x: 800,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 105,
        alive: true,
        type: "jumper",
      },
      {
        x: 1100,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 130,
        alive: true,
        type: "spiked",
      },
      {
        x: 1400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 115,
        alive: true,
        type: "normal",
      },
      {
        x: 1650,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 145,
        alive: true,
        type: "fast",
      },
      {
        x: 1950,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 110,
        alive: true,
        type: "jumper",
      },
      {
        x: 2200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 135,
        alive: true,
        type: "spiked",
      },
      {
        x: 2450,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 120,
        alive: true,
        type: "fast",
      },
      {
        x: 380,
        y: HEIGHT - 192,
        w: 36,
        h: 32,
        dir: -1,
        speed: 120,
        alive: true,
        type: "jumper",
      },
      {
        x: 1220,
        y: HEIGHT - 222,
        w: 36,
        h: 32,
        dir: 1,
        speed: 140,
        alive: true,
        type: "spiked",
      },
      {
        x: 2020,
        y: HEIGHT - 272,
        w: 36,
        h: 32,
        dir: -1,
        speed: 150,
        alive: true,
        type: "fast",
      },
    ],
    coins: [
      { x: 360, y: HEIGHT - 200, r: 10, taken: false },
      { x: 940, y: HEIGHT - 290, r: 10, taken: false },
      { x: 1720, y: HEIGHT - 240, r: 10, taken: false },
      { x: 2280, y: HEIGHT - 240, r: 10, taken: false },
    ],
    powerups: [
      { x: 1340, y: HEIGHT - 280, r: 14, type: "feather", taken: false },
    ],
    flag: { x: 2800, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#f7e9ff", bottom: "#f2f9ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3800, h: 40 },
      { x: 380, y: HEIGHT - 140, w: 160, h: 16 },
      { x: 720, y: HEIGHT - 200, w: 160, h: 16 },
      { x: 1040, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 1320, y: HEIGHT - 280, w: 160, h: 16 },
      { x: 1600, y: HEIGHT - 220, w: 180, h: 16 },
      { x: 1880, y: HEIGHT - 180, w: 180, h: 16 },
      { x: 2160, y: HEIGHT - 220, w: 160, h: 16 },
      { x: 2440, y: HEIGHT - 260, w: 160, h: 16 },
      { x: 2720, y: HEIGHT - 200, w: 180, h: 16 },
      { x: 3000, y: HEIGHT - 160, w: 180, h: 16 },
    ],
    enemies: [
      {
        x: 220,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 115,
        alive: true,
        type: "normal",
      },
      {
        x: 520,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 150,
        alive: true,
        type: "fast",
      },
      {
        x: 850,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 110,
        alive: true,
        type: "jumper",
      },
      {
        x: 1150,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 140,
        alive: true,
        type: "spiked",
      },
      {
        x: 1450,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 120,
        alive: true,
        type: "normal",
      },
      {
        x: 1750,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 155,
        alive: true,
        type: "fast",
      },
      {
        x: 2050,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 115,
        alive: true,
        type: "jumper",
      },
      {
        x: 2350,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 145,
        alive: true,
        type: "spiked",
      },
      {
        x: 2650,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 125,
        alive: true,
        type: "fast",
      },
      {
        x: 2900,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 130,
        alive: true,
        type: "jumper",
      },
      {
        x: 760,
        y: HEIGHT - 232,
        w: 36,
        h: 32,
        dir: -1,
        speed: 130,
        alive: true,
        type: "spiked",
      },
      {
        x: 1620,
        y: HEIGHT - 252,
        w: 36,
        h: 32,
        dir: 1,
        speed: 150,
        alive: true,
        type: "fast",
      },
      {
        x: 2460,
        y: HEIGHT - 292,
        w: 36,
        h: 32,
        dir: -1,
        speed: 160,
        alive: true,
        type: "jumper",
      },
    ],
    coins: [
      { x: 720, y: HEIGHT - 240, r: 10, taken: false },
      { x: 1320, y: HEIGHT - 320, r: 10, taken: false },
      { x: 1880, y: HEIGHT - 220, r: 10, taken: false },
      { x: 2720, y: HEIGHT - 240, r: 10, taken: false },
    ],
    powerups: [{ x: 2100, y: HEIGHT - 300, r: 14, type: "star", taken: false }],
    flag: { x: 3220, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#e4f7e7", bottom: "#f5fff2" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 4000, h: 40 },
      { x: 420, y: HEIGHT - 190, w: 160, h: 16 },
      { x: 760, y: HEIGHT - 140, w: 160, h: 16 },
      { x: 1080, y: HEIGHT - 220, w: 160, h: 16 },
      { x: 1360, y: HEIGHT - 260, w: 160, h: 16 },
      { x: 1640, y: HEIGHT - 220, w: 180, h: 16 },
      { x: 1920, y: HEIGHT - 200, w: 180, h: 16 },
      { x: 2200, y: HEIGHT - 240, w: 180, h: 16 },
      { x: 2480, y: HEIGHT - 280, w: 160, h: 16 },
      { x: 2760, y: HEIGHT - 240, w: 180, h: 16 },
      { x: 3040, y: HEIGHT - 200, w: 180, h: 16 },
    ],
    enemies: [
      // 地面怪物 - 最終關卡最具挑戰性
      {
        x: 250,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 120,
        alive: true,
        type: "normal",
      },
      {
        x: 550,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 160,
        alive: true,
        type: "fast",
      },
      {
        x: 900,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 115,
        alive: true,
        type: "jumper",
      },
      {
        x: 1200,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 150,
        alive: true,
        type: "spiked",
      },
      {
        x: 1500,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 125,
        alive: true,
        type: "normal",
      },
      {
        x: 1800,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 165,
        alive: true,
        type: "fast",
      },
      {
        x: 2100,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 120,
        alive: true,
        type: "jumper",
      },
      {
        x: 2400,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 155,
        alive: true,
        type: "spiked",
      },
      {
        x: 2700,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: 1,
        speed: 130,
        alive: true,
        type: "fast",
      },
      {
        x: 3000,
        y: HEIGHT - 72,
        w: 36,
        h: 32,
        dir: -1,
        speed: 140,
        alive: true,
        type: "jumper",
      },
      // 平台怪物
      {
        x: 440,
        y: HEIGHT - 222,
        w: 36,
        h: 32,
        dir: 1,
        speed: 140,
        alive: true,
        type: "spiked",
      },
      {
        x: 1100,
        y: HEIGHT - 252,
        w: 36,
        h: 32,
        dir: -1,
        speed: 160,
        alive: true,
        type: "fast",
      },
      {
        x: 2220,
        y: HEIGHT - 272,
        w: 36,
        h: 32,
        dir: 1,
        speed: 170,
        alive: true,
        type: "jumper",
      },
      {
        x: 2780,
        y: HEIGHT - 272,
        w: 36,
        h: 32,
        dir: -1,
        speed: 180,
        alive: true,
        type: "spiked",
      },
    ],
    coins: [
      { x: 420, y: HEIGHT - 230, r: 10, taken: false },
      { x: 1080, y: HEIGHT - 260, r: 10, taken: false },
      { x: 1920, y: HEIGHT - 240, r: 10, taken: false },
      { x: 2760, y: HEIGHT - 280, r: 10, taken: false },
    ],
    powerups: [
      { x: 1680, y: HEIGHT - 300, r: 14, type: "feather", taken: false },
    ],
    flag: { x: 3300, y: HEIGHT - 180, h: 180 },
  },
];

const LEVELS = BASE_LEVELS.map((lvl, index) => extendLevel(lvl, index));
