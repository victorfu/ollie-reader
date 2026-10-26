import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Object3D, Vector3 } from "three";
import type { CompanionWardrobe } from "../../../types/companion";
import type { CompanionSceneProps } from "./CompanionScene";
import CompanionPage from "./CompanionPage";
import { advanceSpin, applySpin, releaseSpin, turnSpin } from "./logic/spin";

// jsdom has no WebGL; the 3D scene is replaced by a plain element that
// exposes the props the page hands it.
let sceneProps: CompanionSceneProps | null = null;
vi.mock("./CompanionScene", () => ({
  default: (props: CompanionSceneProps) => {
    sceneProps = props;
    return <div data-scene="" />;
  },
}));

const auth = vi.hoisted(() => ({ user: null as { uid: string } | null }));
const cloud = vi.hoisted(() => ({
  onWardrobe: null as ((wardrobe: CompanionWardrobe) => void) | null,
  onBalance: null as ((value: number) => void) | null,
  purchase: vi.fn(),
  save: vi.fn(),
}));
vi.mock("../../../hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("../../../services/gameProgressService", () => ({
  subscribeTokenBalance: (_uid: string, onBalance: (value: number) => void) => {
    cloud.onBalance = onBalance;
    return () => undefined;
  },
}));
vi.mock("./companionWardrobeStorage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./companionWardrobeStorage")>()),
  subscribeCompanionWardrobe: async (_uid: string, onWardrobe: (wardrobe: CompanionWardrobe) => void) => {
    cloud.onWardrobe = onWardrobe;
    return () => undefined;
  },
  purchaseCompanionAccessory: cloud.purchase,
  saveCompanionEquipment: cloud.save,
}));

let container: HTMLDivElement;
let root: Root;

function setWebGL(available: boolean) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => (available ? ({} as RenderingContext) : null),
  );
}

function button(label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!match) throw new Error(`button not found: ${label}`);
  return match;
}

function pat() {
  act(() => button("動作").click());
  act(() => button("摸摸頭").click());
}

