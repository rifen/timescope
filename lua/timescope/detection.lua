local M = {}
local config = require('timescope').config

-- Convert value to milliseconds based on unit
local function to_milliseconds(value, unit)
  if unit == 'seconds' then return value * 1000
  elseif unit == 'milliseconds' then return value
  elseif unit == 'microseconds' then return value / 1000
  elseif unit == 'nanoseconds' then return value / 1000000
  end
  return value
end

-- Format milliseconds to human-readable duration
local function format_duration(ms)
  if ms < 0 then
    return '-' .. format_duration(-ms)
  end
  if ms < 1 then
    return config.format == 'verbose' and 'less than 1 millisecond' or '<1ms'
  end

  local units = {
    { name = 'year', ms = 31536000000, short = 'y' },
    { name = 'week', ms = 604800000, short = 'w' },
    { name = 'day', ms = 86400000, short = 'd' },
    { name = 'hour', ms = 3600000, short = 'h' },
    { name = 'minute', ms = 60000, short = 'm' },
    { name = 'second', ms = 1000, short = 's' },
    { name = 'millisecond', ms = 1, short = 'ms' }
  }

  local breakdown = {}
  local remaining = ms

  for _, u in ipairs(units) do
    if remaining >= u.ms then
      local value = math.floor(remaining / u.ms)
      table.insert(breakdown, { unit = u.name, short = u.short, value = value })
      remaining = remaining % u.ms
    end
  end

  if #breakdown == 0 then
    return '<1ms'
  end

  -- Compact format: max 2 units
  if config.format == 'compact' then
    local parts = {}
    for i = 1, math.min(2, #breakdown) do
      table.insert(parts, breakdown[i].value .. breakdown[i].short)
    end
    return table.concat(parts, ' ')
  end

  -- Verbose format
  if config.format == 'verbose' then
    local parts = {}
    for _, b in ipairs(breakdown) do
      local plural = b.value ~= 1 and 's' or ''
      table.insert(parts, string.format('%d %s%s', b.value, b.unit, plural))
    end
    return table.concat(parts, ', ')
  end

  -- Both format
  local compact_parts = {}
  for i = 1, math.min(2, #breakdown) do
    table.insert(compact_parts, breakdown[i].value .. breakdown[i].short)
  end
  local compact = table.concat(compact_parts, ' ')

  local verbose_parts = {}
  for _, b in ipairs(breakdown) do
    local plural = b.value ~= 1 and 's' or ''
    table.insert(verbose_parts, string.format('%d %s%s', b.value, b.unit, plural))
  end
  local verbose = table.concat(verbose_parts, ', ')

  return string.format('%s (%s)', verbose, compact)
end

-- Detect duration from token and line context
function M.detect(token, line)
  if not config.context_clues then return nil end

  -- Must be a pure number
  if not token:match('^%d+$') then return nil end

  local value = tonumber(token)
  if not value or value < config.min_value or value > config.max_value then
    return nil
  end

  -- Check ignore patterns
  for _, pattern in ipairs(config.ignore_patterns) do
    if token:match(pattern) then return nil end
  end

  -- Split line into tokens, keeping underscores
  local tokens = {}
  for t in line:gmatch('[^%s=*+/%-()]+') do
    table.insert(tokens, t)
  end

  -- Find token position
  local token_index = nil
  for i, t in ipairs(tokens) do
    if t == token then
      token_index = i
      break
    end
  end
  if not token_index then return nil end

  -- Check surrounding tokens (±2)
  local context_start = math.max(1, token_index - 2)
  local context_end = math.min(#tokens, token_index + 3)
  local context_tokens = {}
  for i = context_start, context_end do
    table.insert(context_tokens, tokens[i])
  end

  -- Check for unit suffixes and keywords
  for _, t in ipairs(context_tokens) do
    local lower = t:lower()

    -- Unit suffixes
    if lower:match('ns$') or lower:match('^_ns$') or lower:match('nano$') then
      local ms = to_milliseconds(value, 'nanoseconds')
      return { text = format_duration(ms), hint = string.format('unit suffix: "%s"', t) }
    end
    if lower:match('us$') or lower:match('^_us$') or lower:match('micro$') then
      local ms = to_milliseconds(value, 'microseconds')
      return { text = format_duration(ms), hint = string.format('unit suffix: "%s"', t) }
    end
    if lower:match('ms$') or lower:match('^_ms$') or lower:match('milli$') then
      local ms = to_milliseconds(value, 'milliseconds')
      return { text = format_duration(ms), hint = string.format('unit suffix: "%s"', t) }
    end
    if lower:match('sec$') or lower:match('^_sec$') or lower:match('second$') then
      local ms = to_milliseconds(value, 'seconds')
      return { text = format_duration(ms), hint = string.format('unit suffix: "%s"', t) }
    end

    -- Semantic keywords
    local unit = M.infer_unit_from_keyword(lower)
    if unit then
      local ms = to_milliseconds(value, unit)
      return { text = format_duration(ms), hint = string.format('keyword: "%s"', t) }
    end
  end

  return nil
end

function M.infer_unit_from_keyword(word)
  if word:match('ms') or word:match('millisecond') then return 'milliseconds' end
  if word:match('us') or word:match('microsecond') then return 'microseconds' end
  if word:match('ns') or word:match('nanosecond') then return 'nanoseconds' end

  local short = {
    'retry', 'backoff', 'delay', 'wait', 'sleep',
    'pause', 'hold', 'throttle', 'rate'
  }
  for _, kw in ipairs(short) do
    if word:match(kw) then return 'milliseconds' end
  end

  local long = {
    'timeout', 'ttl', 'interval', 'duration', 'expiry',
    'expire', 'retention', 'age', 'period', 'cache', 'session'
  }
  for _, kw in ipairs(long) do
    if word:match(kw) then return 'seconds' end
  end

  return nil
end

return M