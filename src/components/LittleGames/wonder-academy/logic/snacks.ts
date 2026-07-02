export const SNACK_NAMES: Record<string, string> = {
  "starberry-cookie": "星莓餅乾",
  "moon-milk-puff": "月乳泡芙",
  "clover-macaron": "三葉草馬卡龍",
  "warm-cocoa-gem": "暖可可寶石",
};

export const SNACK_POOL = Object.keys(SNACK_NAMES);

export function isKnownSnack(snackId: string): boolean {
  return !!SNACK_NAMES[snackId];
}
