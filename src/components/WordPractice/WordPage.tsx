import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSpeechState } from "../../hooks/useSpeechState";
import type { HomeworkWord, WordPageProgress } from "../../types/wordPractice";
import { isAnswerCorrect } from "../../utils/answerMatch";
import { checkSentence, COPY_TARGET, nextSection, pageSection, sentenceWord } from "../../utils/homeworkFlow";
import { INFLECTION_USE, inflectionRule } from "../../utils/inflection";
import type { MessageKey } from "../../i18n/translate";
import { redactWordForms } from "../../utils/wordForms";
import { SpeakButton } from "../common/SpeakButton";
import { AnswerInput } from "./AnswerInput";
import { CopyBoxes } from "./CopyBoxes";
import { SpellingDiff } from "./SpellingDiff";
import { PracticeText } from "./PracticeText";
import { T } from "../common/T";

interface WordPageProps {
  word: HomeworkWord;
  progress: WordPageProgress;
  index: number;
  total: number;
  onChange: (next: WordPageProgress) => void;
}

const SECTION_RANK = { look: 0, copy: 1, recall: 2, form: 3, sentence: 4, done: 5 } as const;

/** The message key for why a sentence is not accepted, or null when it is fine. */
function sentenceHint(result: ReturnType<typeof checkSentence>): MessageKey | null {
  if (result === "missingWord") return "practice.page.sentenceMissingWord";
  if (result === "tooShort") return "practice.page.sentenceTooShort";
  return null;
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
      <Heading>
        <T k="practice.page.lookTitle" />
      </Heading>
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
      {word.inflection && (
        <p className="rounded-[10px] bg-accent-tint px-4 py-3 text-sm">
          <PracticeText
            k="practice.page.seenInBook"
            params={{ form: word.inflection.form, word: word.word }}
            inflection={word.inflection.kind}
          />
        </p>
      )}
      <button
        type="button"
        autoFocus
        onClick={onDone}
        className="btn btn-primary min-h-11 active:scale-[0.98]"
      >
        <T k="practice.page.lookDone" />
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
      <Heading>
        <T k="practice.page.recallTitle" />
      </Heading>
      <div className="flex items-center gap-2">
        <SpeakButton text={word.word} size="md" />
      </div>
      <AnswerInput
        key={attempts}
        value={typed}
        onChange={setTyped}
        onSubmit={check}
        label={<T k="practice.page.recallLabel" />}
      />
      {missed !== null && (
        <div
          role="status"
          className="space-y-2 rounded-[10px] border border-border-hairline bg-background px-4 py-3"
        >
          <p className="text-sm text-muted-foreground">
            <PracticeText k="practice.page.recallMissed" params={{ word: word.word }} bold={["word"]} />
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

/**
 * The inflected form of a word saved that way: first the form, how it is made
 * and when it is used, copied once; then typed again without looking.
 */
function FormSection({
  word,
  inflection,
  onDone,
}: {
  word: HomeworkWord;
  inflection: NonNullable<HomeworkWord["inflection"]>;
  onDone: () => void;
}) {
  const [learned, setLearned] = useState(false);
  const [typed, setTyped] = useState("");
  const [missed, setMissed] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const check = () => {
    if (isAnswerCorrect(typed, inflection.form)) {
      onDone();
      return;
    }
    setMissed(typed.trim());
    setAttempts(attempts + 1);
    setTyped("");
  };

  if (!learned) {
    return (
      <section className="space-y-4">
        <Heading>
          <PracticeText
            k="practice.page.formTitle"
            params={{ word: word.word }}
            inflection={inflection.kind}
          />
        </Heading>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-2xl font-semibold">{inflection.form}</p>
          <SpeakButton text={inflection.form} size="md" />
        </div>
        <ul className="space-y-1 rounded-[10px] border border-border-hairline bg-background px-4 py-3 text-sm">
          <li>
            <T k="practice.page.formHow" params={{ rule: inflectionRule(word.word, inflection.form) }} />
          </li>
          <li>
            <T k="practice.page.formWhen" params={{ use: INFLECTION_USE[inflection.kind] }} />
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          <T k="practice.page.formCopy" />
        </p>
        <CopyBoxes word={inflection.form} done={0} target={1} onCorrect={() => setLearned(true)} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Heading>
        <PracticeText
          k="practice.page.formRecallTitle"
          params={{ word: word.word }}
          inflection={inflection.kind}
        />
      </Heading>
      <AnswerInput
        key={attempts}
        value={typed}
        onChange={setTyped}
        onSubmit={check}
        label={
          <PracticeText k="practice.page.formRecallLabel" params={{ word: word.word }} inflection={inflection.kind} />
        }
      />
      {missed !== null && (
        <div
          role="status"
          className="space-y-2 rounded-[10px] border border-border-hairline bg-background px-4 py-3"
        >
          <p className="text-sm text-muted-foreground">
            <PracticeText k="practice.page.formMissed" params={{ form: inflection.form }} bold={["form"]} />
          </p>
          <SpellingDiff input={missed} expected={inflection.form} />
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
  title: ReactNode;
  label: ReactNode;
  /** Returns the reason the text is not accepted (a message key and its params), or null when it is fine. */
  check: (text: string) => { key: MessageKey; params?: Record<string, string> } | null;
  onAccept: (text: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [hint, setHint] = useState<ReturnType<typeof check>>(null);

  const submit = () => {
    const message = check(typed);
    setHint(message);
    if (message === null) onAccept(tidy(typed));
  };

  return (
    <section className="space-y-3">
      <Heading>{title}</Heading>
      <AnswerInput
        value={typed}
        onChange={(value) => {
          setTyped(value);
          setHint(null);
        }}
        onSubmit={submit}
        label={label}
      />
      <p role="status" className="min-h-6 text-sm text-error">
        {hint && <T k={hint.key} params={hint.params} />}
      </p>
      <button
        type="button"
        disabled={typed.trim() === ""}
        onClick={submit}
        className="btn btn-primary min-h-11 active:scale-[0.98]"
      >
        <T k="practice.page.done" />
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
  const { inflection } = word;
  const stored = pageSection(progress);
  // Only a word saved as an inflected form has a form step.
  const section = stored === "form" && !inflection ? "sentence" : stored;
  const rank = SECTION_RANK[section];
  const target = sentenceWord(word);
  const advance = (extra: Partial<WordPageProgress> = {}) =>
    onChange({ ...progress, ...extra, section: nextSection(section, inflection !== undefined) });

  return (
    <article className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm tabular-nums text-muted-foreground">
          <T k="practice.page.counter" params={{ current: index + 1, total }} />
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
          <Summary>
            ✓ <T k="practice.page.doneLook" />
          </Summary>
          {rank > SECTION_RANK.copy && (
            <Summary>
              ✓ <T k="practice.page.doneCopy" params={{ count: COPY_TARGET }} />
            </Summary>
          )}
          {rank > SECTION_RANK.recall && (
            <Summary>
              ✓ <T k="practice.page.doneRecall" />
            </Summary>
          )}
          {rank > SECTION_RANK.form && inflection && (
            <Summary>
              ✓{" "}
              <PracticeText k="practice.page.doneForm" params={{ form: inflection.form }} inflection={inflection.kind} />
            </Summary>
          )}
          {rank > SECTION_RANK.sentence && progress.sentence && (
            <Summary>
              ✓ <T k="practice.page.doneSentence" params={{ sentence: progress.sentence }} />
            </Summary>
          )}
        </ul>
      )}

      {section === "look" && <LookSection word={word} onDone={() => advance()} />}

      {section === "copy" && (
        <section className="space-y-3">
          <Heading>
            <T k="practice.page.copyTitle" params={{ count: COPY_TARGET }} />
          </Heading>
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

      {section === "form" && inflection && (
        <FormSection word={word} inflection={inflection} onDone={() => advance()} />
      )}

      {section === "sentence" && (
        <WriteSection
          title={<T k="practice.page.sentenceTitle" params={{ word: target }} />}
          label={<T k="practice.page.sentenceLabel" />}
          check={(text) => {
            const key = sentenceHint(checkSentence(text, target));
            return key ? { key, params: { word: target } } : null;
          }}
          onAccept={(text) => advance({ sentence: text })}
        />
      )}
    </article>
  );
}
