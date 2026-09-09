import * as vscode from "vscode";
import { getSettings } from "../config/settings";

export interface DetectedDuration {
  value: number;
  unit:
    | "seconds"
    | "milliseconds"
    | "microseconds"
    | "nanoseconds"
    | "hours"
    | "days"
    | "weeks"
    | "months"
    | "years";
  confidence: number; // 0-1
  source: "heuristic" | "context";
  contextHint?: string; // what triggered the inference
}

const UNIT_THRESHOLDS = {
  nanoseconds: 1e15, // > 1e15 ns (15+ digits) → likely ns
  microseconds: 1e12, // > 1e12 µs (13+ digits) → likely µs
  milliseconds: 1e9, // > 1e9 ms (10+ digits) → likely ms
  seconds: 0, // otherwise seconds
  hours: 0, // only via context/defaultUnit
  days: 0,
  weeks: 0,
  months: 0,
  years: 0,
};

export function detectDuration(
  token: string,
  document: vscode.TextDocument,
  position: vscode.Position,
): DetectedDuration | null {
  const settings = getSettings();

  // Skip if disabled
  if (!settings.enabled) return null;

  // Must be a pure integer
  if (!/^\d+$/.test(token.trim())) return null;

  const value = parseInt(token, 10);

  // Filter by value range
  if (value < settings.minValue || value > settings.maxValue) return null;

  // Always try context clues first — they can override generic ignore patterns
  if (settings.contextClues) {
    const contextResult = inferFromContext(token, document, position, settings);
    if (contextResult) {
      return contextResult;
    }
  }

  // Determine base unit from heuristics / defaultUnit
  let unit:
    | "seconds"
    | "milliseconds"
    | "microseconds"
    | "nanoseconds"
    | "hours"
    | "days"
    | "weeks"
    | "months"
    | "years";
  let confidence = 0.5;
  let source: "heuristic" | "context" = "heuristic";

  if (settings.defaultUnit === "auto") {
    // Heuristic by digit count
    if (value >= UNIT_THRESHOLDS.nanoseconds) {
      unit = "nanoseconds";
      confidence = 0.9;
    } else if (value >= UNIT_THRESHOLDS.microseconds) {
      unit = "microseconds";
      confidence = 0.9;
    } else if (value >= UNIT_THRESHOLDS.milliseconds) {
      unit = "milliseconds";
      confidence = 0.9;
    } else {
      unit = "seconds";
      confidence = 0.7;
    }
  } else {
    unit = settings.defaultUnit;
    confidence = 0.6;
  }

  // Always try context clues when enabled — they can override any defaultUnit
  if (settings.contextClues) {
    const contextResult = inferFromContext(token, document, position, settings);
    if (contextResult) {
      // Only override if context is more specific or higher confidence
      if (contextResult.confidence >= confidence) {
        unit = contextResult.unit;
        confidence = contextResult.confidence;
        source = "context";
      }
    }
  }

  return { value, unit, confidence, source };
}

