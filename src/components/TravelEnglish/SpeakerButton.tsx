import { Volume2 } from "lucide-react";

interface SpeakerButtonProps {
  /** 要朗讀的文字 */
  text: string;
  speak: (text: string) => void;
  /** 無障礙標籤；預設「播放：<text>」 */
  label?: string;
  className?: string;
}

/** 點一下就用 TTS 朗讀指定文字的小喇叭按鈕 */
export function SpeakerButton({ text, speak, label, className }: SpeakerButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-circle text-primary min-h-[44px] min-w-[44px] active:scale-[0.95] ${className ?? ""}`}
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      aria-label={label ?? `播放：${text}`}
    >
      <Volume2 className="w-5 h-5" />
    </button>
  );
}
