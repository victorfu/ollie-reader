import { BookOpen, Check, Cloud, LockKeyhole, Sparkles, WifiOff } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { GACHA_CHARACTERS } from "./gachaData";
import type { GachaSaveV1 } from "./gachaTypes";

interface GachaCollectionProps {
  save: GachaSaveV1;
  isLoading?: boolean;
  isOffline?: boolean;
  syncLabel?: string;
}

export function GachaCollection({
  save,
  isLoading = false,
  isOffline = false,
  syncLabel = "已與雲端同步",
}: GachaCollectionProps) {
  const reduceMotion = useReducedMotion();
  const unlockedCount = GACHA_CHARACTERS.reduce(
    (total, character) =>
      total + ((save.ownedCounts[character.id] ?? 0) > 0 ? 1 : 0),
    0,
  );
  const completion = Math.round(
    (unlockedCount / GACHA_CHARACTERS.length) * 100,
  );

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
            每次遇見新角色都會自動解鎖；重複扭到的角色也會留下相遇次數。
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
            {isOffline ? "離線快取 · 僅供查看" : syncLabel}
          </div>
        </div>
      </div>

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

          return (
            <motion.article
              key={character.id}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.28,
                delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.2),
              }}
              className={`group relative min-w-0 overflow-hidden rounded-[16px] border p-3 shadow-sm transition-all sm:p-4 ${
                isUnlocked
                  ? "border-border-hairline bg-card hover:-translate-y-0.5 hover:shadow-elevated"
                  : "border-border-hairline bg-muted/45"
              }`}
            >
              <div
                className={`relative aspect-square overflow-hidden rounded-[13px] border ${
                  isUnlocked
                    ? "border-white/55 bg-gradient-to-br from-white/85 to-accent-tint dark:border-white/10 dark:from-white/10"
                    : "border-border-hairline bg-background/50"
                }`}
              >
                <img
                  src={character.imageUrl}
                  alt={isUnlocked ? character.name : ""}
                  aria-hidden={!isUnlocked}
                  loading="lazy"
                  decoding="async"
                  className={`h-full w-full object-contain p-1 transition-transform duration-200 ${
                    isUnlocked
                      ? "drop-shadow-[0_10px_12px_rgba(63,52,86,0.16)] group-hover:scale-[1.04]"
                      : "scale-[0.92] brightness-0 opacity-[0.12] dark:invert dark:opacity-[0.08]"
                  }`}
                />

                {isUnlocked ? (
                  <span className="absolute right-2 top-2 inline-flex min-h-7 min-w-7 items-center justify-center rounded-full border border-white/65 bg-background/85 px-2 text-xs font-bold text-foreground shadow-sm backdrop-blur-md dark:border-white/10">
                    ×{ownedCount}
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
                  {isUnlocked ? character.name : "???"}
                </h3>
                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                  {isUnlocked ? character.englishName : "尚未解鎖"}
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
            </motion.article>
          );
        })}
      </div>

      {isLoading ? (
        <div className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-[12px] border border-border-hairline bg-card px-4 text-sm text-muted-foreground" role="status">
          <span className="loading loading-spinner loading-sm text-accent" />
          正在更新雲端圖鑑…
        </div>
      ) : null}
    </section>
  );
}
