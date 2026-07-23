import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HEIGHT,
  MAX_STEPS_PER_FRAME,
  SLOT_RADIUS,
  STEP_MS,
  WIDTH,
} from "../constants";
import { PETS, getPet } from "../data/pets";
import { playMusic, playSfx, stopMusic } from "../audio";
import { getEnemy } from "../data/enemies";
import { previewWave } from "../engine/waves";
import { celebrateClear } from "../render/celebrate";
import type { RunOutcome } from "../engine/progress";
import {
  compileLevel,
  createBattle,
  stepSimulation,
  type CompiledLevel,
} from "../engine/simulation";
import { drawSpawnHint, renderBattle, type ViewState } from "../render/renderer";
import { preloadSprites } from "../render/sprites";
import type { BattleState, Command, Difficulty, LevelSpec } from "../types";
import type { AudioControls } from "../useAudioSettings";
import { Hud } from "./Hud";
import { ResultDialog } from "./ResultDialog";
import { TowerPanel } from "./TowerPanel";

type TowerSummary = { slotId: string; petId: string; level: 1 | 2 | 3 };

/**
 * React 這一層只看得到這份快照。
 *
 * 戰鬥狀態是被模擬迴圈就地改動的可變物件，直接在 render 裡讀它會讀到隨機時間
 * 點的中間值；所以每幀從它抽一份不可變快照出來，React 只依這份快照重繪。
 */
export type HudSnapshot = {
  phase: BattleState["phase"];
  waveNumber: number;
  waveCount: number;
  cakes: number;
  maxCakes: number;
  frosting: number;
  prepSeconds: number;
  kills: number;
  speed: 1 | 2;
  towers: TowerSummary[];
};

function snapshotOf(state: BattleState, waveCount: number): HudSnapshot {
  return {
    phase: state.phase,
    waveNumber: state.waveIndex + 1,
    waveCount,
    cakes: state.cakes,
    maxCakes: state.maxCakes,
    frosting: Math.floor(state.frosting),
    prepSeconds: Math.max(0, Math.ceil(state.prepMs / 1000)),
    kills: state.kills,
    speed: state.speed,
    towers: state.towers.map((tower) => ({
      slotId: tower.slotId,
      petId: tower.petId,
      level: tower.level,
    })),
  };
}

function sameSnapshot(a: HudSnapshot, b: HudSnapshot): boolean {
  return (
    a.phase === b.phase &&
    a.waveNumber === b.waveNumber &&
    a.cakes === b.cakes &&
    a.frosting === b.frosting &&
    a.prepSeconds === b.prepSeconds &&
    a.kills === b.kills &&
    a.speed === b.speed &&
    a.towers.length === b.towers.length &&
    a.towers.every((tower, index) => {
      const other = b.towers[index];
      return (
        tower.slotId === other.slotId &&
        tower.petId === other.petId &&
        tower.level === other.level
      );
    })
  );
}

/** 這一波有沒有 Boss；用來決定要放哪一首曲子。 */
function isBossWave(level: LevelSpec, waveIndex: number): boolean {
  const wave = level.waves[waveIndex];
  if (!wave) return false;
  return previewWave(wave).some((entry) => getEnemy(entry.kind).boss === true);
}

type Props = {
  level: LevelSpec;
  difficulty: Difficulty;
  unlockedPetIds: string[];
  audio: AudioControls;
  onExit: () => void;
  onRetry: () => void;
  onFinished: (outcome: RunOutcome) => void;
};

/**
 * 一場戰鬥。呼叫端用 key 綁定「關卡 + 難度 + 第幾次重試」，換一場就整個重建，
 * 所以這裡不需要處理 props 中途變動的情況。
 */
