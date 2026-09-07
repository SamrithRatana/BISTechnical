/**
 * Mirrors `src/report-layout/` into the CamID mobile app.
 *
 *   npm run sync:shared      copy, then report
 *   npm run check:report-layout     fail if the copy has drifted
 *
 * ── Why a copy and not an import ──────────────────────────────────────────
 * The two apps are separate npm projects with no workspace between them, and
 * the mobile one is bundled by Metro, which resolves from the project root and
 * does not follow a relative path out of it without `watchFolders` wiring that
 * EAS cloud builds do not reliably reproduce. A checked-in copy plus a drift
 * check is the mechanism that survives `npm ci` and a cloud build; a symlink
 * or a `file:` dependency does not.
 *
 * The check is the important half. Without it this is exactly the duplication
 * the shared layout was created to remove — so it runs in `npm run typecheck`
 * on the web side, and editing the mobile copy directly is a build failure
 * rather than a silent fork.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WEB_SRC = resolve(here, "..", "src");
const MOBILE_SRC = resolve(here, "..", "..", "..", "..", "CamIdMobile", "CamIdMobile", "src");

if (!existsSync(MOBILE_SRC)) {
  console.log("sync-shared: mobile source directory not found (standalone/container build), skipping sync check.");
  process.exit(0);
}

/**
 * The folders mirrored into the phone app, in `src/` on both sides.
 *
 * Each one is code that BOTH platforms must run identically — a layout they
 * both print, a rule they both enforce. Anything that is merely "useful on both"
 * does not belong here; the cost of this mechanism is that the mobile copy is
 * generated and can never be edited directly, so it is only worth paying where
 * a divergence would be a bug rather than a preference.
 */
const SHARED_DIRS = ["report-layout", "validation"];

// No blanket `eslint-disable` here on purpose: the mobile project now lints
// (`npm run lint` -> `expo lint`), the mirrored files pass it clean, and a
// blanket disable would hide a future regression in the shared layout on the
// one side that cannot fix it.
const BANNER = `// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — DO NOT EDIT.
//
// Mirrored from the web app's src/ by
//   TestingReact/scripts/sync-report-layout.mjs
//
// This folder is shared so the phone and the desktop behave identically — one
// printed layout, one set of business rules. Edit the original in the web
// project and re-run \`npm run sync:shared\` in TestingReact.
// ─────────────────────────────────────────────────────────────────────────────
`;

function sourceFiles(dir) {
  return readdirSync(join(WEB_SRC, dir))
    .filter((name) => name.endsWith(".ts"))
    .sort();
}

/** The banner is prepended on copy, so hash only the payload beneath it. */
function payloadOf(text) {
  const normalised = text.replace(/\r\n/g, "\n");
  const banner = BANNER.replace(/\r\n/g, "\n");
  return normalised.startsWith(banner) ? normalised.slice(banner.length) : normalised;
}

function hash(text) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex").slice(0, 16);
}

const mode = process.argv.includes("--check") ? "check" : "write";
const problems = [];
let fileCount = 0;

for (const dir of SHARED_DIRS) {
  const source = join(WEB_SRC, dir);
  const target = join(MOBILE_SRC, dir);

  if (!existsSync(source)) {
    console.error(`sync-shared: ${source} does not exist`);
    process.exit(1);
  }

  const files = sourceFiles(dir);
  if (files.length === 0) {
    console.error(`sync-shared: no .ts files in ${source}`);
    process.exit(1);
  }
  fileCount += files.length;

  if (mode === "write") {
    mkdirSync(target, { recursive: true });

    // Remove stale mirrors so a deleted source file cannot linger and keep
    // compiling on the phone.
    for (const name of readdirSync(target)) {
      if (name.endsWith(".ts") && !files.includes(name)) {
        rmSync(join(target, name));
        console.log(`  removed stale ${dir}/${name}`);
      }
    }

    for (const name of files) {
      writeFileSync(join(target, name), BANNER + readFileSync(join(source, name), "utf8"), "utf8");
    }
    console.log(`sync-shared: mirrored ${files.length} files -> ${target}`);
    continue;
  }

  for (const name of files) {
    const targetPath = join(target, name);
    if (!existsSync(targetPath)) {
      problems.push(`missing in mobile: ${dir}/${name}`);
      continue;
    }
    const expected = hash(readFileSync(join(source, name), "utf8"));
    const actual = hash(payloadOf(readFileSync(targetPath, "utf8")));
    if (expected !== actual) problems.push(`out of date: ${dir}/${name}`);
  }

  for (const name of existsSync(target) ? readdirSync(target) : []) {
    if (name.endsWith(".ts") && !files.includes(name)) {
      problems.push(`extra file in mobile: ${dir}/${name}`);
    }
  }
}

if (mode === "write") process.exit(0);

if (problems.length > 0) {
  console.error("sync-shared: the mobile copy of a shared folder has drifted.\n");
  for (const p of problems) console.error(`  • ${p}`);
  console.error("\nRun `npm run sync:shared` in TestingReact and commit the result.");
  console.error("Never edit the mobile copies directly — they are generated.\n");
  process.exit(1);
}

console.log(`sync-shared: mobile copies are in sync (${SHARED_DIRS.join(", ")} — ${fileCount} files)`);
