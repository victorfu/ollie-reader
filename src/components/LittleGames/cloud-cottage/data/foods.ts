import type { FoodDefinition, FoodId, FreeFoodId, SnackId } from "../types";
import { FREE_FOOD_IDS, SNACK_IDS } from "../types";

export const FREE_FOODS = [
  { id: "milk", kind: "free", nameZh: "牛奶", nameEn: "Milk", price: 0, fullnessGain: 30, moodGain: 0, bondGain: 3 },
  { id: "cookie", kind: "free", nameZh: "小餅乾", nameEn: "Cookie", price: 0, fullnessGain: 30, moodGain: 0, bondGain: 3 },
] as const satisfies readonly FoodDefinition[];

export const SNACKS = [
  { id: "apple", kind: "snack", nameZh: "蘋果", nameEn: "Apple", price: 15, fullnessGain: 45, moodGain: 10, bondGain: 6 },
  { id: "banana-yogurt", kind: "snack", nameZh: "香蕉優格", nameEn: "Banana Yogurt", price: 20, fullnessGain: 45, moodGain: 10, bondGain: 6 },
  { id: "pudding", kind: "snack", nameZh: "布丁", nameEn: "Pudding", price: 25, fullnessGain: 45, moodGain: 10, bondGain: 6 },
  { id: "honey-toast", kind: "snack", nameZh: "蜂蜜吐司", nameEn: "Honey Toast", price: 25, fullnessGain: 45, moodGain: 10, bondGain: 6 },
  { id: "strawberry-pancake", kind: "snack", nameZh: "草莓鬆餅", nameEn: "Strawberry Pancake", price: 30, fullnessGain: 45, moodGain: 10, bondGain: 6 },
  { id: "cinnamon-roll", kind: "snack", nameZh: "肉桂捲", nameEn: "Cinnamon Roll", price: 30, fullnessGain: 45, moodGain: 10, bondGain: 6 },
  { id: "rainbow-donut", kind: "snack", nameZh: "彩虹甜甜圈", nameEn: "Rainbow Donut", price: 35, fullnessGain: 45, moodGain: 10, bondGain: 6 },
  { id: "cloud-cake", kind: "snack", nameZh: "雲朵蛋糕", nameEn: "Cloud Cake", price: 40, fullnessGain: 45, moodGain: 10, bondGain: 6 },
] as const satisfies readonly FoodDefinition[];

export const FOODS: readonly FoodDefinition[] = [...FREE_FOODS, ...SNACKS];

const FOOD_BY_ID = new Map<FoodId, FoodDefinition>(FOODS.map((food) => [food.id, food]));
const FREE_FOOD_ID_SET = new Set<string>(FREE_FOOD_IDS);
const SNACK_ID_SET = new Set<string>(SNACK_IDS);

export function getFood(id: FoodId | string): FoodDefinition | undefined {
  return FOOD_BY_ID.get(id as FoodId);
}

export function isFreeFoodId(value: unknown): value is FreeFoodId {
  return typeof value === "string" && FREE_FOOD_ID_SET.has(value);
}

export function isSnackId(value: unknown): value is SnackId {
  return typeof value === "string" && SNACK_ID_SET.has(value);
}

export function isFoodId(value: unknown): value is FoodId {
  return isFreeFoodId(value) || isSnackId(value);
}
