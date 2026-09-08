import {
  type TimeScopeSettings,
  type DetectedDuration,
  type DetectedItem,
  type ScanResult,
  DEFAULT_SETTINGS,
} from "../types";
import { evaluateExpression, formatDurationFull } from "../formatting";

const UNIT_THRESHOLDS = {
  nanoseconds: 1e15,
  microseconds: 1e12,
  milliseconds: 1e9,
  seconds: 0,
};

// Helpers to avoid regex nesting that triggers polynomial ReDoS warnings in CodeQL
function extractIdentifier(line: string): string | undefined {
  // Match an identifier followed by ':' or '=', using lookahead to find
  // the right candidate without nested quantifiers (ReDoS-safe)
  const match = line.match(/(?<!\S)(\w+)\s*[:=]/);
  return match ? match[1] : undefined;
}

function extractExpressionStart(line: string, startIdx: number): number {
  let end = startIdx;
  while (end < line.length) {
    // Strip leading whitespace to check for operator, but compute extension
    // relative to the original slice so we account for skipped spaces correctly
    const rawRest = line.slice(end);
    const strippedRest = rawRest.replace(/^\s+/, "");
    if (!/^[*/+-]/.test(strippedRest)) break;
    // Match operator, then manually consume spaces, then number (avoid [ *\t]* in regex)
    const operatorMatch = strippedRest.match(/^[*/+-]/);
    if (!operatorMatch) break;
    let opEnd = operatorMatch[0].length;
    // Consume optional spaces after operator
    while (
      opEnd < strippedRest.length &&
      (strippedRest[opEnd] === " " || strippedRest[opEnd] === "\t")
    ) {
      opEnd++;
    }
    const numMatch = strippedRest.slice(opEnd).match(/^\d+(?:\.\d+)?/);
    if (!numMatch) break;
    const m = { 0: strippedRest.slice(0, opEnd + numMatch[0].length) };
    if (!m) break;
    // The extension in original coords = stripped-match-length + leading-whitespace
    const leadingWS = rawRest.length - strippedRest.length;
    end += leadingWS + m[0].length;
  }
  return end;
}

// Hard-coded compiled ignore-pattern regexes to avoid dynamic RegExp construction
// from user-controlled settings data.
// These patterns are compiled at build time, not runtime, eliminating ReDoS risk.
const COMPILED_IGNORE_PATTERNS: RegExp[] = [
  /^0x[0-9a-f]+$/i, // hex literals with 0x prefix
  /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // exact IP addresses like 192.168.1.1
  /^\d{4}-\d{2}-\d{2}$/, // exact dates like 2024-01-15
  /^\d{1,3}(?:\.\d{1,3}){3}$/, // dotted-quad with exact 4 groups
];

// Normalize language IDs from editors (VSCode, Neovim) to our internal language keys
function normalizeLanguage(language?: string): string | undefined {
  if (!language) return undefined;
  const lang = language.toLowerCase();
  // VSCode/Neovim use 'javascriptreact'/'typescriptreact' for JSX/TSX
  if (lang.startsWith("javascript") || lang === "jsx") return "javascript";
  if (lang.startsWith("typescript") || lang === "tsx") return "typescript";
  // Python variants
  if (lang.startsWith("python")) return "python";
  // Go variants
  if (lang.startsWith("go")) return "go";
  // Rust variants
  if (lang.startsWith("rust")) return "rust";
  // Java variants
  if (lang.startsWith("java")) return "java";
  // C/C++ variants
  if (lang.startsWith("cpp") || lang.startsWith("c++")) return "cpp";
  if (lang === "c") return "c";
  // C# variants
  if (lang.startsWith("csharp") || lang.startsWith("c#")) return "csharp";
  // Ruby variants
  if (lang.startsWith("ruby")) return "ruby";
  // PHP variants
  if (lang.startsWith("php")) return "php";
  return lang;
}

