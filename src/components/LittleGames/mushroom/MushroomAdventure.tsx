import { useCallback, useEffect, useRef, useState } from "react";
import { MUSHROOM_CONFIG } from "../lib/constants";
import { clamp, getBestScore, setBestScore } from "../lib/game-utils";
import { type MushroomSettings } from "../lib/types";
import { BASE_SPEED, GRAVITY, HEIGHT, JUMP_SPEED, WIDTH } from "./constants";
import { LEVELS } from "./levels";
import { Overlay, PauseOverlay, SettingsOverlay } from "./overlays";
import {
  drawCloud,
  drawHero,
  drawMushroomEnemy,
  drawPowerup,
  roundRect,
} from "./sprites";
import type { FloatingText, GameState, Particle } from "./types";

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBest(getBestScore(MUSHROOM_CONFIG.BEST_SCORE_KEY));
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

  // 暫停：先清空按鍵，避免恢復時角色帶著舊輸入暴衝
  const pauseGame = useCallback(() => {
    const keys = stateRef.current.keys;
    keys.left = false;
    keys.right = false;
    keys.jump = false;
    setGameState("paused");
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
      if (key === "escape") {
        if (gameState === "playing") pauseGame();
        else if (gameState === "paused") setGameState("playing");
        return;
      }
      // 遊玩中攔截遊戲鍵：空白鍵/方向鍵不捲動頁面、不誤觸 focused 按鈕
      if (gameState === "playing" && isGameKey(key)) e.preventDefault();
      // 暫停中不累積按鍵，避免恢復時角色暴衝
      if (gameState === "paused") return;
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
  }, [gameState, pauseGame]);

  // 視窗失焦/分頁切走時自動暫停，中途被叫走也不會送命
  useEffect(() => {
    if (gameState !== "playing") return;
    const onVisibility = () => {
      if (document.hidden) pauseGame();
    };
    const onBlur = () => pauseGame();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [gameState, pauseGame]);

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
        setBestScore(stateRef.current.score, MUSHROOM_CONFIG.BEST_SCORE_KEY);
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

  const startGame = (levelIdx = 0) => {
    // 讓滑鼠點過的按鈕失焦，避免開場第一下空白鍵又觸發按鈕
    (document.activeElement as HTMLElement | null)?.blur();
    stateRef.current.score = 0;
    stateRef.current.lives = 3;
    loadLevel(levelIdx);
    setScore(0);
    setLives(3);
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
              onClick={() => startGame()}
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

    if (gameState === "paused") {
      return (
        <PauseOverlay
          onResume={() => setGameState("playing")}
          onRestart={() => startGame(stateRef.current.levelIndex)}
          onMenu={() => setGameState("menu")}
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
              onClick={() => startGame()}
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
              onClick={() => startGame()}
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
      {gameState === "playing" && (
        <button
          onClick={pauseGame}
          className="absolute right-6 top-6 z-20 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          ⏸ 暫停
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

function aabb(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
