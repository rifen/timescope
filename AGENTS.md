# Agent Instructions for timescope

This document captures hard-won knowledge about the CI/CD pipeline, publishing workflow, and common pitfalls. **Read this before making changes to workflows, package.json scripts, or VS Code extension packaging.**

---

## 🔑 Critical Invariants (Do Not Break)

### Publishing Approach

- Automated VS Code Marketplace publishing is **disabled**.
- The repository only publishes the **core package** to npm via CI.
- VSIX packaging and Marketplace publishing must be performed **manually** (e.g., `npm run package` and `npm run publish` with a PAT).
- Reason: Trusted Publishing (OIDC) requires an Azure AD‑backed organization, which is not available for a personal publisher. Using it would require Microsoft support and adds complexity.
- Keeping publishing manual avoids failed CI runs, unnecessary secret management, and future confusion.
- This note is permanent to ensure future contributors do not re‑add automated Marketplace publishing.

### 1. VS Code Extension Must Have Zero Runtime Dependencies

- **`"vsce": { "dependencies": false }`** in `packages/vscode/package.json`
- **`--no-dependencies`** flag on all `vsce package` / `vsce publish` commands
- Core is **bundled at build time** into `dist/@rifen/timescope-core/` via the `build` script
- Never add runtime `dependencies` to the vscode package.json

### 2. pnpm for Build, npm for vsce

| Tool | Purpose                                                                |
| ---- | ---------------------------------------------------------------------- |
| pnpm | Install, build all packages (`pnpm -r run build`)                      |
| npm  | `vsce package` / `vsce publish` (OIDC trusted publishing only works with npm) |

**Why:** `setup-node` injects `NODE_AUTH_TOKEN` which only `npm`/`vsce` consume. pnpm does not support OIDC token flow.

### 3. `prepare` Script in Core Package (Required)

```json
// packages/core/package.json
"prepare": "npm run build"
```

- Runs **before** pnpm creates bin symlinks
- Guarantees `dist/cli.js` exists → eliminates `ENOENT dist/cli.js` warnings
- Without this, `pnpm install` fails with `[WARN] Failed to create bin ... ENOENT dist/cli.js`

### 4. `vscode:prepublish` Must Be a No-Op

```json
// packages/vscode/package.json
"vscode:prepublish": "echo 'Skipping prepublish - build already run in CI'"
```

- CI workflow explicitly runs `pnpm run build` before packaging
- If `vscode:prepublish` runs a build, `vsce` gets confused and can't find `dist/extension.js`

### 5. TypeScript `rootDir` Must Be `"src"` (Not `"."`)

```json
// packages/vscode/tsconfig.json
"rootDir": "src"
```

- With `rootDir: "."`, `src/extension.ts` → `dist/src/extension.js` (wrong)
- With `rootDir: "src"`, `src/extension.ts` → `dist/extension.js` (matches `"main": "./dist/extension.js"`)

### 6. `.vscodeignore` Must Include Compiled Output

```gitignore
# packages/vscode/.vscodeignore
!dist/**
!extension/timescope.ico
```

- Excludes everything by default (`*`)
- Explicitly includes `dist/**` and the icon
- Without `!dist/**`, vsce packages nothing

---

## 🚀 CI Workflow Structure (`.github/workflows/ci.yml`)

```yaml
jobs:
  test:
    # pnpm install --frozen-lockfile --ignore-scripts
    # pnpm -r run build
    # pnpm --filter @rifen/timescope-core test

  package:
    needs: test
    # pnpm install --frozen-lockfile --ignore-scripts
    # pnpm -r run build
    # cd packages/vscode && pnpm run build   # bundles core
    # cd packages/vscode && npx @vscode/vsce package --no-dependencies --out timescope.vsix
```

**Key flags:**

- `--ignore-scripts` on `pnpm install` → avoids `ERR_PNPM_IGNORED_BUILDS` for native deps
- No staging directory, no `npm install --omit=dev` — core is copied directly at build time

