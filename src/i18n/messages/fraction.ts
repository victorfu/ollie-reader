/**
 * "fraction.*" strings. Keep zh and en on the same keys: the en object is typed
 * against the zh keys, so a missing translation fails tsc.
 */
export const fractionZh = {
  "fraction.title": "分數計算機",
  "fraction.subtitle": "分數與帶分數的加減乘除，並列出每一步算式",
  "fraction.first": "第一個分數",
  "fraction.second": "第二個分數",
  "fraction.whole": "整數",
  "fraction.numerator": "分子",
  "fraction.denominator": "分母",
  "fraction.operator": "運算符號",
  "fraction.op.add": "加",
  "fraction.op.subtract": "減",
  "fraction.op.multiply": "乘",
  "fraction.op.divide": "除",
  "fraction.steps": "計算過程",
  "fraction.hint": "請填好分子和分母（整數部分可留空）",
  "fraction.reset": "重設",
  "fraction.error.divideByZero": "錯誤：不能除以零",
  "fraction.error.notInteger": "錯誤：請輸入整數",
  "fraction.error.mixedSign": "錯誤：帶分數的分子和分母不能是負數，負號請寫在整數部分",
} as const;

export const fractionEn: Record<keyof typeof fractionZh, string> = {
  "fraction.title": "Fraction Calculator",
  "fraction.subtitle": "Add, subtract, multiply and divide fractions and mixed numbers, step by step",
  "fraction.first": "First fraction",
  "fraction.second": "Second fraction",
  "fraction.whole": "Whole",
  "fraction.numerator": "Numerator",
  "fraction.denominator": "Denominator",
  "fraction.operator": "Operator",
  "fraction.op.add": "Add",
  "fraction.op.subtract": "Subtract",
  "fraction.op.multiply": "Multiply",
  "fraction.op.divide": "Divide",
  "fraction.steps": "Working",
  "fraction.hint": "Fill in the numerators and denominators (the whole-number part is optional)",
  "fraction.reset": "Reset",
  "fraction.error.divideByZero": "Error: you can’t divide by zero",
  "fraction.error.notInteger": "Error: please enter whole numbers",
  "fraction.error.mixedSign": "Error: in a mixed number, put the minus sign on the whole part, not the numerator or denominator",
};
