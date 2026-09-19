"""TimeScope manual checks - Python.

Hover a value to see the duration; the expected output is in the trailing
comment. In Neovim, use :next / :bnext to move to the next fixture file.
"""

import asyncio
import time
from datetime import timedelta


def retry_interval(**kwargs: int) -> None:
    """Stub so the keyword-argument example below is valid Python."""


def poll(**kwargs: int) -> None:
    """Stub so the keyword-argument example below is valid Python."""


# --- Unit suffixes in names ---
TIMEOUT_SECONDS = 900                  # 15m
RETRY_DELAY_MS = 5000                  # 5s
POLL_INTERVAL_MICROSECONDS = 1500000   # 1s 500ms
SPIN_WAIT_NANOSECONDS = 750            # <1ms
SESSION_TTL_MINUTES = 45               # 45m
CACHE_TTL_HOURS = 48                   # 2d
RETENTION_DAYS = 7                     # 1w
CYCLE_WEEKS = 2                        # 2w

# --- Context keywords ---
retry_after = 30000                    # 30s (retry -> milliseconds)
cache_ttl = 3600                       # 1h (ttl -> seconds)
backoff_delay = 250                    # 250ms (backoff/delay -> milliseconds)
timeout = 120                          # 2m

# --- Expressions ---
ONE_HOUR_SECONDS = 60 * 60             # 1h
ONE_DAY_SECONDS = 24 * 60 * 60         # 1d
EXPR_TIMEOUT = 60 * 5                  # 5m

# --- Keyword arguments and timedelta ---
start_to_close_timeout = timedelta(seconds=400)         # 6m 40s
delay = timedelta(minutes=5, seconds=30)                # 5m 30s
window = timedelta(hours=1, minutes=30)                 # 1h 30m
retry_interval(ms=50)                                   # 50ms
poll(minutes=10)                                        # 10m

# --- Variables referencing variables ---
COMMIT_TIMER_SETTLE_SECONDS = 5                         # 5s
COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS = 15.0             # 15s
COMMIT_TIMER_CONFIRM_MARGIN_SECONDS = 10                # 10s
COMMIT_TIMER_ARM_TIMEOUT_SECONDS = 15.0                 # 15s

try:  # guarded so the conversions below are valid, runnable Python
    COMMIT_TIMER_ARM_ACTIVITY_SECONDS = int(COMMIT_TIMER_ARM_TIMEOUT_SECONDS) + 15   # 30s
    MIN_COMMIT_TIMER_SECONDS = (                        # 30s
        COMMIT_TIMER_SETTLE_SECONDS
        + int(COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS)
        + COMMIT_TIMER_CONFIRM_MARGIN_SECONDS
    )
    DERIVED_FLOAT = float(COMMIT_TIMER_SETTLE_SECONDS) * 2  # 10s
except (TypeError, ValueError):
    raise  # impossible with constant inputs; re-raise rather than swallow

ROUNDED_UP = round(COMMIT_TIMER_SETTLE_SECONDS / 2 + 0.1)  # 3s


def call_demos() -> None:
    time.sleep(2.5)                                     # 2s 500ms (time.sleep -> seconds)
    asyncio.run(asyncio.sleep(30))                      # 30ms (bare "sleep" -> milliseconds)


# --- Ignored values ---
HEX_COLOR = 0xFF5733                                    # nothing (hex literal)
IP_ADDRESS = "192.168.1.1"                              # nothing (dotted quad)
timestamp = 1700000000                                  # nothing (epoch-like value)
