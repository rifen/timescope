import type { FormatOptions, VariableContext } from "../types";

const TIMEDELTA_FACTORS: Record<string, number> = {
  days: 86400,
  day: 86400,
  seconds: 1,
  second: 1,
  sec: 1,
  secs: 1,
  s: 1,
  microseconds: 1e-6,
  microsecond: 1e-6,
  us: 1e-6,
  milliseconds: 1e-3,
  millisecond: 1e-3,
  ms: 1e-3,
  minutes: 60,
  minute: 60,
  min: 60,
  mins: 60,
  m: 60,
  hours: 3600,
  hour: 3600,
  hr: 3600,
  hrs: 3600,
  h: 3600,
  weeks: 604800,
  week: 604800,
  w: 604800,
};

const TIMEDELTA_POSITIONAL_ORDER = [
  "days",
  "seconds",
  "microseconds",
  "milliseconds",
  "minutes",
  "hours",
  "weeks",
];

/**
 * Safely evaluates an arithmetic expression or timedelta duration string
 * without using `eval()` or `new Function()`.
 *
 * Invariants:
 *   - Character whitelist: alphanumeric, arithmetic operators (+, -, *, /),
 *     parentheses, decimals, commas, equals, and underscores.
 *   - Maximum length: 500 characters
 *   - Supports variable substitution from `variables` context.
 *   - Supports timedelta formats (e.g. `timedelta(seconds=30)`).
 *
 * @param expr Arithmetic expression or duration string.
 * @param variables Optional symbol table for variable lookup.
 * @returns Evaluated numeric value, or null if invalid/unresolvable.
 */
export function evaluateExpression(
  expr: string,
  variables?: VariableContext,
): number | null {
  // Remove spaces and validate characters
  const sanitized = expr.replace(/\s+/g, "");

  // Allow digits, operators, parentheses, decimal points, commas, equals, and identifier letters/underscores
  if (!/^[a-zA-Z0-9_+\-*/().,=]+$/.test(sanitized)) {
    return null;
  }

  // Prevent extremely long expressions
  if (sanitized.length > 500) {
    return null;
  }

  try {
    // Safe arithmetic evaluation using a recursive descent parser
    // This avoids the security risk of new Function() / eval()
    const tokens = tokenize(sanitized);
    return parseTokens(tokens, variables);
  } catch {
    return null;
  }
}

