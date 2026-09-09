// TimeScope Quick Test File
// Hover over any number to see the duration detection

// Basic cases
const HELLO = 120;                    // Should show: 2 minutes
const TIMEOUT = 300;                  // Should show: 5 minutes
const DELAY = 5000;                   // Should show: 5 seconds
const RETRY_INTERVAL = 30000;         // Should show: 30 seconds
const CACHE_TTL = 3600;               // Should show: 1 hour
const MAX_AGE = 86400;                // Should show: 1 day

// With context clues
const retryDelayMs = 5000;            // Should show: 5 seconds (ms context)
const timeoutSeconds = 120;           // Should show: 2 minutes (seconds context)
const cacheDurationHours = 48;        // Should show: 2 days (hours context)
const sessionTTLMinutes = 30;         // Should show: 30 minutes

  // Expressions (no unit suffix to avoid context override)
  const ONE_MINUTE_SECONDS = 60;
  const ONE_HOUR_SECONDS = 60 * 60;
  const ONE_DAY_SECONDS = 24 * 60 * 60;

  // New units (context will detect unit from variable name suffix)
  const VALUE_HOURS = 24;                     // Will be detected as hours → 1d
  const VALUE_DAYS = 7;                       // Will be detected as days → 1w
  const VALUE_WEEKS = 2;                      // Will be detected as weeks → 2w
  const VALUE_MONTHS = 3;                     // Will be detected as months → 3mo
  const VALUE_YEARS = 1;                      // Will be detected as years → 12mo 5d

// Edge cases
const ZERO = 0;                       // Should not show (minValue = 1)
const VERY_LARGE = 9999999999999;     // Should not show (maxValue check)
const HEX = 0xFF;                     // Should not show (ignore pattern)
const IP = 1921681;                   // Should not show (ignore pattern)
