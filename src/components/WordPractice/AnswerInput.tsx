import { useId, type ReactNode } from "react";

interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  label: ReactNode;
  disabled?: boolean;
}

/**
 * The box Ollie types an answer into. The browser's spelling help would give
 * the answer away, so it is all switched off. It takes focus when it mounts;
 * give it a new `key` to focus it again for the next question.
 */
export function AnswerInput({ value, onChange, onSubmit, label, disabled }: AnswerInputProps) {
  const inputId = useId();

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        value={value}
        disabled={disabled}
        autoFocus
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // A held Enter must not skip through questions, and Enter that picks
          // an IME candidate is not a submit.
          if (event.key !== "Enter" || event.repeat || event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (value.trim() !== "") onSubmit();
        }}
        className="input input-bordered min-h-11 w-full rounded-[6px] border-border-hairline bg-background/50 text-lg shadow-sm focus-visible:ring-2 focus-visible:ring-accent"
      />
    </div>
  );
}
