import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ExamPracticePage from "./ExamPracticePage";

let container: HTMLDivElement;
let root: Root;
let currentSearch = "";

function LocationProbe() {
  const location = useLocation();
  useEffect(() => {
    currentSearch = location.search;
  }, [location.search]);
  return <ExamPracticePage />;
}

async function renderAt(entry: string): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
      </MemoryRouter>,
    );
  });
}

function subjectButton(label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`subject button not found: ${label}`);
  }
  return button;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
  });
  window.localStorage.clear();
  currentSearch = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ExamPracticePage subject query", () => {
  it("redirects bare /exams to the canonical chinese query", async () => {
    await renderAt("/exams");

    expect(currentSearch).toBe("?subject=chinese");
    expect(container.textContent).toContain("四年級國語練習卷");
  });

  it("keeps both subjects explicit when switching", async () => {
    await renderAt("/exams?subject=math");
    expect(currentSearch).toBe("?subject=math");
    expect(container.textContent).toContain("四年級數學練習卷");

    await act(async () => {
      subjectButton("國語").click();
    });

    expect(currentSearch).toBe("?subject=chinese");
  });
});
