local M = {}

-- Default settings (mirrors VS Code extension defaults)
M.config = {
  enabled = true,
  defaultUnit = 'seconds',
  format = 'compact',
  minValue = 1,
  maxValue = 31557600000,
  contextClues = true,
  ignorePatterns = {
    '^0x[0-9a-f]+$',
    '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$',
    '^\\d{4}-\\d{2}-\\d{2}$',
    '^\\d{10,}$',
  },
  keywords = {
    'timeout', 'interval', 'delay', 'duration', 'ttl', 'expiry', 'expire',
    'retention', 'age', 'period', 'rate', 'throttle', 'backoff', 'retry',
    'wait', 'sleep', 'pause', 'hold', 'cache', 'session',
  },
  debounceMs = 150,
}

-- Compute the bridge path relative to this file
-- hover.lua is at lua/timescope/hover.lua, bridge is at bin/timescope-bridge.js
local plugin_root = debug.getinfo(1, 'S').source:match('@?(.*/)')
local bridge_path = plugin_root .. '../../bin/timescope-bridge.js'

function M.setup(opts)
  opts = opts or {}
  M.config = vim.tbl_deep_extend('force', M.config, opts)

  local group = vim.api.nvim_create_augroup('TimeScope', { clear = true })
  vim.api.nvim_create_autocmd({ 'CursorMoved', 'CursorMovedI' }, {
    group = group,
    callback = function()
      if M.config.enabled then
        M.debounced_show_duration()
      end
    end
  })

  -- User commands
  vim.api.nvim_create_user_command('TimeScopeEnable', function()
    M.config.enabled = true
    vim.notify('TimeScope enabled', vim.log.levels.INFO)
  end, {})

  vim.api.nvim_create_user_command('TimeScopeDisable', function()
    M.config.enabled = false
    M.clear()
    vim.notify('TimeScope disabled', vim.log.levels.INFO)
  end, {})

  vim.api.nvim_create_user_command('TimeScopeToggle', function()
    M.config.enabled = not M.config.enabled
    if not M.config.enabled then
      M.clear()
    end
    vim.notify('TimeScope ' .. (M.config.enabled and 'enabled' or 'disabled'), vim.log.levels.INFO)
  end, {})

  vim.api.nvim_create_user_command('TimeScopeSettings', function()
    print(vim.inspect(M.config))
  end, {})

  vim.api.nvim_create_user_command('TimeScopeReload', function()
    M.clear()
    vim.notify('TimeScope reloaded', vim.log.levels.INFO)
  end, {})
end

M._debounce_timer = nil

function M.debounced_show_duration()
  -- Cancel existing timer if any
  if M._debounce_timer then
    vim.fn.timer_stop(M._debounce_timer)
  end

  -- Debounce by configured delay
  M._debounce_timer = vim.fn.timer_start(M.config.debounceMs, function()
    M._debounce_timer = nil
    M.show_duration()
  end)
end

function M.clear()
  if M.namespace then
    vim.api.nvim_buf_clear_namespace(0, M.namespace, 0, -1)
  end
end

