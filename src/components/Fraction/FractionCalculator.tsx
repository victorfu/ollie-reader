import { useId, useState } from "react";
import { Divide, Minus, Plus, RotateCcw, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import type { MessageKey } from "../../i18n/translate";
import { T } from "../common/T";
import {
  computeFractionSteps,
  parseFractionInput,
  type Fraction,
  type FractionOperator,
  type FractionStep,
  type MixedNumber,
} from "../../utils/fraction";

interface FractionDraft {
  /** Optional whole-number part of a mixed number. */
  whole: string;
  num: string;
  den: string;
}

const OPERATORS: { value: FractionOperator; icon: LucideIcon; labelKey: MessageKey }[] = [
  { value: "+", icon: Plus, labelKey: "fraction.op.add" },
  { value: "-", icon: Minus, labelKey: "fraction.op.subtract" },
  { value: "*", icon: X, labelKey: "fraction.op.multiply" },
  { value: "/", icon: Divide, labelKey: "fraction.op.divide" },
];

const OPERATOR_SYMBOL: Record<FractionOperator, string> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
};

const DEFAULT_DRAFT: FractionDraft = { whole: "", num: "1", den: "1" };

/** Show negatives with a proper minus sign instead of a hyphen. */
const formatPart = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

function StackedFraction({ fraction, large = false }: { fraction: Fraction; large?: boolean }) {
  return (
    <span
      className={`inline-flex flex-col items-center px-1 leading-tight tabular-nums ${
        large ? "text-2xl" : "text-xl"
      }`}
    >
      <span>{formatPart(fraction.num)}</span>
      <span aria-hidden className="my-0.5 h-px w-full min-w-6 bg-current" />
      <span>{formatPart(fraction.den)}</span>
    </span>
  );
}

function StepView({ step }: { step: FractionStep }) {
  if (step.kind === "pair") {
    return (
      <span className="inline-flex items-center gap-3">
        <StackedFraction fraction={step.left} />
        <span className="text-2xl font-semibold">{OPERATOR_SYMBOL[step.op]}</span>
        <StackedFraction fraction={step.right} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {step.negative && <span className="text-2xl font-semibold">−</span>}
      {step.whole !== undefined && (
        <span className="text-2xl font-semibold tabular-nums">{step.whole}</span>
      )}
      {step.fraction && <StackedFraction fraction={step.fraction} large />}
    </span>
  );
}

function FractionInput({
  value,
  onChange,
  labelKey,
}: {
  value: FractionDraft;
  onChange: (next: FractionDraft) => void;
  labelKey: MessageKey;
}) {
  const { t } = useLanguage();
  const inputClass =
    "rounded-[6px] border border-border-hairline bg-background/50 px-2 py-2 text-center text-xl tabular-nums shadow-sm placeholder:text-sm placeholder:text-base-content/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">{t(labelKey)}</legend>
      <input
        type="text"
        inputMode="numeric"
        className={`${inputClass} w-16`}
        value={value.whole}
        aria-label={`${t(labelKey)} ${t("fraction.whole")}`}
        placeholder={t("fraction.whole")}
        onChange={(e) => onChange({ ...value, whole: e.target.value })}
      />
      <span className="flex flex-col items-center">
        <input
          type="text"
          inputMode="numeric"
          className={`${inputClass} w-20`}
          value={value.num}
          aria-label={`${t(labelKey)} ${t("fraction.numerator")}`}
          placeholder={t("fraction.numerator")}
          onChange={(e) => onChange({ ...value, num: e.target.value })}
        />
        <span aria-hidden className="my-2 h-0.5 w-full rounded-full bg-base-content/80" />
        <input
          type="text"
          inputMode="numeric"
          className={`${inputClass} w-20`}
          value={value.den}
          aria-label={`${t(labelKey)} ${t("fraction.denominator")}`}
          placeholder={t("fraction.denominator")}
          onChange={(e) => onChange({ ...value, den: e.target.value })}
        />
      </span>
    </fieldset>
  );
}

type Outcome =
  | { kind: "empty" }
  | { kind: "error"; messageKey: MessageKey }
  | { kind: "steps"; steps: FractionStep[] };

type ParsedDraft = MixedNumber | "empty" | "invalid";

/**
 * The whole-number box is optional. A whole number on its own (fraction boxes
 * left blank) counts as that number, e.g. 3 → 3/1.
 */
