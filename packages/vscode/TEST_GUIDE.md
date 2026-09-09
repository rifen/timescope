# VS Code Extension Quick Test Guide

## Fast Feedback Loop

Instead of publishing and installing the extension every time, use this quick test workflow:

### 1. Quick Manual Test

```bash
# From the packages/vscode directory
./scripts/quick-test.sh
```

This will:

1. Open VS Code with a test file (`test-data/sample.ts`)
2. Print instructions for testing

**Then in VS Code:**

1. Press **F5** to launch "Extension Development Host"
2. In the new window, open the test file: `test-data/sample.ts`
3. Hover over any number to see TimeScope in action

### 2. Test File Overview

The `test-data/sample.ts` file contains:

| Case | Example | Expected Result |
| ------ | --------- | ---------------- |
| Basic seconds | `HELLO = 120` | `2 minutes` |
| Context: timeout | `TIMEOUT = 300` | `5 minutes` |
| Context: delay | `DELAY = 5000` | `5 seconds` |
| Context: retry | `RETRY_INTERVAL = 30000` | `30 seconds` |
| Context: cache | `CACHE_TTL = 3600` | `1 hour` |
| Context: age | `MAX_AGE = 86400` | `1 day` |
| With ms suffix | `retryDelayMs = 5000` | `5 seconds` |
| With seconds suffix | `timeoutSeconds = 120` | `2 minutes` |
| With hours suffix | `cacheDurationHours = 48` | `2 days` |
| Expressions | `ONE_HOUR = 60 * 60` | `1 hour` |
| New: hours | `HOURS = 24` | `1 day` |
| New: days | `DAYS = 7` | `1 week` |
| New: weeks | `WEEKS = 2` | `2 weeks` |
| New: months | `MONTHS = 3` | `3 months` |
| New: years | `YEARS = 1` | `1 year` |
| Edge: zero | `ZERO = 0` | No hover (minValue = 1) |
| Edge: large | `VERY_LARGE = 9999999999999` | No hover (maxValue) |
| Edge: hex | `HEX = 0xFF` | No hover (ignore pattern) |
| Edge: IP | `IP = 1921681` | No hover (ignore pattern) |

### 3. Debug Commands

While testing in the Extension Development Host:

| Command | Purpose |
| --------- | --------- |
| `Timescope: Dump Settings` | Show current configuration |
| `Timescope: Log Hover Target` | Log hover target info for debugging |
| `Timescope: Toggle` | Enable/disable extension |
| `Developer: Toggle Developer Tools` | Open DevTools console |

### 4. Automated Tests

Run the core test suite:

```bash
cd /home/rifen/proj/timescope
pnpm --filter @rifen/timescope-core test
```

Run VS Code extension tests:

```bash
cd packages/vscode
npm test
```

### 5. Build and Package

```bash
# Build all packages
pnpm -r run build

# Package VSIX
cd packages/vscode
npm run package
```

## Workflow Summary

```mermaid
graph LR
    A[Edit code] --> B[Run quick-test.sh]
    B --> C[Press F5 in VS Code]
    C --> D[Hover in test file]
    D --> E{Working?}
    E -->|No| F[Check DevTools console]
    E -->|Yes| G[Commit and release]
    F --> A
```

## Tips

1. **Use the Extension Development Host** - This loads your local code, not the published extension
2. **Check the TimeScope output channel** - View → Output → Select "TimeScope" from dropdown
3. **Use DevTools** - Help → Toggle Developer Tools to see console logs
4. **Reload window** - Ctrl+Shift+P → "Developer: Reload Window" to reload extension after changes

## Common Issues

| Issue | Solution |
| ------- | ---------- |
| No hover appears | Check TimeScope output channel for errors |
| Wrong unit detected | Use context clues (variable names with units) |
| Extension not loading | Check that `npm run compile` succeeded |
| Settings not updating | Reload window or restart Extension Development Host |
