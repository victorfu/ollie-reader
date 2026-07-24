import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { LEVELS } from "./data/levels";
import { BattleScreen } from "./ui/BattleScreen";
import { CharacterDex } from "./ui/CharacterDex";
import { SquadSelect } from "./ui/SquadSelect";
import { TitleScreen } from "./ui/TitleScreen";
import { useCampaignSave } from "./useCampaignSave";
import { useTowerRoster } from "./useTowerRoster";
import { DEFAULT_ROSTER_IDS } from "./data/characters";
import { readSquadCache, sanitizeSquad, writeSquadCache } from "./squad";
import { useAudioSettings } from "./useAudioSettings";
import { playMusic, playSfx } from "./audio";
import type { Difficulty } from "./types";

type Props = {
  onExit?: () => void;
};

type Screen =
  | { kind: "title" }
  | { kind: "dex" }
  | { kind: "squad"; levelId: string; difficulty: Difficulty }
  | {
      kind: "battle";
      levelId: string;
      difficulty: Difficulty;
      /** 這一場帶進來的隊伍；重試沿用，回路線頁重進才重選 */
      squadIds: string[];
      runId: number;
    };

/**
 * 甜心防衛隊 — 全螢幕塔防遊戲。
 *
 * 進度由 useCampaignSave 負責（本機 + Firestore），這裡只管畫面切換。
 */
export default function SweetheartDefenders({ onExit }: Props) {
  const [screen, setScreen] = useState<Screen>({ kind: "title" });
  const { user } = useAuth();
  const uid = user?.uid ?? null;
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

  // 點關卡不再直接開戰，先進選隊畫面挑這一場要帶誰。
  const openSquadSelect = useCallback(
    (levelId: string, difficulty: Difficulty) => {
      playSfx("select");
      setScreen({ kind: "squad", levelId, difficulty });
    },
    [],
  );

  const startBattle = useCallback(
    (levelId: string, difficulty: Difficulty, squadIds: string[]) => {
      playSfx("place");
      // 記住這次的隊伍，下次進關直接帶入，不用每場重挑。
      writeSquadCache(uid, squadIds);
      setScreen({ kind: "battle", levelId, difficulty, squadIds, runId: 0 });
    },
    [uid],
  );

  // runId 換掉會讓 BattleScreen 整個重建，戰鬥狀態自然歸零。
  const retry = useCallback(() => {
    setScreen((current) =>
      current.kind === "battle"
        ? { ...current, runId: current.runId + 1 }
        : current,
    );
  }, []);

  const level =
    screen.kind === "battle" || screen.kind === "squad"
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
        onStart={openSquadSelect}
        onOpenDex={openDex}
        onExit={onExit}
      />
    );
  }

  if (screen.kind === "squad") {
    return (
      <SquadSelect
        levelName={level.nameZh}
        difficulty={screen.difficulty}
        availableCharacters={roster.available}
        // 上次的隊伍過一遍 sanitize：換帳號或收藏變動後，沒擁有的角色要拿掉。
        initialSquadIds={sanitizeSquad(readSquadCache(uid), roster.available)}
        onStart={(squadIds) =>
          startBattle(screen.levelId, screen.difficulty, squadIds)
        }
        onBack={backToTitle}
      />
    );
  }

  // 只有被選進隊伍的角色能上場。萬一過濾完是空的（快取被改、收藏縮水），
  // 退回整個 roster——遊戲不可以變成無塔可放。
  const squadCharacters = roster.available.filter((character) =>
    screen.squadIds.includes(character.id),
  );
  const battleCharacters =
    squadCharacters.length > 0 ? squadCharacters : roster.available;

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
        availableCharacters={battleCharacters}
        audio={audio}
        coinsEarned={lastCoinsEarned}
        onExit={backToTitle}
        onRetry={retry}
        onFinished={(outcome) => setLastCoinsEarned(recordResult(level.id, outcome))}
      />
    </div>
  );
}
