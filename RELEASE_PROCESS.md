# TimeScope Release Process

## Current release state

The package versions in the repository should always match. Update this section
when a release is completed. The next release currently being prepared is
**0.2.28**.

The GitHub Releases page is separate from git tags. It must also be updated for
every release; do not leave the previous release (for example, `v0.2.26`) as the
latest GitHub release after publishing a newer version.

## Packages

TimeScope is a multi-package monorepo containing:

- Core library: `@rifen/timescope-core` (published to npm by release CI)
- VS Code extension: `rifen-timescope` (packaged by CI; Marketplace publication
  is manual)
- Neovim plugin: `timescope-nvim` (consumed from GitHub)

## Prerequisites

- Node.js >= 20
- pnpm >= 8
- GitHub CLI (`gh`) authenticated with repository access
- Permission to open/merge pull requests and push tags
- npm publishing permissions for `@rifen/timescope-core` are configured in CI
- Permission to publish the VS Code extension to the Marketplace

## Important release rules

- Never release directly from an unreviewed working tree or push release work
  straight to `main`. Use a fresh branch and pull request every time.
- Direct pushes to `main` and `master` are prohibited. Configure the local guard
  after cloning:

  ```bash
  pnpm setup:git-hooks
  ```

  The `.githooks/pre-push` hook rejects direct pushes to protected branches. Do
  not bypass it with `--no-verify`.
- Before starting work, verify the branch:

  ```bash
  git status --short --branch
  git switch -c chore/release-vX.Y.Z
  ```
- All four `package.json` versions must match: the workspace root, core, nvim,
  and vscode packages.
- The release tag is immutable in this repository. If a tag points at a failed
  commit, do not try to move it; fix the issue and use the next patch version.
- The release workflow is triggered by a `vX.Y.Z` tag. It publishes only the
  core npm package. The normal CI workflow builds and uploads the VS Code VSIX;
  Marketplace publication remains a manual step.
- The lockfile must be committed whenever package manifests change. CI uses
  `--frozen-lockfile` and will fail before running tests if it is stale.

## 1. Prepare a release branch

Start from an up-to-date `main` and create a release branch:

```bash
git switch main
git pull --ff-only origin main
git switch -c chore/release-vX.Y.Z
```

Install with the same constraints used by CI:

```bash
pnpm install --frozen-lockfile --ignore-scripts
```

If dependencies or package manifests changed during preparation, regenerate and
commit the lockfile before attempting the release:

```bash
pnpm install --lockfile-only --ignore-scripts
pnpm install --frozen-lockfile --ignore-scripts
```

Run the complete local validation suite:

```bash
pnpm test
pnpm test:e2e
pnpm run build
git diff --check
```

`pnpm test:e2e` builds the generated Neovim bridge before launching the
headless Neovim test. On a Linux machine without a display, use
`xvfb-run -a pnpm test:e2e`.

## 2. Bump all package versions

Set the same semantic version in all four manifests:

- `package.json`
- `packages/core/package.json`
- `packages/nvim/package.json`
- `packages/vscode/package.json`

For example, for `0.2.28`:

```json
{
  "version": "0.2.28"
}
```

Verify that they match:

```bash
node - <<'NODE'
const fs = require('fs');
const files = [
  'package.json',
  'packages/core/package.json',
  'packages/nvim/package.json',
  'packages/vscode/package.json',
];
const versions = files.map((file) => [file, JSON.parse(fs.readFileSync(file)).version]);
console.table(versions);
if (new Set(versions.map(([, version]) => version)).size !== 1) process.exit(1);
NODE
```

Update version-specific documentation only where necessary, then rerun the
validation commands from step 1.

## 3. Commit and open a pull request

Do not push this work directly to `main`:

```bash
git add package.json packages/*/package.json pnpm-lock.yaml README.md RELEASE_PROCESS.md
git commit -m "chore(release): prepare vX.Y.Z"
git push -u origin chore/release-vX.Y.Z
gh pr create --base main --head chore/release-vX.Y.Z \
  --title "chore(release): prepare vX.Y.Z"
```

The pull request must pass the required CI checks, including:

- frozen-lockfile installation
- core tests
- Neovim bridge tests
- VS Code tests
- editor E2E tests
- package/VSIX build
- CodeQL, where required

