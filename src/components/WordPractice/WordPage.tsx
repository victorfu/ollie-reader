import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSpeechState } from "../../hooks/useSpeechState";
import type { Cloze, HomeworkWord, WordPageProgress } from "../../types/wordPractice";
import { isAnswerCorrect } from "../../utils/answerMatch";
import {
  checkSentence,
  clozeFor,
  COPY_TARGET,
  isClozeAnswer,
  nextSection,
  pageSection,
} from "../../utils/homeworkFlow";
import { redactWordForms } from "../../utils/wordForms";
import { SpeakButton } from "../common/SpeakButton";
import { AnswerInput } from "./AnswerInput";
import { CopyBoxes } from "./CopyBoxes";
import { SpellingDiff } from "./SpellingDiff";

interface WordPageProps {
  word: HomeworkWord;
  progress: WordPageProgress;
  index: number;
  total: number;
  onChange: (next: WordPageProgress) => void;
}

const SECTION_RANK = { look: 0, copy: 1, recall: 2, cloze: 3, sentence: 4, done: 5 } as const;

function sentenceHint(result: ReturnType<typeof checkSentence>, word: string): string {
  if (result === "missingWord") return `要用到「${word}」喔`;
  if (result === "tooShort") return "句子至少要 4 個英文字";
  return "";
}

function tidy(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-semibold">{children}</h3>;
}

function Summary({ children }: { children: ReactNode }) {
  return <li className="text-sm text-muted-foreground">{children}</li>;
}

function LookSection({ word, onDone }: { word: HomeworkWord; onDone: () => void }) {
  const { speakAsync } = useSpeechState();
  const spokenRef = useRef(false);
  useEffect(() => {
    if (spokenRef.current) return;
    spokenRef.current = true;
    Promise.resolve(speakAsync(word.word)).catch(() => {});
  }, [speakAsync, word.word]);

  return (
    <section className="space-y-4">
      <Heading>看一看、聽一聽</Heading>
      <ul className="space-y-3">
        {word.definitions.map((d, i) => (
          <li key={i} className="space-y-0.5">
            <p>
              <span className="mr-2 text-sm italic text-muted-foreground">{d.partOfSpeech}</span>
              {d.definition}
            </p>
            {d.definitionChinese && <p className="text-muted-foreground">{d.definitionChinese}</p>}
          </li>
        ))}
      </ul>
      {word.sentence && (
        <p className="rounded-[10px] border border-border-hairline bg-background px-4 py-3">
          {word.sentence}
        </p>
      )}
      <button
        type="button"
        autoFocus
        onClick={onDone}
        className="btn btn-primary min-h-11 active:scale-[0.98]"
      >
        看完了
      </button>
    </section>
  );
}