function inferFromContext(
  token: string,
  document: vscode.TextDocument,
  position: vscode.Position,
  _settings: unknown,
): DetectedDuration | null {
  const line = document.getText(
    new vscode.Range(
      new vscode.Position(position.line, 0),
      new vscode.Position(position.line, position.character + 100),
    ),
  );

  // Split on whitespace + operators, but KEEP underscores inside identifiers
  // e.g. "RETRY_DELAY = 30000" → ["RETRY_DELAY", "30000"]
  const tokens = line.split(/[\s=*+/\-()]+/).filter(Boolean);

  // Find the token at or near the cursor position
  const tokenIndex = tokens.findIndex((t) => t === token);
  if (tokenIndex === -1) return null;

  // Check surrounding tokens (±2) for keywords / unit hints
  const contextStart = Math.max(0, tokenIndex - 2);
  const contextEnd = Math.min(tokens.length, tokenIndex + 3);
  const contextTokens = tokens.slice(contextStart, contextEnd);

  let bestUnit:
    | "seconds"
    | "milliseconds"
    | "microseconds"
    | "nanoseconds"
    | "hours"
    | "days"
    | "weeks"
    | "months"
    | "years"
    | null = null;
  let bestConfidence = 0;
  let bestHint = "";

  for (const t of contextTokens) {
    const lower = t.toLowerCase();

    // Check config-file context first (YAML, nginx, etc. → seconds)
    const fileName = document.uri.path.split("/").pop() || "";
    const fileExt = fileName.includes(".")
      ? fileName.split(".").pop() || ""
      : "";
    const configExtensions = ["yml", "yaml", "toml", "conf", "ini", "json"];
    if (configExtensions.includes(fileExt) && !bestUnit) {
      bestUnit = "seconds";
      bestConfidence = Math.max(bestConfidence, 0.75);
      bestHint = `file context: ${fileExt}`;
    }

    // Direct unit abbreviations in variable name: NANOS, DURATION_NS, MS, US, NS
    // Match as whole word OR underscore-separated suffix (e.g. DURATION_NS)
    if (
      /\bns\b/i.test(lower) ||
      /(?:^|_)ns$/i.test(lower) ||
      /nano(?:s)?$/i.test(lower)
    ) {
      return {
        value: parseInt(token, 10),
        unit: "nanoseconds",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    if (
      /\bus\b/i.test(lower) ||
      /(?:^|_)us$/i.test(lower) ||
      /micro(?:s)?$/i.test(lower)
    ) {
      return {
        value: parseInt(token, 10),
        unit: "microseconds",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    if (
      /\bms\b/i.test(lower) ||
      /(?:^|_)ms$/i.test(lower) ||
      /milli(?:s)?$/i.test(lower)
    ) {
      return {
        value: parseInt(token, 10),
        unit: "milliseconds",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    if (
      /\bsec(?:s)?\b/i.test(lower) ||
      /(?:^|_)sec(?:s)?$/i.test(lower) ||
      /second(?:s)?$/i.test(lower)
    ) {
      return {
        value: parseInt(token, 10),
        unit: "seconds",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    if (
      /\bh(?:r|our)s?\b/i.test(lower) ||
      /(?:^|_)h(?:r)?$/i.test(lower) ||
      /hour/i.test(lower)
    ) {
      return {
        value: parseInt(token, 10),
        unit: "hours",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    if (
      /\bd(?:ay)?s?\b/i.test(lower) ||
      /(?:^|_)d$/i.test(lower) ||
      /day/i.test(lower)
    ) {
      return {
        value: parseInt(token, 10),
        unit: "days",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    if (
      /\bw(?:k|eek)s?\b/i.test(lower) ||
      /(?:^|_)w(?:k)?$/i.test(lower) ||
      /week/i.test(lower)
    ) {
      return {
        value: parseInt(token, 10),
        unit: "weeks",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    if (
      /\bmo(?:nth)?s?\b/i.test(lower) ||
      /(?:^|_)mo$/i.test(lower) ||
      /month/i.test(lower)
    ) {
      return {
        value: parseInt(token, 10),
        unit: "months",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    if (
      /\by(?:r|ear)?s?\b/i.test(lower) ||
      /(?:^|_)y(?:r)?$/i.test(lower) ||
      /year/i.test(lower) ||
      /annual/i.test(lower)
    ) {
      return {
        value: parseInt(token, 10),
        unit: "years",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }

    // Semantic keywords → infer likely unit
    const unitFromKeyword = inferUnitFromKeyword(lower);
    if (unitFromKeyword) {
      const confidence = keywordConfidence(lower);
      if (confidence > bestConfidence) {
        bestUnit = unitFromKeyword;
        bestConfidence = confidence;
        bestHint =
          confidence >= 0.85 ? `keyword: "${t}"` : `keyword: "${t}" (weak)`;
      }
    }
  }

  if (bestUnit) {
    return {
      value: parseInt(token, 10),
      unit: bestUnit,
      confidence: bestConfidence,
      source: "context",
      contextHint: bestHint,
    };
  }

  return null;
}

// Returns the most likely unit for a keyword match
function inferUnitFromKeyword(
  word: string,
):
  | "seconds"
  | "milliseconds"
  | "microseconds"
  | "nanoseconds"
  | "hours"
  | "days"
  | "weeks"
  | "months"
  | "years"
  | null {
  // Explicit unit abbreviations
  if (/\bms\b/.test(word) || /millisecond/.test(word)) return "milliseconds";
  if (/\bus\b/.test(word) || /microsecond/.test(word)) return "microseconds";
  if (/\bns\b/.test(word) || /nanosecond/.test(word)) return "nanoseconds";
  if (/\bh(?:r|our)s?\b/.test(word) || /hour/.test(word)) return "hours";
  if (/\bd(?:ay)?s?\b/.test(word) || /day/.test(word)) return "days";
  if (/\bw(?:k|eek)s?\b/.test(word) || /week/.test(word)) return "weeks";
  if (/\bmo(?:nth)?s?\b/.test(word) || /month/.test(word)) return "months";
  if (
    /\by(?:r|ear)?s?\b/.test(word) ||
    /year/.test(word) ||
    /annual/.test(word)
  )
    return "years";

  // Short-duration operations → usually milliseconds
  if (
    word.includes("retry") ||
    word.includes("backoff") ||
    word.includes("delay") ||
    word.includes("wait") ||
    word.includes("sleep") ||
    word.includes("pause") ||
    word.includes("hold") ||
    word.includes("throttle") ||
    word.includes("rate")
  ) {
    return "milliseconds";
  }

  // Timeouts, TTLs, intervals, sessions → usually seconds
  if (
    word.includes("timeout") ||
    word.includes("ttl") ||
    word.includes("interval") ||
    word.includes("duration") ||
    word.includes("expiry") ||
    word.includes("expire") ||
    word.includes("retention") ||
    word.includes("age") ||
    word.includes("period") ||
    word.includes("cache") ||
    word.includes("session")
  ) {
    return "seconds";
  }

  return null;
}

// Higher confidence for more specific keywords
function keywordConfidence(word: string): number {
  // Very specific words → higher confidence
  const highConfidence = [
    "retry",
    "backoff",
    "timeout",
    "ttl",
    "interval",
    "delay",
    "sleep",
  ];
  const mediumConfidence = [
    "duration",
    "expiry",
    "expire",
    "retention",
    "throttle",
    "wait",
    "pause",
    "hold",
    "cache",
    "session",
    "age",
    "period",
    "rate",
  ];

  for (const kw of highConfidence) {
    if (word.includes(kw)) return 0.85;
  }
  for (const kw of mediumConfidence) {
    if (word.includes(kw)) return 0.75;
  }
  return 0.65;
}
