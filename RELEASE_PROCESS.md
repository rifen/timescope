# TimeScope Release Process

## Current release state

- Latest release: **v0.2.31** (npm, GitHub Release with VSIX, Neovim artifact
  branch)
- Nothing is pending. To ship the next version (for example 0.2.31), follow
  the flow below: it is one click to open the release PR, one merge to publish.

## The flow at a glance

| # | Step | Who | Command / action |
| - | ---- | --- | ---------------- |
| 1 | Open the version-bump PR | one click | Actions → **Cut Release** → *Run workflow* → version `0.2.31` |
| 2 | Merge the bump PR → automatic publish | human | GitHub UI |
| 3 | Publish the VSIX to the Marketplace | human | step 3 below |
| 4 | Verify and update the release history | human or LLM | step 4 below |

Merging the bump PR triggers the automated publish: release tag → npm with
provenance → GitHub Release with the VSIX → Neovim artifact branch. No
clone, no build, no manual version edits.

Done when: `npm view @rifen/timescope-core version` shows the new version, the
GitHub Release is Latest with `timescope.vsix` attached, the Marketplace lists
the version, `nvim-v<version>` exists on origin, and this document's history
has been updated through a PR.

## Packages

TimeScope is a multi-package monorepo containing:

- Core library: `@rifen/timescope-core` (published to npm by release CI)
- VS Code extension: `rifen-timescope` (VSIX built and attached by release CI;
  Marketplace publication is manual)
- Neovim plugin: published by release CI as the `nvim` artifact branch and
  `nvim-v*` tags of this repository

## Prerequisites

- Node.js >= 20
- pnpm >= 8
- GitHub CLI (`gh`) authenticated with repository access
- Permission to open/merge pull requests and run the **Cut Release** workflow
- npm publishing permissions for `@rifen/timescope-core` are configured in CI
- Permission to publish the VS Code extension to the Marketplace

## Release rules

- Never release from an unreviewed working tree. The **Cut Release** workflow
  opens the version-bump PR; humans review and merge it.
- Direct pushes to `main` and `master` are prohibited — for humans and for CI.
  Configure the local guard after cloning: `pnpm setup:git-hooks`. The
  `.githooks/pre-push` hook rejects direct pushes to protected branches. Do
  not bypass it with `--no-verify`.
- All four `package.json` versions must match. CI fails fast on mismatch via
  `node scripts/check-versions.mjs`; the **Cut Release** workflow updates them
  automatically.
- The release tag is immutable. If a tag points at a failed commit, fix the
  issue and cut the next patch version; never move or reuse a tag.
- GitHub Releases in this repository are **immutable**. Assets must be
  attached when the release is created; the automation does this.
- The release tag triggers `release.yml`, which publishes only the core npm
  package and creates the GitHub Release with the VSIX and the Neovim
  artifact branch. Marketplace publication remains manual.
- The lockfile must be committed whenever package manifests change. CI uses
  `--frozen-lockfile` and fails before running tests if it is stale.

## Step 1 — Open the version-bump PR (one click)

GitHub → Actions → **Cut Release** → *Run workflow* → enter the version (for
example `0.2.31`) → **Run workflow**. Or:

```bash
gh workflow run release-cut.yml --ref main -f version=0.2.31
```

The workflow verifies that the tag and npm version are free, then:

- if the manifests already carry the requested version, it tags `main`
  directly (use this after a partial release failure);
- otherwise it opens a pull request titled
  `chore(release): bump to <version>` with the four-manifest version bump.

Alternative (reviewed locally before pushing): run
`pnpm release:prepare 0.2.31` — it performs the same bump on a release
branch, validates the full suite locally, and opens the same PR. Both paths
end with the same pull request.

## Step 2 — Merge the bump PR (publishes automatically)

Review the PR (it contains only the four-manifest version bump) and merge it.
The merge triggers the automated publish:

1. **Tag Release** creates the annotated tag `v<version>` on the merge commit
   and dispatches **Publish Packages** (tag-on-merge workflow).
2. **Publish Packages** (`release.yml`) then:
   - publishes `@rifen/timescope-core` to npm with provenance;
   - builds the VSIX and creates the GitHub Release with it attached
     (releases are immutable — the asset is attached at creation);
   - publishes the Neovim artifact: the orphan branch `nvim` with the plugin
     and the prebuilt bridge, tagged `nvim-v<version>`.

Monitor:

```bash
gh run list --limit 5
gh run watch <RUN_ID> --exit-status
```

Do not publish manually to npm unless the release workflow has been
deliberately changed and these instructions updated.

## Step 3 — Publish the VSIX to the Marketplace (manual)

Download the VSIX from the GitHub Release assets and publish:

```bash
gh release download v0.2.31 -p "timescope.vsix"
npx @vscode/vsce publish --no-dependencies --packagePath timescope.vsix
```

`vsce publish` requires `VSCE_PAT`. Marketplace publication is intentionally
not automated (see AGENTS.md): no OIDC-capable publisher organization exists.
Do not add runtime dependencies to `packages/vscode/package.json`; packaging
must use `--no-dependencies`.

## Step 4 — Verify

```bash
npm view @rifen/timescope-core version   # -> 0.2.31
gh release view v0.2.31                  # Latest, timescope.vsix attached
git ls-remote --tags origin v0.2.31
git ls-remote --tags origin nvim-v0.2.31
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

- v0.2.30 - Released (npm, GitHub Release with VSIX attached, Neovim artifact
  branch + tag). First release using the version-bump PR + tag-on-merge flow.
- v0.2.29 - Released (npm, GitHub Release). First release on the automated
  flow; the VSIX was not attached because immutable releases reject
  post-publication uploads (fixed for future releases).
- v0.2.28 - Released (npm and GitHub Release)
- v0.2.27 - Tag exists, but the release workflow failed before publication
- v0.2.26 - Released (npm and GitHub Release)

## Automation boundaries

Automated:

- CI tests, builds, E2E checks, and VSIX artifact creation
- Version-bump PR opened by the **Cut Release** workflow
- Release tag created when the version bump merges to `main`
- npm publication of `@rifen/timescope-core` after a release tag
- GitHub Release creation with the VSIX attached
- Neovim artifact branch (`nvim`) and `nvim-v*` tags

Manual:

- Running the **Cut Release** workflow
- Reviewing and merging the version-bump pull request
- Publishing the VSIX to the VS Code Marketplace
- Updating the Release History through a pull request
- Neovim release communication through GitHub

## For automated agents (LLMs)

- To ship a release, run the **Cut Release** workflow dispatch with the target
  version (or ask the human to), then merge the version-bump PR it opens —
  everything after the merge is automated. Never edit the four manifests by
  hand and never tag locally.
- Tags are immutable once pushed; never push directly to `main`; never use
  `--no-verify`.
- If a step fails, follow the Recovery section above or fix the reported step
  in a pull request; do not improvise release steps.
- Validation commands a human may ask you to run: `pnpm test`, `pnpm test:e2e`,
  `pnpm run build`, `git diff --check`, and `node scripts/check-versions.mjs`.