// Language-specific keyword to unit mappings
// These OVERRIDE the default keyword detection ONLY for cases where defaults are wrong
const LANGUAGE_KEYWORD_OVERRIDES: Record<string, Record<string, string[]>> = {
  // JavaScript/TypeScript
  // Default keyword mapping already handles:
  //   timeout, interval, delay, duration -> seconds
  //   retry, backoff, retryDelay, wait, sleep, etc -> milliseconds
  // We ONLY need to add cases that DEFAULT misses:
  javascript: {
    milliseconds: [
      "settimeout",
      "setinterval",
      "setimmediate",
      "requestanimationframe",
    ],
    seconds: [],
  },
  typescript: {
    milliseconds: [
      "settimeout",
      "setinterval",
      "setimmediate",
      "requestanimationframe",
    ],
    seconds: [],
  },
  // Python
  // Default mapping is mostly good for Python
  // time.sleep(X) -> X seconds (DEFAULT catches "sleep" -> seconds)
  // We ADD cases that DEFAULT misses:
  python: {
    milliseconds: [],
    seconds: ["time.sleep"], // "sleep" alone is caught by default, but "time.sleep" is not
  },
  // Go
  // Go's time.Sleep takes nanoseconds, but default would see "sleep" -> seconds
  go: {
    nanoseconds: ["time.sleep", "time.after", "time.tick"],
    milliseconds: [],
    seconds: [],
  },
  // Rust
  // Default mapping is decent for Rust
  // std::thread::sleep takes milliseconds, but DEFAULT doesn't catch the full path
  rust: {
    milliseconds: ["std::thread::sleep", "tokio::time::sleep"],
    seconds: [],
  },
  // Java
  // Default mapping is okay for Java
  // Thread.sleep(millis) -> milliseconds (DEFAULT catches "sleep" -> milliseconds)
  // Object.wait(millis) -> milliseconds (DEFAULT catches "wait" -> milliseconds)
  // We ADD cases that DEFAULT might miss or get wrong:
  java: {
    milliseconds: ["thread.sleep"], // "sleep" alone is caught by default
    seconds: [],
  },
  // C/C++
  // Default mapping is good for C/C++
  // sleep(seconds) -> seconds (DEFAULT catches "sleep" -> seconds)
  // usleep(microseconds) -> microseconds (DEFAULT doesn't catch "usleep")
  // nanosleep(nanoseconds) -> nanoseconds (DEFAULT doesn't catch "nanosleep")
  cpp: {
    milliseconds: [],
    seconds: [],
  },
  c: {
    milliseconds: [],
    seconds: [],
  },
  // C#
  // Default mapping is good for C#
  // Thread.Sleep(milliseconds) -> milliseconds (DEFAULT catches "sleep" -> milliseconds)
  // Task.Delay(milliseconds) -> milliseconds (DEFAULT catches "delay" -> milliseconds)
  csharp: {
    milliseconds: [],
    seconds: [],
  },
  // Ruby
  // Default mapping is good for Ruby
  // sleep(seconds) -> seconds (DEFAULT catches "sleep" -> seconds)
  ruby: {
    seconds: [],
  },
  // PHP
  // Default mapping is good for PHP
  // sleep(seconds) -> seconds (DEFAULT catches "sleep" -> seconds)
  // usleep(microseconds) -> microseconds (DEFAULT doesn't catch "usleep")
  php: {
    milliseconds: [],
    seconds: [],
  },
};

export function detectDuration(
  token: string,
  lineContext: string,
  settings: Partial<TimeScopeSettings> = {},
  language?: string,
): DetectedDuration | null {
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

  // Allow expressions with spaces - validate after removing whitespace
  const sanitized = token.trim().replace(/\s+/g, "");
  if (!/^[\d+\-*/().]+$/.test(sanitized)) return null;

  const value = evaluateExpression(sanitized);
  if (value === null) return null;

  // Always try context clues first — they can override min/max, defaults, and ignore patterns
  if (mergedSettings.contextClues) {
    const contextResult = inferFromContext(
      token,
      lineContext,
      mergedSettings,
      language,
    );
    if (contextResult) {
      return {
        ...contextResult,
        value,
      };
    }
  }

  // Check if variable name ends with unit suffix (avoid ReDoS-prone regex nesting)
  const lineIdentifier = extractIdentifier(lineContext);

  if (lineIdentifier && lineIdentifier.endsWith("_MINUTES")) {
    return {
      value,
      unit: "minutes",
      confidence: 0.95,
      source: "context",
      contextHint: `unit suffix: "${lineIdentifier}"`,
    };
  }

  // Check value range
  if (value < mergedSettings.minValue || value > mergedSettings.maxValue)
    return null;

  // Ignore patterns
  for (const regex of COMPILED_IGNORE_PATTERNS) {
    if (regex.test(token)) return null;
  }

  // Heuristic by digit count
  // Ignore Unix timestamp-like large numbers (seconds since epoch) when line context suggests a timestamp
  if (/timestamp/i.test(lineContext) && value >= 1e9 && value < 1e12) {
    return null;
  }

  let unit: DetectedDuration["unit"];
  let confidence = 0.5;

  if (mergedSettings.defaultUnit === "auto") {
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
    unit = mergedSettings.defaultUnit;
    confidence = 0.6;
  }
  return { value, unit, confidence, source: "heuristic" };
}

