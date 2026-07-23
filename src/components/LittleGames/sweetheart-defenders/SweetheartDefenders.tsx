import { useCallback, useEffect, useState } from "react";
import { LEVELS } from "./data/levels";
import { BattleScreen } from "./ui/BattleScreen";
import { CharacterDex } from "./ui/CharacterDex";
import { TitleScreen } from "./ui/TitleScreen";
import { useCampaignSave } from "./useCampaignSave";
import { useTowerRoster } from "./useTowerRoster";
import { DEFAULT_ROSTER_IDS } from "./data/characters";
import { useAudioSettings } from "./useAudioSettings";
import { playMusic, playSfx } from "./audio";
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
  // 能放上塔位的角色來自扭蛋機的收藏，不是這個遊戲自己的解鎖表。
  const roster = useTowerRoster();
  const audio = useAudioSettings();
  const [lastCoinsEarned, setLastCoinsEarned] = useState(0);

  const backToTitle = useCallback(() => setScreen({ kind: "title" }), []);
  const openDex = useCallback(() => {
    playSfx("select");
    setScreen({ kind: "dex" });
  }, []);

  // 不在戰鬥裡就放選單音樂；戰鬥的曲子由 BattleScreen 自己接手。
  const inBattle = screen.kind === "battle";
  useEffect(() => {
    if (!inBattle) playMusic("menu");
  }, [inBattle]);

  const startLevel = useCallback((levelId: string, difficulty: Difficulty) => {
    playSfx("place");
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
    return (
      <CharacterDex
        availableCharacterIds={roster.availableIds}
        defaultRosterIds={DEFAULT_ROSTER_IDS}
        onBack={backToTitle}
      />
    );
  }

  // 找不到關卡（例如舊存檔指到已移除的圖）就退回路線頁，不要卡在空畫面。
  if (screen.kind === "title" || !level) {
    return (
      <TitleScreen
        levelStars={save.levelStars}
        bestWave={save.bestWave}
        availableCharacters={roster.available}
        ownedCount={roster.ownedCount}
        syncStatus={status}
        isSignedIn={isSignedIn}
        audio={audio}
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
        availableCharacters={roster.available}
        audio={audio}
        coinsEarned={lastCoinsEarned}
        onExit={backToTitle}
        onRetry={retry}
        onFinished={(outcome) => setLastCoinsEarned(recordResult(level.id, outcome))}
      />
    </div>
  );
}
