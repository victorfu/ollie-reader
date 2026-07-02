#!/usr/bin/env node
import { chromium } from "playwright";
import {
  buildMalformedLoadoutGuestSave,
  buildPostgameReadyGuestSave,
  buildWardenReadyGuestSave,
  buildWonderAcademyGuestSave,
  relevantWonderAcademyConsoleEntries,
  WONDER_ACADEMY_GUEST_SAVE_KEY,
  WONDER_ACADEMY_SMOKE_CHECKS,
} from "./wonder-academy-smoke-helpers.mjs";

const targetUrl = process.env.WONDER_ACADEMY_SMOKE_URL
  ?? "http://localhost:5173/games/wonder-academy";
const legacyUrl = new URL("/games/monster-academy", targetUrl).toString();

async function assertServerReachable(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    throw new Error(
      `Wonder Academy smoke expects an already-running dev server at ${url}. ${error.message}`,
    );
  }
}

function createBrowserWatch(page) {
  const consoleEntries = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleEntries.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  return { consoleEntries, pageErrors };
}

async function seedGuestSave(page, save) {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: WONDER_ACADEMY_GUEST_SAVE_KEY, value: save });
}

async function clearWonderAcademySavesOnLoad(page) {
  await page.addInitScript(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("wonder-academy-")) window.localStorage.removeItem(key);
    }
  });
}

async function seedRandom(page, values, fallback = 0.01) {
  await page.addInitScript(({ seededValues, fallbackValue }) => {
    const queue = [...seededValues];
    Math.random = () => queue.shift() ?? fallbackValue;
  }, { seededValues: values, fallbackValue: fallback });
}

async function assertExploreCanvasRendered(page) {
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ timeout: 10000 });
  await page.waitForTimeout(750);
  const info = await canvas.evaluate((element) => {
    const canvasElement = element;
    const gl = canvasElement.getContext("webgl")
      || canvasElement.getContext("webgl2")
      || canvasElement.getContext("experimental-webgl");
    let pixel = null;
    if (gl) {
      const data = new Uint8Array(4);
      gl.readPixels(
        Math.floor(canvasElement.width / 2),
        Math.floor(canvasElement.height / 2),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data,
      );
      pixel = Array.from(data);
    }
    return {
      width: canvasElement.width,
      height: canvasElement.height,
      hasWebGl: !!gl,
      pixel,
    };
  });
  const screenshot = await canvas.screenshot();
  const hasVisiblePixel = !!info.pixel && info.pixel[3] > 0 && info.pixel.slice(0, 3).some((v) => v > 0);
  if (
    info.width <= 0
    || info.height <= 0
    || !info.hasWebGl
    || !hasVisiblePixel
    || screenshot.length < 2048
  ) {
    throw new Error(`Explore canvas did not render a visible WebGL scene: ${JSON.stringify({
      ...info,
      screenshotBytes: screenshot.length,
    })}`);
  }
}

async function pressExploreKey(page, key) {
  await page.keyboard.press(key);
  await page.waitForTimeout(300);
}

async function clickExploreTile(page, x, y) {
  await page.locator("canvas").first().click({
    position: {
      x: 20 + x * 64 + 32,
      y: 20 + y * 64 + 32,
    },
  });
  await page.waitForTimeout(800);
}

async function walkToFirstGrassBattle(page) {
  const canvas = page.locator("canvas").first();
  await canvas.click({ position: { x: 300, y: 240 } });
  await pressExploreKey(page, "ArrowRight");
  await pressExploreKey(page, "ArrowRight");
  await pressExploreKey(page, "ArrowRight");
  await page.getByText(/野生的 .* 出現了!/).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /遞點心收服/ }).waitFor({ timeout: 5000 });
}

async function catchCurrentBattleAndReturnToScene(page) {
  await page.getByRole("button", { name: /遞點心收服/ }).click();
  await page.getByRole("heading", { name: /新夥伴/ }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /回到森林/ }).click();
  await page.getByRole("heading", { name: "探索中" }).waitFor({ timeout: 5000 });
  await assertExploreCanvasRendered(page);
}

