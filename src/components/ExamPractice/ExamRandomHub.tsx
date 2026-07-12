import { useState } from "react";
import { Play, Shuffle } from "lucide-react";
import type { ExamTab } from "../../types/exam";
import {
  MIXED_POOL_TOTAL,
  MIXED_SUBJECTS,
  mixedCountOptions,
} from "../../data/exams/mixed";
import { ExamSubjectSwitcher } from "./ExamSubjectSwitcher";

const DEFAULT_COUNT = 30;

interface ExamRandomHubProps {
  tab: ExamTab;
  onSelectSubject: (tab: ExamTab) => void;
  /** 以指定題數隨機組卷並直接開始作答。 */
  onGenerate: (count: number) => void;
}

/** 綜合 tab 的列表視圖:選題數 → 產生隨機綜合卷。 */
export function ExamRandomHub({
  tab,
  onSelectSubject,
  onGenerate,
}: ExamRandomHubProps) {
  const [count, setCount] = useState(DEFAULT_COUNT);
  const base = Math.floor(count / MIXED_SUBJECTS.length);
  const remainder = count % MIXED_SUBJECTS.length;
  const composition =
    remainder === 0
      ? `國語、數學、英文各 ${base} 題`
      : `國語、數學、英文各 ${base}～${base + 1} 題（隨機分配）`;

  return (
    <div className="flex flex-col gap-5">
      <ExamSubjectSwitcher value={tab} onSelect={onSelectSubject} />

      <article className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-border-hairline bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
            <Shuffle size={20} strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">隨機綜合卷</h2>
            <p className="text-xs text-muted-foreground">
              從三科題庫（共 {MIXED_POOL_TOTAL} 題）隨機抽題
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          每次產生都是一張新考卷：三科平均分配、題目不重複，依國語→數學→英文排列。隨機卷不記錄最佳成績。
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">題數</span>
          <select
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            aria-label="選擇題數"
            className="select select-bordered min-h-[48px] w-full rounded-xl bg-background/50 text-base focus-visible:ring-2 focus-visible:ring-accent"
          >
            {mixedCountOptions().map((option) => (
              <option key={option} value={option}>
                {option} 題
              </option>
            ))}
          </select>
        </label>

        <p className="text-sm text-muted-foreground">{composition}</p>

        <button
          type="button"
          onClick={() => onGenerate(count)}
          className="btn btn-primary min-h-[48px] w-full gap-1.5 rounded-xl"
        >
          <Play size={18} strokeWidth={2} />
          產生考卷並開始
        </button>
      </article>

      <p className="text-center text-xs text-muted-foreground">
        答完每一題會立即顯示對錯與解析，錯題可以馬上重練！
      </p>
    </div>
  );
}
