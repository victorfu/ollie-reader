#!/usr/bin/env node
import { chromium } from "playwright";
import {
  buildMalformedLoadoutGuestSave,
  buildWonderAcademyGuestSave,
  relevantWonderAcademyConsoleEntries,
  WONDER_ACADEMY_GUEST_SAVE_KEY,
} from "./wonder-academy-smoke-helpers.mjs";

const targetUrl = process.env.WONDER_ACADEMY_SMOKE_URL
  ?? "http://localhost:5173/games/wonder-academy";

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

async function openGuestHub(context, save) {
  const page = await context.newPage();
  const watch = createBrowserWatch(page);
  await seedGuestSave(page, save);
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "學院大廳" }).waitFor({ timeout: 10000 });
  return { page, watch };
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
    checks: [
      "guest hub loads",
      "malformed skills loadout repairs",
      "skill equip updates",
      "Wonderdex opens",
      "shop opens",
      "no relevant console or page errors",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
