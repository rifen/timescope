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

-- Issue #28: keyword argument with a timedelta constructor
local kwarg_line = 'start_to_close_timeout=timedelta(seconds=400)'
local kwarg_col = kwarg_line:find('400', 1, true) - 1
assert(
  hover.get_token_at_cursor(kwarg_line, kwarg_col) == '400',
  'keyword-argument number extraction failed'
)
assert(
  hover.get_token_at_cursor(kwarg_line, 0) == 'timedelta(seconds=400)',
  'keyword-argument assignment extraction failed'
)
assert(
  hover.get_token_at_cursor('MIN = (60 * 60)', ('MIN = (60 * 60)'):find('60', 1, true) - 1) == '60 * 60',
  'parenthesized expression extraction failed'
)

vim.api.nvim_buf_set_lines(0, 0, -1, false, { kwarg_line })
vim.api.nvim_win_set_cursor(0, { 1, kwarg_col })
hover.show_duration()

local kwarg_completed = vim.wait(5000, function()
  return #vim.api.nvim_buf_get_extmarks(0, hover.namespace, 0, -1, {}) > 0
end, 25)
assert(kwarg_completed, 'timedelta hover virtual text was not produced')

local kwarg_marks = vim.api.nvim_buf_get_extmarks(0, hover.namespace, 0, -1, { details = true })
assert(
  kwarg_marks[1][4].virt_text[1][1] == '6m 40s',
  'expected 6m 40s for timedelta(seconds=400), got ' .. tostring(kwarg_marks[1][4].virt_text[1][1])
)
assert(
  kwarg_marks[1][4].virt_text[2] and kwarg_marks[1][4].virt_text[2][1]:find('timedelta', 1, true),
  'expected timedelta hint for timedelta(seconds=400)'
)

-- The assignment RHS is preferred over the cursor-local number (#26)
local arm_lines = {
  'COMMIT_TIMER_ARM_TIMEOUT_SECONDS = 15.0',
  'COMMIT_TIMER_ARM_ACTIVITY_SECONDS = int(COMMIT_TIMER_ARM_TIMEOUT_SECONDS) + 15',
}
vim.api.nvim_buf_set_lines(0, 0, -1, false, arm_lines)
vim.api.nvim_win_set_cursor(0, {
  2,
  arm_lines[2]:find('15', 1, true) - 1,
})
hover.show_duration()

local arm_completed = vim.wait(5000, function()
  return #vim.api.nvim_buf_get_extmarks(0, hover.namespace, 0, -1, {}) > 0
end, 25)
assert(arm_completed, 'assignment-number hover was not produced')

local arm_marks = vim.api.nvim_buf_get_extmarks(0, hover.namespace, 0, -1, { details = true })
assert(
  arm_marks[1][4].virt_text[1][1] == '30s',
  'expected 30s when hovering the number inside the assignment, got ' .. tostring(arm_marks[1][4].virt_text[1][1])
)

-- Issue #26: variables resolved from earlier in the buffer
local vars_lines = {
  'COMMIT_TIMER_SETTLE_SECONDS = 5',
  'COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS = 15.0',
  'COMMIT_TIMER_CONFIRM_MARGIN_SECONDS = 10',
  'MIN_COMMIT_TIMER_SECONDS = (',
  '    COMMIT_TIMER_SETTLE_SECONDS',
  '    + int(COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS)',
  '    + COMMIT_TIMER_CONFIRM_MARGIN_SECONDS',
  ')',
}
vim.api.nvim_buf_set_lines(0, 0, -1, false, vars_lines)
vim.api.nvim_win_set_cursor(0, {
  4,
  vars_lines[4]:find('MIN_COMMIT_TIMER_SECONDS', 1, true) - 1,
})
hover.show_duration()

local vars_completed = vim.wait(5000, function()
  return #vim.api.nvim_buf_get_extmarks(0, hover.namespace, 0, -1, {}) > 0
end, 25)
assert(vars_completed, 'multi-line assignment hover was not produced')

local vars_marks = vim.api.nvim_buf_get_extmarks(0, hover.namespace, 0, -1, { details = true })
assert(
  vars_marks[1][4].virt_text[1][1] == '30s',
  'expected 30s for MIN_COMMIT_TIMER_SECONDS, got ' .. tostring(vars_marks[1][4].virt_text[1][1])
)

-- Usage of a variable declared earlier
local usage_lines = {
  'COMMIT_TIMER_ARM_TIMEOUT_SECONDS = 15.0',
  'verify(COMMIT_TIMER_ARM_TIMEOUT_SECONDS)',
}
vim.api.nvim_buf_set_lines(0, 0, -1, false, usage_lines)
vim.api.nvim_win_set_cursor(0, {
  2,
  usage_lines[2]:find('COMMIT_TIMER_ARM_TIMEOUT_SECONDS', 1, true) - 1,
})
hover.show_duration()

local usage_completed = vim.wait(5000, function()
  return #vim.api.nvim_buf_get_extmarks(0, hover.namespace, 0, -1, {}) > 0
end, 25)
assert(usage_completed, 'variable usage hover was not produced')

local usage_marks = vim.api.nvim_buf_get_extmarks(0, hover.namespace, 0, -1, { details = true })
assert(
  usage_marks[1][4].virt_text[1][1] == '15s',
  'expected 15s for COMMIT_TIMER_ARM_TIMEOUT_SECONDS usage, got ' .. tostring(usage_marks[1][4].virt_text[1][1])
)

print('Neovim E2E smoke test passed')
vim.cmd('qa!')
