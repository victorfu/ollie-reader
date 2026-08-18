export type SteeringDirection = -1 | 0 | 1;

export function getKeyboardSteeringDirection(key: string): SteeringDirection {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey === "arrowleft" || normalizedKey === "a") return -1;
  if (normalizedKey === "arrowright" || normalizedKey === "d") return 1;
  return 0;
}

export function isDashKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();
  return (
    normalizedKey === " " ||
    normalizedKey === "k" ||
    normalizedKey === "shift"
  );
}

export function getTouchDirection(
  touchPointers: ReadonlyMap<number, Exclude<SteeringDirection, 0>>,
): SteeringDirection {
  let direction = 0;
  for (const pointerDirection of touchPointers.values()) {
    direction += pointerDirection;
  }
  return direction < 0 ? -1 : direction > 0 ? 1 : 0;
}

export function shouldCountTutorialDash(step: number): boolean {
  return step === 3;
}

// 最後一步按下衝刺後保留的收尾時間：足夠讓衝刺位移與粒子演完
export const TUTORIAL_FINALE_SECONDS = 1.6;

export function isTutorialFinaleOver(finaleSeconds: number): boolean {
  return finaleSeconds >= TUTORIAL_FINALE_SECONDS;
}
