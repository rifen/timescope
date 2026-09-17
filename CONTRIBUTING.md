# Contributing to TimeScope

Thank you for your interest in contributing to TimeScope! We welcome bug reports, documentation improvements, feature suggestions, and code contributions.

---

## Code of Conduct

All contributors and maintainers are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

---

## Branch and Pull Request Workflow

To maintain repository stability and quality:

1. **Never commit or push directly to `main` or `master`.**
2. **Set up local git hooks** immediately after cloning:
   ```bash
   pnpm setup:git-hooks
   ```
   This activates a pre-push hook that prevents accidental direct pushes to protected branches.
3. **Create a fresh feature or bugfix branch** from the latest `main`:
   ```bash
   git switch -c <type>/<short-description>
   # Examples:
   # git switch -c feat/custom-unit-parser
   # git switch -c fix/debounce-race-condition
   # git switch -c docs/update-readme
   ```
4. **Keep changes focused and tested.**
5. **Open a Pull Request** against `main` once tests and lints pass.

---

## Prerequisites

- **Node.js**: >= 20.0.0
- **pnpm**: >= 8.0.0 (recommended: 11+)
- **Neovim**: >= 0.7 (optional, required for Neovim plugin testing)

---

## Project Structure

TimeScope is organized as a pnpm workspace monorepo:

```text
timescope/
├── packages/
│   ├── core/       # @rifen/timescope-core (parsing, unit detection, CLI)
│   ├── vscode/     # rifen-timescope (VS Code extension)
│   └── nvim/       # timescope-nvim (Neovim plugin & bridge)
```

---

## Setup and Building

1. Clone the repository:
   ```bash
   git clone https://github.com/rifen/timescope.git
   cd timescope
   ```
2. Configure git hooks:
   ```bash
   pnpm setup:git-hooks
   ```
3. Install dependencies:
   ```bash
   pnpm install --frozen-lockfile --ignore-scripts
   ```
4. Build all packages:
   ```bash
   pnpm -r run build
   ```

---

## Testing

### Automated Test Suite

Run all unit and integration tests across the monorepo:

```bash
pnpm test
```

To run tests only for the core parsing engine:

```bash
pnpm --filter @rifen/timescope-core test
```

### End-to-End (E2E) Smoke Tests

```bash
pnpm test:e2e
```

The E2E test runs the real Neovim plugin headlessly and executes the VS Code extension-host test suite via `@vscode/test-electron`. On headless Linux environments, run under virtual framebuffer:

```bash
xvfb-run -a pnpm test:e2e
```

### Manual Interactive Testing

For interactive debugging during development:

- **VS Code Extension**:
  ```bash
  pnpm test:manual:vscode
  ```
  This opens a clean VS Code extension development host. Hover over values in `packages/vscode/test-data/sample.ts`. You can also test commands in the Command Palette:
  - `TimeScope: Toggle Enabled`
  - `TimeScope: Dump Settings to Output`
  - `TimeScope: Log Hover Target`

- **Neovim Plugin**:
  ```bash
  pnpm test:manual:nvim
  ```
  This builds the Node.js bridge and launches Neovim with `packages/nvim/test-data/sample.lua`. Move the cursor over numbers to verify virtual text. Available commands include:
  - `:TimeScopeToggle`
  - `:TimeScopeSettings`
  - `:TimeScopeReload`
  - `:TimeScopeEnable` / `:TimeScopeDisable`

---

## Code Quality and Security

Before submitting a PR, verify linting and security scans pass:

```bash
# Run linters across packages
pnpm lint

# Run Opengrep SAST security scan
pnpm security:opengrep
```

### Security Guidelines

- Never construct dynamic `RegExp` objects from untrusted or user-supplied strings.
- Validate file names and paths before joining or reading.
- Do not interpolate dynamic variables into `console.log` format specifiers.

---

## Packaging

To package the VS Code extension `.vsix` locally:

```bash
cd packages/vscode
pnpm run build
npm run package
```

> **Note:** The VS Code extension has zero runtime dependencies; `@rifen/timescope-core` is bundled at build time. Packaging uses `npm run package` (invoking `vsce --no-dependencies`).
