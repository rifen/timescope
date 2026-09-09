import { detectDuration, scanCode } from "../index";
import type { TimeScopeSettings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

describe("detectDuration - extensive edge cases", () => {
  const baseSettings: TimeScopeSettings = {
    ...DEFAULT_SETTINGS,
    minValue: 0,
    maxValue: Number.MAX_SAFE_INTEGER,
    contextClues: false,
    defaultUnit: "auto",
    format: "compact",
  };

  test("auto unit selection based on magnitude", () => {
    // nanoseconds threshold (>= 1e15 ns) -> nanoseconds
    expect(
      detectDuration("1000000000000000", "some line", baseSettings)!.unit,
    ).toBe("nanoseconds");
    // microseconds threshold (>= 1e12) -> microseconds
    expect(
      detectDuration("1000000000000", "some line", baseSettings)!.unit,
    ).toBe("microseconds");
    // milliseconds threshold (>= 1e9) -> milliseconds
    expect(detectDuration("1000000000", "some line", baseSettings)!.unit).toBe(
      "milliseconds",
    );
    // below thresholds -> seconds
    expect(detectDuration("500", "some line", baseSettings)!.unit).toBe(
      "seconds",
    );
  });

  test("defaultUnit override", () => {
    const settings = { ...baseSettings, defaultUnit: "milliseconds" as const };
    const result = detectDuration("30000", "any", settings);
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("milliseconds");
  });

  test("context clues detect unit suffix", () => {
    const line = "const timeoutMs = 30";
    const result = detectDuration("30", line, {
      ...baseSettings,
      contextClues: true,
      defaultUnit: "auto" as const,
    });
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("milliseconds");
  });

  test("context clues detect _YEARS suffix", () => {
    const result = detectDuration("5", "const ttl_years = 5", {
      ...baseSettings,
      contextClues: true,
      defaultUnit: "auto" as const,
    });
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("years");
  });

  test("context clues detect _MONTHS suffix", () => {
    const result = detectDuration("3", "const retention_months = 3", {
      ...baseSettings,
      contextClues: true,
      defaultUnit: "auto" as const,
    });
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("months");
  });

  test("context clues detect _WEEKS suffix", () => {
    const result = detectDuration("2", "const cycle_weeks = 2", {
      ...baseSettings,
      contextClues: true,
      defaultUnit: "auto" as const,
    });
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("weeks");
  });

  test("context clues detect _DAYS suffix", () => {
    const result = detectDuration("7", "const period_days = 7", {
      ...baseSettings,
      contextClues: true,
      defaultUnit: "auto" as const,
    });
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("days");
  });

  test("context clues detect _HOURS suffix", () => {
    const result = detectDuration("24", "const duration_hours = 24", {
      ...baseSettings,
      contextClues: true,
      defaultUnit: "auto" as const,
    });
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("hours");
  });

  test("context clues detect camelCase year suffix", () => {
    const result = detectDuration("10", "const ttlYear = 10", {
      ...baseSettings,
      contextClues: true,
      defaultUnit: "auto" as const,
    });
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("years");
  });

  test("context clues detect camelCase day suffix", () => {
    const result = detectDuration("30", "const ttlDay = 30", {
      ...baseSettings,
      contextClues: true,
      defaultUnit: "auto" as const,
    });
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("days");
  });

  test("context clues detect camelCase hour suffix", () => {
    const result = detectDuration("48", "const ttlHour = 48", {
      ...baseSettings,
      contextClues: true,
      defaultUnit: "auto" as const,
    });
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("hours");
  });

  test("context clues detect camelCase month suffix", () => {
    const result = detectDuration("6", "const ttlMonth = 6", {
      ...baseSettings,
      contextClues: true,
      defaultUnit: "auto" as const,
    });
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("months");
  });

  test("ignore patterns prevent detection", () => {
    // ignorePatterns is now hardcoded in COMPILED_IGNORE_PATTERNS
    // Test hex pattern
    expect(detectDuration("0xFF", "line", baseSettings)).toBeNull();
  });

  test("min/max threshold enforcement", () => {
    const settingsLow = { ...baseSettings, minValue: 100 };
    expect(detectDuration("50", "line", settingsLow)).toBeNull();

    const settingsHigh = { ...baseSettings, maxValue: 1000 };
    expect(detectDuration("2000", "line", settingsHigh)).toBeNull();
  });

  test("complex arithmetic evaluation", () => {
    const line = "const total = 60 * 60 * 24";
    const result = detectDuration("60 * 60 * 24", line, {
      ...baseSettings,
      contextClues: true,
    });
    expect(result).not.toBeNull();
    expect(result!.value).toBe(86400);
    // with default auto, 86400 seconds should be seconds unit
    expect(result!.unit).toBe("seconds");
  });

  test("invalid token rejected", () => {
    expect(detectDuration("1; rm -rf /", "line", baseSettings)).toBeNull();
    expect(detectDuration("hello", "line", baseSettings)).toBeNull();
  });
});

describe("detectDuration - language-specific keyword overrides", () => {
  const baseSettings: TimeScopeSettings = {
    ...DEFAULT_SETTINGS,
    minValue: 0,
    maxValue: Number.MAX_SAFE_INTEGER,
    contextClues: true, // Language overrides require contextClues to be enabled
    defaultUnit: "auto",
    format: "compact",
  };

  test("JavaScript setTimeout maps to milliseconds", () => {
    const result = detectDuration(
      "3000",
      "setTimeout(fn, 3000)",
      baseSettings,
      "javascript",
    );
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("milliseconds");
  });

  test("TypeScript setTimeout maps to milliseconds", () => {
    const result = detectDuration(
      "3000",
      "setTimeout(fn, 3000)",
      baseSettings,
      "typescript",
    );
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("milliseconds");
  });

  test("JavaScript setInterval maps to milliseconds", () => {
    const result = detectDuration(
      "5000",
      "setInterval(fn, 5000)",
      baseSettings,
      "javascript",
    );
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("milliseconds");
  });

  test("JavaScript requestAnimationFrame maps to milliseconds", () => {
    const result = detectDuration(
      "2000",
      "requestAnimationFrame(fn, 2000)",
      baseSettings,
      "javascript",
    );
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("milliseconds");
  });

  test("Python time.sleep maps to seconds", () => {
    const result = detectDuration(
      "2.5",
      "time.sleep(2.5)",
      baseSettings,
      "python",
    );
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("seconds");
  });

  test("Go time.Sleep maps to nanoseconds", () => {
    const result = detectDuration(
      "1000000000",
      "time.Sleep(1000000000)",
      baseSettings,
      "go",
    );
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("nanoseconds");
  });

  test("language override takes precedence over default keywords", () => {
    // 'retryDelay' contains 'retry' -> default maps to milliseconds
    // Ensure defaults still work for retryDelay in JS
    const result = detectDuration(
      "500",
      "const retryDelay = 500",
      baseSettings,
      "javascript",
    );
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("milliseconds");
  });

  test("no language uses default keyword mapping", () => {
    // Without language, 'setTimeout' contains 'timeout' -> default maps to seconds
    const result = detectDuration("3000", "setTimeout(fn, 3000)", baseSettings);
    expect(result).not.toBeNull();
    expect(result!.unit).toBe("seconds");
  });
});

describe("scanCode - comprehensive scanning", () => {
  test("detects multiple durations with proper non‑overlap", () => {
    const code = `
      const timeout = 30 * 1000; // milliseconds
      const retryDelay = 5 * 60 * 1000; // also ms
      const longNs = 2000000000000000; // nanoseconds
    `;
    const result = scanCode(code, "test.ts", {
      contextClues: true,
      defaultUnit: "auto",
    });
    // Expect three items
    expect(result.items.length).toBe(3);
    const units = result.items.map((i) => i.unit).sort();
    expect(units).toEqual(["milliseconds", "milliseconds", "nanoseconds"]);
  });

  test("ignores tokens inside version strings or regex quantifiers", () => {
    const code = `
      const version = 'v1.2.3';
      const regex = /a{3,5}/;
      const valid = 5000;
    `;
    const result = scanCode(code, "test.ts", {});
    // Only the numeric literal 5000 should be detected
    expect(result.items.length).toBe(1);
    expect(result.items[0].value).toBe(5000);
    expect(result.items[0].unit).toBe("seconds"); // auto detection for 5000 -> seconds
  });
});
