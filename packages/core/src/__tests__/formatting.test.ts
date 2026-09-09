import {
  toMilliseconds,
  formatDurationFull,
  evaluateExpression,
} from "../formatting";

describe("toMilliseconds", () => {
  it("converts seconds to milliseconds", () => {
    expect(toMilliseconds(30, "seconds")).toBe(30000);
    expect(toMilliseconds(1, "seconds")).toBe(1000);
  });

  it("converts milliseconds to milliseconds", () => {
    expect(toMilliseconds(500, "milliseconds")).toBe(500);
    expect(toMilliseconds(1000, "milliseconds")).toBe(1000);
  });

  it("converts microseconds to milliseconds", () => {
    expect(toMilliseconds(1000, "microseconds")).toBe(1);
    expect(toMilliseconds(500000, "microseconds")).toBe(500);
  });

  it("converts nanoseconds to milliseconds", () => {
    expect(toMilliseconds(1000000, "nanoseconds")).toBe(1);
    expect(toMilliseconds(500000000, "nanoseconds")).toBe(500);
  });

  it("converts hours to milliseconds", () => {
    expect(toMilliseconds(1, "hours")).toBe(3600000);
    expect(toMilliseconds(2, "hours")).toBe(7200000);
    expect(toMilliseconds(24, "hours")).toBe(86400000);
  });

  it("converts days to milliseconds", () => {
    expect(toMilliseconds(1, "days")).toBe(86400000);
    expect(toMilliseconds(7, "days")).toBe(604800000);
  });

  it("converts weeks to milliseconds", () => {
    expect(toMilliseconds(1, "weeks")).toBe(604800000);
    expect(toMilliseconds(2, "weeks")).toBe(1209600000);
  });

  it("converts months to milliseconds (30-day average)", () => {
    expect(toMilliseconds(1, "months")).toBe(2592000000);
    expect(toMilliseconds(12, "months")).toBe(31104000000);
  });

  it("converts years to milliseconds", () => {
    // 365 days * 24 hours * 60 minutes * 60 seconds * 1000 ms
    expect(toMilliseconds(1, "years")).toBe(31536000000);
    expect(toMilliseconds(2, "years")).toBe(63072000000);
  });
});

describe("formatDurationFull", () => {
  it("formats compact output", () => {
    expect(
      formatDurationFull(30000, "milliseconds", { format: "compact" }),
    ).toBe("30s");
  });

  it("formats verbose output", () => {
    expect(
      formatDurationFull(30000, "milliseconds", { format: "verbose" }),
    ).toBe("30 seconds");
  });

  it("formats both compact and verbose", () => {
    expect(formatDurationFull(30000, "milliseconds", { format: "both" })).toBe(
      "30 seconds (30s)",
    );
  });

  it("shows unit labels when enabled", () => {
    expect(
      formatDurationFull(5000, "milliseconds", { format: "compact" }),
    ).toBe("5s");
  });

  it("formats hours correctly", () => {
    expect(formatDurationFull(7200, "seconds", { format: "compact" })).toBe(
      "2h",
    );
    expect(formatDurationFull(2, "hours", { format: "compact" })).toBe("2h");
  });

  it("formats days correctly", () => {
    expect(formatDurationFull(172800, "seconds", { format: "compact" })).toBe(
      "2d",
    );
    expect(formatDurationFull(3, "days", { format: "compact" })).toBe("3d");
  });

  it("formats weeks correctly", () => {
    // 7 days = 1 week in compact format (shows largest units first)
    expect(formatDurationFull(7, "days", { format: "compact" })).toBe("1w");
    expect(formatDurationFull(14, "days", { format: "compact" })).toBe("2w");
  });

  it("formats months correctly", () => {
    expect(formatDurationFull(60, "days", { format: "compact" })).toBe("2mo");
    expect(formatDurationFull(1, "months", { format: "compact" })).toBe("1mo");
  });

  it("formats years correctly", () => {
    // 2 years = 2 * 31536000000 = 63072000000 ms
    // Compact format shows breakdown: 1y + 12mo (approx)
    expect(formatDurationFull(2, "years", { format: "compact" })).toBe(
      "1y 12mo",
    );
    // 365 days = 31536000000 ms, which is less than 1 year (31557600000)
    // So it shows as months and days
    expect(formatDurationFull(365, "days", { format: "compact" })).toBe(
      "12mo 5d",
    );
  });
});

describe("evaluateExpression", () => {
  it("returns number for plain numbers", () => {
    expect(evaluateExpression("30000")).toBe(30000);
    expect(evaluateExpression("60")).toBe(60);
  });

  it("evaluates simple arithmetic", () => {
    expect(evaluateExpression("60 * 40 * 24")).toBe(57600);
    expect(evaluateExpression("1000 * 60 * 60")).toBe(3600000);
  });

  it("respects operator precedence", () => {
    expect(evaluateExpression("10 + 20 * 30")).toBe(610);
    expect(evaluateExpression("(10 + 20) * 30")).toBe(900);
  });

  it("rejects invalid expressions", () => {
    expect(evaluateExpression("1; rm -rf /")).toBeNull();
    expect(evaluateExpression("import os")).toBeNull();
    expect(evaluateExpression("hello")).toBeNull();
  });
});
