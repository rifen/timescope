// TimeScope manual checks - TypeScript
// Neovim: :next / :bnext moves to the next fixture file.
export {};

// Stubs so the sample type-checks; TimeScope only needs the line text.
const tick = () => {};
const frame = () => {};
declare function requestAnimationFrame(callback: () => void, ms: number): void;

// --- Unit suffixes in names ---
const TIMEOUT_SECONDS = 900;              // 15m
const RETRY_DELAY_MS = 5000;              // 5s
const POLL_INTERVAL_US = 1500000;         // 1s 500ms
const SPIN_WAIT_NS = 750;                 // <1ms
const SESSION_TTL_MINUTES = 45;           // 45m
const CACHE_TTL_HOURS = 48;               // 2d
const RETENTION_DAYS = 7;                 // 1w
const CYCLE_WEEKS = 2;                    // 2w

// --- Context keywords ---
const retryDelay = 5000;                  // 5s (delay -> milliseconds)
const cacheTtl = 3600;                    // 1h
const retryBackoff = 250;                 // 250ms

// --- Expressions and casts ---
const ONE_HOUR_SECONDS = 60 * 60;         // 1h
const ONE_DAY_SECONDS = 24 * 60 * 60;     // 1d
const TRUNCATED = Math.trunc(15.9) + 15;  // 30s
const FLOORED = Math.floor(2.5);          // 2s

// --- Functions with language overrides (milliseconds in JS/TS) ---
setTimeout(() => {}, 3000);               // 3s
setInterval(tick, 5000);                  // 5s
requestAnimationFrame(frame, 2000);       // 2s

// --- Variables referencing variables ---
const COMMIT_TIMER_SETTLE_SECONDS = 5;
const COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS = 15.0;
const COMMIT_TIMER_CONFIRM_MARGIN_SECONDS = 10;
const MIN_COMMIT_TIMER_SECONDS = (        // 30s
  COMMIT_TIMER_SETTLE_SECONDS
  + Math.trunc(COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS)
  + COMMIT_TIMER_CONFIRM_MARGIN_SECONDS
);

// --- Ignored values ---
const HEX_COLOR = 0xff5733;               // nothing (hex literal)
const IP_ADDRESS = "192.168.1.1";         // nothing (dotted quad)
const CREATED_AT = "2024-01-15";          // nothing (ISO date)
const timestamp = 1700000000;             // nothing (epoch-like value)

// Exported so type-aware linters treat the sample declarations as used.
export {
  TIMEOUT_SECONDS,
  RETRY_DELAY_MS,
  POLL_INTERVAL_US,
  SPIN_WAIT_NS,
  SESSION_TTL_MINUTES,
  CACHE_TTL_HOURS,
  RETENTION_DAYS,
  CYCLE_WEEKS,
  retryDelay,
  cacheTtl,
  retryBackoff,
  ONE_HOUR_SECONDS,
  ONE_DAY_SECONDS,
  TRUNCATED,
  FLOORED,
  COMMIT_TIMER_SETTLE_SECONDS,
  COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS,
  COMMIT_TIMER_CONFIRM_MARGIN_SECONDS,
  MIN_COMMIT_TIMER_SECONDS,
  HEX_COLOR,
  IP_ADDRESS,
  CREATED_AT,
  timestamp,
};