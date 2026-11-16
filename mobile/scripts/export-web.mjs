#!/usr/bin/env node
/**
 * Static export of the web UI for the Capacitor apps.
 *
 * The Next app has two server-only API routes; `output: "export"` refuses to
 * build them, so they are moved aside for the duration of the export build
 * and restored afterwards. The exported bundle has no server: it calls the
 * hosted deployment instead (NEXT_PUBLIC_API_BASE) and builds share links
 * against the public site URL (NEXT_PUBLIC_SITE_URL).
 *
 * Usage: node mobile/scripts/export-web.mjs [siteUrl]
 * Env:   SITE_URL  — overrides the default deployment URL.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const apiDir = join(root, "src", "app", "api");
const apiBackup = join(root, ".mobile-api-backup");
const outDir = join(root, "out");
const wwwDir = join(root, "mobile", "www");

const siteUrl = (process.argv[2] ?? process.env.SITE_URL ?? "https://meetinthemiddlefair.vercel.app").replace(/\/+$/, "");

function die(message) {
  console.error(`export-web: ${message}`);
  process.exit(1);
}

// Recover from an interrupted earlier run before touching anything.
if (existsSync(apiBackup)) {
  if (existsSync(apiDir)) {
    rmSync(apiBackup, { recursive: true, force: true });
  } else {
    renameSync(apiBackup, apiDir);
    console.log("export-web: restored src/app/api from a previous interrupted run");
  }
}
if (!existsSync(apiDir)) die("src/app/api not found");

try {
  // The API routes cannot exist during an export build.
  renameSync(apiDir, apiBackup);
  // Stale generated types (e.g. from `next dev`) still reference the moved routes.
  rmSync(join(root, ".next"), { recursive: true, force: true });

  console.log(`export-web: building static bundle for ${siteUrl}`);
  const nextBin = join(root, "node_modules", ".bin", "next");
  execFileSync(nextBin, ["build"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      MOBILE: "1",
      NEXT_PUBLIC_API_BASE: siteUrl,
      NEXT_PUBLIC_SITE_URL: siteUrl,
    },
  });
} finally {
  if (existsSync(apiBackup)) {
    if (existsSync(apiDir)) rmSync(apiBackup, { recursive: true, force: true });
    else renameSync(apiBackup, apiDir);
  }
}

if (!existsSync(join(outDir, "index.html"))) die("next build produced no out/index.html");
rmSync(wwwDir, { recursive: true, force: true });
mkdirSync(wwwDir, { recursive: true });
renameSync(outDir, wwwDir);
console.log(`export-web: static bundle ready in mobile/www (${siteUrl})`);
