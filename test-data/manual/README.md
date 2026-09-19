# TimeScope Manual Test Fixtures

Shared, interactive fixtures for the VS Code extension and the Neovim plugin.
Each file exercises the same feature set in a different language; the expected
hover output is in the trailing comment of every line.

## Running

### VS Code

```bash
pnpm test:manual:vscode
```

Then press **F5** and choose **Extension Development Host**. All fixtures open
as tabs in the new window. Hover any number, variable, or expression.

### Neovim

```bash
pnpm test:manual:nvim
```

All fixtures open in the argument list. Move the cursor over a value and the
result appears as virtual text at the end of the line. Use `:next` / `:bnext`
(or `:n` / `:bn`) to cycle through the files.

## Files

| File | Language | Focus |
| ------ | ---------- | ------- |
| [`durations.py`](durations.py) | Python | Unit suffixes, `timedelta(...)`, casts, variable-in-variable (#26), ignored values |
| [`durations.ts`](durations.ts) | TypeScript | `const`, `setTimeout`/`setInterval`, `Math.trunc`, multi-line (#26) |
| [`durations.js`](durations.js) | JavaScript | Delay/interval keywords, camelCase suffixes |
| [`durations.go`](durations.go) | Go | `time.Sleep`/`time.After` nanoseconds, camelCase suffixes |
| [`durations.rs`](durations.rs) | Rust | `Duration::from_*` constructors, typed constants |
| [`durations.java`](durations.java) | Java | `Thread.sleep`, `Duration.of*` constructors |
| [`durations.cs`](durations.cs) | C# | `Task.Delay`, `TimeSpan.From*` constructors |
| [`durations.yaml`](durations.yaml) | YAML | Config keys with unit suffixes and keywords |
| [`durations.json`](durations.json) | JSON | Config keys (no comments; see below) |
| [`durations.toml`](durations.toml) | TOML | Config keys with unit suffixes and keywords |
| [`durations.lua`](durations.lua) | Lua | `local` declarations, `timedelta`, multi-line (#26) for Neovim |

## What to look for

- **Value** — the compact duration (for example `15m`, `1h 30m`, `<1ms`).
- **Hint** — why the unit was inferred, for example
  `inferred from unit suffix: "TIMEOUT_SECONDS"` or `keyword: "timeout"`.
- **Nothing** — ignored values (hex literals, IPs, ISO dates, epoch-like
  numbers) show no hover.

The JSON fixture has no comments, so expectations are listed here:

| Key | Value | Expected |
| ----- | ------- | ---------- |
| `timeout` | 30 | 30s |
| `keepAliveTimeout` | 60 | 1m |
| `session_ttl` | 3600 | 1h |
| `retry_delay_ms` | 250 | 250ms |
| `cache_ttl_seconds` | 86400 | 1d |
| `poll_interval` | 60 | 1m |
| `max_retries` | 5 | 5s (plural `retries` is not a keyword match) |
| `heartbeat` | 5000 | 1h 23m (no unit clue → assumes seconds) |

## Known limits

- Values that are strings with inline units (`"30s"`, `--interval=30s`) are not
  parsed; TimeScope converts bare numbers.
- Arithmetic that mixes unit-carrying language constants (`30 * time.Second`)
  is not evaluated.
- Sub-second constructor results (`timedelta(milliseconds=500)`) are below the
  default `minValue` of 1 and are not shown.