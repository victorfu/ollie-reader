import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  title: string;
  /** 標題底下那行小字，通常放進度或關卡名 */
  subtitle?: ReactNode;
  /** 主要內容。會自己捲，不用再包一層 overflow */
  children: ReactNode;
  /** 釘在底部不跟著捲的區塊，例如圖鑑選到的角色細節 */
  footer?: ReactNode;
  /** 蓋掉預設的面板寬度（max-w-4xl） */
  panelClassName?: string;
  onClose: () => void;
};

/**
 * 遊戲裡的彈出面板：半透明底 + 玻璃面板，點外面、按 Esc、按 X 都能關。
 *
 * 圖鑑和角色細節都用它，收合行為才會一致——同一個手勢在兩個面板上做出不同
 * 的事，是最容易讓人覺得「這遊戲怪怪的」的那種小地方。
 */
export function Popup({
  title,
  subtitle,
  children,
  footer,
  panelClassName = "max-w-4xl",
  onClose,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label={`關閉${title}`}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/25 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-full w-full flex-col overflow-hidden rounded-[16px] border border-black/5 bg-white/90 shadow-2xl backdrop-blur-2xl ${panelClassName}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-black/5 px-4 py-3">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-black/5"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>

        {footer}
      </div>
    </div>
  );
}
