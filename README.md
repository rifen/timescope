# TimeScope

**Hover any integer duration → see human-readable time instantly.**

![CI](https://github.com/rifen/timescope/actions/workflows/ci.yml/badge.svg) ![CodeQL](https://github.com/rifen/timescope/actions/workflows/codeql.yml/badge.svg) ![npm](https://img.shields.io/npm/v/@rifen/timescope-core.svg) ![License](https://img.shields.io/badge/License-MIT-yellow.svg)

TimeScope is a cross-editor tool that eliminates mental math by hovering over numeric durations and revealing their human-readable meaning.

![TimeScope demo](timescope.jpeg)

## Install

### VS Code

Install [`rifen-timescope`](https://marketplace.visualstudio.com/items?itemName=rifen.rifen-timescope) from the VS Code Marketplace, or install the `.vsix` from [Releases](https://github.com/rifen/timescope/releases).

### Neovim (lazy.nvim)

```lua
return {
  'rifen/timescope.nvim',
  version = '*',
  opts = {
    format = 'compact',
  },
}
```

## Quick Start

```lua
-- Neovim (init.lua)
require('timescope').setup({})
```

```json
// VS Code (settings.json)
{
  "timescope.enabled": true,
  "timescope.format": "compact"
}
```

## Features

- **Smart detection** — Infers units from context (variable names, comments, file type)
- **Language-aware detection** — Automatically infers units from language-specific patterns (e.g., `setTimeout` → milliseconds in JS/TS, `time.sleep` → seconds in Python, `time.Sleep` → nanoseconds in Go)
- **Expression parsing** — `60 * 60 * 24` → `1 day`
- **Multiple formats** — Compact (`15m`), verbose (`15 minutes`), or both
- **Context hints** — Shows inference source (e.g., `keyword: "timeout" (javascript)`)
- **Cross-editor** — VS Code and Neovim support
- **Toggle on/off** — Enable/disable without restart

## Usage Examples

```python
# Python
timeout = 900           # → "15m"
retry_delay = 5000      # → "5s"
cache_ttl = 60 * 60 * 24   # → "1d"
time.sleep(30)          # → "30s" (language-aware)
```

```yaml
# YAML
timeout: 300          # → "5m"
interval: 3600000     # → "1h"
ttl: 86400            # → "1d"
```

```go
// Go
timeout := 15 * time.Second  // → "15s"
time.Sleep(2 * time.Second)  // → "2s" (language-aware)
```

```javascript
// JavaScript/TypeScript
setTimeout(fn, 3000)    // → "3s" (language-aware)
setInterval(fn, 5000)   // → "5s" (language-aware)
const timeout = 30000;  // → "30s" (context clues)
```

## Configuration

### VS Code

```json
{
  "timescope.enabled": true,
  "timescope.format": "compact",           // "compact" | "verbose" | "both"
  "timescope.defaultUnit": "auto",        // "seconds" | "milliseconds" | "microseconds" | "nanoseconds" | "hours" | "days" | "weeks" | "months" | "years" | "auto"
  "timescope.minValue": 1,
  "timescope.maxValue": 31557600000,
  "timescope.contextClues": true
}
```

### Neovim

```lua
require('timescope').setup({
  enabled = true,
  format = 'compact',              -- 'compact' | 'verbose' | 'both'
  defaultUnit = 'auto',            -- 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds' | 'hours' | 'days' | 'weeks' | 'months' | 'years' | 'auto'
  minValue = 1,
  maxValue = 31557600000,
  contextClues = true,
  debounceMs = 150,                -- cursor move debounce (ms)
})
```

## Neovim Commands

| Command | Description |
| --------- | ------------- |
| `:TimeScopeEnable` | Enable hover provider |
| `:TimeScopeDisable` | Disable hover provider & clear virtual text |
| `:TimeScopeToggle` | Toggle on/off |
| `:TimeScopeSettings` | Print current config |
| `:TimeScopeReload` | Clear virtual text (force refresh) |

## Language-Aware Detection

TimeScope automatically detects the programming language and adjusts unit inference:

| Language | Keywords → Unit |
| ---------- | ------------------ |
| JavaScript / TypeScript / JSX / TSX | `setTimeout`, `setInterval`, `setImmediate`, `requestAnimationFrame` → **milliseconds** |
| Python | `time.sleep` → **seconds** |
| Go | `time.Sleep`, `time.After`, `time.Tick` → **nanoseconds** |
| Rust | `std::thread::sleep`, `tokio::time::sleep` → **milliseconds** |
| Java | `Thread.sleep`, `TimeUnit.*.sleep` → **milliseconds** |
| C# | `Thread.Sleep`, `Task.Delay` → **milliseconds** |
| C/C++ | `sleep`, `usleep`, `nanosleep`, `std::this_thread::sleep_for` → **seconds** |
| Ruby | `sleep` → **seconds** |
| PHP | `sleep`, `usleep`, `time_nanosleep` → **seconds** |

Works automatically — no configuration needed. The editor's filetype is passed to the core library.

## Links

- **GitHub**: <https://github.com/rifen/timescope>
- **VS Code Marketplace**: <https://marketplace.visualstudio.com/items?itemName=rifen.rifen-timescope>

## License

MIT
