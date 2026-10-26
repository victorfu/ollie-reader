import { useEffect, useRef, useState, type ReactNode } from "react";

interface HintTextProps {
  /** The Chinese meaning shown in the tooltip. */
  hint: string;
  children: ReactNode;
}

/**
 * English text with a dotted underline whose Chinese meaning appears on hover
 * (desktop) or on tap (touch, where hover never fires). Tapping again, tapping
 * elsewhere, or pressing Escape closes it.
 *
 * Not for text inside buttons or links: the tap would also trigger them. Use
 * the stacked `<T variant="stacked">` there instead.
 */
export function HintText({ hint, children }: HintTextProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      data-tip={hint}
      onClick={(event) => {
        // Inside a <label> or row, a tap to read the hint must not also pick
        // the option or open the row.
        event.preventDefault();
        event.stopPropagation();
        setOpen((v) => !v);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setOpen((v) => !v);
        } else if (event.key === "Escape") {
          setOpen(false);
        }
      }}
      className={`tooltip tooltip-top cursor-help underline decoration-dotted decoration-1 underline-offset-4 ${
        open ? "tooltip-open" : ""
      }`}
    >
      {children}
      <span className="sr-only" lang="zh-Hant-TW">
        （{hint}）
      </span>
    </span>
  );
}
