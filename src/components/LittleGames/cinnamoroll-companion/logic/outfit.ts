import type { CompanionAccessory, CompanionOutfit, CompanionSlot } from "../../../../types/companion";

export const ACCESSORIES: ReadonlyArray<{ id: CompanionAccessory; slot: CompanionSlot; label: string }> = [
  { id: "bow", slot: "head", label: "藍蝴蝶結" },
  { id: "hat", slot: "head", label: "粉帽" },
  { id: "crown", slot: "head", label: "皇冠" },
  { id: "glasses", slot: "face", label: "星星眼鏡" },
  { id: "scarf", slot: "neck", label: "圍巾" },
  { id: "plush", slot: "hand", label: "手持玩偶" },
];

/** Preview only: never grants ownership or writes a player save. */
export function previewAccessory(outfit: CompanionOutfit, id: CompanionAccessory): CompanionOutfit {
  const item = ACCESSORIES.find((candidate) => candidate.id === id)!;
  const next = { ...outfit };
  if (next[item.slot] === id) delete next[item.slot];
  else next[item.slot] = id;
  return next;
}