Merge the pull request using the repository's normal merge policy. Start the
tagging step only after the merge has completed and the release commit is on
`origin/main`.

## 4. Create and push the release tag

From the merged `main` commit, verify the version and create an annotated tag:

```bash
git switch main
git pull --ff-only origin main
git show HEAD:package.json | grep '"version"'
git tag -a vX.Y.Z -m "Release version X.Y.Z"
git push origin vX.Y.Z
```

Pushing the tag starts `.github/workflows/release.yml`. The workflow checks
that the version is not already on npm, builds the core package, and publishes
`@rifen/timescope-core` with npm provenance.

Monitor the run:

```bash
gh run list --workflow "Publish Packages" --limit 5
gh run watch <RUN_ID> --exit-status
```

Do not publish manually to npm unless the release workflow has been deliberately
changed and the release instructions have been updated accordingly.

## 5. Update the GitHub Release

A git tag and a GitHub Release are different objects. After the tag and release
CI are successful, create or update the GitHub Release for the new version.
This is required on every release.

If no GitHub Release exists for the tag:

```bash
gh release create vX.Y.Z \
  --title "TimeScope vX.Y.Z" \
  --generate-notes
```

If a draft or existing release needs updating:

```bash
gh release edit vX.Y.Z \
  --title "TimeScope vX.Y.Z" \
  --notes-file release-notes.md
```

Confirm that the latest GitHub Release is no longer the previous version:

```bash
gh release view vX.Y.Z
```

The release notes should summarize the changes and include the VS Code VSIX
asset once it has been downloaded from CI.

## 6. Package and manually publish the VS Code extension

The CI `package` job builds the extension and uploads a `timescope-vscode`
artifact containing the VSIX. It does not automatically publish to the
Marketplace.

1. Find the successful CI run for the merged release commit.
2. Download the VSIX artifact from GitHub Actions, or use:

   ```bash
   gh run download <CI_RUN_ID> -n timescope-vscode
   ```

3. Inspect the package before publishing:

   ```bash
   npx @vscode/vsce ls --tree timescope.vsix
   ```

4. Manually publish the VSIX through the VS Code Marketplace publisher portal,
   or use the authenticated manual `vsce` workflow approved by the maintainer.
5. Attach the final `.vsix` to the GitHub Release if desired and verify the
   Marketplace version matches `X.Y.Z`.

The VS Code package must remain dependency-free at runtime. Packaging must use
`--no-dependencies`; do not add runtime dependencies to
`packages/vscode/package.json`.

## 7. Verify the completed release

Check all release surfaces:

```bash
npm view @rifen/timescope-core version
gh release view vX.Y.Z
git ls-remote --tags origin vX.Y.Z
```

Also verify the VS Code Marketplace version and that the Neovim package points
to the merged GitHub content.

Update the **Current release state** and **Release History** sections below
when the release is complete.

## Recovery and troubleshooting

### CI fails before tests with `ERR_PNPM_OUTDATED_LOCKFILE`

Regenerate the lockfile on the release branch, validate with a frozen install,
commit it, and open/update the pull request. Do not bypass the failure with
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
a pull request, and create a new annotated tag.

### npm publication fails

Check the failed workflow logs and whether the version already exists:

```bash
npm view @rifen/timescope-core versions --json
```

A version that was published cannot be republished. Use a new version.

### VS Code packaging fails

Verify that:

- `packages/vscode/dist/extension.js` exists after the build
- `packages/vscode/tsconfig.json` uses `rootDir: "src"`
- `packages/vscode/.vscodeignore` includes `!dist/**`
- `vscode:prepublish` remains a no-op
- `vsce package` uses `--no-dependencies`

## Release History

Update this list after each completed release. Use `git tag` and GitHub Releases
as the source of truth.

- v0.2.28 - Pending PR/release
- v0.2.27 - Tag exists, but the release workflow failed before publication
- v0.2.26 - Previous release attempt

## Automation boundaries

Automated:

- CI tests, builds, E2E checks, and VSIX artifact creation
- npm publication of `@rifen/timescope-core` after a release tag

Manual:

- Opening/merging the release pull request
- Creating the annotated release tag
- Updating the GitHub Release title, notes, and assets
- Publishing the VSIX to the VS Code Marketplace
- Neovim publication/release communication through GitHub
