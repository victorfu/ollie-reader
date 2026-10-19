/**
 * Build src/data/cefr/cefrLevels.json from the Open Language Profiles
 * CEFR-J (A1-B2) and Octanove (C1-C2) vocabulary profile CSV files.
 *
 * Output shape: { [lowercaseHeadword: string]: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" }
 * with keys sorted alphabetically. When a headword appears at several levels,
 * the lowest level wins.
 *
 * Usage: npm run build-cefr
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = join(__dirname, "..", "src", "data", "cefr", "cefrLevels.json");

const SOURCE_URLS = [
  "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv",
  "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv",
];

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_PATTERN = /^(A1|A2|B1|B2|C1|C2)$/;

/**
 * Minimal RFC 4180 CSV parser: double-quoted fields, commas and newlines
 * inside quotes, "" escapes, LF or CRLF line endings. Fully empty lines are
 * dropped (so a trailing newline does not produce an empty row).
 *
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n") {
      endRow();
    } else if (char === "\r") {
      if (source[i + 1] === "\n") i += 1;
      endRow();
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) endRow();

  return rows;
}

/**
 * @param {string} cell
 * @returns {string[]} normalized, non-empty headword variants
 */
function headwordVariants(cell) {
  return cell
    .split("/")
    .map((variant) => variant.trim().replace(/\s+/g, " ").toLowerCase())
    .filter((variant) => variant !== "");
}

/**
 * @param {string[]} csvTexts CSV documents, each with `headword` and `CEFR` columns
 * @returns {Record<string, string>} lowercase headword -> lowest CEFR level, keys sorted
 */
export function buildCefrLevels(csvTexts) {
  /** @type {Map<string, string>} */
  const levels = new Map();

  for (const csvText of csvTexts) {
    const [header, ...rows] = parseCsv(csvText);
    if (header === undefined) continue;

    const columns = header.map((name) => name.trim().toLowerCase());
    const headwordIndex = columns.indexOf("headword");
    const cefrIndex = columns.indexOf("cefr");
    if (headwordIndex === -1 || cefrIndex === -1) {
      throw new Error('CSV is missing a "headword" or "CEFR" column');
    }

    for (const row of rows) {
      const level = (row[cefrIndex] ?? "").trim();
      if (!LEVEL_PATTERN.test(level)) continue;

      for (const key of headwordVariants(row[headwordIndex] ?? "")) {
        const existing = levels.get(key);
        if (existing === undefined || LEVELS.indexOf(level) < LEVELS.indexOf(existing)) {
          levels.set(key, level);
        }
      }
    }
  }

  const sortedKeys = [...levels.keys()].sort();
  return Object.fromEntries(sortedKeys.map((key) => [key, levels.get(key)]));
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

async function main() {
  const csvTexts = await Promise.all(SOURCE_URLS.map(fetchText));
  const levels = buildCefrLevels(csvTexts);

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, `${JSON.stringify(levels)}\n`);

  console.log(`Wrote ${Object.keys(levels).length} headwords to ${OUTPUT_FILE}`);
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