export function BattleScreen({
  level,
  difficulty,
  unlockedPetIds,
  audio,
  onExit,
  onRetry,
  onFinished,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const compiled = useMemo<CompiledLevel>(() => compileLevel(level), [level]);

  // 可變的模擬狀態。放在 state 而不是 ref，是為了能在初始化時算出第一份快照；
  // 之後的變動一律由迴圈搬進 hud，不靠 React 重繪。
  const [battle] = useState<BattleState>(() =>
    createBattle(compiled, difficulty, 1),
  );
  const [hud, setHud] = useState<HudSnapshot>(() =>
    snapshotOf(battle, level.waves.length),
  );
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [paused, setPaused] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [previewPetId, setPreviewPetId] = useState<string | null>(null);

  const commandQueue = useRef<Command[]>([]);
  const pausedRef = useRef(false);
  const viewRef = useRef<ViewState>({
    selectedSlotId: null,
    hoveredSlotId: null,
    previewPetId: null,
  });

  const unlockedPets = useMemo(
    () => PETS.filter((pet) => unlockedPetIds.includes(pet.id)),
    [unlockedPetIds],
  );

  // 這一關會用到的寵物圖先排進載入佇列，免得放塔的當下才開始抓圖。
  useEffect(() => {
    preloadSprites(unlockedPets.map((pet) => pet.sprite));
  }, [unlockedPets]);

  useEffect(() => {
    viewRef.current.selectedSlotId = selectedSlotId;
    viewRef.current.previewPetId = previewPetId;
  }, [selectedSlotId, previewPetId]);

  // 迴圈跑在 rAF 裡，不能靠 props 重新綁定；用 ref 把暫停狀態遞進去。
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const enqueue = useCallback((command: Command) => {
    commandQueue.current.push(command);
  }, []);

  // 進關卡就放戰鬥音樂，離開畫面停掉；波次之間的換曲在主迴圈裡處理。
  useEffect(() => {
    playMusic(isBossWave(level, 0) ? "boss" : "battle");
    return () => stopMusic();
  }, [level]);

  // 依容器大小等比縮放 canvas（letterbox）；模擬與繪製維持 960×540 邏輯座標。
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const resize = () => {
      const available = stage.getBoundingClientRect();
      const scale = Math.min(available.width / WIDTH, available.height / HEIGHT);
      const displayW = Math.max(1, WIDTH * scale);
      const displayH = Math.max(1, HEIGHT * scale);
      const dpr = window.devicePixelRatio || 1;

      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;
      canvas.width = Math.round(displayW * dpr);
      canvas.height = Math.round(displayH * dpr);

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    window.addEventListener("resize", resize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  // 主迴圈：固定 timestep 前進模擬，rAF 只決定要補幾步 + 畫圖。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;
    let previous = performance.now();
    let accumulator = 0;
    let reported = false;
    // 音效靠比對前後幀的狀態觸發——模擬層不知道有喇叭這回事，也不該知道。
    let lastPhase = battle.phase;
    let lastCakes = battle.cakes;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);

      // 分頁切回來時 elapsed 會很大，夾住避免一次補上千步。
      const elapsed = Math.min(250, now - previous);
      previous = now;

      if (pausedRef.current) {
        // 暫停時時間不走，但指令照樣生效——塔防暫停中還能佈塔是標準做法，
        // 對還在想的小孩尤其重要。dtMs 傳 0 就是「只處理指令，不推進世界」。
        accumulator = 0;
        if (commandQueue.current.length > 0) {
          const commands = commandQueue.current;
          commandQueue.current = [];
          stepSimulation(battle, compiled, commands, 0);
        }
      } else {
        accumulator += elapsed * battle.speed;

        let steps = 0;
        while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
          const commands = commandQueue.current;
          commandQueue.current = [];
          stepSimulation(battle, compiled, commands, STEP_MS);
          accumulator -= STEP_MS;
          steps += 1;
        }
        if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
      }

      const ctx = canvas.getContext("2d");
      if (ctx) {
        renderBattle(ctx, battle, compiled, viewRef.current);
        if (battle.phase === "prep") drawSpawnHint(ctx, compiled, battle.timeMs);
      }

      if (battle.cakes < lastCakes) playSfx("cakeLost");
      lastCakes = battle.cakes;

      if (battle.phase !== lastPhase) {
        if (battle.phase === "wave") {
          playSfx("waveStart");
          // Boss 波換成比較緊張的曲子。
          playMusic(isBossWave(level, battle.waveIndex) ? "boss" : "battle");
          if (isBossWave(level, battle.waveIndex)) playSfx("bossWarn");
        }
        lastPhase = battle.phase;
      }

      const next = snapshotOf(battle, level.waves.length);
      setHud((current) => (sameSnapshot(current, next) ? current : next));

      if (!reported && (battle.phase === "cleared" || battle.phase === "lost")) {
        reported = true;
        const result: RunOutcome = {
          phase: battle.phase,
          cakes: battle.cakes,
          maxCakes: battle.maxCakes,
          kills: battle.kills,
          waveIndex: battle.waveIndex,
        };
        setOutcome(result);
        onFinished(result);

        stopMusic();
        if (battle.phase === "cleared") {
          playSfx("cleared");
          celebrateClear();
        } else {
          playSfx("lost");
        }
      }
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // level 是整個 prop 而不是 level.waves.length：迴圈現在也要靠它判斷這一波
    // 是不是 Boss 波。呼叫端用 key 綁定關卡，所以它在元件的生命週期內不會變。
  }, [battle, compiled, level, onFinished]);

  const toLogicalPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    };
  }, []);

  const slotAt = useCallback(
    (clientX: number, clientY: number): string | null => {
      const point = toLogicalPoint(clientX, clientY);
      if (!point) return null;

      // 觸控時手指比較粗，判定半徑放寬一點。
      const hitRadius = SLOT_RADIUS + 10;
      for (const slot of level.slots) {
        if (Math.hypot(slot.x - point.x, slot.y - point.y) <= hitRadius) {
          return slot.id;
        }
      }
      return null;
    },
    [level.slots, toLogicalPoint],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const slotId = slotAt(event.clientX, event.clientY);
      if (slotId) playSfx("select");
      setSelectedSlotId(slotId);
      setPreviewPetId(null);
    },
    [slotAt],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      viewRef.current.hoveredSlotId = slotAt(event.clientX, event.clientY);
    },
    [slotAt],
  );

  const closePanel = useCallback(() => {
    setSelectedSlotId(null);
    setPreviewPetId(null);
  }, []);

  const selectedTower = hud.towers.find(
    (tower) => tower.slotId === selectedSlotId,
  );
  const selectedPet = selectedTower ? getPet(selectedTower.petId) : undefined;

  return (
    <div className="relative flex h-full w-full flex-col">
      <Hud
        hud={hud}
        levelName={level.nameZh}
        nextWave={level.waves[hud.waveNumber - 1]}
        paused={paused}
        audio={audio}
        onStartWave={() => enqueue({ kind: "startWave" })}
        onToggleSpeed={() =>
          enqueue({ kind: "setSpeed", multiplier: hud.speed === 1 ? 2 : 1 })
        }
        onTogglePause={() => setPaused((current) => !current)}
        onExit={onExit}
      />

      {/* 面板定位在畫布這一層，不是整個畫面，才不會蓋到上面的 HUD 按鈕。 */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={stageRef}
          className="flex min-h-0 flex-1 items-center justify-center p-2"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            className="touch-manipulation rounded-[16px] shadow-[0_18px_50px_rgba(180,120,150,0.28)] ring-1 ring-black/5"
          />
        </div>

        {selectedSlotId && !outcome && (
          <TowerPanel
            tower={selectedTower}
            pet={selectedPet}
            frosting={hud.frosting}
            availablePets={unlockedPets}
            previewPetId={previewPetId}
            onPreviewPet={setPreviewPetId}
            onPlace={(petId) => {
              playSfx("place");
              enqueue({ kind: "placeTower", slotId: selectedSlotId, petId });
              closePanel();
            }}
            onUpgrade={() => {
              playSfx("upgrade");
              enqueue({ kind: "upgradeTower", slotId: selectedSlotId });
            }}
            onSell={() => {
              playSfx("sell");
              enqueue({ kind: "sellTower", slotId: selectedSlotId });
              closePanel();
            }}
            onClose={closePanel}
          />
        )}
      </div>

      {outcome && (
        <ResultDialog
          outcome={outcome}
          totalWaves={level.waves.length}
          onRetry={onRetry}
          onExit={onExit}
        />
      )}
    </div>
  );
}
