import kaplay, {
  type GameObj,
  type KAPLAYCtx,
  type TextComp,
  type Vec2,
} from "kaplay";
import { playSound } from "../../../services/gameService";
import type { GameWordSeed } from "../../../services/gameWords";
import {
  buildWordRunnerRounds,
  getWordRunnerBestScore,
  setWordRunnerBestScore,
  type WordRunnerRound,
} from "./wordRunnerData";

export const WORD_RUNNER_WIDTH = 1280;
export const WORD_RUNNER_HEIGHT = 800;

export type WordRunnerAssets = {
  background: string;
  parallaxClouds: string;
  mascotIdle: string;
  mascotRun: string;
  mascotJump: string;
  platformBook: string;
  tokenCorrect: string;
  cardWrong: string;
  finishFlag: string;
};

export type WordRunnerCallbacks = {
  onScoreChange?: (score: number) => void;
  onBestScoreChange?: (score: number) => void;
  onGameOver?: (result: { score: number; bestScore: number; victory: boolean }) => void;
};

export type WordRunnerGameOptions = {
  canvas: HTMLCanvasElement;
  words: readonly GameWordSeed[];
  assets: WordRunnerAssets;
  callbacks?: WordRunnerCallbacks;
};

export type WordRunnerGameController = {
  quit: () => void;
};

type AnswerMeta = {
  roundIndex: number;
  isCorrect: boolean;
  label: GameObj;
};

const WORLD_SPEED = 165;
const MANUAL_SPEED = 145;
const JUMP_FORCE = 760;
const PLATFORM_Y = 655;
const ROUND_SPACING = 430;
const START_X = 170;
const FIRST_ROUND_X = 650;
const ROUND_COUNT = 10;

function addFixedLabel(
  k: KAPLAYCtx,
  value: string,
  x: number,
  y: number,
  size = 22,
): GameObj<TextComp> {
  return k.add([
    k.text(value, { size }),
    k.pos(x, y),
    k.fixed(),
    k.color("#102033"),
    k.z(120),
  ]);
}

function addGlassPanel(
  k: KAPLAYCtx,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  k.add([
    k.rect(width, height, { radius: 18 }),
    k.pos(x, y),
    k.fixed(),
    k.color("#f7fbff"),
    k.opacity(0.78),
    k.outline(2, k.rgb("#ffffff"), 0.7),
    k.z(105),
  ]);
}

function addBackground(k: KAPLAYCtx): GameObj {
  k.add([
    k.sprite("background"),
    k.pos(0, 0),
    k.scale(WORD_RUNNER_WIDTH / 1586, WORD_RUNNER_HEIGHT / 992),
    k.fixed(),
    k.z(0),
  ]);

  return k.add([
    k.sprite("parallax-clouds"),
    k.pos(0, 0),
    k.scale(WORD_RUNNER_WIDTH / 1586, WORD_RUNNER_HEIGHT / 992),
    k.fixed(),
    k.opacity(0.72),
    k.z(8),
  ]);
}

function playEffect(effect: Parameters<typeof playSound>[0]): void {
  playSound(effect);
}

function createAnswer(
  k: KAPLAYCtx,
  round: WordRunnerRound,
  optionIndex: number,
  x: number,
  y: number,
  answerMeta: Map<GameObj, AnswerMeta>,
  roundObjects: Map<number, GameObj[]>,
): void {
  const option = round.options[optionIndex];
  const isCorrect = option.id === round.correctOptionId;
  const spriteName = isCorrect ? "token-correct" : "card-wrong";
  const itemScale = isCorrect ? 0.27 : 0.22;
  const labelY = isCorrect ? y + 6 : y + 88;
  const labelColor = isCorrect ? "#064e3b" : "#7f1d1d";

  const answer = k.add([
    k.sprite(spriteName),
    k.pos(x, y),
    k.anchor("center"),
    k.scale(itemScale),
    k.area({ scale: isCorrect ? 1.05 : 0.72 }),
    k.z(35),
    "answer",
    "scroll",
  ]);

  const label = k.add([
    k.text(option.word, {
      align: "center",
      size: option.word.length > 11 ? 21 : 26,
      width: 180,
    }),
    k.pos(x, labelY),
    k.anchor("center"),
    k.color(labelColor),
    k.z(45),
    "scroll",
  ]);

  answerMeta.set(answer, {
    roundIndex: Number(round.id.split("-")[1] ?? 0),
    isCorrect,
    label,
  });

  const objects = roundObjects.get(Number(round.id.split("-")[1] ?? 0)) ?? [];
  objects.push(answer, label);
  roundObjects.set(Number(round.id.split("-")[1] ?? 0), objects);
}

