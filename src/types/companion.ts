export type CompanionAction = "leftEar" | "rightEar" | "belly" | "wave" | "jump" | "twirl";
export type CompanionSlot = "head" | "face" | "neck" | "hand";
export type CompanionAccessory = "bow" | "hat" | "crown" | "glasses" | "scarf" | "plush";
export type CompanionOutfit = Partial<Record<CompanionSlot, CompanionAccessory>>;

/** A signed-in player's bought accessories and what the companion wears. */
export interface CompanionWardrobe {
  owned: ReadonlySet<CompanionAccessory>;
  /** Only ever holds owned accessories, each in its own slot. */
  equipped: CompanionOutfit;
}
