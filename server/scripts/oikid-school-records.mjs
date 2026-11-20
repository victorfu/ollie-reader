#!/usr/bin/env node
// OIKID 上課紀錄 (Student/SchoolRecord) CLI: list classes and download their PDF materials.
// Credentials come from OIKID_USERNAME / OIKID_PASSWORD in server/.env.local (or the shell env).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { CookieJar } from "tough-cookie";

const BASE = "https://www.oikid.com";
const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KINDS = {
  handout: { label: "教材", path: "/PHP/Review.php", extra: "" },
  review: { label: "複習", path: "/PHP/Review.php", extra: "&type=review" },
  preview: { label: "預習", path: "/PHP/Preview.php", extra: "" },
};

const HELP = `Usage: npm run oikid -- <command> [options]

Commands:
  list                    List classes from 上課紀錄
  download [id ...]       Download materials for the given class ids (or use filters)
                          教材/複習 are PDFs; 預習 is an MP4 video for regular classes

Options (both commands):
  -p, --page <n>          Only this page (30 rows/page). Default: all pages
      --since <date>      Only classes on/after YYYY-MM-DD
      --until <date>      Only classes on/before YYYY-MM-DD
      --type <t>          Only "open" (FW 主題課) or "regular" classes
      --json              (list) Print raw JSON rows

Options (download):
  -k, --kind <list>       Comma list of: handout,preview,review. Default: handout
  -o, --out <dir>         Output directory. Default: ./oikid-materials
  -f, --force             Re-download files that already exist
      --all               Download every listed class (required when no ids/filters)

Examples:
  npm run oikid -- list --page 1
  npm run oikid -- download 7409013
  npm run oikid -- download --since 2026-10-01 --kind handout,preview -o ~/Downloads/oikid
  npm run oikid -- download --all`;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function loadCredentials() {
  const envFile = join(SERVER_DIR, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const { OIKID_USERNAME: username, OIKID_PASSWORD: password } = process.env;
  if (!username || !password) fail(`Set OIKID_USERNAME and OIKID_PASSWORD in ${envFile}`);
  return { username, password };
}

const isMaterialHost = (url) =>
  url.protocol === "https:" && /^oikid-[a-z0-9-]+\.s3[.a-z0-9-]*\.amazonaws\.com$/.test(url.hostname);

// 教材/複習 are PDFs; 預習 for regular classes is an MP4 video. Anything else is an error page.
function detectExtension(bytes) {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return ".pdf";
  if (bytes.subarray(4, 8).toString("latin1") === "ftyp") return ".mp4";
  return null;
}

function createClient() {
  const jar = new CookieJar();
  async function send(path, { form, xhr = true } = {}) {
    let url = new URL(path, BASE);
    let body = form;
    for (let redirects = 0; redirects <= 10; redirects++) {
      if (url.origin !== BASE) {
        // Materials are served from a pre-signed S3 URL; never send OIKID cookies there.
        const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status} from ${url.hostname}`);
        return response;
      }
      const response = await fetch(url, {
        method: body ? "POST" : "GET",
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(60_000),
        headers: {
          Cookie: await jar.getCookieString(url.href),
          Origin: BASE,
          Referer: `${BASE}/?a=Student/SchoolRecord`,
          ...(xhr ? { Accept: "application/json, text/javascript, */*; q=0.01", "X-Requested-With": "XMLHttpRequest" } : {}),
        },
      });
      for (const cookie of response.headers.getSetCookie()) await jar.setCookie(cookie, url.href);
      if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
        await response.body?.cancel();
        const next = new URL(response.headers.get("location"), url);
        if (next.origin !== BASE && !isMaterialHost(next)) throw new Error(`Unexpected redirect to ${next.origin}`);
        if ([301, 302, 303].includes(response.status)) body = undefined;
        url = next;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status} for ${url.pathname}${url.search.replace(/token=[^&]+/, "token=…")}`);
      }
      return response;
    }
    throw new Error("Too many redirects");
  }

  async function login({ username, password }) {
    await (await send("/login.php", { xhr: false })).body?.cancel();
    const response = await send("/?a=Student/Login&b=Process", { form: new URLSearchParams({ Username: username, Password: password }) });
    const issuedSession = response.headers.getSetCookie().some((cookie) => /^PHPSESSID=[^;\s]+/.test(cookie));
    const result = await response.json().catch(() => null);
    if (!issuedSession || result?.Result !== true) throw new Error("OIKID login failed (check credentials)");
    await jar.setCookie("location=zh-tw; Path=/; Secure", BASE);
  }

  async function searchPage(page) {
    const response = await send("/?a=Student/SchoolRecord&b=Search", { form: new URLSearchParams({ P: String(page) }) });
    const data = JSON.parse(await response.text());
    if (data?.Result !== true || !Array.isArray(data.Data)) throw new Error(`Unexpected SchoolRecord response on page ${page}`);
    return { token: String(data.Token ?? ""), total: Number(data.TotalCount) || 0, rows: data.Data };
  }

  async function download(path) {
    const response = await send(path, { xhr: false });
    return Buffer.from(await response.arrayBuffer());
  }

  return { login, searchPage, download };
}

async function fetchRecords(client, page) {
  if (page) return client.searchPage(page);
  const first = await client.searchPage(1);
  const rows = [...first.rows];
  const pageSize = first.rows.length || 1;
  const pages = Math.ceil(first.total / pageSize);
  for (let p = 2; p <= pages; p++) {
    process.stderr.write(`\rFetching page ${p}/${pages}…`);
    rows.push(...(await client.searchPage(p)).rows);
  }
  if (pages > 1) process.stderr.write("\n");
  return { token: first.token, total: first.total, rows };
}

