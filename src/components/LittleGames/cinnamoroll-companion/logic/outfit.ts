import type { CompanionAccessory, CompanionOutfit, CompanionSlot } from "../../../../types/companion";

/**
 * Shop prices in gacha tokens (one adventure stage is about 65, one gacha
 * spin 50). Adjust here after calibrating against real stage rewards; the
 * Firestore rules fragment `companion-wardrobe-firestore-rules.fragment`
 * repeats them and must be changed together.
 */
export const COMPANION_PRICES: Readonly<Record<CompanionAccessory, number>> = {
  bow: 50,
  hat: 100,
  crown: 300,
  glasses: 120,
  scarf: 150,
  plush: 180,
};

export const ACCESSORIES: ReadonlyArray<{ id: CompanionAccessory; slot: CompanionSlot; label: string; price: number }> = [
  { id: "bow", slot: "head", label: "藍蝴蝶結", price: COMPANION_PRICES.bow },
  { id: "hat", slot: "head", label: "粉帽", price: COMPANION_PRICES.hat },
  { id: "crown", slot: "head", label: "皇冠", price: COMPANION_PRICES.crown },
  { id: "glasses", slot: "face", label: "星星眼鏡", price: COMPANION_PRICES.glasses },
  { id: "scarf", slot: "neck", label: "圍巾", price: COMPANION_PRICES.scarf },
  { id: "plush", slot: "hand", label: "手持玩偶", price: COMPANION_PRICES.plush },
];

export function isCompanionAccessory(value: unknown): value is CompanionAccessory {
  return typeof value === "string" && ACCESSORIES.some((item) => item.id === value);
}

export function accessorySlot(id: CompanionAccessory): CompanionSlot {
  return ACCESSORIES.find((candidate) => candidate.id === id)!.slot;
}

/** Preview only: never grants ownership or writes a player save. */
export function previewAccessory(outfit: CompanionOutfit, id: CompanionAccessory): CompanionOutfit {
  const slot = accessorySlot(id);
  const next = { ...outfit };
  if (next[slot] === id) delete next[slot];
  else next[slot] = id;
  return next;
}

/**
 * What the companion shows: saved equipment, with any free try-ons of
 * accessories the player does not own layered over their slots.
 */
export interface OutfitView {
  equipped: CompanionOutfit;
  trial: CompanionOutfit;
}

export function shownOutfit({ equipped, trial }: OutfitView): CompanionOutfit {
  return { ...equipped, ...trial };
}

/**
 * Tapping an accessory in the wardrobe. An owned one is put on or taken off
 * the saved equipment; any other one is only tried on, so a try-on can never
 * reach the saved equipment.
 */
export function wearAccessory(
  view: OutfitView,
  id: CompanionAccessory,
  owned: ReadonlySet<CompanionAccessory>,
): OutfitView {
  const slot = accessorySlot(id);
  const shown = shownOutfit(view)[slot] === id;
  const trial = { ...view.trial };
  delete trial[slot];
  if (!owned.has(id)) return { equipped: view.equipped, trial: shown ? trial : { ...trial, [slot]: id } };
  const equipped = { ...view.equipped };
  if (shown) {
    if (equipped[slot] === id) delete equipped[slot];
  } else {
    equipped[slot] = id;
  }
  return { equipped, trial };
}

export function sameOutfit(a: CompanionOutfit, b: CompanionOutfit): boolean {
  const slots = new Set([...Object.keys(a), ...Object.keys(b)] as CompanionSlot[]);
  return [...slots].every((slot) => a[slot] === b[slot]);
}
