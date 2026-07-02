#!/usr/bin/env node
import { chromium } from "playwright";
import {
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
      consoleEntries.push({
        type: message.type(),
        text: message.text(),
        url: message.location().url,
      });
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

async function assertSignedOutEntry(page) {
  await page.getByRole("heading", { name: "Wonder Academy" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /登入後開始/ }).waitFor({ timeout: 5000 });
  const guestButtons = await page.getByRole("button", { name: /訪客試玩/ }).count();
  if (guestButtons > 0) {
    throw new Error("Signed-out Wonder Academy entry still offers guest play.");
  }
  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("訪客試玩") || bodyText.includes("訪客試玩只會保存在這台裝置")) {
    throw new Error("Signed-out Wonder Academy entry still renders guest copy.");
  }
}

async function smokeSignedOutEntry(context) {
  const page = await context.newPage();
  const watch = createBrowserWatch(page);
  await clearWonderAcademySavesOnLoad(page);
  await page.goto(legacyUrl, { waitUntil: "networkidle" });
  await page.waitForURL(/\/games\/wonder-academy(?:$|[?#])/, { timeout: 10000 });
  await assertSignedOutEntry(page);
  await page.close();
  return watch;
}

async function smokeGuestSaveDoesNotBypassLogin(context) {
  const page = await context.newPage();
  const watch = createBrowserWatch(page);
  await seedGuestSave(page, buildWonderAcademyGuestSave({ playerName: "Old Guest QA" }));
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await assertSignedOutEntry(page);
  const hubHeadings = await page.getByRole("heading", { name: "學院大廳" }).count();
  if (hubHeadings > 0) {
    throw new Error("Existing guest save opened the hub while signed out.");
  }
  await page.close();
  return watch;
}

async function smokeMobileSignedOutEntry(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const watch = createBrowserWatch(page);
  await clearWonderAcademySavesOnLoad(page);
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await assertSignedOutEntry(page);
  await assertNoHorizontalOverflow(page);
  await page.close();
  await context.close();
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

async function main() {
  await assertServerReachable(targetUrl);

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.WONDER_ACADEMY_SMOKE_CHANNEL
      ? { channel: process.env.WONDER_ACADEMY_SMOKE_CHANNEL }
      : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const watches = [];

  try {
    watches.push(await smokeSignedOutEntry(context));
    watches.push(await smokeGuestSaveDoesNotBypassLogin(context));
    watches.push(await smokeMobileSignedOutEntry(browser));
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
