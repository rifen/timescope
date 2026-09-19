// TimeScope manual checks - JavaScript
// Neovim: :next / :bnext moves to the next fixture file.

const TIMEOUT_MS = 30000;             // 30s
const POLL_INTERVAL_MS = 250;         // 250ms
const CACHE_TTL = 3600;               // 1h
const retryDelay = 1500;              // 1s 500ms
const staleAfterMs = 60000;           // 1m
const requestTimeoutSeconds = 120;    // 2m
const ONE_HOUR_SECONDS = 60 * 60;     // 1h

setTimeout(callback, 3000);           // 3s (setTimeout -> milliseconds)
setInterval(tick, 250);               // 250ms (setInterval -> milliseconds)

// Keep the sample declarations "used" for linters; this file is never executed.
void [
  TIMEOUT_MS,
  POLL_INTERVAL_MS,
  CACHE_TTL,
  retryDelay,
  staleAfterMs,
  requestTimeoutSeconds,
  ONE_HOUR_SECONDS,
];