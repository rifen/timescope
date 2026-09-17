<p align="center">
  <img src="timescope.jpeg" alt="TimeScope Logo" width="480" />
</p>

<h1 align="center">TimeScope</h1>

<p align="center">
  <strong>Hover any integer duration &rarr; see human-readable time instantly.</strong>
</p>

<p align="center">
  <a href="https://github.com/rifen/timescope/actions/workflows/ci.yml"><img src="https://github.com/rifen/timescope/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/rifen/timescope/actions/workflows/codeql.yml"><img src="https://github.com/rifen/timescope/actions/workflows/codeql.yml/badge.svg" alt="CodeQL" /></a>
  <a href="https://www.npmjs.com/package/@rifen/timescope-core"><img src="https://img.shields.io/npm/v/@rifen/timescope-core.svg" alt="npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License" /></a>
</p>

<p align="center">
  TimeScope is a fast, cross-editor tool that eliminates mental math by inspecting numeric durations in your code and displaying their human-readable equivalents on hover.
</p>

<p align="center">
  Never pause to calculate what <code>86400</code>, <code>3600000</code>, or <code>60 * 60 * 24</code> means again.
</p>

---

## Table of Contents

- [Quick Start](#quick-start)
  - [VS Code](#vs-code)
  - [Neovim](#neovim)
  - [CLI](#cli)
- [Features](#features)
- [Usage Examples](#usage-examples)
- [Language-Aware Detection](#language-aware-detection)
- [Configuration](#configuration)
  - [VS Code Settings](#vs-code-settings)
  - [Neovim Settings](#neovim-settings)
- [Editor Commands](#editor-commands)
  - [VS Code Commands](#vs-code-commands)
  - [Neovim Commands](#neovim-commands)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

### VS Code

1. Install **[TimeScope](https://marketplace.visualstudio.com/items?itemName=rifen.rifen-timescope)** (`rifen.rifen-timescope`) from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=rifen.rifen-timescope) or via the Command Palette (`Ctrl+P` / `Cmd+P`):
   ```text
   ext install rifen.rifen-timescope
   ```
2. Open any supported file and **hover over any duration** (e.g. `timeout = 900` or `3000` in `setTimeout(fn, 3000)`). The human-readable duration displays instantly in a hover tooltip.

### Neovim

**Requirements:** Neovim &ge; 0.7 and Node.js &ge; 18.

Install with your plugin manager of choice:

**[lazy.nvim](https://github.com/folke/lazy.nvim)**:
```lua
{
  'rifen/timescope.nvim',
  opts = {
    format = 'compact',
  },
}
```

**[packer.nvim](https://github.com/wbthomason/packer.nvim)**:
```lua
use {
  'rifen/timescope.nvim',
  config = function()
    require('timescope').setup({
      format = 'compact',
    })
  end,
}
```

Move the cursor over any numeric duration to view the formatted duration rendered as inline virtual text.

### CLI

Run TimeScope directly from your terminal using `npx`:

```bash
# Parse a numeric duration or math expression
npx @rifen/timescope-core parse "60 * 60 * 24"

# Scan a source file or directory for durations
npx @rifen/timescope-core scan ./src
```

---

## Features

- **Smart detection** &mdash; Infers units from variable names, comments, and identifiers (e.g., `timeout`, `interval`, `delay`, `ttl`, `retention`).
- **Language-aware rules** &mdash; Recognizes language standard library conventions (`setTimeout` &rarr; ms in JS/TS, `time.sleep` &rarr; seconds in Python, `time.Sleep` &rarr; nanoseconds in Go).
- **Expression evaluation** &mdash; Computes compound expressions like `60 * 60 * 24` &rarr; `1d`.
- **Flexible formatting** &mdash; Choose between compact (`15m`), verbose (`15 minutes`), or combined (`both`).
- **Context hints** &mdash; Displays inference clues alongside formatted times (e.g., `keyword: "timeout" (javascript)`).
- **Zero runtime dependencies** &mdash; Lightweight and fast in both editors.
- **Cross-editor consistency** &mdash; Identical detection engine across VS Code, Neovim, and CLI.

---

## Usage Examples

```python
# Python
timeout = 900              # → "15m"
retry_delay = 5000         # → "5s"
cache_ttl = 60 * 60 * 24   # → "1d"
time.sleep(30)             # → "30s" (language-aware)
```

```javascript
// JavaScript / TypeScript
setTimeout(fn, 3000);       // → "3s" (language-aware)
setInterval(fn, 5000);      // → "5s" (language-aware)
const timeout = 30000;      // → "30s" (context clues)
```

```go
// Go
timeout := 15 * time.Second  // → "15s"
time.Sleep(2 * time.Second)  // → "2s" (language-aware)
```

```yaml
# YAML
timeout: 300          # → "5m"
interval: 3600000     # → "1h"
ttl: 86400            # → "1d"
```

---

## Language-Aware Detection

TimeScope detects the active language and adapts its unit inference to standard library conventions:

| Language | Recognized Patterns | Inferred Unit |
| :--- | :--- | :--- |
| **JavaScript / TypeScript** | `setTimeout`, `setInterval`, `setImmediate`, `requestAnimationFrame` | **Milliseconds** |
| **Python** | `time.sleep` | **Seconds** |
| **Go** | `time.Sleep`, `time.After`, `time.Tick` | **Nanoseconds** |
| **Rust** | `std::thread::sleep`, `tokio::time::sleep` | **Milliseconds** |
| **Java** | `Thread.sleep` | **Milliseconds** |
| **Other Languages** | Common keywords: `timeout`, `interval`, `delay`, `duration`, `ttl`, `sleep`, `wait`, `cache`, etc. | **Context Heuristics** |

---

## Configuration

TimeScope requires zero configuration by default, but provides granular options to customize behavior.

### VS Code Settings

Configure in the VS Code Settings UI or add directly to `settings.json`:

```json
{
  "timescope.enabled": true,
  "timescope.format": "compact",           // "compact" | "verbose" | "both"
  "timescope.defaultUnit": "seconds",      // "seconds" | "milliseconds" | "microseconds" | "nanoseconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years" | "auto"
  "timescope.minValue": 1,
  "timescope.maxValue": 31557600000,       // Ignore values above ~1000 years in ms
  "timescope.contextClues": true,          // Use variable names and comments to infer units
  "timescope.fileTypes": ["*"]             // Glob patterns for active file types
}
```

### Neovim Settings

Configure through `require('timescope').setup({...})` or the `opts` table in `lazy.nvim`:

```lua
require('timescope').setup({
  enabled = true,
  format = 'compact',              -- 'compact' | 'verbose' | 'both'
  defaultUnit = 'seconds',         -- 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds' | 'hours' | 'days' | 'weeks' | 'months' | 'years' | 'auto'
  minValue = 1,
  maxValue = 31557600000,
  contextClues = true,
  debounceMs = 150,                -- Cursor move debounce delay in ms
})
```

---

## Editor Commands

### VS Code Commands

Access these from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Action |
| :--- | :--- |
| `TimeScope: Toggle Enabled` | Toggle the hover provider on or off |
| `TimeScope: Dump Settings to Output` | Print active configuration to the TimeScope output channel |
| `TimeScope: Log Hover Target` | Inspect token and AST context under the active cursor |

### Neovim Commands

| Command | Description |
| :--- | :--- |
| `:TimeScopeEnable` | Enable the hover provider |
| `:TimeScopeDisable` | Disable the hover provider and clear virtual text |
| `:TimeScopeToggle` | Toggle the hover provider on or off |
| `:TimeScopeSettings` | Display active configuration in the command window |
| `:TimeScopeReload` | Clear virtual text and force refresh |

---

## Contributing

We welcome contributions!

- Read our [**Contributing Guide**](CONTRIBUTING.md) for local development setup, workflow standards, and testing procedures.
- Please review our [**Code of Conduct**](CODE_OF_CONDUCT.md) before engaging in discussions or opening issues.
- Security disclosures should follow the instructions in [**SECURITY.md**](SECURITY.md).

---

## License

This project is licensed under the [MIT License](LICENSE).
