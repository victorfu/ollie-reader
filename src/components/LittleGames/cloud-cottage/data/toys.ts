import type { ToyDefinition, ToyId } from "../types";
import { TOY_IDS } from "../types";

export const TOYS: readonly ToyDefinition[] = [
  { id: "ball", nameZh: "皮球", nameEn: "Ball", price: 60, moodGain: 15, bondGain: 2 },
  { id: "frisbee", nameZh: "飛盤", nameEn: "Frisbee", price: 80, moodGain: 15, bondGain: 2 },
  { id: "bubble-machine", nameZh: "泡泡機", nameEn: "Bubble Machine", price: 100, moodGain: 15, bondGain: 2 },
  { id: "music-box", nameZh: "音樂盒", nameEn: "Music Box", price: 120, moodGain: 15, bondGain: 2 },
  { id: "cloud-swing", nameZh: "雲朵鞦韆", nameEn: "Cloud Swing", price: 150, moodGain: 15, bondGain: 2 },
] as const;

const TOY_BY_ID = new Map<ToyId, ToyDefinition>(TOYS.map((toy) => [toy.id, toy]));
const TOY_ID_SET = new Set<string>(TOY_IDS);

export function getToy(id: ToyId | string): ToyDefinition | undefined {
  return TOY_BY_ID.get(id as ToyId);
}

export function isToyId(value: unknown): value is ToyId {
  return typeof value === "string" && TOY_ID_SET.has(value);
}
