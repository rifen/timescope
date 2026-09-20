-- TimeScope Neovim Plugin
-- Hover over integer durations to see human-readable time

local M = {}

M.config = {
  format = 'compact',
  default_unit = 'seconds',
  min_value = 1,
  max_value = 31557600000,
  context_clues = true,
  ignore_patterns = {
    '^0x[0-9a-f]+$',
    '^%d+%.%d+%.%d+%.%d+$',
    '^%d%d%d%d%-%d%d%-%d%d$',
    '^%d%d+$'
  },
  keywords = {
    'timeout', 'interval', 'delay', 'duration', 'ttl',
    'expiry', 'expire', 'retention', 'age', 'period',
    'rate', 'throttle', 'backoff', 'retry', 'wait',
    'sleep', 'pause', 'hold', 'cache', 'session'
  }
}

function M.setup(user_config)
  M.config = vim.tbl_deep_extend('force', M.config, user_config or {})
  require("timescope.hover").setup()
end

return M
