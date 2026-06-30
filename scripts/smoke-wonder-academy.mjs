#!/usr/bin/env node
import { chromium } from "playwright";
import {
  buildMalformedLoadoutGuestSave,
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
    watches.push(await smokeMalformedSkillsRepair(context));
    watches.push(await smokeHubSurfacesAndEquip(context));
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
