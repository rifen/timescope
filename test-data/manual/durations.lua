--- TimeScope manual checks - Lua (used by the Neovim manual test).
--- Move the cursor over a value to see virtual text.
--- Use :next / :bnext to move to the next fixture file (or :prev / :bprevious).

-- Unit suffixes and context keywords
TIMEOUT_SECONDS = 900            -- 15m
RETRY_DELAY_MS = 5000            -- 5s
CACHE_TTL = 3600                 -- 1h
local poll_interval = 60         -- 1m
local backoff = 500              -- 500ms
local spin_wait_ns = 750         -- <1ms

-- Keyword argument and constructor call
START_TO_CLOSE_TIMEOUT = timedelta({ seconds = 400 })   -- 6m 40s

-- Variables referencing variables
COMMIT_TIMER_SETTLE_SECONDS = 5
COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS = 15.0
COMMIT_TIMER_CONFIRM_MARGIN_SECONDS = 10
MIN_COMMIT_TIMER_SECONDS = (     -- 30s
  COMMIT_TIMER_SETTLE_SECONDS
  + int(COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS)
  + COMMIT_TIMER_CONFIRM_MARGIN_SECONDS
)
COMMIT_TIMER_ARM_ACTIVITY_SECONDS = MIN_COMMIT_TIMER_SECONDS + 0   -- 30s

-- Ignored values
HEX_COLOR = 0xFF5733             -- nothing (hex literal)
IP_ADDRESS = "192.168.1.1"       -- nothing (dotted quad)
timestamp = 1700000000           -- nothing (epoch-like value)