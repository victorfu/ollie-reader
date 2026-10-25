export type CompanionAction = "leftEar" | "rightEar" | "belly" | "wave" | "jump" | "twirl";
export type CompanionSlot = "head" | "face" | "neck" | "hand";
export type CompanionAccessory = "bow" | "hat" | "crown" | "glasses" | "scarf" | "plush";
export type CompanionOutfit = Partial<Record<CompanionSlot, CompanionAccessory>>;