---

## 📦 Release Workflow (`.github/workflows/release.yml`)

Same as CI `package` job, plus:

```yaml
- name: Publish VS Code extension
  run: |
    cd packages/vscode
    npm run publish -- -p $VSCE_PAT
```

- Uses `npm run publish` (not pnpm) for OIDC token
- `VSCE_PAT` is a fallback PAT; OIDC preferred

---

## 🧱 Monorepo Structure

```text
timescope/
├── package.json              # pnpm workspace root
├── pnpm-workspace.yaml       # onlyBuiltDependencies: ["@vscode/vsce-sign", "keytar", "node"]
├── packages/
│   ├── core/                 # @rifen/timescope-core
│   │   ├── package.json      # "prepare": "npm run build", "bin": { "timescope": "dist/cli.js" }
│   │   └── src/
│   ├── vscode/               # rifen-timescope (VS Code extension)
│   │   ├── package.json      # vsce.dependencies: false, workspace:* for core
│   │   ├── tsconfig.json     # rootDir: "src", paths: @rifen/timescope-core → ../core/dist
│   │   ├── .vscodeignore     # !dist/**, !extension/timescope.ico
│   │   └── src/
│   └── nvim/                 # Neovim bridge (separate package)
```

---

## ❌ Historical Pitfalls (Do Not Reintroduce)

| Pitfall | Symptom | Fix |
| --------- | --------- | ----- |
| `allowBuilds` in pnpm-workspace.yaml | Deprecated, silently ignored | Use `onlyBuiltDependencies: [...]` array |
| Staging directory with `npm install` | `ELSPROBLEMS` from devDependencies in transitive deps | Bundle core at build time, use `--no-dependencies` |
| GCF (`@blackwell-systems/gcf`) as dependency | Brought in `@types/node`, `typescript`, `vitest` as devDeps → `vsce` failure | **Removed entirely** — core now has zero runtime deps |
| `rootDir: "."` in vscode tsconfig | `extension.js` lands in `dist/src/` → vsce entrypoint error | `rootDir: "src"` |
| `vscode:prepublish` running build | Duplicate build confuses vsce | No-op prepublish |
| Missing `prepare` in core | `pnpm install` warns `ENOENT dist/cli.js` | Add `"prepare": "npm run build"` |
| Relative `file:../packages/core` in staging | Resolves incorrectly in CI | Absolute paths or (better) bundle at build time |

---

## 🛠️ Local Development Commands

```bash
# Full clean build (run from repo root)
pnpm install --frozen-lockfile --ignore-scripts
pnpm -r run build

# Test core only
pnpm --filter @rifen/timescope-core test

# Package VSIX locally (from packages/vscode)
pnpm run build
npm run package   # runs vsce with --no-dependencies

# Verify VSIX contents
npx @vscode/vsce ls --tree
```

---

## 🔍 Debugging Checklist

If CI fails on `package` job:

1. ✅ Does `pnpm -r run build` succeed locally?
2. ✅ Does `packages/vscode/dist/extension.js` exist after `pnpm run build`?
3. ✅ Is `vscode:prepublish` a no-op?
4. ✅ Is `rootDir: "src"` in tsconfig?
5. ✅ Does `.vscodeignore` have `!dist/**`?
6. ✅ Is `vsce package` using `--no-dependencies`?
7. ✅ Is `package.json` `main` pointing to `./dist/extension.js`?

---

## 📚 References

- [pnpm `onlyBuiltDependencies`](https://pnpm.io/pnpm-workspace_yaml#onlybuiltdependencies)
- [vsce `--no-dependencies`](https://github.com/microsoft/vscode-vsce/wiki/Dependencies)
- [npm Trusted Publishers (OIDC)](https://docs.npmjs.com/trusted-publishers#supported-cicd-providers)
- [VS Code Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)

---

## Changelog

- 2025-09-01 — after fixing CI pipeline (commits 91b6411 → 43247db)
