import confetti from "canvas-confetti";
import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { MUSHROOM_CONFIG } from "../lib/constants";
import { clamp, getBestScore, setBestScore } from "../lib/game-utils";
import { type MushroomSettings } from "../lib/types";
import {
  BASE_SPEED,
  GRAVITY,
  HEIGHT,
  JUMP_SPEED,
  SPRING_SPEED,
  TUTORIAL_INDEX,
  WIDTH,
} from "./constants";
import { buildLevels, LEVEL_COUNT, TUTORIAL_LEVEL } from "./levels";
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  BTN_SECONDARY,
  Overlay,
  PauseOverlay,
  SettingsOverlay,
  TutorialCompleteOverlay,
} from "./overlays";
import {
  drawCloud,
  drawGate,
  drawHero,
  drawMushroomEnemy,
  drawPowerup,
  drawSign,
  drawSpring,
  roundRect,
} from "./sprites";
import type {
  AmbientKind,
  FloatingText,
  GameState,
  Level,
  MushroomProgress,
  Particle,
} from "./types";

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

// 關卡進度持久化
const loadProgress = (): MushroomProgress => {
  try {
    const stored = localStorage.getItem(MUSHROOM_CONFIG.PROGRESS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<MushroomProgress>;
      return {
        version: 1,
        highestUnlocked: clamp(
          Math.floor(parsed.highestUnlocked ?? 0),
          0,
          LEVEL_COUNT - 1,
        ),
        tutorialDone: Boolean(parsed.tutorialDone),
      };
    }
  } catch { /* ignore invalid stored progress */ }
  return { version: 1, highestUnlocked: 0, tutorialDone: false };
};

const saveProgress = (progress: MushroomProgress) => {
  localStorage.setItem(MUSHROOM_CONFIG.PROGRESS_KEY, JSON.stringify(progress));
};

// 執行期生成的關卡：開局／儲存設定時重建（隨機尾段 + 套用設定）。
// 模組級可變狀態——遊戲同時只會有一個實例。
let currentLevels: Level[] = buildLevels(loadSettings());
const rebuildLevels = (settings: MushroomSettings) => {
  currentLevels = buildLevels(settings);
};

// 一般關卡查 currentLevels；教學關（TUTORIAL_INDEX）是獨立常數
const getLevel = (index: number) =>
  index === TUTORIAL_INDEX ? TUTORIAL_LEVEL : currentLevels[index];

