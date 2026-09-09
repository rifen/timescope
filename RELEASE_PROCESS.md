# TimeScope Release Process

## Current Version

**0.2.24** (as of September 2026)

## Overview

This document outlines the release process for TimeScope, a multi-package monorepo containing:

- Core library (`@rifen/timescope-core`)
- VS Code extension (`rifen-timescope`)
- Neovim plugin (`timelens-nvim`)

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Access to npm publish (for core package)
- Access to VS Code Marketplace publishing (for extension)
- GitHub access with permission to push tags

## Release Steps

### 1. Preparation

Ensure all tests pass and code is ready for release:

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Run all tests
pnpm test

# Build all packages
pnpm run build
```

### 2. Version Bump

Update version in all package.json files:

- `/package.json` (workspace root)
- `/packages/core/package.json`
- `/packages/nvim/package.json`
- `/packages/vscode/package.json`

All versions should match. Use the same version number across all packages.

Example for version 0.2.24:

```json
{
  "version": "0.2.24"
}
```

### 3. Update Documentation

Update README files to reflect the new version:

- Root README.md
- `/packages/core/README.md`
- `/packages/vscode/README.md`
- `/packages/nvim/README.md`

Specifically update:

- VS Code configuration examples (defaultUnit enum)
- Installation instructions (VSIX names)
- Any version-specific references

### 4. Commit Changes

```bash
git add package.json packages/*/package.json
git commit -m "chore(release): bump version to X.Y.Z"
```

### 5. Create Git Tag

Create an annotated tag for the release:

```bash
git tag -a vX.Y.Z -m "Release version X.Y.Z"
```

### 6. Push Changes

```bash
git push origin main
git push origin vX.Y.Z
```

### 7. Publish Packages

#### Core Library (npm)

```bash
cd packages/core
npm publish --access public
```

#### VS Code Extension

```bash
cd packages/vscode
# Package the extension
npm run package
# Publish to marketplace (requires PAT)
npm run publish -- -p $VSCE_PAT
```

#### Neovim Plugin

The Neovim plugin is published automatically when consumers install from GitHub.

## Important Notes

### Versioning Strategy

- Use semantic versioning (MAJOR.MINOR.PATCH)
- All packages share the same version number
- The workspace root version is informational only

### VS Code Marketplace Publishing

The VS Code extension uses `vsce` for publishing:

- Dependencies are excluded via `"vsce": { "dependencies": false }`
- The `--no-dependencies` flag is required for both package and publish
- OIDC trusted publishing is preferred, with PAT as fallback

### Configuration Settings

As of v0.2.24, the VS Code extension configuration no longer includes:

- `showBreakdown`
- `showUnitLabel`
- `ignorePatterns`
- `keywords`

These were removed to simplify the API as they weren't used in the core detection logic.

### Supported Time Units

Starting in v0.2.24, TimeScope supports:

- Seconds (s, sec, second, seconds)
- Milliseconds (ms, msec, millisecond, milliseconds)
- Microseconds (µs, us, microsecond, microseconds)
- Nanoseconds (ns, nsec, nanosecond, nanoseconds)
- Hours (h, hr, hour, hours, hourly)
- Days (d, day, days, daily)
- Weeks (w, wk, week, weeks, weekly)
- Months (mo, month, months, monthly)
- Years (y, yr, year, years, yearly, annual)

## Troubleshooting

### "Already exists" tag error

If a tag already exists locally or remotely:

```bash
# Delete local tag
git tag -d vX.Y.Z

# Delete remote tag (if needed)
git push origin --delete vX.Y.Z

# Recreate tag
git tag -a vX.Y.Z -m "Release version X.Y.Z"
git push origin vX.Y.Z
```

### Failed to publish npm package

- Ensure you're logged in: `npm login`
- Check for existing version: `npm view @rifen/timescope-core versions`
- Package may need access level change if previously unpublished

### VS Code publishing fails

- Verify PAT is valid and has `vscode.packages` scope
- Check that `vsce package --no-dependencies` works before publishing
- Ensure extension doesn't have runtime dependencies (enforced by `"vsce": { "dependencies": false }`)

## Release History

See `git tag` for previous releases:

- v0.2.23 - Previous npm version
- v0.2.24 - Current release (includes extended time units)
- v0.2.5 - Incorrect version bump (removed from history)

## Automation Considerations

Future improvements could include:

- Automated version bumping scripts
- GitHub Actions for automated publishing
- Release notes generation from commit history
