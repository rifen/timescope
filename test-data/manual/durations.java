// TimeScope manual checks - Java
// Neovim: :next / :bnext moves to the next fixture file.
import java.time.Duration;

public class Timers {
    static final int TIMEOUT_SECONDS = 900;      // 15m
    static final int RETRY_DELAY_MS = 5000;      // 5s
    static final int CACHE_TTL = 3600;           // 1h
    static final int exponentialBackoffMs = 250; // 250ms

    void run() throws InterruptedException {
        Thread.sleep(5000);                        // 5s (Thread.sleep -> milliseconds)
        Duration timeout = Duration.ofSeconds(30); // 30s
        Duration window = Duration.ofMinutes(5);   // 5m
        Duration retry = Duration.ofMillis(500);   // 500ms
    }

    public static void main(String[] args) throws InterruptedException {
        new Timers().run();
    }
}