async function walkToChestAndAssertLoot(page) {
  await clickExploreTile(page, 7, 2);
  await clickExploreTile(page, 7, 1);
  await clickExploreTile(page, 6, 1);
  await page.getByText(/打開寶箱!獲得/).waitFor({ timeout: 10000 });
}

async function openGuestHub(context, save) {
  const page = await context.newPage();
  const watch = createBrowserWatch(page);
  await seedGuestSave(page, save);
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "學院大廳" }).waitFor({ timeout: 10000 });
  return { page, watch };
}

async function smokeNewGameExploreFlow(context) {
  const page = await context.newPage();
  const watch = createBrowserWatch(page);
  await clearWonderAcademySavesOnLoad(page);
  await seedRandom(page, [
    0.01, // grass encounter threshold
    0.01, // rollEncounter chance
    0.01, // pick Mossmew
    0.01, // low wild level
    0.99, // not shiny
    0.01, // catch succeeds
    0.01, // caught ownedId suffix
    0.01, // caught reward snack
    0.01,
    0.01,
    0.01,
    0.01,
  ]);

  await page.goto(legacyUrl, { waitUntil: "networkidle" });
  await page.waitForURL(/\/games\/wonder-academy(?:$|[?#])/, { timeout: 10000 });
  await page.getByRole("heading", { name: "Wonder Academy" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /訪客試玩/ }).click();
  await page.getByPlaceholder("輸入你的名字").fill("QA");
  await page.getByRole("button", { name: /這就是我/ }).click();
  await page.getByRole("heading", { name: /選擇你的第一個夥伴/ }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /^Lumi/ }).click();
  await page.getByRole("heading", { name: /Lumi 選擇了你/ }).waitFor({ timeout: 5000 });
  await page.getByPlaceholder(/幫牠取個暱稱/).fill("Spark");
  await page.getByRole("button", { name: /一起出發/ }).click();
  await page.getByRole("heading", { name: "學院大廳" }).waitFor({ timeout: 5000 });

  await page.getByRole("button", { name: /出發探索/ }).click();
  await page.getByRole("heading", { name: "選擇探索地點" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /星葉森林/ }).click();
  await page.getByRole("heading", { name: /星葉森林/ }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /^🐾 林間入口$/ }).click();
  await assertExploreCanvasRendered(page);
  await walkToFirstGrassBattle(page);
  await catchCurrentBattleAndReturnToScene(page);
  await walkToChestAndAssertLoot(page);

  await page.close();
  return watch;
}

async function smokeWardenBattle(context) {
  const { page, watch } = await openGuestHub(context, buildWardenReadyGuestSave());
  await page.getByRole("button", { name: /出發探索/ }).click();
  await page.getByRole("heading", { name: "選擇探索地點" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /星葉森林/ }).click();
  await page.getByRole("heading", { name: /星葉森林/ }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /^👑 守關之地$/ }).click();
  await page.getByText("👑 守關魔王").waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /微光閃/ }).click();
  await page.getByText(/反擊了!/).waitFor({ timeout: 5000 });
  await page.close();
  return watch;
}

async function smokeGuestReload(context) {
  const page = await context.newPage();
  const watch = createBrowserWatch(page);
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.evaluate(({ key, save }) => {
    for (const storageKey of Object.keys(window.localStorage)) {
      if (storageKey.startsWith("wonder-academy-")) window.localStorage.removeItem(storageKey);
    }
    window.localStorage.setItem(key, JSON.stringify(save));
  }, {
    key: WONDER_ACADEMY_GUEST_SAVE_KEY,
    save: buildWonderAcademyGuestSave({ playerName: "Reload QA" }),
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "學院大廳" }).waitFor({ timeout: 10000 });
  await page.getByText(/圖鑑進度/).first().waitFor({ timeout: 5000 });
  await page.close();
  return watch;
}

async function assertNoHorizontalOverflow(page) {
  const layout = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (layout.scrollWidth > layout.innerWidth + 2) {
    throw new Error(`Mobile layout overflows horizontally: ${JSON.stringify(layout)}`);
  }
}

