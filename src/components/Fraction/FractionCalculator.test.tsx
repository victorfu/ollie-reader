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
  it("shows the working for 1/2 − 3/4", () => {
    const [an, ad, bn, bd] = inputs();
    type(an, "1");
    type(ad, "2");
    type(bn, "3");
    type(bd, "4");
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="減"]')!.click());

    expect(stepTexts()).toEqual(["=12+−34", "=24+−34", "=−14", "=−14"]);
  });

  it("shows an error when dividing by zero and when typing a decimal", () => {
    const [, , bn] = inputs();
    type(bn, "0");
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="除"]')!.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("錯誤：不能除以零");

    type(bn, "1.5");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("錯誤：請輸入整數");
  });

  it("shows a hint while an input is blank", () => {
    type(inputs()[0], "");
    expect(container.textContent).toContain("請輸入四個整數");
    expect(container.querySelector("ol")).toBeNull();
  });
});
