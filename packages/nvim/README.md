# TimeScope — Neovim Plugin

**Hover any integer duration → see human-readable time instantly.**

TimeScope eliminates the mental math of converting raw numbers (seconds, milliseconds, nanoseconds) into readable durations. Perfect for HTTP timeouts, retry intervals, TTLs, cache configs, cron schedules, and any numeric time value in your code.

## Requirements

- **Node.js 18+** (for `@rifen/timescope-core` bridge)
- **Neovim 0.7+**

## Installation

### lazy.nvim

```lua
-- ~/.config/nvim/lua/plugins/timescope.lua
return {
  'rifen/timescope.nvim',
  version = '*',
  event = 'VeryLazy',
  keys = {
    { '<leader>tl', '<cmd>TimeScopeToggle<cr>', desc = 'TimeScope: Toggle' },
    { '<leader>tr', '<cmd>TimeScopeReload<cr>', desc = 'TimeScope: Reload' },
    { '<leader>ts', '<cmd>TimeScopeSettings<cr>', desc = 'TimeScope: Show Settings' },
  },
  opts = {
    format = 'compact',
    contextClues = true,
  },
  config = function(_, opts)
    require('timescope').setup(opts)
  end,
}
```

### packer.nvim

```lua
use {
  'rifen/timescope.nvim',
  config = function()
    require('timescope').setup({
      format = 'compact',
      contextClues = true,
    })
  end,
}
```

## How it works

1. On `CursorMoved`, the plugin extracts the token under the cursor
2. Spawns a Node.js bridge process (`bin/timescope-bridge.js`)
3. Bridge imports `@rifen/timescope-core`, runs detection + formatting
4. Returns formatted duration as JSON
5. Plugin renders virtual text with the result

## Configuration

```lua
require('timescope').setup({
  enabled = true,
  format = 'compact',              -- 'compact' | 'verbose' | 'both'
  defaultUnit = 'seconds',         -- 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds' | 'auto'
  minValue = 1,
  maxValue = 31557600000,
  showBreakdown = true,
  showUnitLabel = true,
  contextClues = true,
  ignorePatterns = {
    '^0x[0-9a-f]+$',
    '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$',  -- IPv4
    '^\\d{4}-\\d{2}-\\d{2}$',  -- ISO dates
    '^\\d{10,}$',  -- Unix timestamps
  },
  keywords = {
    'timeout', 'interval', 'delay', 'duration', 'ttl',
    'expiry', 'expire', 'retention', 'age', 'period',
    'rate', 'throttle', 'backoff', 'retry', 'wait',
    'sleep', 'pause', 'hold', 'cache', 'session'
  },
  debounceMs = 150,                -- cursor move debounce (ms)
})
```

## Commands

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
| ---------- | ----------------- |
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

## Usage

1. Open any file containing numeric timestamps
2. Move cursor over a number — virtual text appears with converted time

**Works in:** source code, config files (YAML/TOML/JSON), Dockerfiles, k8s manifests, `.env`, docs.

## Lazy.nvim Integration

The plugin is designed to work seamlessly with lazy.nvim:

- **Event loading**: Plugin loads on `VeryLazy` event
- **Options handling**: Pass config via `opts` key
- **Key bindings**: Define keys in plugin spec
- **Lazy loading**: Bridge process only starts when needed

### Complete lazy.nvim Example

```lua
-- ~/.config/nvim/lua/plugins/timescope.lua
return {
  'rifen/timescope.nvim',
  version = '*',
  event = 'VeryLazy',
  keys = {
    { '<leader>tl', '<cmd>TimeScopeToggle<cr>', desc = 'TimeScope: Toggle' },
    { '<leader>tr', '<cmd>TimeScopeReload<cr>', desc = 'TimeScope: Reload' },
    { '<leader>ts', '<cmd>TimeScopeSettings<cr>', desc = 'TimeScope: Show Settings' },
  },
  opts = {
    format = 'compact',
    contextClues = true,
    keywords = { 'timeout', 'interval', 'delay', 'ttl' },
  },
  config = function(_, opts)
    require('timescope').setup(opts)
  end,
}
```

## Related

- **[TimeScope VS Code](https://marketplace.visualstudio.com/items?itemName=rifen.timescope)** — Hover provider for VS Code
- **[TimeScope Core](https://www.npmjs.com/package/@rifen/timescope-core)** — Shared detection/formatting library on npm
- **[Monorepo](https://github.com/rifen/timescope)** — All packages in one repo
