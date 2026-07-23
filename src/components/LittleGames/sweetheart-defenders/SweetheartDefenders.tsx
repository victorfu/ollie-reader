import { useCallback, useState } from "react";
import { LEVELS } from "./data/levels";
import { BattleScreen } from "./ui/BattleScreen";
import { PetDex } from "./ui/PetDex";
import { TitleScreen } from "./ui/TitleScreen";
import { useCampaignSave } from "./useCampaignSave";
import type { Difficulty } from "./types";

type Props = {
  onExit?: () => void;
};

type Screen =
  | { kind: "title" }
  | { kind: "dex" }
  | { kind: "battle"; levelId: string; difficulty: Difficulty; runId: number };

/**
 * 甜心防衛隊 — 全螢幕塔防遊戲。
 *
 * 進度由 useCampaignSave 負責（本機 + Firestore），這裡只管畫面切換。
 */
export default function SweetheartDefenders({ onExit }: Props) {
  const [screen, setScreen] = useState<Screen>({ kind: "title" });
  const { save, status, isSignedIn, recordResult } = useCampaignSave();

  const backToTitle = useCallback(() => setScreen({ kind: "title" }), []);
  const openDex = useCallback(() => setScreen({ kind: "dex" }), []);

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

  const level =
    screen.kind === "battle"
      ? LEVELS.find((candidate) => candidate.id === screen.levelId)
      : undefined;

  if (screen.kind === "dex") {
    return <PetDex unlockedPetIds={save.unlockedPetIds} onBack={backToTitle} />;
  }

  // 找不到關卡（例如舊存檔指到已移除的圖）就退回路線頁，不要卡在空畫面。
  if (screen.kind === "title" || !level) {
    return (
      <TitleScreen
        levelStars={save.levelStars}
        bestWave={save.bestWave}
        unlockedPetIds={save.unlockedPetIds}
        syncStatus={status}
        isSignedIn={isSignedIn}
        onStart={startLevel}
        onOpenDex={openDex}
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
        unlockedPetIds={save.unlockedPetIds}
        onExit={backToTitle}
        onRetry={retry}
        onFinished={(outcome) => recordResult(level.id, outcome)}
      />
    </div>
  );
}