// 主題環境粒子（螢幕座標）：雪花、落葉、螢火蟲、星星、洞穴微光
const spawnAmbient = (kind: AmbientKind): Particle => {
  switch (kind) {
    case "snow":
      return {
        x: Math.random() * WIDTH,
        y: -10,
        vx: (Math.random() - 0.5) * 30,
        vy: 40 + Math.random() * 40,
        life: 12,
        maxLife: 12,
        color: "#ffffff",
        size: 2 + Math.random() * 2.5,
      };
    case "leaves":
      return {
        x: Math.random() * (WIDTH + 200),
        y: -10,
        vx: -20 - Math.random() * 25,
        vy: 35 + Math.random() * 30,
        life: 12,
        maxLife: 12,
        color: Math.random() > 0.5 ? "#84cc16" : "#ca8a04",
        size: 3 + Math.random() * 2.5,
      };
    case "fireflies":
      return {
        x: Math.random() * WIDTH,
        y: 120 + Math.random() * 330,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 25,
        life: 3 + Math.random() * 2,
        maxLife: 5,
        color: "#fde047",
        size: 2 + Math.random() * 1.5,
      };
    case "stars":
      return {
        x: Math.random() * WIDTH,
        y: Math.random() * 280,
        vx: 0,
        vy: 0,
        life: 2 + Math.random() * 2,
        maxLife: 4,
        color: "#ffffff",
        size: 1 + Math.random() * 1.6,
      };
    default:
      // sparkles（洞穴微光）
      return {
        x: Math.random() * WIDTH,
        y: 160 + Math.random() * 320,
        vx: (Math.random() - 0.5) * 15,
        vy: -12 - Math.random() * 18,
        life: 2.5 + Math.random(),
        maxLife: 3.5,
        color: "#fbbf24",
        size: 1.5 + Math.random() * 1.8,
      };
  }
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
  const [levelIndex, setLevelIndex] = useState(0);
  const [settings, setSettings] = useState<MushroomSettings>(loadSettings);
  const [progress, setProgress] = useState<MushroomProgress>(loadProgress);

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
    platforms: currentLevels[0].platforms,
    enemies: currentLevels[0].enemies.map((e) => ({ ...e })),
    coins: currentLevels[0].coins.map((c) => ({ ...c })),
    powerups: currentLevels[0].powerups.map((p) => ({ ...p })),
    flag: currentLevels[0].flag,
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
    // 教學關狀態
    gatesOpen: {} as Record<string, boolean>,
    activeHintId: null as string | null,
    checkpointX: 80,
    // 移動平台：關卡內累計時間 + 玩家腳下的平台索引（載運用）
    time: 0,
    groundPlatformIndex: -1,
    // 主題環境粒子（螢幕座標）
    ambient: [] as Particle[],
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
      // 底限只避免尺寸歸零；不設高地板，確保 canvas 一定能塞進容器
      // （容器 overflow-hidden，canvas 若比容器大會裁掉 HUD）
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

  // 全通關／教學完成的彩帶慶祝（尊重減少動態偏好）
  const shouldReduceMotion = useReducedMotion();
  useEffect(() => {
    if (gameState !== "win" && gameState !== "tutorialComplete") return;
    if (shouldReduceMotion) return;
    confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });
    const timer = setTimeout(() => {
      confetti({ particleCount: 80, spread: 110, origin: { y: 0.4 } });
    }, 350);
    return () => clearTimeout(timer);
  }, [gameState, shouldReduceMotion]);

  const loadLevel = (index: number) => {
    const lvl = getLevel(index);
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
      platforms: lvl.platforms.map((p) => ({ ...p, baseX: p.x, baseY: p.y })),
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
      // 重置教學狀態
      gatesOpen: {},
      activeHintId: null,
      checkpointX: 80,
      // 重置平台時間與載運
      time: 0,
      groundPlatformIndex: -1,
      ambient: [],
    };
    setLevelIndex(index);
  };

  // 過關即解鎖，之後可從選單直接挑戰
  const unlockLevel = (idx: number) => {
    setProgress((prev) => {
      const highestUnlocked = clamp(
        Math.max(prev.highestUnlocked, idx),
        0,
        LEVEL_COUNT - 1,
      );
      if (highestUnlocked === prev.highestUnlocked) return prev;
      const next = { ...prev, highestUnlocked };
      saveProgress(next);
      return next;
    });
  };

  const nextLevel = () => {
    const next = stateRef.current.levelIndex + 1;
    unlockLevel(next);
    if (next >= LEVEL_COUNT) {
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

  const completeTutorial = () => {
    setProgress((prev) => {
      if (prev.tutorialDone) return prev;
      const next = { ...prev, tutorialDone: true };
      saveProgress(next);
      return next;
    });
    setGameState("tutorialComplete");
  };

  const hitPlayer = () => {
    const s = stateRef.current;
    if (s.invincibleTimer > 0) return;

    // 教學關不扣生命：輕震動 + 擊退 + 短暫無敵，讓小孩安心試錯
    if (getLevel(s.levelIndex).tutorial) {
      const p = s.player;
      s.screenShake = { intensity: 4, duration: 0.2 };
      s.comboCount = 0;
      p.vy = -400;
      p.vx = -Math.sign(p.vx || 1) * 220;
      s.invincibleTimer = 2;
      return;
    }

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
      // 死亡也結算最佳分數（原本只有全通關才會存）
      if (s.score > best) {
        setBest(s.score);
        setBestScore(s.score, MUSHROOM_CONFIG.BEST_SCORE_KEY);
      }
      setGameState("dead");
    } else {
      const lvl = getLevel(s.levelIndex);
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
    const lvl = getLevel(s.levelIndex);
    s.time += dt;

    // 移動平台：以絕對時間正弦定位（不受 dt clamp 影響、無漂移），
    // 玩家上一幀站在其上時跟著平台位移
    s.platforms.forEach((plat, i) => {
      if (plat.squash) plat.squash = Math.max(0, plat.squash - dt);
      if (plat.kind !== "moving" || !plat.move) return;
      const { axis, range, speed, phase = 0 } = plat.move;
      const offset = Math.sin(s.time * speed + phase) * range;
      if (axis === "x") {
        const next = (plat.baseX ?? plat.x) + offset;
        if (s.groundPlatformIndex === i) p.x += next - plat.x;
        plat.x = next;
      } else {
        const next = (plat.baseY ?? plat.y) + offset;
        if (s.groundPlatformIndex === i) p.y += next - plat.y;
        plat.y = next;
      }
    });

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

    // 每幀重算腳下平台（載運判定用）；地面也是平台（有坑洞的關卡才可能墜落）
    s.groundPlatformIndex = -1;
    p.onGround = false;

    // platforms
    s.platforms.forEach((plat, i) => {
      if (aabb(p, plat)) {
        const prevY = p.y - p.vy * dt;
        if (prevY + p.h <= plat.y + 6) {
          if (plat.kind === "spring" && p.vy > 0) {
            // 彈跳蘑菇：自動高彈（比一般跳更高），保留二段跳機會
            p.y = plat.y - p.h;
            p.vy = -SPRING_SPEED;
            p.onGround = false;
            p.jumps = 1;
            plat.squash = 0.25;
            if (
              settings.enableParticles &&
              s.particles.length < MUSHROOM_CONFIG.MAX_PARTICLES
            ) {
              for (
                let k = 0;
                k < 6 && s.particles.length < MUSHROOM_CONFIG.MAX_PARTICLES;
                k++
              ) {
                s.particles.push({
                  x: plat.x + plat.w / 2 + (Math.random() - 0.5) * plat.w,
                  y: plat.y,
                  vx: (Math.random() - 0.5) * 120,
                  vy: -60 - Math.random() * 120,
                  life: 0.5,
                  maxLife: 0.5,
                  color: "#fda4af",
                  size: 3 + Math.random() * 3,
                });
              }
            }
            return;
          }
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.jumps = 0;
          s.groundPlatformIndex = i;
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

    // 教學關：告示觸發、檢查點推進、關卡門
    if (lvl.tutorial) {
      const px = p.x + p.w / 2;
      s.activeHintId = null;
      for (const t of lvl.triggers ?? []) {
        if (px >= t.x && px <= t.x + t.w) s.activeHintId = t.id;
        // 走過的區段起點成為落地重生的檢查點
        if (px >= t.x) s.checkpointX = Math.max(s.checkpointX, t.x + 20);
      }
      for (const g of lvl.gates ?? []) {
        if (s.gatesOpen[g.id]) continue;
        const cleared =
          g.until === "enemiesCleared"
            ? s.enemies.every(
                (e) => !e.alive || e.x < g.x - 600 || e.x > g.x,
              )
            : s.coins.every((c) => c.taken || c.x > g.x);
        if (cleared) {
          s.gatesOpen[g.id] = true;
          s.floatingTexts.push({
            x: g.x + 12,
            y: HEIGHT - 220,
            text: "門打開了！",
            life: 1.5,
            color: "#22c55e",
          });
        } else {
          // 未解鎖：視為一面牆
          const wall = { x: g.x, y: 0, w: 24, h: HEIGHT - 40 };
          if (aabb(p, wall)) {
            if (p.x < wall.x) p.x = wall.x - p.w;
            else p.x = wall.x + wall.w;
            p.vx = 0;
          }
        }
      }
    }

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

    // 主題環境粒子：生成與推進
    const ambientKind = lvl.theme.ambient;
    if (ambientKind !== "none" && settings.enableParticles) {
      if (s.ambient.length < 40 && Math.random() < 0.35) {
        s.ambient.push(spawnAmbient(ambientKind));
      }
      for (let i = s.ambient.length - 1; i >= 0; i--) {
        const a = s.ambient[i];
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.life -= dt;
        if (a.life <= 0 || a.y > HEIGHT + 20 || a.x < -20 || a.x > WIDTH + 220) {
          s.ambient.splice(i, 1);
        }
      }
    } else if (s.ambient.length) {
      s.ambient.length = 0;
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
      if (lvl.tutorial) {
        completeTutorial();
      } else {
        const bonus = 150 + Math.max(0, 200 - Math.floor(p.y));
        s.score += bonus;
        nextLevel();
      }
      return;
    }

    // fall death
    if (p.y > HEIGHT + 220) {
      if (lvl.tutorial) {
        // 教學關落地重生於檢查點，不扣生命
        p.x = s.checkpointX;
        p.y = HEIGHT - 140;
        p.vx = 0;
        p.vy = 0;
      } else {
        hitPlayer();
      }
    }
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    const lvl = getLevel(s.levelIndex);

    ctx.save();

    // 螢幕震動效果
    if (s.screenShake.duration > 0) {
      const shakeX = (Math.random() - 0.5) * s.screenShake.intensity * 2;
      const shakeY = (Math.random() - 0.5) * s.screenShake.intensity * 2;
      ctx.translate(shakeX, shakeY);
    }

    ctx.clearRect(-10, -10, WIDTH + 20, HEIGHT + 20);

    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, lvl.theme.sky.top);
    sky.addColorStop(1, lvl.theme.sky.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // clouds - 視差滾動 (0.2 速率)
    ctx.save();
    ctx.fillStyle = lvl.theme.cloud;
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
    ctx.fillStyle = lvl.theme.hillFar;
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
    ctx.fillStyle = lvl.theme.hillNear;
    ctx.beginPath();
    ctx.ellipse(260, HEIGHT - 20, 180, 90, 0, 0, Math.PI * 2);
    ctx.ellipse(740, HEIGHT - 10, 220, 100, 0, 0, Math.PI * 2);
    ctx.fill();

    // platforms（含地面段：接觸畫布底部的平台以地面色實心繪製，坑洞自然留空）
    s.platforms.forEach((p) => {
      if (p.kind === "spring") {
        drawSpring(ctx, p);
        return;
      }
      if (p.y + p.h >= HEIGHT - 0.5) {
        ctx.fillStyle = lvl.theme.ground;
        ctx.fillRect(p.x, p.y, p.w, HEIGHT - p.y + 20);
        return;
      }
      ctx.fillStyle = lvl.theme.platform;
      roundRect(ctx, p.x, p.y, p.w, p.h, 6);
      ctx.fillStyle = lvl.theme.platformEdge;
      roundRect(ctx, p.x, p.y, p.w, 8, 6);
      if (p.kind === "moving") {
        // 移動平台：底部兩顆鉚釘 + 描邊做視覺區隔
        ctx.strokeStyle = "rgba(45, 90, 39, 0.55)";
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
        ctx.fillStyle = "#3f6212";
        ctx.beginPath();
        ctx.arc(p.x + 10, p.y + p.h - 5, 3, 0, Math.PI * 2);
        ctx.arc(p.x + p.w - 10, p.y + p.h - 5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
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

    // 教學：告示牌與未解鎖的門
    if (lvl.tutorial) {
      for (const t of lvl.triggers ?? []) {
        drawSign(ctx, t.anchorX, HEIGHT - 40, t.text, s.activeHintId === t.id);
      }
      for (const g of lvl.gates ?? []) {
        if (!s.gatesOpen[g.id]) drawGate(ctx, g.x, HEIGHT - 40, g.hint);
      }
    }

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

    // 主題環境粒子（螢幕座標，世界之上、HUD 之下）
    s.ambient.forEach((a) => {
      ctx.save();
      const t = a.life / a.maxLife;
      ctx.globalAlpha = Math.min(1, t * 2) * 0.9;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // HUD：圓角半透明資訊籤（邏輯座標繪製，letterbox 縮放下自動等比）
    let hudX = 14;
    const chip = (text: string, color = "#0f172a") => {
      ctx.font = "bold 18px system-ui";
      ctx.textAlign = "left";
      const w = ctx.measureText(text).width + 28;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      roundRect(ctx, hudX, 12, w, 36, 18);
      ctx.fillStyle = color;
      ctx.fillText(text, hudX + 14, 37);
      hudX += w + 8;
    };
    chip(`分數 ${s.score}`);
    if (s.levelIndex === TUTORIAL_INDEX) {
      chip("教學關 · 放心練習", "#0369a1");
    } else {
      chip(
        s.lives <= 5 ? "❤️".repeat(Math.max(s.lives, 0)) : `❤️ ×${s.lives}`,
        "#e11d48",
      );
      chip(`第 ${s.levelIndex + 1} 關 · ${lvl.theme.name}`);
    }
    chip(`最佳 ${best}`, "#64748b");
    if (s.comboCount >= 2) {
      const comboColor =
        s.comboCount >= 5
          ? "#f59e0b"
          : s.comboCount >= 3
          ? "#22c55e"
          : "#3b82f6";
      chip(`連擊 ×${s.comboCount}`, comboColor);
    }
    if (s.invincibleTimer > 0) chip(`⭐ ${s.invincibleTimer.toFixed(1)}s`, "#d97706");
    if (s.featherTimer > 0) chip(`🪶 ${s.featherTimer.toFixed(1)}s`, "#7c3aed");
    if (s.speedTimer > 0) chip(`👟 ${s.speedTimer.toFixed(1)}s`, "#0284c7");

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
    // 每輪重新生成關卡：隨機尾段每次不同，並套用最新設定
    rebuildLevels(settings);
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
    rebuildLevels(newSettings);
    setGameState("menu");
  };

  const overlay = () => {
    if (gameState === "menu") {
      const hasProgress = progress.highestUnlocked > 0;
      return (
        <Overlay>
          <h2 className="text-4xl font-bold text-emerald-800 mb-2">
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
            {!progress.tutorialDone ? (
              <>
                <button
                  onClick={() => startGame(TUTORIAL_INDEX)}
                  className={BTN_PRIMARY}
                >
                  🎓 先玩教學
                </button>
                <button
                  onClick={() => startGame()}
                  className={BTN_SECONDARY}
                >
                  直接開始
                </button>
              </>
            ) : hasProgress ? (
              <>
                <button
                  onClick={() => startGame(progress.highestUnlocked)}
                  className={BTN_PRIMARY}
                >
                  繼續（第 {progress.highestUnlocked + 1} 關）
                </button>
                <button
                  onClick={() => startGame()}
                  className={BTN_SECONDARY}
                >
                  從第 1 關開始
                </button>
              </>
            ) : (
              <button
                onClick={() => startGame()}
                className={BTN_PRIMARY}
              >
                開始遊戲
              </button>
            )}
            {progress.tutorialDone && (
              <button
                onClick={() => startGame(TUTORIAL_INDEX)}
                className={BTN_SECONDARY}
              >
                🎓 教學
              </button>
            )}
            <button
              onClick={() => setGameState("settings")}
              className={BTN_SECONDARY}
            >
              ⚙️ 設定
            </button>
          </div>
          {hasProgress && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-2">選擇關卡</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {Array.from({ length: LEVEL_COUNT }, (_, i) => {
                  const unlocked = i <= progress.highestUnlocked;
                  return (
                    <button
                      key={i}
                      disabled={!unlocked}
                      aria-disabled={!unlocked}
                      onClick={() => startGame(i)}
                      aria-label={
                        unlocked ? `第 ${i + 1} 關` : `第 ${i + 1} 關（未解鎖）`
                      }
                      className={`h-9 w-9 rounded-full text-sm font-semibold shadow transition ${
                        unlocked
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      {unlocked ? i + 1 : "🔒"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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

    if (gameState === "tutorialComplete") {
      return (
        <TutorialCompleteOverlay
          onStart={() => startGame(0)}
          onMenu={() => setGameState("menu")}
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
          <h2 className="text-4xl font-bold text-emerald-800 mb-2">
            全部通關！
          </h2>
          <p className="text-slate-700 mb-2">總分 {score}</p>
          <p className="text-xs text-slate-600 mb-4">最佳：{best}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => startGame()}
              className={BTN_PRIMARY}
            >
              再玩一次
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className={BTN_OUTLINE}
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
          <h2 className="text-4xl font-bold text-rose-500 mb-2">差一點點！</h2>
          <p className="text-slate-700 mb-1">再試一次一定可以的！</p>
          <p className="text-slate-600 mb-4 text-sm">
            這次拿到 {score} 分（第 {levelIndex + 1} 關）
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => startGame(levelIndex)}
              className={BTN_PRIMARY}
            >
              從第 {levelIndex + 1} 關再試
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className={BTN_OUTLINE}
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
