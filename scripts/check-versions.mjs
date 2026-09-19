#!/usr/bin/env node
/**
 * Verify that all four package manifests carry the same version.
 *
 * Usage:
 *   node scripts/check-versions.mjs
 *   node scripts/check-versions.mjs --expect 0.2.30
 *
 * Exits 1 when the versions differ, or when --expect is given and the
 * manifests do not carry that exact version. Used by CI and by
 * `pnpm release:prepare`.
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

const versions = FILES.map((file) => {
  const fullPath = path.join(ROOT, file);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    console.error(`Cannot read ${file}: ${error.message}`);
    process.exit(1);
  }
  return [file, manifest.version];
});

console.table(versions);

if (new Set(versions.map(([, version]) => version)).size !== 1) {
  console.error(
    "Package versions do not match across manifests. Bump all four together (see RELEASE_PROCESS.md).",
  );
  process.exit(1);
}

const expectIndex = process.argv.indexOf("--expect");
if (expectIndex !== -1) {
  const expected = process.argv[expectIndex + 1];
  if (!expected || !/^\d+\.\d+\.\d+$/.test(expected)) {
    console.error("--expect requires a version in the form X.Y.Z");
    process.exit(1);
  }
  if (versions[0][1] !== expected) {
    console.error(
      `Manifests are at ${versions[0][1]}, but ${expected} was expected.`,
    );
    process.exit(1);
  }
}
