import type { Homework, HomeworkWordProgress } from "../../types/wordPractice";
import type { StepId } from "../../utils/homeworkProgress";

/** What the page hands to every practice step component. */
export interface StepProps {
  homework: Homework;
  /** Replaces the homework's progress with the full, latest array (and saves it). */
  onProgress: (next: HomeworkWordProgress[]) => void;
  /** Leaves the step and returns to the homework overview. */
  onExit: () => void;
}

/** The names Ollie sees for each step. They stay English, like the exercises. */
export const STEP_LABELS: Record<StepId, string> = {
  learn: "Learn",
  spell: "Spell It",
  fill: "Fill in the Blank",
  define: "What's the Word?",
  sentence: "Write a Sentence",
  test: "Spelling Test",
};
