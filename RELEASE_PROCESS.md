# TimeScope Release Process

## Current release state

- Latest release: **v0.2.29** (npm, GitHub Release)
- Nothing is pending. Prepare the next release when there is something to ship:

```bash
pnpm release:prepare 0.2.30
```

## The flow at a glance

| # | Step | Who | Command / action |
| - | ---- | --- | ---------------- |
| 1 | Branch, bump versions, validate, open PR | human or LLM | `pnpm release:prepare 0.2.30` |
| 2 | Review and merge the release PR | human | GitHub UI |
| 3 | Tag, publish to npm, GitHub Release + VSIX | GitHub Actions | Actions → **Cut Release** → *Run workflow* → version `0.2.30` |
| 4 | Publish the VSIX to the Marketplace | human | step 4 below |
| 5 | Verify | human or LLM | step 5 below |

Done when: `npm view @rifen/timescope-core version` shows the new version, the
GitHub Release is Latest with `timescope.vsix` attached, the Marketplace lists
the version, and this document's history has been updated through a PR.

## Packages

TimeScope is a multi-package monorepo containing:

- Core library: `@rifen/timescope-core` (published to npm by release CI)
- VS Code extension: `rifen-timescope` (VSIX built by release CI; Marketplace
  publication is manual)
- Neovim plugin: `timescope-nvim` (consumed from GitHub)

## Prerequisites

- Node.js >= 20
- pnpm >= 8
- GitHub CLI (`gh`) authenticated with repository access
- Permission to open/merge pull requests and run the **Cut Release** workflow
- npm publishing permissions for `@rifen/timescope-core` are configured in CI
- Permission to publish the VS Code extension to the Marketplace

## Release rules

- Never release from an unreviewed working tree or push release work straight to
  `main`. Use a fresh branch and pull request every time.
- Direct pushes to `main` and `master` are prohibited. Configure the local
  guard after cloning: `pnpm setup:git-hooks`. The `.githooks/pre-push` hook
  rejects direct pushes to protected branches. Do not bypass it with
  `--no-verify`.
- All four `package.json` versions must match. CI fails fast on mismatch via
  `node scripts/check-versions.mjs`.
- The release tag is immutable. If a tag points at a failed commit, fix the
  issue and use the next patch version; never move or reuse a tag.
- GitHub Releases in this repository are **immutable**. Assets must be attached
  when the release is created; the automation does this.
- The release tag triggers `release.yml`, which publishes only the core npm
  package and creates the GitHub Release with the VSIX. Marketplace publication
  remains manual.
- The lockfile must be committed whenever package manifests change. CI uses
  `--frozen-lockfile` and fails before running tests if it is stale.

## Step 1 — Prepare the release (one command)

```bash
pnpm release:prepare 0.2.30
```

The command verifies preconditions, then performs RELEASE_PROCESS steps that
used to be manual:

1. Checks a clean tracked tree, `gh` authentication, and that `main` matches
   `origin/main`.
2. Defaults the version to the next patch of the current manifests and verifies
   it is free on npm and as a tag (pass an explicit version to override).
3. Creates `chore/release-v<version>` from `main`.
4. Bumps the four manifests and updates this document plus the release workflow
   example.
5. Runs `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm run build`,
   `pnpm test`, `pnpm test:e2e` (skip with `--skip-e2e`), and `git diff --check`.
6. Commits `chore(release): prepare v<version>`, pushes, and opens the release
   pull request.

Flags: `--skip-e2e`, `--dry-run` (verify and print the plan without changing
anything). `pnpm test` runs the VS Code extension host, which needs a display
or `xvfb`; `--skip-e2e` does not skip it, but CI covers it.

Manual fallback (identical outcome, for humans who prefer it):

```bash
git switch main && git pull --ff-only origin main
git switch -c chore/release-v0.2.30
# bump the four package.json versions to 0.2.30, update this document
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build && pnpm test && pnpm test:e2e && git diff --check
git add package.json packages/*/package.json pnpm-lock.yaml RELEASE_PROCESS.md .github/workflows/release.yml
git commit -m "chore(release): prepare v0.2.30"
git push -u origin chore/release-v0.2.30
gh pr create --base main --head chore/release-v0.2.30 --title "chore(release): prepare v0.2.30"
```

## Step 2 — Merge the release PR

The PR must pass CI: the version-match check, frozen-lockfile install, core
tests, Neovim bridge tests, VS Code tests, editor E2E, package/VSIX build,
CodeQL, and Opengrep. Merge with the repository's normal merge policy. Start
step 3 only after the merge is on `origin/main`.

## Step 3 — Cut the release (tag + npm + GitHub Release + VSIX)

One click: GitHub → Actions → **Cut Release** → *Run workflow* → enter the
version (for example `0.2.30`) → **Run workflow**. Or:

