// TimeScope manual checks - Rust
// Neovim: :next / :bnext moves to the next fixture file.
use std::time::Duration;

const TIMEOUT_SECONDS: u64 = 900;      // 15m
const RETRY_DELAY_MS: u64 = 5000;      // 5s
const CACHE_TTL_SECONDS: u64 = 3600;   // 1h
const BACKOFF_MS: u64 = 250;           // 250ms
const WINDOW_SECONDS: u64 = 60 * 60;   // 1h

fn main() {
    let timeout = Duration::from_secs(15);        // 15s
    let retry = Duration::from_millis(500);       // 500ms
    let backoff = Duration::from_micros(1500000); // 1s 500ms
    let spin = Duration::from_nanos(750);         // <1ms

    std::thread::sleep(Duration::from_millis(250)); // 250ms

    println!(
        "{} {} {} {} {} {:?} {:?} {:?} {:?}",
        TIMEOUT_SECONDS,
        RETRY_DELAY_MS,
        CACHE_TTL_SECONDS,
        BACKOFF_MS,
        WINDOW_SECONDS,
        timeout,
        retry,
        backoff,
        spin,
    );
}