#!/usr/bin/env node
// 從 pets-source/ 的原圖產生遊戲用的小圖 sprites。
//
// 原圖是 688–888px 的 PNG（單張 0.5–1.1MB，整包 45MB），但塔在畫面上只有約
// 56px。直接用原圖會讓一關下載十幾 MB，所以這裡先縮到 192px（約 60KB/張）。
// 產物會 commit 進 repo，遊戲只 import pets/ 底下的小圖。
//
// 用 macOS 內建的 sips，不需要任何 npm 依賴（跟 desktop/ 的打包工具鏈一樣是
// macOS-only）。sips 不支援寫出 webp，所以輸出 PNG 以保留透明背景。
//
//   node scripts/make-sweetheart-sprites.mjs

import { execFile } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "src/assets/games/sweetheart-defenders/pets-source");
const OUTPUT_DIR = path.join(ROOT, "src/assets/games/sweetheart-defenders/pets");
const MAX_EDGE = 192;

/** `mossmew-portrait.png` -> `mossmew` */
function petIdFromFilename(filename) {
  return path.basename(filename, ".png").replace(/-portrait$/, "");
}

async function hasAlpha(file) {
  const { stdout } = await execFileAsync("sips", ["-g", "hasAlpha", file]);
  return /hasAlpha:\s*yes/.test(stdout);
}

async function main() {
  if (process.platform !== "darwin") {
    console.error("這個腳本需要 macOS 的 sips 指令。");
    process.exitCode = 1;
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = (await readdir(SOURCE_DIR))
    .filter((name) => name.endsWith(".png"))
    .sort();

  if (files.length === 0) {
    console.error(`找不到原圖：${SOURCE_DIR}`);
    process.exitCode = 1;
    return;
  }

  const suspicious = [];

  for (const file of files) {
    const petId = petIdFromFilename(file);
    const source = path.join(SOURCE_DIR, file);

    await execFileAsync("sips", [
      "-Z",
      String(MAX_EDGE),
      source,
      "--out",
      path.join(OUTPUT_DIR, `${petId}.png`),
    ]);

    // 寵物圖應該是去背的。沒有 alpha 通道通常代表放錯檔案（例如整張聯絡表
    // 而不是單隻寵物），而且圖鑑把未解鎖的寵物壓成剪影時會變成一塊黑方塊。
    if (!(await hasAlpha(source))) suspicious.push(file);

    console.log(`  ${file} -> pets/${petId}.png`);
  }

  console.log(`\n完成：${files.length} 張，最長邊 ${MAX_EDGE}px`);

  if (suspicious.length > 0) {
    console.warn(
      `\n⚠️  下列原圖沒有透明背景，請確認不是放錯檔案：\n${suspicious
        .map((file) => `   - ${file}`)
        .join("\n")}`,
    );
  }
}

await main();
