import * as assert from "assert";
import { suite, test } from "mocha";
import { toMilliseconds, formatDuration } from "@rifen/timescope-core";

suite("Formatting Tests", () => {
  test("toMilliseconds: converts seconds", () => {
    assert.strictEqual(toMilliseconds(60, "seconds"), 60000);
    assert.strictEqual(toMilliseconds(3600, "seconds"), 3600000);
    assert.strictEqual(toMilliseconds(900, "seconds"), 900000);
  });

  test("toMilliseconds: converts milliseconds", () => {
    assert.strictEqual(toMilliseconds(1000, "milliseconds"), 1000);
    assert.strictEqual(toMilliseconds(500, "milliseconds"), 500);
  });

  test("toMilliseconds: converts microseconds", () => {
    assert.strictEqual(toMilliseconds(1000000, "microseconds"), 1000);
    assert.strictEqual(toMilliseconds(5000000, "microseconds"), 5000);
  });

  test("toMilliseconds: converts nanoseconds", () => {
    assert.strictEqual(toMilliseconds(1000000000, "nanoseconds"), 1000);
    assert.strictEqual(toMilliseconds(5000000000, "nanoseconds"), 5000);
  });

  test("formatDuration: compact format", () => {
    const opts = {
      format: "compact" as const,
      showBreakdown: true,
      showUnitLabel: true,
    };

    // 15 minutes
    assert.strictEqual(formatDuration(900000, opts), "15m");

    // 1 hour
    assert.strictEqual(formatDuration(3600000, opts), "1h");

    // 1 day
    assert.strictEqual(formatDuration(86400000, opts), "1d");

    // 1 week
    assert.strictEqual(formatDuration(604800000, opts), "1w");

    // 1 year
    assert.strictEqual(formatDuration(31536000000, opts), "1y");

    // 2 hours 30 minutes
    assert.strictEqual(formatDuration(9000000, opts), "2h 30m");
  });

  test("formatDuration: verbose format", () => {
    const opts = {
      format: "verbose" as const,
      showBreakdown: true,
      showUnitLabel: true,
    };

    // 15 minutes
    assert.strictEqual(formatDuration(900000, opts), "15 minutes");

    // 1 hour
    assert.strictEqual(formatDuration(3600000, opts), "1 hour");

    // 2 hours
    assert.strictEqual(formatDuration(7200000, opts), "2 hours");

    // 1 hour, 30 minutes
    assert.strictEqual(formatDuration(5400000, opts), "1 hour, 30 minutes");
  });

  test("formatDuration: both format", () => {
    const opts = {
      format: "both" as const,
      showBreakdown: true,
      showUnitLabel: true,
    };

    assert.strictEqual(formatDuration(900000, opts), "15 minutes (15m)");
    assert.strictEqual(formatDuration(3600000, opts), "1 hour (1h)");
  });

  test("formatDuration: handles edge cases", () => {
    const opts = {
      format: "compact" as const,
      showBreakdown: true,
      showUnitLabel: true,
    };

    // Less than 1ms
    assert.strictEqual(formatDuration(0.5, opts), "<1ms");
    assert.strictEqual(formatDuration(0, opts), "<1ms");

    // Very small values
    assert.strictEqual(formatDuration(1, opts), "1ms");
  });
});
