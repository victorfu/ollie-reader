import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "../../contexts/LanguageContext";
import FractionCalculator from "./FractionCalculator";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <LanguageProvider>
        <FractionCalculator />
      </LanguageProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const inputs = () => Array.from(container.querySelectorAll<HTMLInputElement>("input"));

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const stepTexts = () =>
  Array.from(container.querySelectorAll("ol > li")).map((li) => li.textContent);

describe("<FractionCalculator>", () => {
  it("shows the working for mixed numbers: 2 1/3 + 1/2", () => {
    const [aw, an, ad, , bn, bd] = inputs();
    type(aw, "2");
    type(an, "1");
    type(ad, "3");
    type(bn, "1");
    type(bd, "2");

    expect(stepTexts()).toEqual(["=73+12", "=146+36", "=176", "=256"]);
  });

  it("treats a whole number on its own as that number", () => {
    const [aw, an, ad] = inputs();
    type(aw, "3");
    type(an, "");
    type(ad, "");

    // 3 + 1/1 (the second fraction keeps its default)
    expect(stepTexts()).toEqual(["=41", "=4"]);
  });

  it("rejects a negative numerator in a mixed number", () => {
    const [aw, an] = inputs();
    type(aw, "1");
    type(an, "-1");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "錯誤：帶分數的分子和分母不能是負數，負號請寫在整數部分",
    );
  });

  it("shows the working for 1/2 − 3/4", () => {
    const [, an, ad, , bn, bd] = inputs();
    type(an, "1");
    type(ad, "2");
    type(bn, "3");
    type(bd, "4");
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="減"]')!.click());

    expect(stepTexts()).toEqual(["=12+−34", "=24+−34", "=−14", "=−14"]);
  });

  it("shows an error when dividing by zero and when typing a decimal", () => {
    const [, , , , bn] = inputs();
    type(bn, "0");
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="除"]')!.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("錯誤：不能除以零");

    type(bn, "1.5");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("錯誤：請輸入整數");
  });

  it("shows a hint while an input is blank", () => {
    type(inputs()[1], "");
    expect(container.textContent).toContain("請填好分子和分母");
    expect(container.querySelector("ol")).toBeNull();
  });
});