async function renderPage(onExit = vi.fn()) {
  await act(async () => {
    root.render(<CompanionPage onExit={onExit} />);
  });
  return onExit;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  sceneProps = null;
  auth.user = null;
  cloud.onWardrobe = null;
  cloud.onBalance = null;
  cloud.purchase.mockReset();
  cloud.save.mockReset().mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("CompanionPage", () => {
  it("previews six accessories, replaces headwear, removes items and performs actions", async () => {
    setWebGL(true);
    await renderPage();
    act(() => button("換裝").click());
    expect(container.textContent).toContain("不代表擁有");
    act(() => button("藍蝴蝶結").click());
    expect(sceneProps?.outfit).toEqual({ head: "bow" });
    expect(button("藍蝴蝶結").textContent).toContain("試穿中");
    act(() => button("皇冠").click());
    act(() => button("圍巾").click());
    expect(sceneProps?.outfit).toEqual({ head: "crown", neck: "scarf" });
    act(() => button("皇冠").click());
    expect(sceneProps?.outfit).toEqual({ neck: "scarf" });
    act(() => button("全部卸除").click());
    expect(sceneProps?.outfit).toEqual({});
    act(() => (container.querySelector('[aria-label="關閉"]') as HTMLButtonElement).click());
    act(() => button("動作").click());
    act(() => button("跳一跳").click());
    expect(sceneProps?.runtime.performance?.action).toBe("jump");
    expect(container.querySelector("dialog")).toBeNull();
    expect(cloud.purchase).not.toHaveBeenCalled();
    expect(cloud.save).not.toHaveBeenCalled();
  });

  it("lets a guest browse and try on shop items but not buy them", async () => {
    setWebGL(true);
    await renderPage();
    act(() => button("商店").click());

    expect(container.textContent).toContain("登入後才能購買");
    expect(container.textContent).toContain("300 代幣");
    act(() => button("皇冠").click());
    expect(sceneProps?.outfit).toEqual({ head: "crown" });
    const buyButtons = [...container.querySelectorAll("dialog button")].filter((b) => b.textContent === "購買");
    expect(buyButtons).toHaveLength(6);
    expect(buyButtons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it("buys with shared tokens, wears the item at once and celebrates", async () => {
    setWebGL(true);
    auth.user = { uid: "uid-1" };
    await renderPage();
    act(() => {
      cloud.onWardrobe?.({ owned: new Set(), equipped: {} });
      cloud.onBalance?.(120);
    });
    act(() => button("商店").click());
    expect(container.textContent).toContain("我的代幣：120");

    // A try-on of something else in the same slot gives way to the purchase.
    act(() => button("皇冠").click());
    const crownCard = button("皇冠").parentElement!;
    expect(crownCard.querySelector<HTMLButtonElement>("button:last-child")!.disabled).toBe(true);
    expect(crownCard.textContent).toContain("代幣不足");

    cloud.purchase.mockImplementation(async () => {
      cloud.onWardrobe?.({ owned: new Set(["hat"]), equipped: { head: "hat" } });
      cloud.onBalance?.(20);
      return {};
    });
    const hatBuy = button("粉帽").parentElement!.querySelector<HTMLButtonElement>("button:last-child")!;
    await act(async () => hatBuy.click());

    expect(cloud.purchase).toHaveBeenCalledWith("uid-1", "hat", expect.any(String));
    expect(sceneProps?.outfit).toEqual({ head: "hat" });
    expect(sceneProps?.runtime.performance?.action).toBe("jump");
    expect(container.textContent).toContain("買到了");
    expect(container.textContent).toContain("我的代幣：20");
    expect(button("粉帽").parentElement!.textContent).toContain("已擁有");
  });

  it("shows a failed purchase without claiming the item", async () => {
    setWebGL(true);
    auth.user = { uid: "uid-1" };
    await renderPage();
    act(() => {
      cloud.onWardrobe?.({ owned: new Set(), equipped: {} });
      cloud.onBalance?.(500);
    });
    act(() => button("商店").click());
    cloud.purchase.mockRejectedValue(new Error("unavailable"));

    const bowBuy = button("藍蝴蝶結").parentElement!.querySelector<HTMLButtonElement>("button:last-child")!;
    await act(async () => bowBuy.click());

    expect(container.textContent).toContain("購買沒有完成");
    expect(sceneProps?.outfit).toEqual({});
    expect(sceneProps?.runtime.performance).toBeNull();
    expect(button("藍蝴蝶結").parentElement!.textContent).not.toContain("已擁有");
  });

  it("saves owned accessories as equipment but never a try-on", async () => {
    setWebGL(true);
    auth.user = { uid: "uid-1" };
    await renderPage();
    act(() => {
      cloud.onWardrobe?.({ owned: new Set(["bow", "scarf"]), equipped: { head: "bow" } });
      cloud.onBalance?.(0);
    });
    expect(sceneProps?.outfit).toEqual({ head: "bow" });
    act(() => button("換裝").click());

    act(() => button("圍巾").click());
    expect(cloud.save).toHaveBeenLastCalledWith("uid-1", { head: "bow", neck: "scarf" }, new Set(["bow", "scarf"]));
    act(() => button("皇冠").click());
    expect(cloud.save).toHaveBeenCalledTimes(1);
    expect(sceneProps?.outfit).toEqual({ head: "crown" });

    act(() => button("全部卸除").click());
    expect(cloud.save).toHaveBeenLastCalledWith("uid-1", {}, new Set(["bow", "scarf"]));
  });

  it("explains and offers a way back when the device has no WebGL", async () => {
    setWebGL(false);
    const onExit = await renderPage();

    expect(container.textContent).toContain("無法顯示 3D");
    expect(container.querySelector("[data-scene]")).toBeNull();

    act(() => button("返回").click());
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("offers pat inside the actions panel instead of as its own button", async () => {
    setWebGL(true);
    await renderPage();

    expect(container.textContent).not.toContain("轉一轉");
    expect(container.textContent).not.toContain("摸摸頭");
    expect(sceneProps?.runtime.petting).toBe(false);
    expect(container.textContent).toContain("拖曳");

    pat();
    expect(container.querySelector("dialog")).toBeNull();
    expect(sceneProps?.runtime.petting).toBe(false);
    expect(sceneProps?.runtime.pet.phase).toBe("petting");
  });

  it("extends the pat on every press while leaving canvas drags available for turning", async () => {
    setWebGL(true);
    await renderPage();

    pat();
    const patUntil = sceneProps?.runtime.pet.patUntil ?? 0;
    await new Promise((resolve) => setTimeout(resolve, 5));
    pat();
    expect(sceneProps?.runtime.pet.patUntil ?? 0).toBeGreaterThan(patUntil);
    expect(sceneProps?.runtime.petting).toBe(false);
  });

  it("accumulates a heart across repeated pats", async () => {
    setWebGL(true);
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    await renderPage();

    for (now = 0; now <= 1500; now += 500) pat();

    expect(sceneProps?.runtime.pet.strokeTime).toBe(1500);
    expect(sceneProps?.runtime.pet.hearts).toBe(1);
  });

  it("interrupts another action with a pat without changing drag behavior", async () => {
    setWebGL(true);
    await renderPage();

    act(() => sceneProps!.runtime.perform("jump", performance.now()));
    pat();
    expect(sceneProps?.runtime.performance).toBeNull();
    expect(sceneProps?.runtime.pet.phase).toBe("petting");
    expect(sceneProps?.runtime.petting).toBe(false);
  });

  it("puts the model back upright and facing front with 回正", async () => {
    setWebGL(true);
    await renderPage();
    const runtime = sceneProps!.runtime;
    runtime.spin = releaseSpin(turnSpin(runtime.spin, 1.2, 0.8, 0), 500);

    act(() => button("回正").click());
    for (let i = 0; i < 120; i += 1) runtime.spin = advanceSpin(runtime.spin, 1 / 60);

    const stage = new Object3D();
    applySpin(stage, runtime.spin);
    const front = new Vector3(0, 0, 1).applyQuaternion(stage.quaternion);
    expect(front.z).toBeCloseTo(1, 5);
  });

  it("keeps the model credit off the play screen until asked for", async () => {
    setWebGL(true);
    await renderPage();
    expect(container.textContent).not.toContain("fukkacumy");

    act(() => button("模型出處").click());

    const links = [...container.querySelectorAll("a")];
    const source = links.find((a) => a.href.includes("sketchfab.com/3d-models/cinnamoroll-eae98497b99f47b8897c4ffd06521e31"));
    const author = links.find((a) => a.href.includes("sketchfab.com/kraevaya201"));
    const licence = links.find((a) => a.href.includes("creativecommons.org/licenses/by/4.0"));

    expect(source?.textContent).toContain("Cinnamoroll");
    expect(author?.textContent).toContain("fukkacumy");
    expect(licence?.textContent).toContain("CC BY 4.0");
  });

  it("keeps the loading message up until the scene has drawn", async () => {
    setWebGL(true);
    await renderPage();
    expect(container.textContent).toContain("大耳狗準備中");

    act(() => sceneProps?.onReady());

    expect(container.textContent).not.toContain("大耳狗準備中");
  });

  it("offers to reload the scene after the GPU context is lost", async () => {
    setWebGL(true);
    await renderPage();

    act(() => sceneProps?.onContextLost());
    expect(container.querySelector("[data-scene]")).toBeNull();

    await act(async () => button("重新載入").click());
    expect(container.querySelector("[data-scene]")).not.toBeNull();
  });
});