async function assertTouchTarget(page, roleName) {
  const box = await page.getByRole("button", { name: roleName }).first().boundingBox();
  if (!box || box.width < 44 || box.height < 44) {
    throw new Error(`Touch target is too small for ${roleName}: ${JSON.stringify(box)}`);
  }
}

async function smokeMobileTouchFlow(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const { page, watch } = await openGuestHub(
    context,
    buildWonderAcademyGuestSave({ playerName: "Mobile QA" }),
  );
  await assertNoHorizontalOverflow(page);
  await assertTouchTarget(page, /出發探索/);
  await assertTouchTarget(page, /圖鑑/);
  await assertTouchTarget(page, /商店/);

  await page.getByRole("button", { name: /圖鑑/ }).tap();
  await page.getByRole("heading", { name: "Wonderdex" }).waitFor({ timeout: 5000 });
  await assertNoHorizontalOverflow(page);
  await page.getByRole("button", { name: /關閉/ }).tap();
  await page.getByRole("heading", { name: "學院大廳" }).waitFor({ timeout: 5000 });

  await page.getByRole("button", { name: /商店/ }).tap();
  await page.getByRole("heading", { name: "點心商店" }).waitFor({ timeout: 5000 });
  await assertNoHorizontalOverflow(page);
  await page.close();
  await context.close();
  return watch;
}

async function smokeReducedMotionStarterFlow(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const watch = createBrowserWatch(page);
  await clearWonderAcademySavesOnLoad(page);
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Wonder Academy" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /訪客試玩/ }).click();
  await page.getByPlaceholder("輸入你的名字").fill("Motion QA");
  await page.getByRole("button", { name: /這就是我/ }).click();
  await page.getByRole("heading", { name: /選擇你的第一個夥伴/ }).waitFor({ timeout: 5000 });
  const animationName = await page.locator(".wa-starter").first().evaluate((el) =>
    window.getComputedStyle(el).animationName,
  );
  if (animationName !== "none") {
    throw new Error(`Reduced motion starter card still animates: ${animationName}`);
  }
  await page.close();
  await context.close();
  return watch;
}

async function smokeKeyboardEntryFlow(context) {
  const page = await context.newPage();
  const watch = createBrowserWatch(page);
  await clearWonderAcademySavesOnLoad(page);
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Wonder Academy" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /訪客試玩/ }).focus();
  await page.keyboard.press("Enter");
  await page.getByPlaceholder("輸入你的名字").fill("Key QA");
  await page.getByRole("button", { name: /這就是我/ }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: /選擇你的第一個夥伴/ }).waitFor({ timeout: 5000 });
  await page.close();
  return watch;
}

async function setRangeValue(locator, value) {
  await locator.focus();
  await locator.press("Home");
  const steps = Math.round(value / 0.05);
  for (let i = 0; i < steps; i += 1) {
    await locator.press("ArrowRight");
  }
}

async function smokeExpandedRegions(context) {
  const { page, watch } = await openGuestHub(context, buildWonderAcademyGuestSave());
  await page.getByRole("button", { name: /出發探索/ }).click();
  await page.getByRole("heading", { name: "選擇探索地點" }).waitFor({ timeout: 5000 });
  for (const regionName of ["星葉森林", "玻璃海岸", "鐘塔宿舍", "糖雲市集"]) {
    await page.getByRole("button", { name: new RegExp(regionName) }).waitFor({ timeout: 5000 });
  }
  await page.close();
  return watch;
}

async function smokeWorkshopAndAudio(context) {
  const { page, watch } = await openGuestHub(context, buildPostgameReadyGuestSave());
  await page.getByRole("button", { name: /工房/ }).click();
  await page.getByRole("heading", { name: /護符工房/ }).waitFor({ timeout: 5000 });
  await page.getByText("幸運提燈").waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "製作" }).first().click();
  await page.getByText("持有 1").waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "啟用" }).first().click();
  await page.getByText("啟用中").waitFor({ timeout: 5000 });
  await setRangeValue(page.getByLabel("音樂音量"), 0.2);
  await page.getByText("20%").waitFor({ timeout: 5000 });
  await setRangeValue(page.getByLabel("音效音量"), 0.35);
  await page.getByText("35%").waitFor({ timeout: 5000 });
  await page.close();
  return watch;
}

