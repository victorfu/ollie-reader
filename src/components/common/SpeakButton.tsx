import type { MouseEvent } from "react";
import { Volume2 } from "lucide-react";
import { useSpeechState } from "../../hooks/useSpeechState";

type SpeakButtonSize = "sm" | "md";

interface SpeakButtonProps {
  /** Text to read aloud; also identifies which button is "playing". */
  text: string;
  /** Accessible name while idle. */
  label?: string;
  size?: SpeakButtonSize;
  className?: string;
}

// 44px targets on touch screens, compact once a precise pointer is present.
const SIZE_CLASS: Record<SpeakButtonSize, { button: string; icon: string }> = {
  sm: { button: "size-8 pointer-coarse:size-11", icon: "size-4 pointer-coarse:size-5" },
  md: { button: "size-9 pointer-coarse:size-11", icon: "size-5" },
};

/**
 * Speaker button with explicit feedback: a spinner while audio is being
 * fetched, a pulsing tinted icon while it plays, and a second tap stops it.
 * Only the button whose `text` is being spoken shows the active state.
 */
export const SpeakButton = ({
  text,
  label = "播放發音",
  size = "sm",
  className = "",
}: SpeakButtonProps) => {
  const { speak, stopSpeaking, isSpeaking, isLoadingAudio, speakingText } =
    useSpeechState();
  const isActive = speakingText === text && (isSpeaking || isLoadingAudio);
  const isLoading = isActive && isLoadingAudio;

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Rows wrap this in a selectable container; never toggle selection.
    e.stopPropagation();
    if (isActive) {
      stopSpeaking();
    } else {
      speak(text);
    }
  };

  const { button, icon } = SIZE_CLASS[size];
  const stateClass = isActive
    ? "bg-accent-tint text-accent"
    : "text-accent/70 hover:bg-accent-tint hover:text-accent";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isActive ? "停止播放" : label}
      title={isActive ? "停止播放" : label}
      aria-pressed={isActive}
      aria-busy={isLoading}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${button} ${stateClass} ${className}`}
    >
      {isLoading ? (
        <span className="loading loading-spinner loading-xs" aria-hidden="true" />
      ) : (
        <Volume2
          className={`${icon} ${isActive ? "motion-safe:animate-pulse" : ""}`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      )}
    </button>
  );
};
