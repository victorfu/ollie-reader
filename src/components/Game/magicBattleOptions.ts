import type { GameWord } from "../../services/gameService";

export interface MagicBattleOptions {
  definitions: string[];
  correctDefinitionIndex: number;
}

function normalizeVisibleText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/**
 * Build four visually distinct definitions. Different words can legitimately
 * share the same translation, so choosing distractors by word alone can render
 * two identical buttons and make the question ambiguous.
 */
export function buildMagicBattleOptions(
  target: GameWord,
  candidates: readonly GameWord[],
  random: () => number = Math.random,
): MagicBattleOptions {
  const targetWordKey = normalizeVisibleText(target.word);
  const targetDefinition = target.def.trim();
  const usedDefinitions = new Set([normalizeVisibleText(targetDefinition)]);
  const uniqueDistractors: string[] = [];

  for (const candidate of shuffle(candidates, random)) {
    if (normalizeVisibleText(candidate.word) === targetWordKey) continue;
    const definition = candidate.def.trim();
    const definitionKey = normalizeVisibleText(definition);
    if (!definitionKey || usedDefinitions.has(definitionKey)) continue;
    usedDefinitions.add(definitionKey);
    uniqueDistractors.push(definition);
    if (uniqueDistractors.length === 3) break;
  }

  const choices = shuffle(
    [
      { definition: targetDefinition, correct: true },
      ...uniqueDistractors.map((definition) => ({
        definition,
        correct: false,
      })),
    ],
    random,
  );

  return {
    definitions: choices.map((choice) => choice.definition),
    correctDefinitionIndex: choices.findIndex((choice) => choice.correct),
  };
}
