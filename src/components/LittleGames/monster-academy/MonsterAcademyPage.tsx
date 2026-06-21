import { useState } from "react";
import {
  ArrowLeft,
  Heart,
  Pause,
  Play,
  RefreshCcw,
  Star,
} from "lucide-react";
import academyCourtyardUrl from "../../../assets/games/monster-academy/academy-courtyard.png";
import battleArenaUrl from "../../../assets/games/monster-academy/battle-arena.png";
import echoDrakeUrl from "../../../assets/games/monster-academy/echo-drake.png";
import glimmerPuffUrl from "../../../assets/games/monster-academy/glimmer-puff.png";
import heroUrl from "../../../assets/games/monster-academy/hero.png";
import muddlefoxUrl from "../../../assets/games/monster-academy/muddlefox.png";
import ollieUrl from "../../../assets/games/monster-academy/ollie.png";
import riddleMothUrl from "../../../assets/games/monster-academy/riddle-moth.png";
import { MonsterAcademyHost } from "./MonsterAcademyHost";
import type {
  MonsterAcademyAssets,
  MonsterAcademySnapshot,
} from "./monsterAcademyGame";

type MonsterAcademyPageProps = {
  onExit?: () => void;
};

const MONSTER_ACADEMY_ASSETS: MonsterAcademyAssets = {
  academyCourtyard: academyCourtyardUrl,
  battleArena: battleArenaUrl,
  hero: heroUrl,
  ollie: ollieUrl,
  glimmerPuff: glimmerPuffUrl,
  riddleMoth: riddleMothUrl,
  echoDrake: echoDrakeUrl,
  muddlefox: muddlefoxUrl,
};

function getModeLabel(snapshot: MonsterAcademySnapshot | null): string {
  if (!snapshot) return "Loading academy";
  if (snapshot.mode === "complete") return "Crystal Bell restored";
  if (snapshot.mode === "battle") return snapshot.enemyName ?? "Battle";
  return `Trial ${Math.min(snapshot.battleIndex + 1, snapshot.totalBattles)}`;
}

export default function MonsterAcademyPage({
  onExit,
}: MonsterAcademyPageProps) {
  const [snapshot, setSnapshot] = useState<MonsterAcademySnapshot | null>(null);

  const statusText = snapshot?.message ?? "Loading Monster Academy.";
  const hpLabel = snapshot
    ? `${snapshot.playerHp}/${snapshot.playerMaxHp}`
    : "--";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#101426] text-white">
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#101426]/92 px-3 py-2 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-white shadow-sm transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            aria-label="回到小遊戲"
            title="Back to games"
          >
            <ArrowLeft className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/80">
              KAPLAY RPG
            </p>
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-2xl">
              Ollie Monster Academy
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white sm:inline-flex">
            {snapshot?.paused ? (
              <Pause className="size-4" strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Play className="size-4" strokeWidth={1.8} aria-hidden="true" />
            )}
            {getModeLabel(snapshot)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white">
            <Heart className="size-4 text-rose-300" strokeWidth={1.8} aria-hidden="true" />
            {hpLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-amber-300/15 px-3 py-2 text-sm font-semibold text-amber-100">
            <Star className="size-4" strokeWidth={1.8} aria-hidden="true" />
            {snapshot?.stars ?? 0}
          </span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-2 p-2 sm:gap-3 sm:p-3">
        <section className="min-h-0 flex-1">
          <MonsterAcademyHost
            assets={MONSTER_ACADEMY_ASSETS}
            onSnapshot={setSnapshot}
          />
        </section>

        <footer className="flex min-h-10 items-center justify-between gap-3 rounded-[10px] border border-white/10 bg-white/[0.08] px-3 py-2 text-xs text-white/70 sm:text-sm">
          <p className="min-w-0 truncate" aria-live="polite">
            {statusText}
          </p>
          <p className="hidden shrink-0 items-center gap-1.5 md:inline-flex">
            <RefreshCcw className="size-4" strokeWidth={1.8} aria-hidden="true" />
            1-4 actions · ←/→ select · Enter confirm · P pause · R restart
          </p>
        </footer>
      </main>
    </div>
  );
}