async function smokePostgameTrial(context) {
  const { page, watch } = await openGuestHub(context, buildPostgameReadyGuestSave());
  await page.getByRole("button", { name: /試煉/ }).click();
  await page.getByRole("heading", { name: /Wonder Keeper 試煉/ }).waitFor({ timeout: 5000 });
  await page.getByText("靜鐘之心試煉").waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /開始試煉/ }).first().click();
  await page.getByText("👑 守關魔王").waitFor({ timeout: 5000 });
  await page.close();
  return watch;
}

async function smokeMalformedSkillsRepair(context) {
  const { page, watch } = await openGuestHub(context, buildMalformedLoadoutGuestSave());
  await page.getByRole("button", { name: /技能/ }).first().click();
  await page.getByRole("heading", { name: "技能" }).waitFor({ timeout: 5000 });
  await page.getByText("Lv.9 · 裝備 4/4").waitFor({ timeout: 5000 });

  const bodyText = await page.locator("body").innerText();
  const defaultMovesVisible = ["微光閃", "電光衝", "眨眼佯攻", "星步衝刺"]
    .every((moveName) => bodyText.includes(moveName));
  if (!defaultMovesVisible) {
    throw new Error("Skills repair smoke did not show Lumi default moves.");
  }
  if (bodyText.includes("泡泡輕拍") || bodyText.includes("bubble-pat")) {
    throw new Error("Skills repair smoke still shows malformed Momo move bubble-pat.");
  }
  await page.close();
  return watch;
}

async function smokeHubSurfacesAndEquip(context) {
  const { page, watch } = await openGuestHub(
    context,
    buildWonderAcademyGuestSave({ equippedMoveIds: ["tiny-flash"] }),
  );

  await page.getByRole("button", { name: /技能/ }).first().click();
  await page.getByRole("heading", { name: "技能" }).waitFor({ timeout: 5000 });
  await page.getByText("Lv.9 · 裝備 1/4").waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /極光遊行/ }).click();
  await page.getByText("Lv.9 · 裝備 2/4").waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /完成/ }).click();
  await page.getByRole("heading", { name: "學院大廳" }).waitFor({ timeout: 5000 });

  await page.getByRole("button", { name: /圖鑑/ }).click();
  await page.getByRole("heading", { name: "Wonderdex" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /關閉/ }).click();
  await page.getByRole("heading", { name: "學院大廳" }).waitFor({ timeout: 5000 });

  await page.getByRole("button", { name: /商店/ }).click();
  await page.getByRole("heading", { name: "點心商店" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /關閉/ }).click();
  await page.getByRole("heading", { name: "學院大廳" }).waitFor({ timeout: 5000 });

  await page.close();
  return watch;
}

async function main() {
  await assertServerReachable(targetUrl);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const watches = [];

  try {
    watches.push(await smokeNewGameExploreFlow(context));
    watches.push(await smokeWardenBattle(context));
    watches.push(await smokeGuestReload(context));
    watches.push(await smokeKeyboardEntryFlow(context));
    watches.push(await smokeMobileTouchFlow(browser));
    watches.push(await smokeMalformedSkillsRepair(context));
    watches.push(await smokeHubSurfacesAndEquip(context));
    watches.push(await smokeExpandedRegions(context));
    watches.push(await smokeWorkshopAndAudio(context));
    watches.push(await smokePostgameTrial(context));
    watches.push(await smokeReducedMotionStarterFlow(browser));
  } finally {
    await browser.close();
  }

  const consoleEntries = watches.flatMap((watch) => watch.consoleEntries);
  const pageErrors = watches.flatMap((watch) => watch.pageErrors);
  const relevantConsole = relevantWonderAcademyConsoleEntries(consoleEntries);
  if (relevantConsole.length > 0 || pageErrors.length > 0) {
    throw new Error(JSON.stringify({ relevantConsole, pageErrors }, null, 2));
  }

  console.log(JSON.stringify({
    status: "passed",
    url: targetUrl,
    checks: WONDER_ACADEMY_SMOKE_CHECKS,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
