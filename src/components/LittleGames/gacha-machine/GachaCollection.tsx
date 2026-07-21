import { useState } from "react";
import {
  BookOpen,
  Check,
  Cloud,
  Eye,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { GACHA_CHARACTERS } from "./gachaData";
import type { GachaCharacter, GachaSaveV1 } from "./gachaTypes";
import { GachaCollectionDialog } from "./GachaCollectionDialog";

interface GachaCollectionProps {
  save: GachaSaveV1;
  isLoading?: boolean;
  isOffline?: boolean;
  syncLabel?: string;
  hasPendingCapsule?: boolean;
  canResetCollection?: boolean;
  showAllEntries?: boolean;
  onOpenPendingCapsule?: () => void;
  onRequestReset?: () => void;
}

export function GachaCollection({
  save,
  isLoading = false,
  isOffline = false,
  syncLabel = "已與雲端同步",
  hasPendingCapsule = false,
  canResetCollection = false,
  showAllEntries = false,
  onOpenPendingCapsule,
  onRequestReset,
}: GachaCollectionProps) {
  const reduceMotion = useReducedMotion();
  const [selectedCharacter, setSelectedCharacter] =
    useState<GachaCharacter | null>(null);
  const unlockedCount = GACHA_CHARACTERS.reduce(
    (total, character) =>
      total + ((save.ownedCounts[character.id] ?? 0) > 0 ? 1 : 0),
    0,
  );
  const completion = Math.round(
    (unlockedCount / GACHA_CHARACTERS.length) * 100,
  );
  const ownedTotal = Object.values(save.ownedCounts).reduce(
    (total, count) => total + (count ?? 0),
    0,
  );
  const missCount = Math.max(0, save.totalDraws - ownedTotal);

  const selectedOwnedCount = selectedCharacter
    ? (save.ownedCounts[selectedCharacter.id] ?? 0)
    : 0;

  return (
    <section
      aria-labelledby="gacha-collection-title"
      aria-busy={isLoading}
      className="mx-auto w-full max-w-6xl"
    >
      <div className="mb-5 flex flex-col gap-4 rounded-[18px] border border-border-hairline bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-tint px-3 py-1 text-xs font-bold text-accent">
            <BookOpen className="size-4" strokeWidth={1.8} aria-hidden="true" />
            MY COLLECTION
          </div>
          <h2
            id="gacha-collection-title"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            我的角色圖鑑
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
            每次遇見新角色都會自動解鎖；重複扭到的角色也會留下相遇次數。點選角色即可查看大圖。
          </p>
        </div>

        <div className="min-w-48 rounded-[14px] border border-border-hairline bg-background/70 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-muted-foreground">
              收集進度
            </span>
            <span className="text-sm font-bold text-foreground">
              {unlockedCount} / {GACHA_CHARACTERS.length}
            </span>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="角色圖鑑收集進度"
            aria-valuemin={0}
            aria-valuemax={GACHA_CHARACTERS.length}
            aria-valuenow={unlockedCount}
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-pink-400"
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${completion}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.55, ease: "easeOut" }}
            />
          </div>
          <div
            className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${
              isOffline ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
            }`}
          >
            {isOffline ? (
              <WifiOff className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Cloud className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            )}
            {syncLabel}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border-hairline pt-3 text-center">
            <div>
              <p className="text-lg font-black text-foreground">{save.totalDraws}</p>
              <p className="text-[11px] font-medium text-muted-foreground">累計抽取</p>
            </div>
            <div>
              <p className="text-lg font-black text-foreground">{missCount}</p>
              <p className="text-[11px] font-medium text-muted-foreground">空膠囊</p>
            </div>
          </div>
        </div>
      </div>

      {hasPendingCapsule ? (
        <div className="mb-5 flex flex-col gap-3 rounded-[14px] border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-900 sm:flex-row sm:items-center sm:justify-between dark:text-sky-100" role="status">
          <span>
            <strong className="font-bold">還有一顆待開啟膠囊。</strong>
            本次結果會在你親手打開後才顯示於圖鑑。
          </span>
          <button
            type="button"
            onClick={onOpenPendingCapsule}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[9px] border border-sky-400/30 bg-background/85 px-4 font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RotateCcw className="size-4" strokeWidth={1.8} aria-hidden="true" />
            回到扭蛋機
          </button>
        </div>
      ) : null}

      {showAllEntries ? (
        <div
          className="mb-5 flex items-start gap-3 rounded-[14px] border border-accent/20 bg-accent-tint px-4 py-3 text-sm text-foreground"
          role="status"
        >
          <Eye
            className="mt-0.5 size-5 shrink-0 text-accent"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span>
            <strong className="font-bold">完整圖鑑預覽已開啟。</strong>
            尚未抽到的角色也可以查看圖片；收集進度仍只計算實際遇見的角色。
          </span>
        </div>
      ) : null}

      {unlockedCount === GACHA_CHARACTERS.length ? (
        <div className="mb-5 flex items-center gap-3 rounded-[14px] border border-amber-300/35 bg-amber-300/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <Sparkles className="size-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>
            <strong className="font-bold">圖鑑完成！</strong>
            你已經遇見所有角色，還可以繼續扭蛋累積相遇次數。
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
        {GACHA_CHARACTERS.map((character, index) => {
          const ownedCount = save.ownedCounts[character.id] ?? 0;
          const isUnlocked = ownedCount > 0;
          const isVisible = isUnlocked || showAllEntries;
          const isPreview = showAllEntries && !isUnlocked;

          return (
            <motion.button
              key={character.id}
              type="button"
              onClick={() => {
                if (isVisible) setSelectedCharacter(character);
              }}
              disabled={!isVisible}
              aria-label={
                isVisible
                  ? `查看${character.name}角色圖片${isPreview ? "（尚未解鎖）" : `，已遇見 ${ownedCount} 次`}`
                  : "尚未解鎖的角色"
              }
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={
                isVisible && !reduceMotion ? { scale: 0.985 } : undefined
              }
              transition={{
                duration: reduceMotion ? 0 : 0.28,
                delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.2),
              }}
              className={`group relative min-w-0 overflow-hidden rounded-[16px] border p-3 text-left shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-4 ${
                isVisible
                  ? "cursor-zoom-in border-border-hairline bg-card hover:-translate-y-0.5 hover:shadow-elevated"
                  : "cursor-default border-border-hairline bg-muted/45"
              }`}
            >
              <div
                className={`relative aspect-square overflow-hidden rounded-[13px] border ${
                  isVisible
                    ? "border-white/55 bg-gradient-to-br from-white/85 to-accent-tint dark:border-white/10 dark:from-white/10"
                    : "border-border-hairline bg-background/50"
                }`}
              >
                <img
                  src={character.imageUrl}
                  alt={isVisible ? character.name : ""}
                  aria-hidden={!isVisible}
                  loading="lazy"
                  decoding="async"
                  className={`h-full w-full object-contain p-1 transition-transform duration-200 ${
                    isVisible
                      ? "drop-shadow-[0_10px_12px_rgba(63,52,86,0.16)] group-hover:scale-[1.04]"
                      : "scale-[0.92] brightness-0 opacity-[0.12] dark:invert dark:opacity-[0.08]"
                  }`}
                />

                {isUnlocked ? (
                  <span className="absolute right-2 top-2 inline-flex min-h-7 min-w-7 items-center justify-center rounded-full border border-white/65 bg-background/85 px-2 text-xs font-bold text-foreground shadow-sm backdrop-blur-md dark:border-white/10">
                    ×{ownedCount}
                  </span>
                ) : isPreview ? (
                  <span className="absolute right-2 top-2 inline-flex min-h-7 items-center justify-center gap-1 rounded-full border border-white/65 bg-background/85 px-2 text-[10px] font-bold text-accent shadow-sm backdrop-blur-md dark:border-white/10">
                    <Eye className="size-3.5" strokeWidth={1.9} aria-hidden="true" />
                    預覽
                  </span>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                    <LockKeyhole
                      className="size-6 opacity-65"
                      strokeWidth={1.6}
                      aria-hidden="true"
                    />
                    <span className="text-lg font-black tracking-[0.16em] opacity-55">
                      ???
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3 min-w-0 text-center">
                <h3 className="truncate text-sm font-bold text-foreground">
                  {isVisible ? character.name : "???"}
                </h3>
                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                  {isVisible ? character.englishName : "尚未解鎖"}
                </p>
              </div>

              {isUnlocked ? (
                <span
                  aria-hidden="true"
                  className="absolute left-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm"
                >
                  <Check className="size-4" strokeWidth={2.4} aria-hidden="true" />
                </span>
              ) : null}
            </motion.button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-[12px] border border-border-hairline bg-card px-4 text-sm text-muted-foreground" role="status">
          <span className="loading loading-spinner loading-sm text-accent" />
          正在更新雲端圖鑑…
        </div>
      ) : null}

      <section className="mt-8 rounded-[16px] border border-error/20 bg-error/5 p-5" aria-labelledby="gacha-reset-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-error">
              <Trash2 className="size-5" strokeWidth={1.8} aria-hidden="true" />
              <h3 id="gacha-reset-title" className="font-bold">
                圖鑑管理
              </h3>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              清空會移除全部角色、相遇次數、抽取與空膠囊統計，並同步到其他裝置。這個動作無法復原。
            </p>
            {isOffline ? (
              <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                離線時只能查看快取，重新連線後才能清空圖鑑。
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onRequestReset}
            disabled={!canResetCollection}
            className="btn btn-error min-h-11 shrink-0 rounded-[9px] px-5 disabled:cursor-not-allowed"
          >
            <Trash2 className="size-4" strokeWidth={1.8} aria-hidden="true" />
            清空圖鑑
          </button>
        </div>
      </section>
      <GachaCollectionDialog
        character={
          selectedCharacter && (showAllEntries || selectedOwnedCount > 0)
            ? selectedCharacter
            : null
        }
        ownedCount={selectedOwnedCount}
        reduceMotion={Boolean(reduceMotion)}
        onClose={() => setSelectedCharacter(null)}
      />
    </section>
  );
}
