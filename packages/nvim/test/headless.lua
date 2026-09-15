-- Contributor-facing smoke test for the real Neovim plugin runtime.
-- Run with: nvim --headless --clean -u test/headless.lua

vim.opt.rtp:prepend(vim.fn.getcwd())

local timescope = require('timescope')
timescope.setup({ debounceMs = 0 })

assert(vim.fn.exists(':TimeScopeEnable') == 2, 'TimeScopeEnable command was not registered')
assert(vim.fn.exists(':TimeScopeDisable') == 2, 'TimeScopeDisable command was not registered')

local hover = require('timescope.hover')
local sample = 'TIMEOUT_SECONDS = 30'
local sample_col = sample:find('30', 1, true) - 1
assert(hover.get_token_at_cursor(sample, sample_col) == '30', 'token extraction failed')

vim.api.nvim_buf_set_lines(0, 0, -1, false, { sample })
vim.api.nvim_win_set_cursor(0, { 1, sample_col })
hover.show_duration()

local completed = vim.wait(5000, function()
  return #vim.api.nvim_buf_get_extmarks(0, hover.namespace, 0, -1, {}) > 0
end, 25)
assert(completed, 'hover virtual text was not produced by the bridge')

local marks = vim.api.nvim_buf_get_extmarks(0, hover.namespace, 0, -1, { details = true })
assert(#marks > 0, 'expected at least one TimeScope extmark')

print('Neovim E2E smoke test passed')
vim.cmd('qa!')
