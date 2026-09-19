#!/usr/bin/env node
/**
 * TimeScope release preparation — RELEASE_PROCESS.md steps 1-3 in one command.
 *
 * Usage:
 *   pnpm release:prepare [version] [--skip-e2e] [--dry-run]
 *
 * - `version` defaults to the next patch of the current manifest version.
 * - Creates `chore/release-v<version>` from an up-to-date `main`, bumps the
 *   four manifests, updates RELEASE_PROCESS.md and the release workflow
 *   example, runs the validation suite, commits, pushes, and opens the
 *   release pull request.
 * - `--dry-run` verifies everything and prints the plan without switching
 *   branches, touching files, or creating remotes.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFESTS = [
  "package.json",
  "packages/core/package.json",
  "packages/nvim/package.json",
  "packages/vscode/package.json",
];
const RELEASE_PROCESS = "RELEASE_PROCESS.md";
const RELEASE_WORKFLOW = ".github/workflows/release.yml";
const NPM_PACKAGE = "@rifen/timescope-core";

const argv = process.argv.slice(2);
const skipE2E = argv.includes("--skip-e2e");
const dryRun = argv.includes("--dry-run");
const requested = argv.find((argument) => !argument.startsWith("--"));

if (requested !== undefined && !/^\d+\.\d+\.\d+$/.test(requested)) {
  fail("Version must be X.Y.Z (for example 0.2.30).");
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function step(number, total, label) {
  console.log(`\n==> [${number}/${total}] ${label}`);
}

function git(args, options = {}) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      ...options,
    }).trim();
  } catch (error) {
    fail(
      `git ${args.join(" ")} failed:\n${String(error.stdout || error.stderr || error.message).trim()}`,
    );
  }
}

function run(label, command, args) {
  console.log(`    ${label}: $ ${command} ${args.join(" ")}`);
  try {
    execFileSync(command, args, { cwd: ROOT, stdio: "inherit" });
  } catch (error) {
    fail(`${label} failed (exit ${error.status ?? "?"}).`);
  }
}

function readManifestVersion(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")).version;
  } catch (error) {
    fail(`Cannot read ${file}: ${error.message}`);
  }
}

function npmHasVersion(version) {
  try {
    execFileSync("npm", ["view", `${NPM_PACKAGE}@${version}`, "version"], {
      cwd: ROOT,
      stdio: "ignore",
    });
    return true;
  } catch {
    // npm registry errors (for example E503 maintenance) read as "not
    // published"; the publish workflow re-checks before publishing.
    return false;
  }
}

function compareSemver(a, b) {
  const [aMajor, aMinor, aPatch] = a.split(".").map(Number);
  const [bMajor, bMinor, bPatch] = b.split(".").map(Number);
  return (
    aMajor - bMajor || aMinor - bMinor || aPatch - bPatch
  );
}

const STEPS = 7;

// ---------------------------------------------------------------- 1. Guard
step(1, STEPS, "Preconditions");

if (process.platform === "win32") {
  fail("This script targets POSIX shells; run it from Linux, macOS, or WSL.");
}

try {
  execFileSync("gh", ["--version"], { cwd: ROOT, stdio: "ignore" });
} catch {
  fail("GitHub CLI (gh) must be installed and authenticated (`gh auth login`).");
}

const dirty = git(["status", "--porcelain"])
  .split("\n")
  .filter((entry) => entry && !entry.startsWith("??"));
if (dirty.length > 0) {
  fail(`Working tree has uncommitted changes:\n${dirty.join("\n")}`);
}

try {
  git(["fetch", "--force", "--tags", "origin", "--quiet"]);
} catch (error) {
  fail(
    `git fetch failed. Run git fetch --force --tags origin manually and retry. ${error.message}`,
  );
}

const localMain = git(["rev-parse", "main"]);
const originMain = git(["rev-parse", "origin/main"]);
if (localMain !== originMain) {
  fail(
    "Local main is not up to date with origin/main. " +
      "Run: git switch main && git pull --ff-only origin main",
  );
}

const currentVersion = readManifestVersion(MANIFESTS[0]);
const mismatched = MANIFESTS.filter(
  (file) => readManifestVersion(file) !== currentVersion,
);
if (mismatched.length > 0) {
  fail(
    `Manifests disagree with ${MANIFESTS[0]} (${currentVersion}): ${mismatched.join(", ")}. ` +
      "Fix the versions before preparing a release.",
  );
}

console.log(`    current version: ${currentVersion}`);

// ------------------------------------------------------- 2. Target version
step(2, STEPS, "Determine the release version");

const version =
  requested ??
  (() => {
    const [major, minor, patch] = currentVersion.split(".").map(Number);
    return `${major}.${minor}.${patch + 1}`;
  })();

if (compareSemver(version, currentVersion) <= 0) {
  fail(
    `Version ${version} must be greater than the current ${currentVersion}.`,
  );
}

if (npmHasVersion(version)) {
  fail(`${NPM_PACKAGE}@${version} is already published to npm.`);
}
let tagExistsLocally = false;
try {
  // rev-parse exits non-zero when the ref does not exist, which is the
  // expected outcome here.
  execFileSync("git", ["rev-parse", "-q", "--verify", `refs/tags/v${version}`], {
    cwd: ROOT,
    stdio: "ignore",
  });
  tagExistsLocally = true;
} catch {
  tagExistsLocally = false;
}
if (tagExistsLocally) {
  fail(`Tag v${version} already exists locally. Tags are immutable; choose another version.`);
}
if (git(["ls-remote", "--tags", "origin", `refs/tags/v${version}`]) !== "") {
  fail(`Tag v${version} already exists on origin. Tags are immutable; choose another version.`);
}

const branch = `chore/release-v${version}`;
if (git(["ls-remote", "--heads", "origin", branch]) !== "") {
  fail(`Branch ${branch} already exists on origin; a release for ${version} may already be in flight.`);
}

console.log(`    release version: ${version}`);

// ------------------------------------------------------------- 3. Branch
if (dryRun) {
  console.log("\n[ dry-run ] Everything checks out. The script would:");
  console.log(`[ dry-run ]   1. git switch main && git pull --ff-only origin main`);
  console.log(`[ dry-run ]   2. git switch -c ${branch}`);
  console.log(`[ dry-run ]   3. bump ${MANIFESTS.join(", ")} to ${version}`);
  console.log(`[ dry-run ]   4. update ${RELEASE_PROCESS} and ${RELEASE_WORKFLOW}`);
  console.log(`[ dry-run ]   5. run the validation suite${skipE2E ? " (without e2e)" : ""}`);
  console.log(`[ dry-run ]   6. commit, push, and open the release PR`);
  console.log("\n[ dry-run ] Nothing was changed. Re-run without --dry-run to execute.");
  process.exit(0);
}

step(3, STEPS, `Create ${branch} from main`);
git(["switch", "main"]);
run("pull main", "git", ["pull", "--ff-only", "origin", "main"]);
git(["switch", "-c", branch]);

// ------------------------------------------------- 4. Bump files and docs
step(4, STEPS, `Bump manifests and release documentation to ${version}`);

for (const file of MANIFESTS) {
  const manifestPath = path.join(ROOT, file);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`Cannot read ${file}: ${error.message}`);
  }
  manifest.version = version;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`    bumped ${file} -> ${version}`);
}

const processPath = path.join(ROOT, RELEASE_PROCESS);
const releaseDoc = fs.readFileSync(processPath, "utf8");
if (!/The next release currently being prepared is\s+\*\*[\d.]+\*\*\./.test(releaseDoc)) {
  fail(`${RELEASE_PROCESS} no longer contains the "next release" marker.`);
}
const updatedDoc = releaseDoc.replace(
  /The next release currently being prepared is\s+\*\*[\d.]+\*\*\./,
  `The next release currently being prepared is\n**${version}**.`,
);
const docLines = updatedDoc
  .split("\n")
  .filter((line) => !/^- v\d+\.\d+\.\d+ - In preparation/.test(line));
const firstHistoryLine = docLines.findIndex((line) =>
  /^- v\d+\.\d+\.\d+/.test(line),
);
if (firstHistoryLine === -1) {
  fail(`${RELEASE_PROCESS} no longer contains the release history list.`);
}
docLines.splice(
  firstHistoryLine,
  0,
  `- v${version} - In preparation (opened by \`pnpm release:prepare\`)`,
);
fs.writeFileSync(processPath, `${docLines.join("\n")}`);

const workflowPath = path.join(ROOT, RELEASE_WORKFLOW);
let releaseWorkflow = fs.readFileSync(workflowPath, "utf8");
if (!/Existing release tag to publish \(for example, v\d+\.\d+\.\d+\)/.test(releaseWorkflow)) {
  fail(`${RELEASE_WORKFLOW} no longer contains the example tag.`);
}
releaseWorkflow = releaseWorkflow.replace(
  /Existing release tag to publish \(for example, v\d+\.\d+\.\d+\)/,
  `Existing release tag to publish (for example, v${version})`,
);
fs.writeFileSync(workflowPath, releaseWorkflow);

// ------------------------------------------------------- 5. Validation
step(5, STEPS, "Validation");
run("frozen install", "pnpm", ["install", "--frozen-lockfile", "--ignore-scripts"]);
run("build", "pnpm", ["run", "build"]);
run("tests", "pnpm", ["test"]);
if (!skipE2E) {
  run("editor e2e", "pnpm", ["test:e2e"]);
}
git(["diff", "--check"]);

// ------------------------------------------------------- 6. Commit
step(6, STEPS, "Commit");
const changed = git(["status", "--porcelain"])
  .split("\n")
  .filter((entry) => entry && !entry.startsWith("??"))
  .map((entry) => entry.slice(3));
const allowed = new Set([...MANIFESTS, RELEASE_PROCESS, RELEASE_WORKFLOW, "pnpm-lock.yaml"]);
const unexpected = changed.filter((file) => !allowed.has(file));
if (unexpected.length > 0) {
  fail(`Unexpected files changed during preparation:\n${unexpected.join("\n")}`);
}
if (changed.length === 0) {
  fail("Nothing changed during preparation; refusing to create an empty commit.");
}

git(["add", "--", ...changed]);
execFileSync(
  "git",
  [
    "commit",
    "-m",
    `chore(release): prepare v${version}`,
    "-m",
    `Bump all four manifests to ${version} and update the release-state documentation.`,
  ],
  { cwd: ROOT, stdio: "inherit" },
);

// ---------------------------------------------------- 7. Push and PR
step(7, STEPS, "Push and open the release pull request");
git(["push", "-u", "origin", branch]);

const prBody = [
  "## Summary",
  "",
  `Prepares the **v${version}** release by bumping all four package manifests to \`${version}\` and updating the release-state documentation.`,
  "",
  "## Test plan",
  "",
  "- [x] `pnpm install --frozen-lockfile --ignore-scripts`",
  "- [x] `pnpm run build`",
  "- [x] `pnpm test`",
  skipE2E ? "- [ ] `pnpm test:e2e` (skipped locally; CI runs it)" : "- [x] `pnpm test:e2e`",
  "- [x] `git diff --check`",
  "",
  "After merge: run the **Cut Release** workflow with version",
  `\`${version}\` to tag, publish to npm, and create the GitHub Release with the VSIX.`,
  "",
].join("\n");
const prBodyPath = path.join(os.tmpdir(), `timescope-release-pr-${version}.md`);
fs.writeFileSync(prBodyPath, prBody);

let prUrl;
try {
  prUrl = execFileSync(
    "gh",
    [
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      branch,
      "--title",
      `chore(release): prepare v${version}`,
      "--body-file",
      prBodyPath,
    ],
    { cwd: ROOT, encoding: "utf8" },
  ).trim();
} catch (error) {
  fail(`Branch pushed, but the pull request failed to open: ${error.message}`);
}

console.log(`\n✔ Release branch ready: ${prUrl}`);
console.log("\nNext steps (RELEASE_PROCESS.md):");
console.log(`  1. Review and merge the pull request.`);
console.log(`  2. Actions → "Cut Release" → Run workflow → version ${version}`);
console.log("     (tags main, publishes to npm, creates the GitHub Release with the VSIX).");
console.log("  3. Publish the VSIX to the Marketplace from the GitHub Release assets.");
