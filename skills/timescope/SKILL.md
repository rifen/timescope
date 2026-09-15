---
name: timescope
description: Analyzes source code and configuration files to detect, parse, and audit time duration constants (timeouts, intervals, TTLs, retry delays, cache expiries, and sleep intervals).
---

# TimeScope Agent Skill

TimeScope detects, normalizes, and audits raw time numbers (e.g., `900`, `60 * 60 * 24`, `30000`) across source code and configuration files.

---

## When to Use This Skill

Activate this skill when:

- Auditing timeouts, intervals, rate limits, retry backoffs, or cache TTL configurations across a codebase.
- Investigating timeout mismatch issues (e.g., frontend timeout < backend timeout, connection pool TTLs).
- Refactoring hardcoded duration magic numbers into named constants or config parameters.
- Evaluating duration arithmetic expressions (e.g., `60 * 60 * 24` -> `1d / 86,400s`).

---

## Commands & Tools

### 1. Scan a File or Directory for Durations

Use the built-in scanner script to find all duration constants in a file or project:

```bash
# Scan repository or directory as JSON
node packages/core/dist/cli.js scan <path> --format=json

# Scan with human-readable text output
node packages/core/dist/cli.js scan <path> --format=text
```

### 2. Parse & Convert a Single Duration Expression

Evaluate arithmetic or ambiguous duration numbers:

```bash
node packages/core/dist/cli.js parse "60 * 60 * 24"
node packages/core/dist/cli.js parse "30000" --unit=milliseconds
```

### 3. Programmatic Usage in Scripts / Subagents

```typescript
import { scanCode, detectDuration, formatDurationFull } from '@rifen/timescope-core';

// Scan source code
const scan = scanCode(sourceCode, 'server.ts');

console.log(JSON.stringify(scan, null, 2));
```

---

## Output Formats

The CLI supports `json` for machine-readable results and `text` for human-readable output.