function RecallSection({ word, onDone }: { word: HomeworkWord; onDone: () => void }) {
  const [typed, setTyped] = useState("");
  const [missed, setMissed] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const check = () => {
    if (isAnswerCorrect(typed, word.word)) {
      onDone();
      return;
    }
    setMissed(typed.trim());
    setAttempts(attempts + 1);
    setTyped("");
  };

  return (
    <section className="space-y-4">
      <Heading>不看單字，聽發音打出來</Heading>
      <div className="flex items-center gap-2">
        <SpeakButton text={word.word} size="md" />
      </div>
      <AnswerInput
        key={attempts}
        value={typed}
        onChange={setTyped}
        onSubmit={check}
        label="把單字打出來"
      />
      {missed !== null && (
        <div
          role="status"
          className="space-y-2 rounded-[10px] border border-border-hairline bg-background px-4 py-3"
        >
          <p className="text-sm text-muted-foreground">
            正確拼法是 <strong className="text-foreground">{word.word}</strong>，再打一次：
          </p>
          <SpellingDiff input={missed} expected={word.word} />
        </div>
      )}
      {/* Below the input, so a word with many meanings never pushes it off screen. */}
      <ul className="space-y-2">
        {word.definitions.map((d, i) => (
          <li key={i} className="space-y-0.5">
            <p>{redactWordForms(d.definition, word.word, "____")}</p>
            {d.definitionChinese && (
              <p className="text-muted-foreground">
                {redactWordForms(d.definitionChinese, word.word, "____")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClozeSection({ cloze, onDone }: { cloze: Cloze; onDone: () => void }) {
  const [typed, setTyped] = useState("");
  const [missed, setMissed] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const check = () => {
    if (isClozeAnswer(typed, cloze)) {
      onDone();
      return;
    }
    setMissed(typed.trim());
    setAttempts(attempts + 1);
    setTyped("");
  };

  return (
    <section className="space-y-4">
      <Heading>例句填空：把空格裡的字打出來</Heading>
      <p className="rounded-[10px] border border-border-hairline bg-background px-4 py-3 text-lg">
        {cloze.text}
      </p>
      <AnswerInput
        key={attempts}
        value={typed}
        onChange={setTyped}
        onSubmit={check}
        label="空格裡的字"
      />
      {missed !== null && (
        <div
          role="status"
          className="space-y-2 rounded-[10px] border border-border-hairline bg-background px-4 py-3"
        >
          <p className="text-sm text-muted-foreground">
            正確答案是 <strong className="text-foreground">{cloze.answer}</strong>，再打一次：
          </p>
          <SpellingDiff input={missed} expected={cloze.answer} />
        </div>
      )}
    </section>
  );
}

function WriteSection({
  title,
  label,
  check,
  onAccept,
}: {
  title: string;
  label: string;
  /** Returns the Chinese reason the text is not accepted, or "" when it is fine. */
  check: (text: string) => string;
  onAccept: (text: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [hint, setHint] = useState("");

  const submit = () => {
    const message = check(typed);
    setHint(message);
    if (message === "") onAccept(tidy(typed));
  };

  return (
    <section className="space-y-3">
      <Heading>{title}</Heading>
      <AnswerInput
        value={typed}
        onChange={(value) => {
          setTyped(value);
          setHint("");
        }}
        onSubmit={submit}
        label={label}
      />
      <p role="status" className="min-h-6 text-sm text-error">
        {hint}
      </p>
      <button
        type="button"
        disabled={typed.trim() === ""}
        onClick={submit}
        className="btn btn-primary min-h-11 active:scale-[0.98]"
      >
        好了
      </button>
    </section>
  );
}

/**
 * One page of the homework book: a single word, one section at a time.
 * Finished sections shrink to a summary line, and the word is kept off the
 * page while it is being recalled.
 */
export function WordPage({ word, progress, index, total, onChange }: WordPageProps) {
  const cloze = clozeFor(word);
  const stored = pageSection(progress);
  // A word without a usable example has no cloze; a page saved there goes on to the sentence.
  const section = stored === "cloze" && !cloze ? "sentence" : stored;
  const rank = SECTION_RANK[section];
  const advance = (extra: Partial<WordPageProgress> = {}) =>
    onChange({ ...progress, ...extra, section: nextSection(section, cloze !== null) });

  return (
    <article className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm tabular-nums text-muted-foreground">
          第 {index + 1} / {total} 個字
        </p>
        {section === "recall" ? (
          <h2 className="text-3xl font-semibold tracking-tight">?</h2>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {word.emoji && (
              <span className="text-4xl leading-none" aria-hidden="true">
                {word.emoji}
              </span>
            )}
            <h2 className="break-words text-3xl font-semibold tracking-tight">{word.word}</h2>
            <SpeakButton text={word.word} size="md" />
          </div>
        )}
      </header>

      {rank > 0 && (
        <ul className="space-y-1">
          <Summary>✓ 看字</Summary>
          {rank > SECTION_RANK.copy && <Summary>✓ 抄寫 {COPY_TARGET} 遍</Summary>}
          {rank > SECTION_RANK.recall && <Summary>✓ 默寫</Summary>}
          {rank > SECTION_RANK.cloze && cloze && <Summary>✓ 例句填空</Summary>}
          {rank > SECTION_RANK.sentence && progress.sentence && (
            <Summary>✓ 造句：{progress.sentence}</Summary>
          )}
        </ul>
      )}

      {section === "look" && <LookSection word={word} onDone={() => advance()} />}

      {section === "copy" && (
        <section className="space-y-3">
          <Heading>照著打 {COPY_TARGET} 遍</Heading>
          <CopyBoxes
            word={word.word}
            done={progress.copies}
            target={COPY_TARGET}
            onCorrect={() => {
              const copies = progress.copies + 1;
              if (copies >= COPY_TARGET) advance({ copies: COPY_TARGET });
              else onChange({ ...progress, copies });
            }}
          />
        </section>
      )}

      {section === "recall" && <RecallSection word={word} onDone={() => advance()} />}

      {section === "cloze" && cloze && <ClozeSection cloze={cloze} onDone={() => advance()} />}

      {section === "sentence" && (
        <WriteSection
          title={`造句：用 ${word.word} 寫一個完整的句子`}
          label="你的句子"
          check={(text) => sentenceHint(checkSentence(text, word.word), word.word)}
          onAccept={(text) => advance({ sentence: text })}
        />
      )}
    </article>
  );
}
