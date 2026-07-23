import { useCallback, useState } from "react";
import { LEVELS } from "./data/levels";
import { STARTER_PET_IDS } from "./data/pets";
import { petsUnlockedBy } from "./data/unlocks";
import {
  applyRunResult,
  type CampaignProgress,
  type RunOutcome,
} from "./engine/progress";
import { BattleScreen } from "./ui/BattleScreen";
import { TitleScreen } from "./ui/TitleScreen";
import type { Difficulty } from "./types";

type Props = {
  onExit?: () => void;
};

type Screen =
  | { kind: "title" }
  | { kind: "battle"; levelId: string; difficulty: Difficulty; runId: number };

/**
 * 甜心防衛隊 — 全螢幕塔防遊戲。
 *
 * 進度目前只活在這個 state 裡（關掉分頁就沒了）；M4 會把它換成 local-first +
 * Firestore 的存檔，介面不用動。
 */
export default function SweetheartDefenders({ onExit }: Props) {
  const [screen, setScreen] = useState<Screen>({ kind: "title" });
  const [progress, setProgress] = useState<CampaignProgress>({
    levelStars: {},
    unlockedPetIds: STARTER_PET_IDS,
  });

  const backToTitle = useCallback(() => setScreen({ kind: "title" }), []);

  const startLevel = useCallback((levelId: string, difficulty: Difficulty) => {
    setScreen({ kind: "battle", levelId, difficulty, runId: 0 });
  }, []);

  // runId 換掉會讓 BattleScreen 整個重建，戰鬥狀態自然歸零。
  const retry = useCallback(() => {
    setScreen((current) =>
      current.kind === "battle"
        ? { ...current, runId: current.runId + 1 }
        : current,
    );
  }, []);

  const recordResult = useCallback((levelId: string, outcome: RunOutcome) => {
    setProgress((current) =>
      applyRunResult(current, levelId, outcome, petsUnlockedBy),
    );
  }, []);

  if (screen.kind === "title") {
    return (
      <TitleScreen
        levelStars={progress.levelStars}
        unlockedPetIds={progress.unlockedPetIds}
        onStart={startLevel}
        onExit={onExit}
      />
    );
  }

  const level = LEVELS.find((candidate) => candidate.id === screen.levelId);
  if (!level) {
    return (
      <TitleScreen
        levelStars={progress.levelStars}
        unlockedPetIds={progress.unlockedPetIds}
        onStart={startLevel}
        onExit={onExit}
      />
    );
  }

  return (
    <div
      className="h-screen w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 18% 18%, rgba(255,200,224,0.5), transparent 42%), radial-gradient(circle at 82% 12%, rgba(198,222,255,0.45), transparent 38%), #fff7fb",
      }}
    >
      <BattleScreen
        key={`${screen.levelId}-${screen.difficulty}-${screen.runId}`}
        level={level}
        difficulty={screen.difficulty}
        unlockedPetIds={progress.unlockedPetIds}
        onExit={backToTitle}
        onRetry={retry}
        onFinished={(outcome) => recordResult(level.id, outcome)}
      />
    </div>
  );
}
