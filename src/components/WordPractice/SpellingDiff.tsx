import { diffSpelling, type SpellingDiffPart } from "../../utils/answerMatch";

interface SpellingDiffProps {
  input: string;
  expected: string;
}

/**
 * Colour is never the only cue: each kind of mistake has its own underline
 * or strike-through as well.
 * - wrong: the letter that belongs here, underlined.
 * - missing: a letter that was left out, with a dotted underline.
 * - extra: a letter that was typed but does not belong, struck through.
 */
const KIND_STYLES: Record<SpellingDiffPart["kind"], string> = {
  same: "",
  wrong: "rounded-[3px] bg-error/10 text-error underline decoration-2 underline-offset-4",
  missing:
    "rounded-[3px] bg-error/10 text-error underline decoration-dotted decoration-2 underline-offset-4",
  extra: "rounded-[3px] bg-error/10 text-error line-through decoration-2",
};

/** A space in a marked part would be invisible, so it is drawn as a symbol. */
function visibleText(part: SpellingDiffPart): string {
  return part.kind === "same" ? part.text : part.text.replace(/ /g, "␣");
}

/**
 * The correct spelling with the typed mistakes marked on it. The parts are
 * lower-cased, so show the correctly-cased word next to this as well.
 */
export function SpellingDiff({ input, expected }: SpellingDiffProps) {
  return (
    <span
      role="img"
      aria-label={`Correct spelling: ${expected}`}
      className="whitespace-pre-wrap break-words text-3xl font-semibold tracking-wide"
    >
      {diffSpelling(input, expected).map((part, index) => (
        <span key={index} data-kind={part.kind} className={KIND_STYLES[part.kind]}>
          {visibleText(part)}
        </span>
      ))}
    </span>
  );
}
