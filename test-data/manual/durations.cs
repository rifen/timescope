// TimeScope manual checks - C#
// Neovim: :next / :bnext moves to the next fixture file.
using System;
using System.Threading.Tasks;

class Timers
{
    const int TimeoutSeconds = 900;              // 15m
    const int RetryDelayMs = 5000;               // 5s
    const int CacheTtl = 3600;                   // 1h
    const int ExponentialBackoffMs = 250;        // 250ms

    async Task Run()
    {
        await Task.Delay(5000);                       // 5s (Delay -> milliseconds)
        var timeout = TimeSpan.FromSeconds(30);       // 30s
        var window = TimeSpan.FromMinutes(5);         // 5m
        var retry = TimeSpan.FromMilliseconds(500);   // 500ms
    }

    static async Task Main()
    {
        await new Timers().Run();
    }
}