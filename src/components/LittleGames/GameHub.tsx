import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBestScore } from "./lib/game-utils";
import {
  getWordRunnerBestScore,
  WORD_RUNNER_BEST_SCORE_KEY,
} from "./kaplay-runner/wordRunnerData";

const METEOR_BEST_KEY = "meteor-glider-best";
const MUSHROOM_BEST_KEY = "mushroom-adventure-best";

type GameCard = {
  id: "bunny" | "meteor" | "mushroom" | "kaplay-runner";
  to: string;
  title: string;
  blurb: string;
  tag: string;
  emoji: string;
  best: number | null;
};

function readBest(key: string): number | null {
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  const parsed = parseInt(stored, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function GameHub() {
  const navigate = useNavigate();
  const [bunnyBest] = useState(() => getBestScore());
  const [meteorBest] = useState(() => readBest(METEOR_BEST_KEY));
  const [mushroomBest] = useState(() => readBest(MUSHROOM_BEST_KEY));
  const [wordRunnerBest] = useState(() =>
    getWordRunnerBestScore(localStorage),
  );

  const cards: GameCard[] = useMemo(
    () => [
      {
        id: "kaplay-runner",
        to: "/games/kaplay-runner",
        title: "Ollie Word Runner",
        blurb: "KAPLAY pilot：在天空圖書館跑酷，收集符合提示的英文單字。",
        tag: "KAPLAY Pilot",
        emoji: "🦉",
        best: wordRunnerBest,
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
    ],
    [bunnyBest, meteorBest, mushroomBest, wordRunnerBest],
  );

  const openGame = (card: GameCard) => {
    if (card.id === "kaplay-runner") {
      window.open(card.to, "_blank", "noopener,noreferrer");
      return;
    }

    navigate(card.to);
  };

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
              <span className="rounded-full bg-accent-tint px-2.5 py-1 text-xs font-semibold text-accent">
                {card.tag}
              </span>
            </div>
            <h2 className="mt-3 text-lg font-semibold tracking-tight">
              {card.title}
            </h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              {card.blurb}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {card.best && card.best > 0
                  ? `最高分 ${card.best}`
                  : card.id === "kaplay-runner"
                    ? `保存在 ${WORD_RUNNER_BEST_SCORE_KEY}`
                    : "尚無紀錄"}
              </span>
              <button
                type="button"
                onClick={() => openGame(card)}
                className="btn btn-primary btn-sm rounded-[6px]"
              >
                {card.id === "kaplay-runner" ? "新分頁開啟" : "開始遊戲"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
