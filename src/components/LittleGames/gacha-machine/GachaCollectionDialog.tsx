import { useEffect, useId, useRef } from "react";
import { motion } from "framer-motion";
import { Check, Eye, X } from "lucide-react";
import type { GachaCharacter } from "./gachaTypes";

interface GachaCollectionDialogProps {
  character: GachaCharacter | null;
  ownedCount: number;
  reduceMotion: boolean;
  onClose: () => void;
}

export function GachaCollectionDialog({
  character,
  ownedCount,
  reduceMotion,
  onClose,
}: GachaCollectionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isPreview = ownedCount <= 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (character) {
      if (!dialog.open) {
        previouslyFocusedRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        dialog.showModal();
        closeButtonRef.current?.focus({ preventScroll: true });
      }
      return;
    }

    if (dialog.open) dialog.close();
  }, [character]);

  const handleDialogClose = () => {
    onClose();
    const restoreFocus = () => {
      const previous = previouslyFocusedRef.current;
      if (previous?.isConnected) previous.focus();
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(restoreFocus);
    } else {
      queueMicrotask(restoreFocus);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom bg-black/25 backdrop-blur-sm sm:modal-middle dark:bg-black/50"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={handleDialogClose}
    >
      {character ? (
        <motion.div
          className="modal-box relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] border border-white/60 bg-background/95 p-0 shadow-floating backdrop-blur-2xl sm:rounded-[24px] dark:border-white/10"
          initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: reduceMotion ? 0 : 0.28,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="關閉角色圖片"
            className="absolute right-3 top-3 z-20 inline-flex size-11 items-center justify-center rounded-full border border-border-hairline bg-background/80 text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </button>

          <div className="relative flex min-h-[min(60dvh,480px)] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_55%,rgba(147,197,253,0.24)_0%,rgba(196,181,253,0.14)_38%,transparent_70%)] px-5 pb-4 pt-16 sm:px-10">
            <div
              aria-hidden="true"
              className="absolute left-[12%] top-[18%] size-3 rounded-full bg-amber-300/80 shadow-[0_0_20px_rgba(252,211,77,0.7)]"
            />
            <div
              aria-hidden="true"
              className="absolute right-[14%] top-[28%] text-4xl text-pink-300/75"
            >
              ✦
            </div>
            <motion.img
              src={character.imageUrl}
              alt={`${character.name}角色圖片`}
              loading="eager"
              decoding="async"
              initial={reduceMotion ? false : { y: 14, scale: 0.9 }}
              animate={{ y: 0, scale: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.36 }}
              className="relative z-10 max-h-[48dvh] w-full max-w-lg object-contain drop-shadow-[0_24px_24px_rgba(56,45,80,0.2)]"
            />
          </div>

          <div className="border-t border-border-hairline px-6 pb-7 pt-5 text-center sm:px-8">
            <div
              className={`mx-auto mb-3 inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                isPreview
                  ? "bg-accent-tint text-accent"
                  : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {isPreview ? (
                <Eye className="size-4" strokeWidth={1.9} aria-hidden="true" />
              ) : (
                <Check className="size-4" strokeWidth={2} aria-hidden="true" />
              )}
              {isPreview ? "完整圖鑑預覽" : `已遇見 ${ownedCount} 次`}
            </div>
            <h2 id={titleId} className="text-3xl font-bold tracking-tight">
              {character.name}
            </h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {character.englishName}
            </p>
            <p
              id={descriptionId}
              className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground"
            >
              {isPreview
                ? "這個角色尚未透過扭蛋解鎖；目前依照設定提供圖片預覽。"
                : "這個角色已收錄在你的圖鑑中，可以隨時回來查看。"}
            </p>
          </div>
        </motion.div>
      ) : null}

      <form method="dialog" className="modal-backdrop">
        <button type="submit" aria-label="關閉角色圖片">
          關閉
        </button>
      </form>
    </dialog>
  );
}
