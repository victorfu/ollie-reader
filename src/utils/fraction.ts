/**
 * Step-by-step fraction arithmetic for the fraction calculator page.
 * Each step is one line of working a student would write down.
 */

export interface Fraction {
  num: number;
  den: number;
}

export type FractionOperator = "+" | "-" | "*" | "/";

export type FractionStep =
  | { kind: "pair"; left: Fraction; op: "+" | "*"; right: Fraction }
  | {
      kind: "value";
      /** Leading minus sign shown in front of the whole / fraction part. */
      negative?: boolean;
      whole?: number;
      fraction?: Fraction;
    };

export type FractionResult =
  | { ok: true; steps: FractionStep[] }
  | { ok: false; error: "divideByZero" };

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
};

const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b);

/** Parse one input box: an integer, "empty" (still typing) or "invalid". */
export function parseFractionInput(raw: string): number | "empty" | "invalid" {
  const text = raw.trim();
  if (text === "" || text === "-") return "empty";
  if (!/^-?\d+$/.test(text)) return "invalid";
  return Number(text);
}

export function computeFractionSteps(
  a: Fraction,
  operator: FractionOperator,
  b: Fraction,
): FractionResult {
  if (a.den === 0 || b.den === 0 || (operator === "/" && b.num === 0)) {
    return { ok: false, error: "divideByZero" };
  }

  const steps: FractionStep[] = [];
  let left = a;
  let right = b;
  let op: "+" | "*";

  // Subtraction → add the opposite; division → multiply by the reciprocal.
  if (operator === "-") {
    right = { num: -b.num, den: b.den };
    op = "+";
    steps.push({ kind: "pair", left, op, right });
  } else if (operator === "/") {
    right = { num: b.den, den: b.num };
    op = "*";
    steps.push({ kind: "pair", left, op, right });
  } else {
    op = operator === "+" ? "+" : "*";
  }

  let value: Fraction;
  if (op === "*") {
    value = { num: left.num * right.num, den: left.den * right.den };
  } else if (left.den === right.den) {
    value = { num: left.num + right.num, den: left.den };
  } else {
    const common = lcm(left.den, right.den);
    left = { num: left.num * (common / left.den), den: common };
    right = { num: right.num * (common / right.den), den: common };
    steps.push({ kind: "pair", left, op, right });
    value = { num: left.num + right.num, den: common };
  }
  steps.push({ kind: "value", fraction: value });

  // Simplify: whole-number shortcuts, then sign, reduction and mixed number.
  if (value.num === 0) {
    steps.push({ kind: "value", whole: 0 });
    return { ok: true, steps };
  }
  if (Math.abs(value.num) === Math.abs(value.den)) {
    steps.push({ kind: "value", whole: value.num === value.den ? 1 : -1 });
    return { ok: true, steps };
  }

  const negative = value.num < 0 !== value.den < 0;
  const factor = gcd(value.num, value.den);
  const num = Math.abs(value.num) / factor;
  const den = Math.abs(value.den) / factor;
  const signChanged = negative || value.den < 0;
  if (factor > 1 || signChanged) {
    steps.push({ kind: "value", ...(negative && { negative }), fraction: { num, den } });
  }

  if (num > den) {
    const whole = Math.floor(num / den);
    const rest = num % den;
    steps.push({
      kind: "value",
      ...(negative && { negative }),
      whole,
      ...(rest !== 0 && { fraction: { num: rest, den } }),
    });
  }

  return { ok: true, steps };
}