function parseDraft(draft: FractionDraft): ParsedDraft {
  const [whole, num, den] = [draft.whole, draft.num, draft.den].map(parseFractionInput);
  if ([whole, num, den].includes("invalid")) return "invalid";
  if (typeof whole === "number" && num === "empty" && den === "empty") {
    return { num: whole, den: 1 };
  }
  if (typeof num !== "number" || typeof den !== "number") return "empty";
  return typeof whole === "number" ? { whole, num, den } : { num, den };
}

const ERROR_KEYS: Record<"divideByZero" | "mixedSign", MessageKey> = {
  divideByZero: "fraction.error.divideByZero",
  mixedSign: "fraction.error.mixedSign",
};

function evaluate(a: FractionDraft, op: FractionOperator, b: FractionDraft): Outcome {
  const parsed = [parseDraft(a), parseDraft(b)];
  if (parsed.includes("invalid")) {
    return { kind: "error", messageKey: "fraction.error.notInteger" };
  }
  const [left, right] = parsed;
  if (typeof left !== "object" || typeof right !== "object") return { kind: "empty" };
  const result = computeFractionSteps(left, op, right);
  if (!result.ok) return { kind: "error", messageKey: ERROR_KEYS[result.error] };
  return { kind: "steps", steps: result.steps };
}

export default function FractionCalculator() {
  const { t } = useLanguage();
  const operatorGroupId = useId();
  const [first, setFirst] = useState<FractionDraft>(DEFAULT_DRAFT);
  const [second, setSecond] = useState<FractionDraft>(DEFAULT_DRAFT);
  const [operator, setOperator] = useState<FractionOperator>("+");

  const outcome = evaluate(first, operator, second);

  const handleReset = () => {
    setFirst(DEFAULT_DRAFT);
    setSecond(DEFAULT_DRAFT);
    setOperator("+");
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            <T k="fraction.title" />
          </h1>
          <p className="mt-1 text-sm text-base-content/60">
            <T k="fraction.subtitle" />
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm gap-1.5" onClick={handleReset}>
          <RotateCcw className="size-4" aria-hidden />
          <T k="fraction.reset" />
        </button>
      </header>

      <section className="card rounded-[10px] border border-border-hairline bg-base-100 p-5 shadow-sm sm:p-8">
        <div className="flex flex-col items-center justify-center gap-4 md:flex-row md:gap-6">
          <FractionInput value={first} onChange={setFirst} labelKey="fraction.first" />
          <div
            role="radiogroup"
            aria-labelledby={operatorGroupId}
            className="grid grid-cols-4 gap-1.5 md:grid-cols-2"
          >
            <span id={operatorGroupId} className="sr-only">
              {t("fraction.operator")}
            </span>
            {OPERATORS.map(({ value, icon: Icon, labelKey }) => {
              const selected = value === operator;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={t(labelKey)}
                  onClick={() => setOperator(value)}
                  className={`flex size-11 items-center justify-center rounded-[6px] border transition-all duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    selected
                      ? "border-transparent bg-primary text-primary-content shadow-sm"
                      : "border-border-hairline bg-base-100 hover:bg-base-content/5"
                  }`}
                >
                  <Icon className="size-5" strokeWidth={2.25} aria-hidden />
                </button>
              );
            })}
          </div>
          <FractionInput value={second} onChange={setSecond} labelKey="fraction.second" />
        </div>
      </section>

      <section
        aria-live="polite"
        className="card rounded-[10px] border border-border-hairline bg-base-100 p-5 shadow-sm sm:p-8"
      >
        <h2 className="mb-4 text-sm font-semibold text-base-content/60">
          <T k="fraction.steps" />
        </h2>
        {outcome.kind === "empty" && (
          <p className="text-base-content/60">
            <T k="fraction.hint" />
          </p>
        )}
        {outcome.kind === "error" && (
          <p role="alert" className="rounded-[6px] bg-error/10 px-3 py-2 text-error">
            <T k={outcome.messageKey} />
          </p>
        )}
        {outcome.kind === "steps" && (
          <ol className="flex flex-col gap-4">
            {outcome.steps.map((step, index) => (
              <li key={index} className="flex items-center gap-4">
                <span className="text-2xl font-semibold text-base-content/50">=</span>
                <StepView step={step} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
