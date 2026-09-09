import type { FormatOptions } from "../types";

const UNITS = [
  { unit: "year", ms: 31557600000, short: "y" },
  { unit: "month", ms: 2592000000, short: "mo" }, // 30 days average
  { unit: "week", ms: 604800000, short: "w" },
  { unit: "day", ms: 86400000, short: "d" },
  { unit: "hour", ms: 3600000, short: "h" },
  { unit: "minute", ms: 60000, short: "m" },
  { unit: "second", ms: 1000, short: "s" },
  { unit: "millisecond", ms: 1, short: "ms" },
];

export function toMilliseconds(
  value: number,
  unit:
    | "seconds"
    | "minutes"
    | "milliseconds"
    | "microseconds"
    | "nanoseconds"
    | "hours"
    | "days"
    | "weeks"
    | "months"
    | "years",
): number {
  switch (unit) {
    case "years":
      return value * 365 * 24 * 60 * 60 * 1000;
    case "months":
      return value * 30 * 24 * 60 * 60 * 1000; // 30-day average month
    case "weeks":
      return value * 7 * 24 * 60 * 60 * 1000;
    case "days":
      return value * 24 * 60 * 60 * 1000;
    case "hours":
      return value * 60 * 60 * 1000;
    case "minutes":
      return value * 60 * 1000;
    case "seconds":
      return value * 1000;
    case "milliseconds":
      return value;
    case "microseconds":
      return value / 1000;
    case "nanoseconds":
      return value / 1_000_000;
    default:
      // Should never happen; return value unchanged as fallback
      return value;
  }
}

export function formatDuration(ms: number, options: FormatOptions): string {
  if (ms < 1) {
    return options.format === "verbose" ? "less than 1 millisecond" : "<1ms";
  }

  const breakdown = computeBreakdown(ms);

  const compact = formatCompact(breakdown);
  const verbose = formatVerbose(breakdown);

  if (options.format === "compact") return compact;
  if (options.format === "verbose") return verbose;
  return `${verbose} (${compact})`;
}

export function formatDurationFull(
  value: number,
  unit:
    | "seconds"
    | "minutes"
    | "milliseconds"
    | "microseconds"
    | "nanoseconds"
    | "hours"
    | "days"
    | "weeks"
    | "months"
    | "years",
  options: FormatOptions,
): string {
  const ms = toMilliseconds(value, unit);
  return formatDuration(ms, options);
}

export function evaluateExpression(expr: string): number | null {
  // Remove spaces and validate characters
  const sanitized = expr.replace(/\s+/g, "");

  // Only allow digits, operators, parentheses, and decimal points
  if (!/^[\d+\-*/().]+$/.test(sanitized)) {
    return null;
  }

  // Prevent extremely long expressions
  if (sanitized.length > 100) {
    return null;
  }

  try {
    // Safe arithmetic evaluation using a simple recursive descent parser
    // This avoids the security risk of new Function() / eval()
    const tokens = tokenize(sanitized);
    return parseTokens(tokens);
  } catch {
    return null;
  }
}

function parseTokens(tokens: string[]): number | null {
  let pos = 0;

  function parseExpression(): number {
    let value = parseTerm();
    while (
      pos < tokens.length &&
      (tokens[pos] === "+" || tokens[pos] === "-")
    ) {
      const op = tokens[pos++];
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (
      pos < tokens.length &&
      (tokens[pos] === "*" || tokens[pos] === "/")
    ) {
      const op = tokens[pos++];
      const right = parseFactor();
      value = op === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseFactor(): number {
    if (tokens[pos] === "(") {
      pos++; // consume '('
      const value = parseExpression();
      if (pos >= tokens.length || tokens[pos] !== ")") {
        return NaN; // mismatched parentheses
      }
      pos++; // consume ')'
      return value;
    }
    // Must be a number
    const num = Number(tokens[pos++]);
    if (Number.isNaN(num)) return NaN;
    return num;
  }

  const result = parseExpression();
  // Ensure all tokens consumed and result is valid
  if (pos !== tokens.length || !Number.isFinite(result)) {
    return null;
  }
  return result;
}

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let current = "";

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    if (/[\d.]/.test(char)) {
      current += char;
    } else if (/[+\-*/()]/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      tokens.push(char);
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function computeBreakdown(
  ms: number,
): Array<{ unit: string; short: string; value: number }> {
  let remaining = ms;
  const result: Array<{ unit: string; short: string; value: number }> = [];

  for (const { unit, ms: unitMs, short } of UNITS) {
    if (remaining >= unitMs) {
      const value = Math.floor(remaining / unitMs);
      result.push({ unit, short, value });
      remaining = remaining % unitMs;
    }
  }

  return result;
}

function formatCompact(
  breakdown: Array<{ unit: string; short: string; value: number }>,
): string {
  if (breakdown.length === 0) return "<1ms";
  const toShow = breakdown.slice(0, 2);
  return toShow.map(({ short, value }) => `${value}${short}`).join(" ");
}

function formatVerbose(
  breakdown: Array<{ unit: string; short: string; value: number }>,
): string {
  if (breakdown.length === 0) return "less than 1 millisecond";

  return breakdown
    .map(({ unit, value }) => {
      const plural = value === 1 ? "" : "s";
      return `${value} ${unit}${plural}`;
    })
    .join(", ");
}