export function createWordRunnerGame({
  canvas,
  words,
  assets,
  callbacks,
}: WordRunnerGameOptions): WordRunnerGameController {
  const k = kaplay({
    canvas,
    width: WORD_RUNNER_WIDTH,
    height: WORD_RUNNER_HEIGHT,
    stretch: true,
    letterbox: true,
    global: false,
    debug: false,
    focus: true,
    touchToMouse: false,
    loadingScreen: false,
    background: [255, 255, 255, 0],
    pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
  });

  k.loadSprite("background", assets.background);
  k.loadSprite("parallax-clouds", assets.parallaxClouds);
  k.loadSprite("mascot-idle", assets.mascotIdle);
  k.loadSprite("mascot-run", assets.mascotRun);
  k.loadSprite("mascot-jump", assets.mascotJump);
  k.loadSprite("platform-book", assets.platformBook);
  k.loadSprite("token-correct", assets.tokenCorrect);
  k.loadSprite("card-wrong", assets.cardWrong);
  k.loadSprite("finish-flag", assets.finishFlag);

  const rounds = buildWordRunnerRounds(words, ROUND_COUNT);
  const sceneCleanups = new Set<() => void>();

  k.scene("runner", () => {
    k.debug.timeScale = 1;
    k.setGravity(1850);

    let score = 0;
    let lives = 3;
    let currentRoundIndex = 0;
    let gameEnded = false;
    let paused = false;
    const input = { left: false, right: false };
    const answerMeta = new Map<GameObj, AnswerMeta>();
    const roundObjects = new Map<number, GameObj[]>();
    const finishX = FIRST_ROUND_X + rounds.length * ROUND_SPACING + 280;

    const cloudLayer = addBackground(k);

    for (let x = 70; x < finishX + 700; x += 235) {
      k.add([
        k.sprite("platform-book"),
        k.pos(x, PLATFORM_Y),
        k.anchor("center"),
        k.scale(0.31),
        k.z(20),
        "platform",
        "scroll",
      ]);
    }

    k.add([
      k.rect(finishX + 1200, 36),
      k.pos(-260, PLATFORM_Y - 18),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "floor",
    ]);

    rounds.forEach((round, roundIndex) => {
      const baseX = FIRST_ROUND_X + roundIndex * ROUND_SPACING;
      const y = roundIndex % 2 === 0 ? 560 : 530;

      round.options.forEach((_, optionIndex) => {
        createAnswer(
          k,
          round,
          optionIndex,
          baseX + optionIndex * 126,
          y,
          answerMeta,
          roundObjects,
        );
      });
    });

    k.add([
      k.sprite("finish-flag"),
      k.pos(finishX, PLATFORM_Y - 72),
      k.anchor("center"),
      k.scale(0.34),
      k.area({ scale: 0.5 }),
      k.z(32),
      "finish",
      "scroll",
    ]);

    const player = k.add([
      k.sprite("mascot-run"),
      k.pos(START_X, PLATFORM_Y - 140),
      k.anchor("center"),
      k.scale(0.25),
      k.area({ scale: k.vec2(0.48, 0.62), offset: k.vec2(0, 20) }),
      k.body({ jumpForce: JUMP_FORCE, maxVelocity: 1200 }),
      k.z(50),
      "player",
    ]);

    addGlassPanel(k, 28, 22, 340, 94);
    addGlassPanel(k, WORD_RUNNER_WIDTH - 210, 22, 180, 78);
    addGlassPanel(k, 414, 22, 452, 78);

    addFixedLabel(k, "Ollie Word Runner", 48, 44, 24);
    const scoreText = addFixedLabel(k, "Score 0", 48, 78, 20);
    const bestText = addFixedLabel(
      k,
      `Best ${getWordRunnerBestScore()}`,
      190,
      78,
      20,
    );
    const promptText = addFixedLabel(
      k,
      rounds[0] ? `Find: ${rounds[0].definition}` : "Find the word",
      438,
      50,
      22,
    );
    const statusText = addFixedLabel(k, "Collect the green word", 438, 78, 18);
    const pauseText = addFixedLabel(k, "Pause", WORD_RUNNER_WIDTH - 164, 50, 22);

    k.add([
      k.circle(58),
      k.pos(112, WORD_RUNNER_HEIGHT - 92),
      k.fixed(),
      k.color("#eaf3ff"),
      k.opacity(0.68),
      k.outline(3, k.rgb("#ffffff"), 0.72),
      k.z(110),
    ]);
    addFixedLabel(k, "←", 88, WORD_RUNNER_HEIGHT - 112, 42);
    k.add([
      k.circle(58),
      k.pos(252, WORD_RUNNER_HEIGHT - 92),
      k.fixed(),
      k.color("#eaf3ff"),
      k.opacity(0.68),
      k.outline(3, k.rgb("#ffffff"), 0.72),
      k.z(110),
    ]);
    addFixedLabel(k, "→", 228, WORD_RUNNER_HEIGHT - 112, 42);
    k.add([
      k.circle(66),
      k.pos(WORD_RUNNER_WIDTH - 116, WORD_RUNNER_HEIGHT - 96),
      k.fixed(),
      k.color("#eaf3ff"),
      k.opacity(0.72),
      k.outline(3, k.rgb("#ffffff"), 0.75),
      k.z(110),
    ]);
    addFixedLabel(k, "Jump", WORD_RUNNER_WIDTH - 150, WORD_RUNNER_HEIGHT - 107, 24);

    callbacks?.onScoreChange?.(score);
    callbacks?.onBestScoreChange?.(getWordRunnerBestScore());

    const updateHud = () => {
      scoreText.text = `Score ${score}`;
      bestText.text = `Best ${getWordRunnerBestScore()}`;
      const currentRound = rounds[currentRoundIndex];
      promptText.text = currentRound
        ? `Find: ${currentRound.definition}`
        : "Run to the flag";
      statusText.text = gameEnded
        ? "Press Enter or tap to restart"
        : `Lives ${"♥".repeat(lives)}${"♡".repeat(Math.max(0, 3 - lives))}`;
      callbacks?.onScoreChange?.(score);
    };

    const jump = () => {
      if (paused || gameEnded) return;
      if (player.isGrounded()) {
        player.jump(JUMP_FORCE);
        playEffect("click");
      }
    };

    const setPaused = (nextPaused: boolean) => {
      if (gameEnded) return;
      paused = nextPaused;
      k.debug.timeScale = paused ? 0 : 1;
      pauseText.text = paused ? "Resume" : "Pause";
      statusText.text = paused ? "Paused" : "Collect the green word";
    };

    const endGame = (victory: boolean) => {
      if (gameEnded) return;

      gameEnded = true;
      const bestScore = setWordRunnerBestScore(score);
      callbacks?.onBestScoreChange?.(bestScore);
      callbacks?.onGameOver?.({ score, bestScore, victory });
      playEffect(victory ? "levelup" : "wrong");
      statusText.text = victory
        ? "Nice run. Press Enter or tap to restart"
        : "Try again. Press Enter or tap to restart";
    };

    const clearRound = (roundIndex: number) => {
      const objects = roundObjects.get(roundIndex) ?? [];
      objects.forEach((obj) => {
        if (obj.exists()) k.destroy(obj);
      });
      roundObjects.delete(roundIndex);
    };

    player.onCollide("answer", (answer) => {
      if (paused || gameEnded) return;

      const meta = answerMeta.get(answer);
      if (!meta) return;

      if (meta.isCorrect) {
        score += 100;
        currentRoundIndex = Math.max(currentRoundIndex, meta.roundIndex + 1);
        clearRound(meta.roundIndex);
        playEffect("correct");
      } else {
        score = Math.max(0, score - 50);
        lives -= 1;
        k.destroy(answer);
        if (meta.label.exists()) k.destroy(meta.label);
        playEffect("wrong");
        k.shake(4);
      }

      updateHud();

      if (lives <= 0) {
        endGame(false);
      }
    });

    player.onCollide("finish", () => {
      score += currentRoundIndex >= rounds.length ? 250 : 100;
      updateHud();
      endGame(true);
    });

    k.onKeyDown(["left", "a"], () => {
      input.left = true;
    });
    k.onKeyRelease(["left", "a"], () => {
      input.left = false;
    });
    k.onKeyDown(["right", "d"], () => {
      input.right = true;
    });
    k.onKeyRelease(["right", "d"], () => {
      input.right = false;
    });
    k.onKeyPress(["space", "up", "w"], jump);
    k.onKeyPress("p", () => setPaused(!paused));
    k.onKeyPress("enter", () => {
      if (gameEnded) k.go("runner");
    });

    const handleScreenPress = (pos: Vec2) => {
      if (gameEnded) {
        k.go("runner");
        return;
      }

      if (pos.x > WORD_RUNNER_WIDTH - 210 && pos.y < 125) {
        setPaused(!paused);
        return;
      }

      if (pos.y < WORD_RUNNER_HEIGHT - 190) return;

      if (pos.x > WORD_RUNNER_WIDTH - 260) {
        jump();
      } else if (pos.x < 185) {
        input.left = true;
      } else if (pos.x < 330) {
        input.right = true;
      }
    };

    const releaseTouchControls = () => {
      input.left = false;
      input.right = false;
    };

    const clientToGamePos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * WORD_RUNNER_WIDTH;
      const y = ((clientY - rect.top) / rect.height) * WORD_RUNNER_HEIGHT;

      return k.vec2(x, y);
    };

    let lastCanvasPressAt = 0;
    const handleCanvasPress = (
      event: MouseEvent | PointerEvent | TouchEvent,
      clientX: number,
      clientY: number,
    ) => {
      if (event.target !== canvas) return;

      event.preventDefault();

      const now = window.performance.now();
      if (now - lastCanvasPressAt < 250) return;

      lastCanvasPressAt = now;
      handleScreenPress(clientToGamePos(clientX, clientY));
    };

    const handlePointerDown = (event: PointerEvent) => {
      handleCanvasPress(event, event.clientX, event.clientY);
    };

    const handleMouseDown = (event: MouseEvent) => {
      handleCanvasPress(event, event.clientX, event.clientY);
    };

    const handleClick = (event: MouseEvent) => {
      handleCanvasPress(event, event.clientX, event.clientY);
    };

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;

      handleCanvasPress(event, touch.clientX, touch.clientY);
    };

    const cleanupNativeInput = () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("pointerup", releaseTouchControls);
      window.removeEventListener("pointercancel", releaseTouchControls);
      window.removeEventListener("mouseup", releaseTouchControls);
      window.removeEventListener("touchend", releaseTouchControls);
      window.removeEventListener("touchcancel", releaseTouchControls);
      sceneCleanups.delete(cleanupNativeInput);
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("pointerup", releaseTouchControls);
    window.addEventListener("pointercancel", releaseTouchControls);
    window.addEventListener("mouseup", releaseTouchControls);
    window.addEventListener("touchend", releaseTouchControls);
    window.addEventListener("touchcancel", releaseTouchControls);
    sceneCleanups.add(cleanupNativeInput);
    k.onSceneLeave(cleanupNativeInput);

    k.onUpdate(() => {
      if (paused || gameEnded) return;

      const manual =
        (input.left ? -MANUAL_SPEED : 0) + (input.right ? MANUAL_SPEED : 0);
      player.pos.x = Math.max(
        120,
        Math.min(420, player.pos.x + manual * k.dt()),
      );

      k.query({ include: "scroll" }).forEach((obj) => {
        obj.move(-WORLD_SPEED, 0);
      });
      cloudLayer.pos.x = -((k.time() * 14) % 70);

      if (player.pos.y > WORD_RUNNER_HEIGHT + 260) {
        lives = 0;
        updateHud();
        endGame(false);
      }
    });

    updateHud();
  });

  k.onLoad(() => {
    k.go("runner");
  });

  k.onLoadError((name, failedAsset) => {
    throw new Error(
      `Failed to load Word Runner asset ${name}: ${failedAsset.error}`,
    );
  });

  return {
    quit: () => {
      sceneCleanups.forEach((cleanup) => cleanup());
      sceneCleanups.clear();
      k.debug.timeScale = 1;
      k.quit();
    },
  };
}
