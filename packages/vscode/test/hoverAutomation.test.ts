import * as vscode from "vscode";
import { DurationHoverProvider } from "../src/provider/durationHover";
import { getSettings } from "../src/config/settings";

interface TestCase {
  line: string;
  cursorChar: number;
  expectedToken: string | null;
  expectedFormat?: string;
  expectedHint?: string;
  description: string;
}

const testCases: TestCase[] = [
  // Variable name hover - should extract expression
  {
    line: "INTERVAL = 60 * 60",
    cursorChar: 7,
    expectedToken: "60 * 60",
    expectedFormat: "1h",
    expectedHint: "INTERVAL",
    description: "Hover on variable name INTERVAL",
  },
  {
    line: "COMPLEX = 60 * 40 * 24",
    cursorChar: 7,
    expectedToken: "60 * 40 * 24",
    expectedFormat: "16h",
    description: "Hover on variable name COMPLEX",
  },
  {
    line: "DAILY_CRON = 24 * 60 * 60",
    cursorChar: 10,
    expectedToken: "24 * 60 * 60",
    expectedFormat: "1d",
    description: "Hover on variable name DAILY_CRON",
  },
  {
    line: "WEEKLY_MS = 7 * 24 * 60 * 60 * 1000",
    cursorChar: 9,
    expectedToken: "7 * 24 * 60 * 60 * 1000",
    expectedFormat: "1w",
    expectedHint: "WEEKLY_MS",
    description: "Hover on variable name WEEKLY_MS",
  },

  // Expression hover - should extract full expression
  {
    line: "INTERVAL = 60 * 60",
    cursorChar: 15,
    expectedToken: "60 * 60",
    expectedFormat: "1h",
    description: "Hover on expression 60 * 60",
  },
  {
    line: "COMPLEX = 60 * 40 * 24",
    cursorChar: 15,
    expectedToken: "60 * 40 * 24",
    expectedFormat: "16h",
    description: "Hover on expression 60 * 40 * 24",
  },

  // Unit suffixes
  {
    line: "RETRY_DELAY_S = 2",
    cursorChar: 7,
    expectedToken: "2",
    expectedFormat: "2s",
    expectedHint: "RETRY_DELAY_S",
    description: "Hover on RETRY_DELAY_S variable name",
  },
  {
    line: "MIN_TIMEOUT_MILLISECONDS = 500",
    cursorChar: 15,
    expectedToken: "500",
    expectedFormat: "500ms",
    expectedHint: "MIN_TIMEOUT_MILLISECONDS",
    description: "Hover on MIN_TIMEOUT_MILLISECONDS variable name",
  },
  {
    line: "LONG_WAIT_MICROSECONDS = 1500000",
    cursorChar: 15,
    expectedToken: "1500000",
    expectedFormat: "1s 500ms",
    expectedHint: "LONG_WAIT_MICROSECONDS",
    description: "Hover on LONG_WAIT_MICROSECONDS variable name",
  },
  {
    line: "VERY_SHORT_NANOSECONDS = 750",
    cursorChar: 15,
    expectedToken: "750",
    expectedFormat: "<1ms",
    expectedHint: "VERY_SHORT_NANOSECONDS",
    description: "Hover on VERY_SHORT_NANOSECONDS variable name",
  },
  {
    line: "BARE_NANOS = 900000000000",
    cursorChar: 10,
    expectedToken: "900000000000",
    expectedFormat: "15m",
    expectedHint: "BARE_NANOS",
    description: "Hover on BARE_NANOS variable name",
  },

  // Keyword-based detection
  {
    line: "TIMEOUT_SECONDS = 900",
    cursorChar: 15,
    expectedToken: "900",
    expectedFormat: "15m",
    expectedHint: "TIMEOUT_SECONDS",
    description: "Hover on TIMEOUT_SECONDS variable name",
  },
  {
    line: "RETRY_DELAY_MS = 5000",
    cursorChar: 14,
    expectedToken: "5000",
    expectedFormat: "5s",
    expectedHint: "RETRY_DELAY_MS",
    description: "Hover on RETRY_DELAY_MS variable name",
  },
  {
    line: "SESSION_TTL = 86400",
    cursorChar: 11,
    expectedToken: "86400",
    expectedFormat: "1d",
    expectedHint: "SESSION_TTL",
    description: "Hover on SESSION_TTL variable name",
  },
  {
    line: "CACHE_EXPIRY = 86400000",
    cursorChar: 12,
    expectedToken: "86400000",
    expectedFormat: "2y 38w",
    expectedHint: "CACHE_EXPIRY",
    description: "Hover on CACHE_EXPIRY variable name",
  },

  // Ignored patterns
  {
    line: "DATE = 2024-01-15",
    cursorChar: 5,
    expectedToken: null,
    description: "DATE with ISO date should be ignored",
  },
  {
    line: "IP = 192.168.1.1",
    cursorChar: 3,
    expectedToken: null,
    description: "IP address should be ignored",
  },
  {
    line: "HEX_COLOR = 0xFF5733",
    cursorChar: 10,
    expectedToken: null,
    description: "Hex color should be ignored",
  },
  {
    line: "UNIX_EPOCH = 1700000000",
    cursorChar: 11,
    expectedToken: null,
    description: "Unix epoch should be ignored",
  },
  {
    line: "NEGATIVE = -5000",
    cursorChar: 9,
    expectedToken: null,
    description: "Negative number should be ignored",
  },
  {
    line: "ZERO = 0",
    cursorChar: 5,
    expectedToken: null,
    description: "Zero should be ignored",
  },
  {
    line: "LARGE = 31557600001",
    cursorChar: 6,
    expectedToken: null,
    description: "Value above maxValue should be ignored",
  },

  // Edge cases that should show
  {
    line: "SMALL = 1",
    cursorChar: 6,
    expectedToken: "1",
    expectedFormat: "1s",
    description: "Min boundary value",
  },
  {
    line: "PORT = 8080",
    cursorChar: 5,
    expectedToken: "8080",
    expectedFormat: "2h 14m",
    description: "Port number (4 digits, not epoch)",
  },
];

