import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

// Run after `npm run build`. Exercise the built route with require(esm) disabled,
// matching the runtime failure that cannot be caught by mocked Firebase tests.
const cwd = fileURLToPath(new URL("../", import.meta.url));
const port = process.env.SMOKE_PORT || "3012";
const child = spawn(process.execPath, [
  "--no-experimental-require-module", "node_modules/next/dist/bin/next",
  "start", "-H", "127.0.0.1", "-p", port,
], {
  cwd, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, FIREBASE_PROJECT_ID: "runtime-test", NODE_ENV: "production" },
});
let output = "";
const exited = once(child, "exit");
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timed out")), 30_000);
    const read = (chunk) => {
      output += chunk.toString();
      if (output.includes("Ready in")) { clearTimeout(timer); resolve(); }
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", () => { clearTimeout(timer); reject(new Error("Server exited before smoke checks")); });
  });
  const base = `http://127.0.0.1:${port}`;
  const origin = "https://ollie-reader.web.app";
  for (const [path, header] of [["/api/oikid/booking-records", "authorization"], ["/api/version", "cache-control"]]) {
    const response = await fetch(base + path, { method: "OPTIONS", signal: AbortSignal.timeout(10_000), headers: {
      Origin: origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": header,
    } });
    assert.equal(response.status, 204, `${path} preflight`);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.ok(response.headers.get("access-control-allow-headers").toLowerCase().includes(header));
  }
  for (const [headers, expected] of [[{}, 401], [{ Authorization: "Bearer invalid" }, 403]]) {
    const response = await fetch(`${base}/api/oikid/booking-records`, {
      headers: { ...headers, Origin: origin }, signal: AbortSignal.timeout(10_000),
    });
    assert.equal(response.status, expected, "Firebase auth guard");
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.ok((await response.json()).detail);
  }
  console.log("Production runtime smoke passed: booking/version preflight and Firebase auth guards with require(esm) disabled.");
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  const force = setTimeout(() => child.kill("SIGKILL"), 5000);
  await exited;
  clearTimeout(force);
}
