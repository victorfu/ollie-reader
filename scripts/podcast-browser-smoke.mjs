// Run with Vite + server running. No auth bypass is installed in the app:
// a Playwright-only HTML harness mounts the production Podcast component.
// Uses the real resolver and remote audio, never a mocked success response.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.PODCAST_WEB_URL || 'http://localhost:5173';
const output = process.env.PODCAST_SCREENSHOTS || '/tmp/ollie-podcast-smoke';
const url = 'https://podcasts.apple.com/tw/podcast/storytime-sweeter-than-honey/id1567336024?i=1000539350317';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PODCAST_CHROMIUM_PATH });
const harnessName = `.podcast-smoke-${process.pid}.html`;
const harnessPath = fileURLToPath(new URL(`../${harnessName}`, import.meta.url));
try {
  const page = await browser.newPage();
  page.on('pageerror', error => console.error(error.message));
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
  page.on('requestfailed', request => console.error(request.url(), request.failure()?.errorText));
  await writeFile(harnessPath, `<!doctype html><html data-theme="ollielight"><head><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body><div id="root"></div><script type="module">
import React from 'react';
import ReactDOM from 'react-dom/client';
const { default: Podcasts } = await import('/src/components/Podcasts/Podcasts.tsx');
window.smokeRoot = ReactDOM.createRoot(document.getElementById('root'));
window.smokeRoot.render(React.createElement(React.StrictMode, null, React.createElement(Podcasts)));
</script></body></html>`);
  await page.goto(`${base}/${harnessName}`);
  await page.getByLabel('Apple Podcasts 網址', { exact: true }).fill(url);
  await page.getByRole('button', { name: '載入 Podcast', exact: true }).click();
  await page.getByRole('heading', { name: 'Storytime: Sweeter than Honey', exact: true }).waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('audio')?.readyState >= 1, undefined, { timeout: 30000 });
  await page.locator('article img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
  assert.equal(await page.locator('audio').evaluate(a => a.paused), true);
  for (const [width, height, theme] of [[375, 812, 'light'], [768, 1024, 'light'], [1440, 900, 'dark']]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme === 'dark' ? 'olliedark' : 'ollielight'; document.documentElement.classList.toggle('dark', theme === 'dark'); }, theme);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
    for (const button of await page.locator('button, select, input').all()) {
      const box = await button.boundingBox();
      assert.ok(box && box.height >= 44, `touch target under 44px at ${width}`);
    }
    await page.screenshot({ path: `${output}/${width}-${theme}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForFunction(() => { const a = document.querySelector('audio'); return !a.paused && a.currentTime > 0.3; }, undefined, { timeout: 30000 });
  await page.getByRole('button', { name: '暫停', exact: true }).click();
  const before = await page.locator('audio').evaluate(a => a.currentTime);
  await page.getByRole('button', { name: '快轉 10 秒', exact: true }).click();
  await page.waitForFunction(before => document.querySelector('audio').currentTime >= before + 9, before);
  await page.getByRole('button', { name: '倒退 10 秒', exact: true }).click();
  assert.ok(Math.abs(await page.locator('audio').evaluate(a => a.currentTime) - before) < 1);
  await page.getByLabel('播放速度', { exact: true }).selectOption('1.25');
  assert.equal(await page.locator('audio').evaluate(a => a.playbackRate), 1.25);
  await page.getByLabel('播放進度', { exact: true }).fill('120');
  await page.waitForFunction(() => Math.abs(document.querySelector('audio').currentTime - 120) < 1);
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio').currentTime > 120.3);
  const state = await page.locator('audio').evaluate(a => ({ time: a.currentTime, duration: a.duration, speed: a.playbackRate, seekable: a.seekable.length }));
  await page.getByLabel('Apple Podcasts 網址', { exact: true }).fill('https://podcasts.apple.com/tw/podcast/lingokids-stories-for-kids-learn-life-lessons-and-laugh/id1567336024');
  await page.getByRole('button', { name: '載入 Podcast', exact: true }).click();
  await page.getByLabel('選擇單集', { exact: true }).waitFor({ timeout: 30000 });
  assert.equal(await page.locator('audio').count(), 0, 'a show must not choose an episode automatically');
  const showEpisodeCount = await page.locator('#podcast-episode option').count() - 1;
  assert.ok(showEpisodeCount > 0);
  await page.getByLabel('選擇單集', { exact: true }).selectOption('41de79d7-ab9c-4035-a1af-aee96c385002');
  await page.getByRole('heading', { name: 'Storytime: Sweeter than Honey', exact: true }).waitFor();
  assert.equal(await page.locator('audio').evaluate(a => a.paused), true);
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio').currentTime > 0.3);
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${output}/show-375-dark.png`, fullPage: true });
  await page.evaluate(() => { window.smokeAudio = document.querySelector('audio'); window.smokeRoot.unmount(); });
  assert.equal(await page.evaluate(() => window.smokeAudio.paused && !window.smokeAudio.hasAttribute('src')), true);
  console.log(JSON.stringify({ passed: true, url, ...state, showEpisodeCount, viewports: [375, 768, 1440], output }));
} finally { await browser.close(); await unlink(harnessPath).catch(() => {}); }