function stripComments(expr: string): string {
  let result = expr.replace(/\s*#[^\n]*/g, "");
  result = result.replace(/\s*\/\/.*$/gm, "");
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  return result.trim();
}

function testExtractCandidate() {
  console.log("=== Testing extractCandidate logic ===\n");
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const provider = new DurationHoverProvider(() => {});

    // Access private method via type assertion
    const extractCandidate = (provider as any).extractCandidate.bind(provider);
    const result = extractCandidate(tc.line, tc.cursorChar, 0);

    let success = true;
    let errorMsg = "";

    if (tc.expectedToken === null) {
      if (result !== null) {
        success = false;
        errorMsg = `Expected null (ignored), but got token: "${result.token}"`;
      }
    } else {
      if (result === null) {
        success = false;
        errorMsg = `Expected token "${tc.expectedToken}", but got null (ignored)`;
      } else {
        const sanitized = stripComments(result.token).trim();
        if (sanitized !== tc.expectedToken) {
          success = false;
          errorMsg = `Expected token "${tc.expectedToken}", but got "${sanitized}" (raw: "${result.token}")`;
        }
      }
    }

    if (success && tc.expectedToken !== null && tc.expectedFormat) {
      // Test full detection
      const settings = getSettings();
      const {
        detectDuration,
        formatDurationFull,
      } = require("@rifen/timescope-core");
      const duration = detectDuration(tc.expectedToken, tc.line, settings);

      if (!duration) {
        success = false;
        errorMsg = `Detection returned null for token "${tc.expectedToken}"`;
      } else {
        const formatted = formatDurationFull(duration.value, duration.unit, {
          format: settings.format,
        });

        if (formatted !== tc.expectedFormat) {
          success = false;
          errorMsg = `Format mismatch: expected "${tc.expectedFormat}", got "${formatted}" (unit: ${duration.unit}, hint: ${duration.contextHint})`;
        }

        if (
          tc.expectedHint &&
          duration.contextHint &&
          !duration.contextHint.includes(tc.expectedHint)
        ) {
          success = false;
          errorMsg = `Hint mismatch: expected to contain "${tc.expectedHint}", got "${duration.contextHint}"`;
        }
      }
    }

    if (success) {
      console.log(`✅ ${tc.description}`);
      passed++;
    } else {
      console.log(`❌ ${tc.description}`);
      console.log(`   ${errorMsg}`);
      console.log(`   Line: "${tc.line}"`);
      console.log(`   Cursor: ${tc.cursorChar}`);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  return failed === 0;
}

const success = testExtractCandidate();
process.exit(success ? 0 : 1);