function M.show_duration()
  -- Clear previous virtual text immediately
  vim.api.nvim_buf_clear_namespace(0, M.namespace, 0, -1)

  -- Kill any pending job from previous request
  if M._pending_job then
    vim.fn.jobstop(M._pending_job)
    M._pending_job = nil
  end

  -- Get current line and cursor position
  local cursor = vim.api.nvim_win_get_cursor(0)
  local row = cursor[1] - 1
  local col = cursor[2]
  local line = vim.api.nvim_buf_get_lines(0, row, row + 1, false)[1] or ''

  -- Extract token under cursor
  local token = M.get_token_at_cursor(line, col)
  if not token then return end

  -- Call Node.js bridge
  local filetype = vim.bo.filetype
  -- Send the whole buffer so the bridge can resolve constants and variables
  -- declared earlier in the file (#26), plus the assignment RHS so the whole
  -- expression is evaluated (matching the VS Code extension).
  local code = table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\n')
  local input = vim.fn.json_encode({
    token = token,
    line = line,
    language = filetype,
    settings = M.config,
    assignment = M.get_assignment_expression(line),
    code = code,
  })

  local job = vim.fn.jobstart({ 'node', bridge_path }, {
    stdin = 'pipe',
    stdout = 'pipe',
    stderr = 'pipe',
    on_stdout = function(_, data)
      if not data or #data == 0 then return end

      local raw = table.concat(data)
      if raw == '' or raw == 'null' then return end

      local ok, response = pcall(vim.fn.json_decode, raw)
      if not ok then
        vim.notify('TimeScope: JSON decode error: ' .. tostring(response) .. ' (raw: ' .. raw .. ')', vim.log.levels.ERROR)
        return
      end
      if response and response.text then
        local virt_text = { { response.text, 'Comment' } }

        if response.hint then
          table.insert(virt_text, { ' (' .. response.hint .. ')', 'DiagnosticHint' })
        end

        -- Only show if cursor is still on the same position (avoid race conditions)
        local current_cursor = vim.api.nvim_win_get_cursor(0)
        if current_cursor[1] - 1 == row and current_cursor[2] >= col and current_cursor[2] <= col + #token then
          vim.api.nvim_buf_set_extmark(0, M.namespace, row, -1, {
            virt_text = virt_text,
            virt_text_pos = 'eol',
            hl_mode = 'combine'
          })
        end
      end
      M._pending_job = nil
    end,
    on_stderr = function(_, data)
      -- Neovim reports a closed stream as {''}; ignore empty chunks.
      local message = table.concat(data or {})
      if message ~= '' then
        vim.notify('TimeScope bridge stderr: ' .. message, vim.log.levels.WARN)
      end
    end,
    on_exit = function()
      -- The bridge exits after every request by design; clearing the pending
      -- job is all that is needed (notifying here would spam every hover).
      M._pending_job = nil
    end
  })
  if job > 0 then
    -- Send the JSON payload followed by a newline so the bridge reads a complete line
    vim.fn.chansend(job, input .. "\n")
    -- The bridge handles one request per line; close stdin so the process exits
    -- after responding instead of waiting forever for more input.
    vim.fn.chanclose(job, 'stdin')
    M._pending_job = job
  else
    vim.notify('TimeScope: Failed to start bridge job (job=' .. tostring(job) .. ')', vim.log.levels.ERROR)
  end
end

M._pending_job = nil

-- Extract the token the cursor is on. Prefers the numeric/operator expression
-- under the cursor; falls back to the right-hand side of an assignment so
-- keyword arguments and constructor calls such as
-- `timeout=timedelta(seconds=400)` can be evaluated by the Node bridge.
function M.get_token_at_cursor(line, col)
  local numeric = M.get_numeric_expression(line, col)
  if numeric then
    return numeric
  end
  local assignment = M.get_assignment_expression(line)
  if assignment then
    return assignment
  end
  return M.get_identifier_at_cursor(line, col)
end

-- Numbers, arithmetic operators and whitespace around the cursor. Parentheses
-- terminate the expression so a closing `)` is never glued onto a value.
function M.get_numeric_expression(line, col)
  local expr_start = nil
  for i = col + 1, 1, -1 do
    local ch = line:sub(i, i)
    if ch:find('[0-9+%-*.%s]') then
      expr_start = i
    else
      break
    end
  end

  local expr_end = nil
  for i = col + 1, #line do
    local ch = line:sub(i, i)
    if ch:find('[0-9+%-*.%s]') then
      expr_end = i
    else
      break
    end
  end

  if not expr_start or not expr_end then
    return nil
  end

  local expr = line:sub(expr_start, expr_end):match('^%s*(.-)%s*$') -- trim
  -- Must contain at least one digit
  if not expr:find('%d') then
    return nil
  end

  return expr
end

-- Right-hand side of `NAME = EXPR`, including const/let/var declarations.
function M.get_assignment_expression(line)
  local body = (line:gsub('^%s*(const|let|var|val|final|local)%s+', '', 1))
  local expr = body:match('^%s*[%a_][%w_]*%s*=%s*(.+)$')
  if not expr then
    return nil
  end

  expr = expr:gsub('%s*#.*$', '')
  expr = expr:gsub('%s*//.*$', '')
  expr = expr:gsub('%s*%-%-.*$', '')
  expr = expr:gsub('[;,]+%s*$', '')
  expr = expr:gsub('%s*[;,]+%s*$', '')
  expr = expr:match('^%s*(.-)%s*$')
  if expr == '' then
    return nil
  end
  return expr
end

-- Identifier under the cursor. The bridge resolves it against constants
-- declared elsewhere in the buffer.
function M.get_identifier_at_cursor(line, col)
  local start_col = nil
  for i = col + 1, 1, -1 do
    if line:sub(i, i):find('[%w_]') then
      start_col = i
    else
      break
    end
  end
  if not start_col then
    return nil
  end

  local end_col = start_col
  for i = start_col + 1, #line do
    if line:sub(i, i):find('[%w_]') then
      end_col = i
    else
      break
    end
  end

  return line:sub(start_col, end_col)
end

M.namespace = vim.api.nvim_create_namespace('timescope')
M.bridge_path = bridge_path

return M