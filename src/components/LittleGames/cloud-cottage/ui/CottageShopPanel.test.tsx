import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialPetSave } from "../logic/petState";
import type { CottageProductId, PetSaveV1 } from "../types";

vi.mock("./CottagePanel", () => ({
  CottagePanel: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: ReactNode;
  }) =>
    open ? (
      <section role="dialog" aria-label={title}>
        {children}
      </section>
    ) : null,
}));

import {
  CottageShopPanel,
  type CottageShopCategory,
} from "./CottageShopPanel";

const NOW = new Date("2026-07-30T12:00:00+08:00").getTime();

let container: HTMLDivElement;
let root: Root;

function permanentSave(): PetSaveV1 {
  const initial = createInitialPetSave(NOW, "2026-07-30");
  return {
    ...initial,
    inventory: {
      ...initial.inventory,
      outfits: ["strawberry-clip"],
      furniture: [...initial.inventory.furniture, "lamp"],
      wallpapers: [...initial.inventory.wallpapers, "starry-night"],
      floors: [...initial.inventory.floors, "cloud-carpet"],
    },
  };
}

function productButton(productId: CottageProductId): HTMLButtonElement {
  const element = container.querySelector(`[data-product-id="${productId}"]`);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`product button not found: ${productId}`);
  }
  return element;
}

function categoryButton(category: CottageShopCategory): HTMLButtonElement {
  const element = container.querySelector(
    `[data-shop-category="${category}"]`,
  );
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`category button not found: ${category}`);
  }
  return element;
}

function ShopHarness({
  save,
  onPurchase,
  onOpenWardrobe = vi.fn(),
  onOpenDecorate = vi.fn(),
}: {
  save: PetSaveV1;
  onPurchase: (productId: CottageProductId) => void;
  onOpenWardrobe?: () => void;
  onOpenDecorate?: () => void;
}) {
  const [category, setCategory] = useState<CottageShopCategory>("outfit");
  return (
    <CottageShopPanel
      open
      save={save}
      coins={500}
      online
      busy={null}
      category={category}
      onCategoryChange={setCategory}
      onPurchase={onPurchase}
      onSpeak={vi.fn()}
      onClose={vi.fn()}
      onOpenWardrobe={onOpenWardrobe}
      onOpenDecorate={onOpenDecorate}
    />
  );
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("CottageShopPanel permanent ownership", () => {
  it("marks owned permanent products and keeps unowned products purchasable", () => {
    const onPurchase = vi.fn();
    const onOpenWardrobe = vi.fn();
    const onOpenDecorate = vi.fn();
    act(() => {
      root.render(
        <ShopHarness
          save={permanentSave()}
          onPurchase={onPurchase}
          onOpenWardrobe={onOpenWardrobe}
          onOpenDecorate={onOpenDecorate}
        />,
      );
    });

    expect(productButton("strawberry-clip").disabled).toBe(true);
    expect(productButton("strawberry-clip").textContent).toContain("已擁有");
    expect(productButton("strawberry-clip").getAttribute("aria-label")).toBe(
      "草莓髮夾 已擁有",
    );
    expect(productButton("sailor-hat").disabled).toBe(false);
    act(() => productButton("sailor-hat").click());
    expect(onPurchase).toHaveBeenLastCalledWith("sailor-hat");

    const wardrobeShortcut = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "打開衣櫥",
    );
    act(() => wardrobeShortcut?.click());
    expect(onOpenWardrobe).toHaveBeenCalledTimes(1);

    act(() => categoryButton("furniture").click());
    expect(categoryButton("furniture").getAttribute("aria-selected")).toBe("true");
    expect(productButton("lamp").disabled).toBe(true);
    expect(productButton("plant").disabled).toBe(false);
    act(() => productButton("plant").click());
    expect(onPurchase).toHaveBeenLastCalledWith("plant");

    const decorateShortcut = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "佈置房間",
    );
    act(() => decorateShortcut?.click());
    expect(onOpenDecorate).toHaveBeenCalledTimes(1);

    act(() => categoryButton("wallpaper").click());
    expect(productButton("starry-night").disabled).toBe(true);
    expect(productButton("candy-stripes").disabled).toBe(false);

    act(() => categoryButton("floor").click());
    expect(productButton("cloud-carpet").disabled).toBe(true);
    expect(productButton("frosting-check").disabled).toBe(false);
  });

  it("disables purchases while offline but still exposes owned products", () => {
    const save = permanentSave();
    act(() => {
      root.render(
        <CottageShopPanel
          open
          save={save}
          coins={500}
          online={false}
          busy={null}
          category="furniture"
          onCategoryChange={vi.fn()}
          onPurchase={vi.fn()}
          onSpeak={vi.fn()}
          onClose={vi.fn()}
          onOpenWardrobe={vi.fn()}
          onOpenDecorate={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "已經擁有的物品仍可查看",
    );
    expect(productButton("lamp").textContent).toContain("已擁有");
    expect(productButton("plant").disabled).toBe(true);
  });
});