```bash
gh workflow run release-cut.yml --ref main -f version=0.2.30
```

The workflow verifies that the four manifests match the version and that the
tag and npm version are free, then creates the annotated tag `v<version>` on
`main`. The tag push triggers **Publish Packages**:

1. `publish-core` publishes `@rifen/timescope-core` to npm with provenance.
2. `github-release` builds the VSIX and creates the GitHub Release with the
   VSIX attached at creation (releases here are immutable).

Monitor:

```bash
gh run list --workflow "Publish Packages" --limit 5
gh run watch <RUN_ID> --exit-status
```

## Step 4 — Publish the VSIX to the Marketplace (manual)

The release workflow attaches `timescope.vsix` to the GitHub Release. Download
it and publish (Marketplace publication is intentionally not automated; see
AGENTS.md):

```bash
gh release download v0.2.30 -p "timescope.vsix"
npx @vscode/vsce publish --no-dependencies --packagePath timescope.vsix
```

`vsce publish` requires `VSCE_PAT`. Do not add runtime dependencies to
`packages/vscode/package.json`; packaging must use `--no-dependencies`.

## Step 5 — Verify

```bash
npm view @rifen/timescope-core version   # -> 0.2.30
gh release view v0.2.30                  # Latest, timescope.vsix attached
git ls-remote --tags origin v0.2.30
```

Also confirm the Marketplace version matches, then update the Release History
below through a pull request.

## Recovery and troubleshooting

### npm publish fails (for example E503 maintenance)

The npm registry may be temporarily unavailable. Wait for
https://status.npmjs.org to recover, then re-run **Publish Packages** with
`release_tag=v<version>` (workflow_dispatch). A version that was actually
published cannot be republished; if npm succeeded but a later job failed,
create the GitHub Release manually:

```bash
gh release create v<version> timescope.vsix --title "TimeScope v<version>" --generate-notes --verify-tag
```

### CI fails before tests with `ERR_PNPM_OUTDATED_LOCKFILE`

Regenerate the lockfile on the release branch, validate with a frozen install,
commit it, and update the pull request. Do not bypass the failure with
`--no-frozen-lockfile` in CI.

### Neovim E2E cannot find `bin/timescope-bridge.js`

The bridge is generated and ignored by Git. Run:

```bash
pnpm --filter timescope-nvim build
```

The root `pnpm test:e2e` command performs this build automatically.

### Jest reports `No tests found` for Neovim

Ensure `packages/nvim/bin/__tests__/bridge.test.ts` is tracked. The Neovim
`.gitignore` must ignore generated bridge output without ignoring this test
source.

### A tag already exists

Tags are protected and must not be moved. Do not delete or force-push the tag.
Use the next patch version, update all package manifests, merge the fix through
a pull request, and cut the release again.

### VS Code packaging fails

Verify that:

- `packages/vscode/dist/extension.js` exists after the build
- `packages/vscode/tsconfig.json` uses `rootDir: "src"`
- `packages/vscode/.vscodeignore` includes `!dist/**`
- `vscode:prepublish` remains a no-op
- `vsce package` uses `--no-dependencies`

## Release History

Update this list after each completed release. Use `git tag` and GitHub
Releases as the source of truth.

- v0.2.29 - Released (npm, GitHub Release). First release on the automated
  flow; the VSIX was not attached because immutable releases reject
  post-publication uploads (fixed for future releases).
- v0.2.28 - Released (npm and GitHub Release)
- v0.2.27 - Tag exists, but the release workflow failed before publication
- v0.2.26 - Released (npm and GitHub Release)

## Automation boundaries

Automated:

- CI tests, builds, E2E checks, and VSIX artifact creation
- npm publication of `@rifen/timescope-core` after a release tag
- GitHub Release creation with the VSIX attached
- Release preparation (branch, version bump, PR) via `pnpm release:prepare`
- Tag creation via the **Cut Release** workflow

Manual:

- Running `pnpm release:prepare` and the **Cut Release** workflow
- Reviewing and merging the release pull request
- Publishing the VSIX to the VS Code Marketplace
- Neovim release communication through GitHub

## For automated agents (LLMs)

- Prepare releases with `pnpm release:prepare <version>`; never edit the four
  manifests by hand and never tag locally.
- Tags are created **only** through the **Cut Release** workflow dispatch and
  are immutable once pushed.
- Never push directly to `main` and never use `--no-verify`.
- If `pnpm release:prepare` fails, fix the reported step or open a regular
  branch and PR; do not improvise release steps.
- After a release, update the Release History through a pull request.
- Validation commands a human may ask you to run: `pnpm test`, `pnpm test:e2e`,
  `pnpm run build`, `git diff --check`, and `node scripts/check-versions.mjs`.