function parseTokens(
  tokens: string[],
  variables?: VariableContext,
): number | null {
  let pos = 0;

  function lookupVariable(name: string): number {
    if (!variables) return NaN;
    const val =
      variables instanceof Map ? variables.get(name) : variables[name];
    if (typeof val === "number" && Number.isFinite(val)) {
      return val;
    }
    return NaN;
  }

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
    if (tokens[pos] === "+" || tokens[pos] === "-") {
      const sign = tokens[pos++];
      const value = parseFactor();
      return sign === "-" ? -value : value;
    }

    if (tokens[pos] === "(") {
      pos++; // consume '('
      const value = parseExpression();
      if (pos >= tokens.length || tokens[pos] !== ")") {
        return NaN; // mismatched parentheses
      }
      pos++; // consume ')'
      return value;
    }

    // Function call or identifier
    if (/^[a-zA-Z_]/.test(tokens[pos])) {
      const name = tokens[pos++];

      // Check for function call
      if (pos < tokens.length && tokens[pos] === "(") {
        pos++; // consume '('
        return evaluateFunctionCall(name);
      }

      // Variable lookup
      return lookupVariable(name);
    }

    // Number literal
    const num = Number(tokens[pos++]);
    if (Number.isNaN(num)) return NaN;
    return num;
  }

  function evaluateFunctionCall(funcName: string): number {
    const fnLower = funcName.toLowerCase();

    if (fnLower === "timedelta" || fnLower === "datetime.timedelta") {
      let totalSeconds = 0;
      let positionalIndex = 0;

      while (pos < tokens.length && tokens[pos] !== ")") {
        // Check if keyword argument: name = expr
        if (
          pos + 1 < tokens.length &&
          tokens[pos + 1] === "=" &&
          /^[a-zA-Z_]/.test(tokens[pos])
        ) {
          const kwName = tokens[pos++].toLowerCase();
          pos++; // consume '='
          const val = parseExpression();
          if (Number.isNaN(val)) return NaN;
          const factor = TIMEDELTA_FACTORS[kwName];
          if (factor !== undefined) {
            totalSeconds += val * factor;
          }
        } else {
          // Positional argument
          const val = parseExpression();
          if (Number.isNaN(val)) return NaN;
          if (positionalIndex < TIMEDELTA_POSITIONAL_ORDER.length) {
            const kwName = TIMEDELTA_POSITIONAL_ORDER[positionalIndex++];
            const factor = TIMEDELTA_FACTORS[kwName];
            if (factor !== undefined) {
              totalSeconds += val * factor;
            }
          }
        }

        if (pos < tokens.length && tokens[pos] === ",") {
          pos++; // consume ','
        } else {
          break;
        }
      }

      if (pos >= tokens.length || tokens[pos] !== ")") {
        return NaN;
      }
      pos++; // consume ')'
      return totalSeconds;
    }

    // Single-argument functions: int, float, round, Math.floor, Math.round
    const arg = parseExpression();
    if (pos >= tokens.length || tokens[pos] !== ")") {
      return NaN;
    }
    pos++; // consume ')'

    if (fnLower === "int" || fnLower === "math.trunc") {
      return Math.trunc(arg);
    }
    if (fnLower === "float" || fnLower === "number") {
      return Number(arg);
    }
    if (fnLower === "round" || fnLower === "math.round") {
      return Math.round(arg);
    }
    if (fnLower === "math.floor") {
      return Math.floor(arg);
    }

    return NaN;
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
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    // Operators and delimiters
    if (/[+\-*/(),=]/.test(char)) {
      tokens.push(char);
      i++;
      continue;
    }

    // Numbers: digits with optional decimal point
    if (/[\d.]/.test(char)) {
      let num = "";
      while (i < expr.length && /[\d.]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push(num);
      continue;
    }

    // Identifiers: letters, underscores, and dotted names (e.g. datetime.timedelta)
    if (/[a-zA-Z_]/.test(char)) {
      let ident = "";
      while (i < expr.length && /[a-zA-Z0-9_.]/.test(expr[i])) {
        ident += expr[i++];
      }
      tokens.push(ident);
      continue;
    }

    // Unknown character: skip
    i++;
  }

  return tokens;
}

const UNITS = [
  { unit: "year", ms: 31536000000, short: "y" },
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
  if (ms < 0) {
    const positive = formatDuration(-ms, options);
    return `-${positive}`;
  }
  if (ms < 1) {
    return options.format === "verbose" ? "less than 1 millisecond" : "<1ms";
  }

  const breakdown = computeBreakdown(ms);

  const visibleBreakdown =
    options.showBreakdown === false ? breakdown.slice(0, 1) : breakdown;
  const compact = formatCompact(
    visibleBreakdown,
    options.showUnitLabel !== false,
  );
  const verbose = formatVerbose(
    visibleBreakdown,
    options.showUnitLabel !== false,
  );

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
  showUnitLabel = true,
): string {
  if (breakdown.length === 0) return "<1ms";
  const toShow = breakdown.slice(0, 2);
  return toShow
    .map(({ short, value }) =>
      showUnitLabel ? `${value}${short}` : `${value}`,
    )
    .join(" ");
}

function formatVerbose(
  breakdown: Array<{ unit: string; short: string; value: number }>,
  showUnitLabel = true,
): string {
  if (breakdown.length === 0) return "less than 1 millisecond";

  return breakdown
    .map(({ unit, value }) => {
      const plural = value === 1 ? "" : "s";
      return showUnitLabel ? `${value} ${unit}${plural}` : `${value}`;
    })
    .join(", ");
}
