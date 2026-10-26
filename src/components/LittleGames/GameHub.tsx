import { useCallback, useEffect, useMemo, useState } from "react";
import { getBestScore } from "./lib/game-utils";
import { GACHA_CHARACTER_IDS } from "./gacha-machine/gachaTypes";
import { openGameTab } from "../../utils/gameTabs";
import { T } from "../common/T";
import { HintText } from "../common/HintText";
import { useLanguage } from "../../hooks/useLanguage";
import { msg, type MessageKey, type MessageParams } from "../../i18n/translate";

const METEOR_BEST_KEY = "meteor-glider-best";
const MUSHROOM_BEST_KEY = "mushroom-adventure-best";

type GameCard = {
  id:
    | "word-adventure"
    | "gacha-machine"
    | "cottage"
    | "bunny"
    | "meteor"
    | "mushroom"
    | "sweetheart";
  to: string;
  title: MessageKey;
  /**
   * 英文名。這是一個英文學習 App，所以有英文名的卡片在任何語言下都以英文名為主、
   * `title` 的中文名放在下一行；只有本來就沒有英文名的幾款（單字大冒險等）
   * 直接顯示翻譯後的單一名稱。
   */
  titleEn?: string;
  blurb: MessageKey;
  blurbParams?: MessageParams;
  tag: string;
  emoji: string;
  best: number | null;
  primaryLabel?: MessageKey;
  statusLabel?: MessageKey;
  inDevelopment?: boolean;
  secondaryAction?: {
    label: MessageKey;
    to: string;
  };
};

function readBest(key: string): number | null {
  const stored = getBestScore(key);
  return stored > 0 ? stored : null;
}

export default function GameHub() {
  const { language, showHints, tZh } = useLanguage();
  const [bunnyBest, setBunnyBest] = useState(() => getBestScore());
  const [meteorBest, setMeteorBest] = useState(() => readBest(METEOR_BEST_KEY));
  const [mushroomBest, setMushroomBest] = useState(() =>
    readBest(MUSHROOM_BEST_KEY),
  );

  useEffect(() => {
    const refreshBestScores = () => {
      setBunnyBest(getBestScore());
      setMeteorBest(readBest(METEOR_BEST_KEY));
      setMushroomBest(readBest(MUSHROOM_BEST_KEY));
    };

    // Games run in separate tabs. Their localStorage writes surface here as
    // `storage` events; focus is a fallback for browsers that coalesce events.
    window.addEventListener("storage", refreshBestScores);
    window.addEventListener("focus", refreshBestScores);
    return () => {
      window.removeEventListener("storage", refreshBestScores);
      window.removeEventListener("focus", refreshBestScores);
    };
  }, []);

  const cards: GameCard[] = useMemo(
    () => [
      {
        id: "word-adventure",
        to: "/games/spirit",
        title: "arcade.hub.wordAdventure.title",
        blurb: "arcade.hub.wordAdventure.blurb",
        tag: "Quiz",
        emoji: "🗺️",
        best: null,
      },
      {
        id: "gacha-machine",
        to: "/games/gacha",
        title: "arcade.hub.gacha.title",
        blurb: "arcade.hub.gacha.blurb",
        blurbParams: {
          game: msg("arcade.hub.wordAdventure.title"),
          count: GACHA_CHARACTER_IDS.length,
        },
        tag: "Collection",
        emoji: "🎀",
        best: null,
        primaryLabel: "arcade.hub.gacha.play",
        statusLabel: "arcade.hub.gacha.status",
        secondaryAction: {
          label: "arcade.hub.gacha.collection",
          to: "/games/gacha?view=collection",
        },
      },
      {
        id: "cottage",
        to: "/games/cottage",
        title: "arcade.hub.cottage.title",
        blurb: "arcade.hub.cottage.blurb",
        tag: "3D Companion",
        emoji: "☁️",
        best: null,
        statusLabel: "arcade.hub.cottage.status",
      },
      {
        id: "sweetheart",
        to: "/games/sweetheart",
        title: "arcade.hub.sweetheart.title",
        blurb: "arcade.hub.sweetheart.blurb",
        tag: "Tower Defense",
        emoji: "🍰",
        best: null,
        inDevelopment: true,
        statusLabel: "arcade.hub.sweetheart.status",
      },
      {
        id: "mushroom",
        to: "/games/mushroom",
        title: "arcade.hub.mushroom.title",
        titleEn: "Mushroom Adventure",
        blurb: "arcade.hub.mushroom.blurb",
        tag: "Platformer",
        emoji: "🍄",
        best: mushroomBest,
      },
      {
        id: "meteor",
        to: "/games/meteor",
        title: "arcade.hub.meteor.title",
        titleEn: "Meteor Glider",
        blurb: "arcade.hub.meteor.blurb",
        tag: "Arcade",
        emoji: "☄️",
        best: meteorBest,
      },
      {
        id: "bunny",
        to: "/games/bunny",
        title: "arcade.hub.bunny.title",
        titleEn: "Bunny Jumper",
        blurb: "arcade.hub.bunny.blurb",
        tag: "Arcade",
        emoji: "🐰",
        best: bunnyBest,
      },
    ],
    [bunnyBest, meteorBest, mushroomBest],
  );

  // 每個完整遊戲 URL 對應一個分頁；重複進入時保留遊戲狀態並聚焦既有分頁。
  const openGame = useCallback((to: string) => {
    openGameTab(to);
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Ollie Little Games
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          <T k="arcade.hub.title" />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <T k="arcade.hub.subtitle" />
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.id}
            className="group flex min-w-0 flex-col rounded-[10px] border border-border-hairline bg-card p-4 shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl" aria-hidden="true">
                {card.emoji}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {card.inDevelopment && (
                  <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">
                    <T k="arcade.hub.inDevelopment" />
                  </span>
                )}
                <span className="rounded-full bg-accent-tint px-2.5 py-1 text-xs font-semibold text-accent">
                  {card.tag}
                </span>
              </div>
            </div>
            <h2 className="mt-2 text-base font-semibold tracking-tight">
              {card.titleEn ? (
                showHints ? <HintText hint={tZh(card.title)}>{card.titleEn}</HintText> : card.titleEn
              ) : (
                <T k={card.title} />
              )}
            </h2>
            {/* English-named cards show their Chinese name underneath in Chinese mode. */}
            {card.titleEn && language === "zh-TW" && (
              <p
                lang="zh-Hant-TW"
                className="text-sm font-medium text-muted-foreground"
              >
                {tZh(card.title)}
              </p>
            )}
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              <T k={card.blurb} params={card.blurbParams} />
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {card.statusLabel ? (
                  <T k={card.statusLabel} />
                ) : card.best && card.best > 0 ? (
                  <T k="arcade.hub.bestStars" params={{ n: card.best }} />
                ) : card.id === "word-adventure" ? (
                  <T k="arcade.hub.cloudProgress" />
                ) : (
                  <T k="arcade.hub.noRecord" />
                )}
              </span>
              <div className="flex flex-wrap justify-end gap-2">
                {card.secondaryAction && (
                  <button
                    type="button"
                    onClick={() => openGame(card.secondaryAction!.to)}
                    className="btn btn-outline btn-sm min-h-11 rounded-[6px]"
                  >
                    <T k={card.secondaryAction.label} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openGame(card.to)}
                  className="btn btn-primary btn-sm min-h-11 rounded-[6px]"
                >
                  <T
                    k={card.primaryLabel ?? "arcade.hub.play"}
                  />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
