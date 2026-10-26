import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("../../services/gameService", () => ({ playSound: vi.fn() }));
vi.mock("../../hooks/useSpeechState", () => ({
  useSpeechState: () => ({ speak: vi.fn() }),
}));

import { BossBattle } from "./BossBattle";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { BossState, QuizState, Stage } from "../../types/game";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const stage: Stage = {
  id: "boss-24",
  name: "宇宙之王",
  stageNumber: 75,
  isBoss: true,
  requiredLevel: 39,
  rewardExp: 0,
  questionCount: 19,
  bossHp: 15,
  bossPhases: [["meaning"], ["meaning"], ["meaning"]],
  bossShield: true,
};

const quiz = (isAnswered: boolean): QuizState => ({
  questions: [
    {
      kind: "meaning",
      word: "apple",
      prompt: "apple",
      options: ["蘋果", "狗", "貓", "書"],
      correctIndex: 0,
    },
  ],
  currentIndex: 0,
  timeLeft: 60,
  lives: 3,
  maxLives: 3,
  score: 0,
  combo: 0,
  maxCombo: 0,
  isAnswered,
  lastAnswerCorrect: isAnswered ? true : null,
});

const boss = (over: Partial<BossState>): BossState => ({
  bossHp: 15,
  bossMaxHp: 15,
  lastHit: null,
  phase: 0,
  phaseCount: 3,
  enteredPhase: false,
  shielded: false,
  wrongStreak: 0,
  ...over,
});

function renderBattle(bossState: BossState, isAnswered = false) {
  act(() =>
    root.render(
      <LanguageProvider>
        <BossBattle
          stage={stage}
          quizState={quiz(isAnswered)}
          bossState={bossState}
          timeLimit={60}
          onSubmitAnswer={vi.fn()}
          onAdvanceQuestion={vi.fn()}
          onTickTimer={vi.fn()}
          onQuit={vi.fn()}
          isSettling={false}
        />
      </LanguageProvider>,
    ),
  );
}

describe("BossBattle phases and shield", () => {
  it("shows the phase and the phase look", () => {
    renderBattle(boss({}));
    expect(container.textContent).toContain("第 1/3 階段");
    expect(container.textContent).toContain("👑");
    expect(container.textContent).toContain("📍宇宙之王");

    renderBattle(boss({ bossHp: 4, phase: 2 }));
    expect(container.textContent).toContain("第 3/3 階段");
    expect(container.textContent).toContain("💥");
    expect(container.textContent).toContain("宇宙之王 · 超新星");
  });

  it("announces a new phase right after the hit that caused it", () => {
    renderBattle(boss({ bossHp: 10, phase: 1, enteredPhase: true }), true);
    expect(container.textContent).toContain("魔王進入第 2 階段！");
  });

  it("shows the shield and when it breaks", () => {
    renderBattle(boss({ shielded: true, wrongStreak: 2, lastHit: "player" }), true);
    expect(container.textContent).toContain("護盾中");
    expect(container.textContent).toContain("魔王張開護盾！");

    renderBattle(boss({ lastHit: "shield" }), true);
    expect(container.textContent).not.toContain("護盾中");
    expect(container.textContent).toContain("護盾被打破了！");
  });

  it("hides the phase badge for a single-phase boss", () => {
    renderBattle(boss({ phaseCount: 1 }));
    expect(container.textContent).not.toContain("階段");
  });
});
