#!/usr/bin/env node
/**
 * Set the same version in all four package manifests.
 *
 * Usage: node scripts/bump-versions.mjs <version>
 *
 * - No-op when the manifests already carry <version>.
 * - Fails when the manifests are newer than <version> (downgrade guard).
 * - Used by the Cut Release workflow (auto-bump on main).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "package.json",
  "packages/core/package.json",
  "packages/nvim/package.json",
  "packages/vscode/package.json",
];

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node scripts/bump-versions.mjs <version>  (X.Y.Z)");
  process.exit(1);
}

const manifests = FILES.map((file) => {
  const full = path.join(ROOT, file);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (error) {
    console.error(`Cannot read ${file}: ${error.message}`);
    process.exit(1);
  }
  return { file, full, manifest, version: manifest.version };
});

if (new Set(manifests.map((m) => m.version)).size !== 1) {
  console.error(
    "Manifest versions do not match; fix them before bumping: " +
      manifests.map((m) => `${m.file}=${m.version}`).join(", "),
  );
  process.exit(1);
}

function compareSemver(a, b) {
  const [aMajor, aMinor, aPatch] = a.split(".").map(Number);
  const [bMajor, bMinor, bPatch] = b.split(".").map(Number);
  return aMajor - bMajor || aMinor - bMinor || aPatch - bPatch;
}

const current = manifests[0].version;
if (compareSemver(current, version) > 0) {
  console.error(`Refusing to downgrade: manifests are at ${current}.`);
  process.exit(1);
}
if (current === version) {
  console.log(`Manifests already at ${version}; nothing to do.`);
  process.exit(0);
}

for (const m of manifests) {
  m.manifest.version = version;
  fs.writeFileSync(m.full, `${JSON.stringify(m.manifest, null, 2)}\n`);
  console.log(`bumped ${m.file} -> ${version}`);
}