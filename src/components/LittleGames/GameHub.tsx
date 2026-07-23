import { useCallback, useMemo, useState } from "react";
import { getBestScore } from "./lib/game-utils";
import { GACHA_CHARACTER_IDS } from "./gacha-machine/gachaTypes";
import { openGameTab } from "../../utils/gameTabs";

const METEOR_BEST_KEY = "meteor-glider-best";
const MUSHROOM_BEST_KEY = "mushroom-adventure-best";

type GameCard = {
  id:
    | "word-adventure"
    | "gacha-machine"
    | "bunny"
    | "meteor"
    | "mushroom"
    | "sweetheart";
  to: string;
  title: string;
  blurb: string;
  tag: string;
  emoji: string;
  best: number | null;
  primaryLabel?: string;
  statusLabel?: string;
  inDevelopment?: boolean;
  secondaryAction?: {
    label: string;
    to: string;
  };
};

function readBest(key: string): number | null {
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  const parsed = parseInt(stored, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function GameHub() {
  const [bunnyBest] = useState(() => getBestScore());
  const [meteorBest] = useState(() => readBest(METEOR_BEST_KEY));
  const [mushroomBest] = useState(() => readBest(MUSHROOM_BEST_KEY));

  const cards: GameCard[] = useMemo(
    () => [
      {
        id: "word-adventure",
        to: "/games/spirit",
        title: "單字大冒險",
        blurb:
          "用生詞本的單字闖關，答對詞彙小測驗、賺扭蛋代幣抽人氣角色。",
        tag: "Quiz",
        emoji: "🗺️",
        best: null,
      },
      {
        id: "gacha-machine",
        to: "/games/gacha",
        title: "人氣角色扭蛋機",
        blurb: `用「單字大冒險」賺的代幣扭蛋，收集 ${GACHA_CHARACTER_IDS.length} 個人氣角色圖鑑項目。`,
        tag: "Collection",
        emoji: "🎀",
        best: null,
        primaryLabel: "開始扭蛋",
        statusLabel: "雲端圖鑑",
        secondaryAction: {
          label: "查看圖鑑",
          to: "/games/gacha?view=collection",
        },
      },
      {
        id: "bunny",
        to: "/games/bunny",
        title: "Bunny Jumper",
        blurb: "在粉彩天空中不斷彈跳，收集胡蘿蔔、衝高連段分數。",
        tag: "Arcade",
        emoji: "🐰",
        best: bunnyBest,
      },
      {
        id: "mushroom",
        to: "/games/mushroom",
        title: "森林蘑菇冒險",
        blurb: "像馬力歐的闖關平台：踩蘑菇怪、收集硬幣、衝向旗桿。",
        tag: "Platformer",
        emoji: "🍄",
        best: mushroomBest,
      },
      {
        id: "meteor",
        to: "/games/meteor",
        title: "Meteor Glider",
        blurb: "駕駛滑翔機穿越隕石雨，衝刺鑽過縫隙、收集燃料電池。",
        tag: "Arcade",
        emoji: "☄️",
        best: meteorBest,
      },
      {
        id: "sweetheart",
        to: "/games/sweetheart",
        title: "甜心防衛隊",
        blurb:
          "甜點店保衛戰：把寵物放上塔位攔下偷糖果的怪物，守住櫃檯上的蛋糕。",
        tag: "Tower Defense",
        emoji: "🍰",
        best: null,
        inDevelopment: true,
        statusLabel: "開發中 · 雲端存檔",
      },
    ],
    [bunnyBest, meteorBest, mushroomBest],
  );

  // 每個完整遊戲 URL 對應一個分頁；重複進入時保留遊戲狀態並聚焦既有分頁。
  const openGame = useCallback((to: string) => {
    openGameTab(to);
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Ollie Little Games
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">小遊戲</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          一些瀏覽器大小的小冒險，點開即玩，免安裝。
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.id}
            className="group flex flex-col rounded-[10px] border border-border-hairline bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl" aria-hidden="true">
                {card.emoji}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {card.inDevelopment && (
                  <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">
                    開發中
                  </span>
                )}
                <span className="rounded-full bg-accent-tint px-2.5 py-1 text-xs font-semibold text-accent">
                  {card.tag}
                </span>
              </div>
            </div>
            <h2 className="mt-3 text-lg font-semibold tracking-tight">
              {card.title}
            </h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              {card.blurb}
            </p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {card.statusLabel ??
                (card.best && card.best > 0
                  ? `最高星星 ${card.best}`
                  : card.id === "word-adventure"
                    ? "雲端存檔進度"
                    : "尚無紀錄")}
              </span>
              <div className="flex flex-wrap justify-end gap-2">
                {card.secondaryAction && (
                  <button
                    type="button"
                    onClick={() => openGame(card.secondaryAction!.to)}
                    className="btn btn-outline btn-sm min-h-11 rounded-[6px]"
                  >
                    {card.secondaryAction.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openGame(card.to)}
                  className="btn btn-primary btn-sm min-h-11 rounded-[6px]"
                >
                  {card.primaryLabel ?? "開始遊戲"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
