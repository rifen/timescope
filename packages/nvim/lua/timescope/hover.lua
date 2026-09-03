local M = {}

-- Compute the bridge path relative to this file
-- hover.lua is at lua/timescope/hover.lua, bridge is at bin/timescope-bridge.js
local plugin_root = debug.getinfo(1, 'S').source:match('@?(.*/)')
local bridge_path = plugin_root .. '../../bin/timescope-bridge.js'

function M.setup()
  local group = vim.api.nvim_create_augroup('TimeScope', { clear = true })
  vim.api.nvim_create_autocmd({ 'CursorMoved', 'CursorMovedI' }, {
    group = group,
    callback = function()
      M.show_duration()
    end
  })
end

function M.show_duration()
  -- Clear previous virtual text
  vim.api.nvim_buf_clear_namespace(0, M.namespace, 0, -1)

  -- Get current line and cursor position
  local cursor = vim.api.nvim_win_get_cursor(0)
  local row = cursor[1] - 1
  local col = cursor[2]
  local line = vim.api.nvim_buf_get_lines(0, row, row + 1, false)[1] or ''

  -- Extract token under cursor
  local token = M.get_token_at_cursor(line, col)
  if not token then return end

  -- Call Node.js bridge
  local input = vim.fn.json_encode({ token = token, line = line })

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

        vim.api.nvim_buf_set_extmark(0, M.namespace, row, -1, {
          virt_text = virt_text,
          virt_text_pos = 'eol',
          hl_mode = 'combine'
        })
      end
    end
  })
  if job > 0 then
    -- Send the JSON payload followed by a newline so the bridge reads a complete line
    vim.fn.chansend(job, input .. "\n")
  end
end

function M.get_token_at_cursor(line, col)
  -- Find the full number that contains the cursor position
  -- Search backward from cursor to find start of number
  local num_start = nil
  for i = col + 1, 1, -1 do
    local ch = line:sub(i, i)
    if ch:match('%d') then
      num_start = i
    else
      break
    end
  end

  -- Search forward from cursor to find end of number
  local num_end = nil
  for i = col + 1, #line do
    local ch = line:sub(i, i)
    if ch:match('%d') then
      num_end = i
    else
      break
    end
  end

  if not num_start or not num_end then
    return nil
  end

  return line:sub(num_start, num_end)
end

M.namespace = vim.api.nvim_create_namespace('timescope')
M.bridge_path = bridge_path

return M