function inferFromContext(
  token: string,
  line: string,
  _settings: TimeScopeSettings,
  language?: string,
): DetectedDuration | null {
  // Tokenize the line, preserving variable names with underscores
  const tokens = line.split(/[\s=;,:*+/\-()[\]{}'"<>|&!]+/).filter(Boolean);

  // For expressions like "60 * 40 * 24", find any token from the expression
  const expressionParts = token.split(/[\s*+/\-()]+/).filter(Boolean);
  const tokenIndex = tokens.findIndex((t) => expressionParts.includes(t));

  if (tokenIndex === -1) return null;

  const contextStart = Math.max(0, tokenIndex - 2);
  const contextEnd = Math.min(tokens.length, tokenIndex + 3);
  const contextTokens = tokens.slice(contextStart, contextEnd);

  for (const t of contextTokens) {
    const lower = t.toLowerCase();

    // Match unit suffixes: _NS, _US, _MS, _SEC, _S, _MIN, camelCase, or full words
    if (
      /\bns\b/i.test(lower) ||
      /(?:^|_)ns$/i.test(lower) ||
      /(?:[A-Z]|_)ns$/i.test(t) ||
      /nano(?:s|seconds)?$/i.test(lower)
    ) {
      return {
        value: 0,
        unit: "nanoseconds",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    if (
      /\bus\b/i.test(lower) ||
      /(?:^|_)us$/i.test(lower) ||
      /(?:[A-Z]|_)us$/i.test(t) ||
      /micro(?:s|seconds)?$/i.test(lower)
    ) {
      return {
        value: 0,
        unit: "microseconds",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    if (
      /\bms\b/i.test(lower) ||
      /(?:^|_)ms$/i.test(lower) ||
      /(?:[A-Z]|_)ms$/i.test(t) ||
      /milli(?:s|seconds)?$/i.test(lower)
    ) {
      return {
        value: 0,
        unit: "milliseconds",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    if (
      /\bsec(?:s)?\b/i.test(lower) ||
      /(?:^|_)sec(?:s)?$/i.test(lower) ||
      /(?:[A-Z]|_)sec(?:s)?$/i.test(t) ||
      /second(?:s)?$/i.test(lower)
    ) {
      return {
        value: 0,
        unit: "seconds",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    if (
      /\bmin(?:utes?)?\b/i.test(lower) ||
      /(?:^|_)min(?:utes?)?$/i.test(lower) ||
      /(?:[A-Z]|_)min(?:utes?)?$/i.test(t)
    ) {
      return {
        value: 0,
        unit: "minutes",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
    // Standalone '_S' or '_s' suffix (not part of another word like MINUTES)
    if (
      /\bs\b/i.test(lower) ||
      /(?:^|_)s$/i.test(lower) ||
      /(?:^|_)s$/i.test(t)
    ) {
      return {
        value: 0,
        unit: "seconds",
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${t}"`,
      };
    }
  }

  // Semantic keywords (only if no explicit unit suffix matched)
  // First check language-specific overrides (with normalization)
  const normLang = normalizeLanguage(language);
  if (normLang && LANGUAGE_KEYWORD_OVERRIDES[normLang]) {
    const langOverrides = LANGUAGE_KEYWORD_OVERRIDES[normLang];
    for (const t of contextTokens) {
      const lower = t.toLowerCase();
      for (const [unit, keywords] of Object.entries(langOverrides)) {
        if (keywords.some((k) => lower.includes(k))) {
          return {
            value: 0,
            unit: unit as DetectedDuration["unit"],
            confidence: 0.9,
            source: "context",
            contextHint: `keyword: "${t}" (${language})`,
          };
        }
      }
    }
  }

  let bestUnit: DetectedDuration["unit"] | null = null;
  let bestConfidence = 0;
  let bestHint = "";

  for (const t of contextTokens) {
    const lower = t.toLowerCase();
    const unitFromKeyword = inferUnitFromKeyword(lower);
    if (unitFromKeyword) {
      let confidence = keywordConfidence(lower);
      // Boost confidence for explicit unit words
      if (/(milli|micro|nano|second)s?/.test(lower)) {
        confidence = 0.95;
      }
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
      value: 0,
      unit: bestUnit,
      confidence: bestConfidence,
      source: "context",
      contextHint: bestHint,
    };
  }

  return null;
}

function inferUnitFromKeyword(word: string): DetectedDuration["unit"] | null {
  if (
    /\bms\b/.test(word) ||
    /millisecond/.test(word) ||
    /milliseconds/.test(word)
  )
    return "milliseconds";
  if (
    /\bus\b/i.test(word) ||
    /microsecond/.test(word) ||
    /microseconds/.test(word)
  )
    return "microseconds";
  if (
    /\bns\b/i.test(word) ||
    /nanosecond/.test(word) ||
    /nanoseconds/.test(word)
  )
    return "nanoseconds";

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

function keywordConfidence(word: string): number {
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

export function scanCode(
  code: string,
  filePath?: string,
  settings: Partial<TimeScopeSettings> = {},
): ScanResult {
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
  const lines = code.split(/\r?\n/);
  const items: DetectedItem[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex];
    const lineNum = lineIndex + 1;

    // Check for variable/key identifier if present
    // Check for variable/key identifier if present (avoid ReDoS-prone regex nesting)
    const lineIdentifier = extractIdentifier(rawLine);

    // Regex for finding number start positions in expressions (e.g. 900, 60 * 60 * 24, 30000)
    // We extend matches manually to avoid nested quantifiers (ReDoS-safe)
    const numberStartRegex = /\b\d+(?:\.\d+)?\b/g;
    let match: RegExpExecArray | null;

    const matchedSpans: Array<{ start: number; end: number }> = [];

    while ((match = numberStartRegex.exec(rawLine)) !== null) {
      // Extend match to capture full expression (e.g. "60 * 60 * 24")
      const spanEnd = extractExpressionStart(
        rawLine,
        match.index + match[0].length,
      );
      const token = rawLine.slice(match.index, spanEnd).trim();
      const colIndex = match.index + 1;

      // Check if this overlaps with an already matched longer span
      const overlaps = matchedSpans.some(
        (s) => match!.index >= s.start && spanEnd <= s.end,
      );
      if (overlaps) continue;

      // Skip tokens inside regex quantifier brackets like {1,3} or \d{10,}
      const beforeChar = match.index > 0 ? rawLine[match.index - 1] : "";
      const afterChar = spanEnd < rawLine.length ? rawLine[spanEnd] : "";
      if (
        (beforeChar === "{" || beforeChar === ",") &&
        (afterChar === "}" || afterChar === ",")
      ) {
        continue;
      }
      // Skip version string parts like v1.2.3 or @1.2.3
      if (
        beforeChar === "v" ||
        beforeChar === "@" ||
        beforeChar === "^" ||
        beforeChar === "~"
      ) {
        continue;
      }
      // Additional skip: tokens that are part of version strings (e.g., 2.3 in "v1.2.3")
      if (token.includes(".") && /[v@]\d+\.\d+/.test(rawLine)) {
        continue;
      }

      const detected = detectDuration(token, rawLine, mergedSettings);
      if (detected) {
        matchedSpans.push({ start: match.index, end: spanEnd });
        const formatted = formatDurationFull(detected.value, detected.unit, {
          format: mergedSettings.format || "compact",
          showBreakdown: mergedSettings.showBreakdown ?? true,
          showUnitLabel: mergedSettings.showUnitLabel ?? true,
        });

        items.push({
          ...detected,
          token,
          line: lineNum,
          column: colIndex,
          formatted,
          lineContext: rawLine.trim(),
          identifier: lineIdentifier,
        });
      }
    }
  }

  return {
    filePath,
    items,
    totalCount: items.length,
  };
}
