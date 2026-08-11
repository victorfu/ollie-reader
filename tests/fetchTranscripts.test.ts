import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";

import { fetchAndSaveTranscript } from "../scripts/fetch-transcripts.mjs";

function transcriptResponse(html: string) {
  return {
    ok: true,
    status: 200,
    async text() {
      return html;
    },
  };
}

test("parses and saves a non-empty transcript", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "ollie-transcript-test-"));
  const outputPath = join(outputDir, "episode.json");

  try {
    const lines = await fetchAndSaveTranscript(1, "episode-1", outputPath, {
      fetchImpl: async () =>
        transcriptResponse(
          '<html><div class="full-script">First line<br>Second line</div></html>',
        ),
    });

    assert.deepEqual(lines, [
      { index: 0, text: "First line" },
      { index: 1, text: "Second line" },
    ]);
    assert.deepEqual(JSON.parse(readFileSync(outputPath, "utf8")), lines);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("fails explicitly and preserves the existing file when the selector is missing", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "ollie-transcript-test-"));
  const outputPath = join(outputDir, "episode.json");
  const existingTranscript = '[{"index":0,"text":"Keep me"}]';
  writeFileSync(outputPath, existingTranscript);

  try {
    await assert.rejects(
      fetchAndSaveTranscript(1, "episode-1", outputPath, {
        fetchImpl: async () =>
          transcriptResponse("<html><body>Layout changed</body></html>"),
      }),
      /missing the required \.full-script element/,
    );

    assert.equal(readFileSync(outputPath, "utf8"), existingTranscript);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("fails explicitly and preserves the existing file when the selector has no lines", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "ollie-transcript-test-"));
  const outputPath = join(outputDir, "episode.json");
  const existingTranscript = '[{"index":0,"text":"Keep me"}]';
  writeFileSync(outputPath, existingTranscript);

  try {
    await assert.rejects(
      fetchAndSaveTranscript(1, "episode-1", outputPath, {
        fetchImpl: async () =>
          transcriptResponse('<div class="full-script">  <br> \n </div>'),
      }),
      /contains no transcript lines/,
    );

    assert.equal(readFileSync(outputPath, "utf8"), existingTranscript);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
