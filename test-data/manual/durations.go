// TimeScope manual checks - Go
// Neovim: :next / :bnext moves to the next fixture file.
package main

import "time"

const (
	TimeoutSeconds = 30           // 30s (camelCase suffix)
	RetryDelayMs   = 5000         // 5s (camelCase suffix)
	PollIntervalNs = 5000000000   // 5s (camelCase suffix)
	CacheTtl       = 3600         // 1h (ttl keyword)
)

func main() {
	// time.Sleep and time.After take nanoseconds; the Go override handles it.
	time.Sleep(5000000000) // 5s

	select {
	case <-time.After(1500000000): // 1s 500ms
	}
}