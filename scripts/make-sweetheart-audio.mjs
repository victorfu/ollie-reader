#!/usr/bin/env node
// 把 audio-source/ 的 WAV 轉成遊戲用的 AAC。
//
// 原始音檔是未壓縮的 WAV，光是三首背景音樂就 2.2MB；轉成 AAC 之後整包從
// 3.4MB 掉到約 330KB，對一個網頁遊戲來說差很多。產物會 commit 進 repo，
// 遊戲只 import audio/ 底下的 .m4a。
//
// 用 macOS 內建的 afconvert，不需要任何 npm 依賴（跟 sprite 腳本一樣是
// macOS-only）。AAC 在 Chrome / Safari / Edge / Firefox 都能播。
//
//   node scripts/make-sweetheart-audio.mjs

import { execFile } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(
  ROOT,
  "src/assets/games/sweetheart-defenders/audio-source",
);
const OUTPUT_DIR = path.join(ROOT, "src/assets/games/sweetheart-defenders/audio");
/** afconvert 的品質等級，0–127；對這種短音效與循環樂句夠用了。 */
const QUALITY = "3";

async function main() {
  if (process.platform !== "darwin") {
    console.error("這個腳本需要 macOS 的 afconvert 指令。");
    process.exitCode = 1;
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = (await readdir(SOURCE_DIR))
    .filter((name) => name.endsWith(".wav"))
    .sort();

  if (files.length === 0) {
    console.error(`找不到原始音檔：${SOURCE_DIR}`);
    process.exitCode = 1;
    return;
  }

  let sourceBytes = 0;
  let outputBytes = 0;

  for (const file of files) {
    const source = path.join(SOURCE_DIR, file);
    const output = path.join(OUTPUT_DIR, `${path.basename(file, ".wav")}.m4a`);

    await execFileAsync("afconvert", [
      "-f",
      "m4af",
      "-d",
      "aac",
      "-s",
      QUALITY,
      source,
      output,
    ]);

    sourceBytes += (await stat(source)).size;
    outputBytes += (await stat(output)).size;
    console.log(`  ${file} -> audio/${path.basename(output)}`);
  }

  const toMb = (bytes) => (bytes / 1024 / 1024).toFixed(2);
  console.log(
    `\n完成：${files.length} 個檔案，${toMb(sourceBytes)}MB -> ${toMb(outputBytes)}MB`,
  );
}

await main();
