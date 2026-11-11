/**
 * "fraction.*" strings. Keep zh and en on the same keys: the en object is typed
 * against the zh keys, so a missing translation fails tsc.
 */
export const fractionZh = {
  "fraction.title": "分數計算機",
  "fraction.subtitle": "進行分數的加減乘除運算，並列出每一步算式",
  "fraction.first": "第一個分數",
  "fraction.second": "第二個分數",
  "fraction.numerator": "分子",
  "fraction.denominator": "分母",
  "fraction.operator": "運算符號",
  "fraction.op.add": "加",
  "fraction.op.subtract": "減",
  "fraction.op.multiply": "乘",
  "fraction.op.divide": "除",
  "fraction.steps": "計算過程",
  "fraction.hint": "請輸入四個整數",
  "fraction.reset": "重設",
  "fraction.error.divideByZero": "錯誤：不能除以零",
  "fraction.error.notInteger": "錯誤：請輸入整數",
} as const;

export const fractionEn: Record<keyof typeof fractionZh, string> = {
  "fraction.title": "Fraction Calculator",
  "fraction.subtitle": "Add, subtract, multiply and divide fractions, step by step",
  "fraction.first": "First fraction",
  "fraction.second": "Second fraction",
  "fraction.numerator": "Numerator",
  "fraction.denominator": "Denominator",
  "fraction.operator": "Operator",
  "fraction.op.add": "Add",
  "fraction.op.subtract": "Subtract",
  "fraction.op.multiply": "Multiply",
  "fraction.op.divide": "Divide",
  "fraction.steps": "Working",
  "fraction.hint": "Enter four whole numbers",
  "fraction.reset": "Reset",
  "fraction.error.divideByZero": "Error: you can’t divide by zero",
  "fraction.error.notInteger": "Error: please enter whole numbers",
};
