# TimeScope — VSCode Extension

**Hover any integer duration → see human-readable time instantly.**

TimeScope eliminates the mental math of converting raw numbers (seconds, milliseconds, nanoseconds) into readable durations.
Perfect for HTTP timeouts, retry intervals, TTLs, cache configs, cron schedules, and any numeric time value in your code.

Just hover—no clicks, no commands, no context switching.

---

## ✨ Features

| Input (unit) | Example | Hover Reveals |
| -------------- | --------- | --------------- |
| **Seconds** | `900` | `15 minutes` |
| **Seconds** | `3600` | `1 hour` |
| **Seconds** | `86400` | `1 day` |
| **Seconds** | `604800` | `1 week` |
| **Seconds** | `31536000` | `1 year` |
| **Milliseconds** | `5000` | `5 seconds` |
| **Milliseconds** | `900000` | `15 minutes` |
| **Milliseconds** | `3600000` | `1 hour` |
| **Microseconds** | `5000000` | `5 seconds` |
| **Nanoseconds** | `5000000000` | `5 seconds` |
| **Hours** | `24` | `1 day` |
| **Days** | `7` | `1 week` |
| **Weeks** | `2` | `2 weeks` |
| **Months** | `3` | `3 months` |
| **Years** | `1` | `1 year` |

- **Smart unit detection** — Heuristics + context clues (variable names, comments, file type) infer seconds/ms/µs/ns
- **Best-fit output** — Automatically picks the largest whole unit (e.g., `90000` → `25 hours`, not `54000 minutes`)
- **Precise breakdown** — Also shows `1h 30m 45s` style for non-round numbers
- **Copy on click** — Click the hover to copy the formatted duration
- **Multi-cursor friendly** — Works with multiple selections
- **Works everywhere** — Source code, config files (JSON/YAML/TOML), Dockerfiles, k8s manifests, `.env`, docs

---

## 🎯 Real-World Examples

```yaml
# docker-compose.yml
timeout: 300          # → "5 minutes"
healthcheck_interval: 30000   # → "30 seconds"

# nginx.conf
proxy_read_timeout 600;       # → "10 minutes"
keepalive_timeout 75;         # → "1 minute 15 seconds"

# Kubernetes
terminationGracePeriodSeconds: 30   # → "30 seconds"
ttlSecondsAfterFinished: 86400      # → "1 day"

# Application code (Go, JS, Python, Java, Rust, etc.)
http.Client{Timeout: 15 * time.Second}    # → "15 seconds"
setTimeout(fn, 300000)                     # → "5 minutes"
retry_after = 3600                         # → "1 hour"
CACHE_TTL = 86400                          # → "1 day"

# Cron / schedulers
"schedule": "*/300 * * * *"   # 300 → "5 minutes"
interval: 3600000             # → "1 hour"
```

---

## 🚀 Install

```bash
# From VSIX (install from /tmp or download)
code --install-extension timescope-vscode-0.2.4.vsix

# Or from VS Code Marketplace (after publication)
# Extension ID: rifen.rifen-timescope
```

---

## ⚙️ Configuration

```json
// settings.json
{
  "timescope.enabled": true,
  "timescope.defaultUnit": "auto",          // "seconds" | "milliseconds" | "microseconds" | "nanoseconds" | "hours" | "days" | "weeks" | "months" | "years" | "auto"
  "timescope.format": "compact",            // "compact" | "verbose" | "both"
  "timescope.minValue": 1,                  // Ignore values below this
  "timescope.maxValue": 31557600000,        // Ignore values above this (~1000 years in ms)
  "timescope.contextClues": true,           // Use var names, comments, file type to infer unit
  "timescope.fileTypes": ["*"]              // Glob patterns to activate on
}
```

**Format styles:**

- **compact** — `15m`, `1h`, `2d 3h`, `5s`
- **verbose** — `15 minutes`, `1 hour`, `2 days 3 hours`, `5 seconds`
- **both** — `15 minutes (15m)`

---

## 🛠️ Development

```bash
# Prereqs: Node.js 18+, pnpm
pnpm install
pnpm compile        # Compile TypeScript
pnpm watch          # Watch + compile
pnpm test           # Run tests
pnpm package        # Create .vsix
```

**Project structure:**

```
src/
├── extension.ts          # Entry point, registers hover provider
├── provider/
│   └── durationHover.ts  # HoverProvider implementation
├── detection/
│   └── detect.ts         # Duration detection + unit inference
├── formatting/
│   └── format.ts         # Human-readable duration formatting
├── config/
│   └── settings.ts       # Configuration schema + defaults
└── test/
    └── *.test.ts         # Unit + integration tests
```

---

## 📦 Publishing

```bash
pnpm package
vsce publish
# or: vsce publish patch/minor/major
```

---

## 🤝 Related

- **[TimeScope Core](https://github.com/rifen/timescope-core)** — Shared detection/formatting logic (`@rifen/timescope-core`)
- **[TimeScope Neovim](https://github.com/rifen/timescope-nvim)** — Same functionality for Neovim
- **[Monorepo](https://github.com/rifen/timescope)** — All packages in one repo

---

## 📄 License

MIT — Free for personal and commercial use.

---

## 💡 Why "TimeScope"?

Like a lens reveals what's invisible to the naked eye, TimeScope reveals the *meaning* hidden inside raw numbers.
No more mental math: `900` → `15 minutes`, `300000` → `5 minutes`, `86400` → `1 day`.
Instant clarity for timeouts, intervals, TTLs, and every other duration hiding in your code.