const startDate = (row) => new Date(String(row.start_time).replace(/-/g, "/"));

function className(row) {
  if (row.Course === "Open") return row.OpenName || row.title;
  return [`Lv${row.Level}`, row.ClassVersion, row.Courses && `Unit ${row.Courses}`].filter(Boolean).join(" ");
}

function applyFilters(rows, { since, until, type }) {
  return rows.filter((row) => {
    const day = String(row.start_time).slice(0, 10);
    if (since && day < since) return false;
    if (until && day > until) return false;
    if (type === "open" && row.Course !== "Open") return false;
    if (type === "regular" && row.Course === "Open") return false;
    return true;
  });
}

function safeFileName(text) {
  return text.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

function printTable(rows) {
  for (const row of rows) {
    const type = row.Course === "Open" ? "open   " : "regular";
    console.log(`${row.id}  ${String(row.start_time).slice(0, 16)}  ${type}  ${className(row)}  — ${row.TeacherName ?? ""}`);
  }
  console.log(`\n${rows.length} class(es)`);
}

async function main() {
  const { values: opts, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      page: { type: "string", short: "p" },
      since: { type: "string" },
      until: { type: "string" },
      type: { type: "string" },
      json: { type: "boolean" },
      kind: { type: "string", short: "k", default: "handout" },
      out: { type: "string", short: "o", default: "oikid-materials" },
      force: { type: "boolean", short: "f" },
      all: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, ...ids] = positionals;
  if (opts.help || !command) return console.log(HELP);
  if (!["list", "download"].includes(command)) fail(`Unknown command "${command}"\n\n${HELP}`);
  for (const key of ["since", "until"]) if (opts[key] && !/^\d{4}-\d{2}-\d{2}$/.test(opts[key])) fail(`--${key} must be YYYY-MM-DD`);
  if (opts.type && !["open", "regular"].includes(opts.type)) fail('--type must be "open" or "regular"');
  const page = opts.page ? Number(opts.page) : undefined;
  if (opts.page && !(Number.isInteger(page) && page > 0)) fail("--page must be a positive integer");
  const kinds = opts.kind.split(",").map((k) => k.trim()).filter(Boolean);
  for (const kind of kinds) if (!KINDS[kind]) fail(`Unknown --kind "${kind}" (use ${Object.keys(KINDS).join(",")})`);
  const hasSelection = ids.length || page || opts.since || opts.until || opts.type || opts.all;
  if (command === "download" && !hasSelection) fail("Pass class ids, a filter (--page/--since/--until/--type), or --all");

  const client = createClient();
  await client.login(loadCredentials());
  // The token is bound to this login session, so list and download happen in one run.
  const { token, rows } = await fetchRecords(client, page);
  let selected = applyFilters(rows, opts);
  if (ids.length) {
    const wanted = new Set(ids);
    selected = selected.filter((row) => wanted.has(String(row.id)));
    const missing = ids.filter((id) => !selected.some((row) => String(row.id) === id));
    if (missing.length) console.warn(`Not found in 上課紀錄${page ? ` page ${page}` : ""}: ${missing.join(", ")}`);
  }

  if (command === "list") {
    if (opts.json) return console.log(JSON.stringify(selected, null, 2));
    return printTable(selected);
  }

  const outDir = resolve(opts.out);
  mkdirSync(outDir, { recursive: true });
  const now = new Date();
  const counts = { saved: 0, skipped: 0, missing: 0, failed: 0 };
  for (const row of selected) {
    if (startDate(row) > now) {
      console.log(`- ${row.id} ${className(row)}: class not started yet, skipped`);
      counts.skipped++;
      continue;
    }
    for (const kind of kinds) {
      const { label, path, extra } = KINDS[kind];
      const stamp = String(row.start_time).slice(0, 16).replace(/[-:]/g, "").replace(" ", "_");
      const suffix = kinds.length > 1 ? `_${label}` : "";
      const base = join(outDir, `${stamp}_${row.id}_${safeFileName(className(row))}${suffix}`);
      const existing = [".pdf", ".mp4"].map((ext) => base + ext).find((candidate) => existsSync(candidate));
      if (!opts.force && existing) {
        console.log(`= exists  ${existing}`);
        counts.skipped++;
        continue;
      }
      try {
        const bytes = await client.download(`${path}?id=${encodeURIComponent(row.id)}&token=${token}${extra}`);
        const ext = detectExtension(bytes);
        if (!ext) {
          const message = bytes.toString("utf8").replace(/<[^>]*>/g, "").trim().slice(0, 80);
          console.log(`- ${row.id} ${label}: no material (${message || "empty response"})`);
          counts.missing++;
          continue;
        }
        const file = base + ext;
        writeFileSync(file, bytes);
        console.log(`✓ ${(bytes.length / 1024 / 1024).toFixed(1)} MB  ${file}`);
        counts.saved++;
      } catch (error) {
        console.error(`✗ ${row.id} ${label}: ${error.message}`);
        counts.failed++;
      }
    }
  }
  console.log(`\nSaved ${counts.saved}, skipped ${counts.skipped}, no material ${counts.missing}, failed ${counts.failed} → ${outDir}`);
  if (counts.failed) process.exitCode = 1;
}

main().catch((error) => fail(error.message));
