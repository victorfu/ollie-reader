import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { BookOpen, Check, PackageOpen, Sparkles, X } from "lucide-react";
import { playSound } from "../../../services/gameService";
import { getGachaCharacter } from "./gachaData";
import { useLanguage } from "../../../hooks/useLanguage";
import { T } from "../../common/T";
import type { GachaDrawResult } from "./gachaTypes";

interface GachaRevealDialogProps {
  isOpen: boolean;
  result: GachaDrawResult | null;
  reduceMotion: boolean;
  onClose: () => void;
  onOpenCollection: () => void;
  onRestoreFocus: () => void;
}

export function GachaRevealDialog({
  isOpen,
  result,
  reduceMotion,
  onClose,
  onOpenCollection,
  onRestoreFocus,
}: GachaRevealDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const celebratedResultRef = useRef<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        previouslyFocusedRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      celebratedResultRef.current = null;
      return;
    }
    if (!result) return;
    const resultKey =
      result.kind === "miss"
        ? `${result.totalDraws}:miss`
        : `${result.totalDraws}:${result.characterId}:${result.ownedCount}`;
    if (celebratedResultRef.current === resultKey) return;
    celebratedResultRef.current = resultKey;

    const isNewCharacter = result.kind === "character" && result.isNew;
    playSound(isNewCharacter ? "unlock" : "click");
    if (!isNewCharacter || reduceMotion) return;

    void confetti({
      particleCount: 110,
      spread: 82,
      startVelocity: 34,
      scalar: 0.9,
      origin: { y: 0.58 },
      colors: ["#f9a8d4", "#fcd34d", "#93c5fd", "#a7f3d0", "#c4b5fd"],
      disableForReducedMotion: true,
    });
  }, [isOpen, reduceMotion, result]);

  const handleDialogClose = () => {
    onClose();
    const restoreFocus = () => {
      const previous = previouslyFocusedRef.current;
      const isDocumentFallback =
        previous === document.body || previous === document.documentElement;

      if (previous?.isConnected && !isDocumentFallback) {
        previous.focus();
        if (document.activeElement === previous) return;
      }

      onRestoreFocus();
    };
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(restoreFocus);
    } else {
      queueMicrotask(restoreFocus);
    }
  };

  const handleOpenCollection = () => {
    onOpenCollection();
    dialogRef.current?.close();
  };

  const character =
    result?.kind === "character"
      ? getGachaCharacter(result.characterId)
      : null;
  const isMiss = result?.kind === "miss";

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom bg-black/25 backdrop-blur-sm sm:modal-middle dark:bg-black/50"
      aria-labelledby="gacha-reveal-title"
      aria-describedby="gacha-reveal-description"
      onClose={handleDialogClose}
    >
      {isOpen && result && (isMiss || character) ? (
        <motion.div
          className="modal-box relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-white/60 bg-background/95 p-0 shadow-floating backdrop-blur-2xl sm:rounded-[24px] dark:border-white/10"
          initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: reduceMotion ? 0 : 0.32,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t("gacha.reveal.close")}
            className="absolute right-3 top-3 z-20 inline-flex size-11 items-center justify-center rounded-full border border-border-hairline bg-background/75 text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </button>

          <div className="relative flex min-h-72 items-end justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_70%,rgba(244,114,182,0.25)_0%,rgba(147,197,253,0.12)_36%,transparent_67%)] px-8 pb-3 pt-12">
            <div
              aria-hidden="true"
              className="absolute left-8 top-14 size-3 rounded-full bg-amber-300/80 shadow-[0_0_20px_rgba(252,211,77,0.7)]"
            />
            <div
              aria-hidden="true"
              className="absolute right-12 top-24 size-2 rounded-full bg-sky-300/90 shadow-[0_0_18px_rgba(125,211,252,0.7)]"
            />
            <div
              aria-hidden="true"
              className="absolute right-20 top-10 text-3xl text-pink-300/80"
            >
              ✦
            </div>
            {character ? (
              <motion.div
                initial={reduceMotion ? false : { y: 20, rotate: -4, scale: 0.78 }}
                animate={{ y: 0, rotate: 0, scale: 1 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.48,
                  delay: reduceMotion ? 0 : 0.08,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
                className="relative z-10 flex size-56 items-center justify-center rounded-full border border-white/70 bg-white/45 shadow-[0_24px_55px_rgba(76,61,107,0.18),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-sm dark:border-white/15 dark:bg-white/5"
              >
                <img
                  src={character.imageUrl}
                  alt={character.name}
                  loading="eager"
                  decoding="async"
                  className="h-[92%] w-[92%] object-contain drop-shadow-[0_18px_18px_rgba(56,45,80,0.2)]"
                />
              </motion.div>
            ) : (
              <motion.div
                initial={reduceMotion ? false : { y: 18, scale: 0.82 }}
                animate={{ y: 0, scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.32 }}
                className="relative z-10 flex size-48 items-center justify-center rounded-full border border-white/70 bg-white/55 text-muted-foreground shadow-[0_24px_55px_rgba(76,61,107,0.14),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-sm dark:border-white/15 dark:bg-white/5"
              >
                <PackageOpen className="size-24" strokeWidth={1.2} aria-hidden="true" />
              </motion.div>
            )}
          </div>

          <div className="px-6 pb-7 pt-3 text-center sm:px-8">
            <div
              className={`mx-auto mb-3 inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                isMiss
                  ? "bg-muted text-muted-foreground"
                  : result.kind === "character" && result.isNew
                    ? "bg-amber-400/15 text-amber-700 dark:text-amber-200"
                    : "bg-accent-tint text-accent"
              }`}
            >
              {isMiss ? (
                <PackageOpen className="size-4" strokeWidth={1.9} aria-hidden="true" />
              ) : result.kind === "character" && result.isNew ? (
                <Sparkles className="size-4" strokeWidth={1.9} aria-hidden="true" />
              ) : (
                <Check className="size-4" strokeWidth={2} aria-hidden="true" />
              )}
              {isMiss ? (
                <T k="gacha.reveal.emptyBadge" />
              ) : result.kind === "character" && result.isNew ? (
                <T k="gacha.reveal.newBadge" />
              ) : result.kind === "character" ? (
                <T k="gacha.reveal.metBadge" params={{ n: result.ownedCount }} />
              ) : null}
            </div>
            <h2
              id="gacha-reveal-title"
              className="text-3xl font-bold tracking-tight text-foreground"
            >
              {isMiss ? (
                <T k="gacha.reveal.emptyTitle" />
              ) : (
                character?.name
              )}
            </h2>
            {character ? (
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                {character.englishName}
              </p>
            ) : null}
            <p
              id="gacha-reveal-description"
              className="mx-auto mt-4 max-w-xs text-sm leading-6 text-muted-foreground"
            >
              {isMiss ? (
                <T k="gacha.reveal.emptyBody" />
              ) : result.kind === "character" && result.isNew ? (
                <T k="gacha.reveal.newBody" />
              ) : (
                <T k="gacha.reveal.repeatBody" />
              )}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleOpenCollection}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-border-hairline bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <BookOpen className="size-4" strokeWidth={1.8} aria-hidden="true" />
                <T k="gacha.reveal.viewCollection" />
              </button>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="btn btn-primary min-h-11 rounded-[10px] text-sm shadow-sm active:scale-[0.98]"
              >
                <T k="gacha.reveal.again" />
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}

      <form method="dialog" className="modal-backdrop">
        <button type="submit" aria-label={t("gacha.reveal.close")}>
          {t("gacha.close")}
        </button>
      </form>
    </dialog>
  );
}
