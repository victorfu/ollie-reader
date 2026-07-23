export type Rng = () => number;

// mulberry32 — small, fast, deterministic PRNG. Returns a float in [0, 1).
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 同樣的 mulberry32，但狀態存在 BattleState 上而不是 closure 裡，
 * 這樣整個戰鬥狀態可以序列化、也能在測試裡精確重現。
 */
export function nextRandom(state: { rngState: number }): number {
  let a = state.rngState | 0;
  a = (a + 0x6d2b79f5) | 0;
  state.rngState = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
