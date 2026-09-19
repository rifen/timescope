import {
  type TimeScopeSettings,
  type DetectedDuration,
  type DetectedItem,
  type ScanResult,
  type VariableContext,
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

    // Check for operator at current position
    const operatorMatch = strippedRest.match(/^[*/+-]/);
    if (!operatorMatch) break;

    // Consume operator
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
    // The extension in original coords = stripped-match-length + leading-whitespace
    const leadingWS = rawRest.length - strippedRest.length;
    end += leadingWS + opEnd + numMatch[0].length;
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
  },
  typescript: {
    milliseconds: [
      "settimeout",
      "setinterval",
      "setimmediate",
      "requestanimationframe",
    ],
  },
  // Python
  // Default mapping is mostly good for Python
  // time.sleep(X) -> X seconds (DEFAULT catches "sleep" -> seconds)
  // We ADD cases that DEFAULT misses:
  python: {
    seconds: ["time.sleep"], // "sleep" alone is caught by default, but "time.sleep" is not
  },
  // Go
  // Go's time.Sleep takes nanoseconds, but default would see "sleep" -> seconds
  go: {
    nanoseconds: ["time.sleep", "time.after", "time.tick"],
  },
  // Rust
  // Default mapping is decent for Rust
  // std::thread::sleep takes milliseconds, but DEFAULT doesn't catch the full path
  rust: {
    milliseconds: ["std::thread::sleep", "tokio::time::sleep"],
  },
  // Java
  // Default mapping is okay for Java
  // Thread.sleep(millis) -> milliseconds (DEFAULT catches "sleep" -> milliseconds)
  // Object.wait(millis) -> milliseconds (DEFAULT catches "wait" -> milliseconds)
  // We ADD cases that DEFAULT might miss or get wrong:
  java: {
    milliseconds: ["thread.sleep"], // "sleep" alone is caught by default
  },
  // C/C++
  // Default mapping is good for C/C++
  // sleep(seconds) -> seconds (DEFAULT catches "sleep" -> seconds)
  // usleep(microseconds) -> microseconds (DEFAULT doesn't catch "usleep")
  // nanosleep(nanoseconds) -> nanoseconds (DEFAULT doesn't catch "nanosleep")
  // These languages don't have any overrides needed
  // C# (no overrides needed)
  // Ruby (no overrides needed)
  // PHP (no overrides needed)
};

const MAX_SYMBOL_ENTRIES = 1000;
const MAX_JOINED_EXPRESSION_LENGTH = 500;

// Supported assignment forms: NAME = EXPR, NAME: TYPE = EXPR, and
// const/let/var/val/final/local declarations. Comparisons (==, <=) never
// match because a single '=' is required immediately after the name or type.
const ASSIGNMENT_PATTERN =
  /^[ \t]*(?:(?:const|let|var|val|final|local)\s+)?([A-Za-z_]\w*)\s*(?::[^=]+?)?=[ \t]*(.+)$/;

function stripLineComment(line: string): string {
  let commentStart = line.search(/#|\/\//);
  // Lua/SQL style `--` comments, but not C-style `i--` or Python `5--3`.
  const dashes = line.indexOf("--");
  if (
    dashes !== -1 &&
    (dashes + 2 >= line.length ||
      /\s/.test(line[dashes + 2]) ||
      line[dashes + 2] === "[")
  ) {
    if (commentStart === -1 || dashes < commentStart) commentStart = dashes;
  }
  return commentStart === -1 ? line : line.slice(0, commentStart);
}

function parenDepth(expression: string): number {
  let depth = 0;
  for (const char of expression) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
  }
  return depth;
}

interface ParsedAssignment {
  name: string;
  expression: string;
  expressionStart: number;
  endLine: number;
}

// Parse one assignment, joining continuation lines until parentheses balance.
function readAssignment(
  lines: string[],
  startLine: number,
): ParsedAssignment | null {
  const match = ASSIGNMENT_PATTERN.exec(lines[startLine]);
  if (!match) return null;

  let expression = stripLineComment(match[2]);
  let endLine = startLine;
  while (
    parenDepth(expression) > 0 &&
    expression.length < MAX_JOINED_EXPRESSION_LENGTH &&
    endLine + 1 < lines.length
  ) {
    endLine += 1;
    expression += " " + stripLineComment(lines[endLine]);
  }

  return {
    name: match[1],
    expression: expression.trim().replace(/[;,.]+\s*$/, ""),
    expressionStart: match[0].length - match[2].length,
    endLine,
  };
}

// Resolve `NAME = EXPR` assignments in document order so a variable can
// reference values defined earlier in the same document. Cycles and forward
// references resolve to nothing since each expression only sees already
// resolved values.
export function buildSymbolTable(code: string): Map<string, number> {
  const variables = new Map<string, number>();
  const lines = code.split(/\r?\n/);

  for (let line = 0; line < lines.length; line++) {
    if (variables.size >= MAX_SYMBOL_ENTRIES) break;
    const assignment = readAssignment(lines, line);
    if (!assignment) continue;

    line = assignment.endLine;
    const value = evaluateExpression(assignment.expression, variables);
    if (value !== null) variables.set(assignment.name, value);
  }

  return variables;
}

export function detectDuration(
  token: string,
  lineContext: string,
  settings: Partial<TimeScopeSettings> = {},
  language?: string,
  variables?: VariableContext,
): DetectedDuration | null {
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

  const value = evaluateExpression(token, variables);
  if (value === null || value <= 0) return null;

  // Reject invalid sign before context inference. Contextual units may legitimately
  // use values above the generic raw-value ceiling (for example nanoseconds).
  if (value <= 0 || value < mergedSettings.minValue) return null;

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

  // Generic heuristic detections must respect the configured upper bound.
  if (value > mergedSettings.maxValue) return null;

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

function extractPrecedingParameter(line: string, token: string): string | null {
  let searchPos = 0;
  while (searchPos < line.length) {
    const idx = line.indexOf(token, searchPos);
    if (idx === -1) break;

    const before = line.slice(0, idx).trimEnd();
    if (before.endsWith("=") || before.endsWith(":")) {
      const op = before[before.length - 1];
      const beforeOp = before.slice(0, -1).trimEnd();
      const idMatch = beforeOp.match(/([a-zA-Z_]\w*)$/);
      if (idMatch) {
        const paramStart = idMatch.index ?? 0;
        const charBeforeParam = beforeOp.slice(0, paramStart).trimEnd().slice(-1);
        const isArgOrProperty =
          charBeforeParam === "(" ||
          charBeforeParam === "," ||
          charBeforeParam === "{" ||
          charBeforeParam === "[";
        if (isArgOrProperty) {
          return `${idMatch[1]}${op}`;
        }
      }
    }
    searchPos = idx + token.length;
  }
  return null;
}

function matchUnitSuffix(t: string): DetectedDuration["unit"] | null {
  const base = t.replace(/[=:]$/, "");
  const lower = base.toLowerCase();

  // Match unit suffixes: _NS, _US, _MS, _SEC, _S, _MIN, camelCase, or full words
  if (
    /(?:^|_)ns$/.test(lower) ||
    /(?:^|_)ns$/.test(base) ||
    /[a-z]Ns$/.test(base) ||
    /nano(?:s|seconds)?$/i.test(lower)
  ) {
    return "nanoseconds";
  }
  if (
    /(?:^|_)us$/.test(lower) ||
    /(?:^|_)us$/.test(base) ||
    /micro(?:s|seconds)?$/i.test(lower)
  ) {
    return "microseconds";
  }
  if (
    /(?:^|_)ms$/.test(lower) ||
    /(?:^|_)ms$/.test(base) ||
    /[a-z]Ms$/.test(base) ||
    /milli(?:s|seconds)?$/i.test(lower)
  ) {
    return "milliseconds";
  }
  if (
    /(?:^|_)sec(?:s)?$/.test(lower) ||
    /(?:^|_)sec(?:s)?$/.test(base) ||
    /[a-z]Sec(?:s)?$/.test(base) ||
    /second(?:s)?$/i.test(lower)
  ) {
    return "seconds";
  }
  if (/(?:^|_)min(?:utes?)?$/.test(lower) || /min(?:utes?)$/.test(lower)) {
    return "minutes";
  }
  if (/(?:^|_)hour(s)?$/.test(lower) || /hour(s)?$/.test(lower)) {
    return "hours";
  }
  if (/(?:^|_)day(s)?$/.test(lower) || /day(s)?$/.test(lower)) {
    return "days";
  }
  if (
    /(?:^|_)w(?:eeks?)?$/.test(lower) ||
    /(?:^|_)w(?:eeks?)?$/.test(base) ||
    /[a-z]Week(s)?$/.test(base)
  ) {
    return "weeks";
  }
  if (
    /(?:^|_)mo(?:nth)?s?$/.test(lower) ||
    /(?:^|_)mo(?:nth)?s?$/.test(base) ||
    /[a-z]Month(s)?$/.test(base)
  ) {
    return "months";
  }
  if (/(?:^|_)year(s)?$/.test(lower) || /year(s)?$/.test(lower)) {
    return "years";
  }
  // Standalone '_S' or '_s' suffix (not part of another word like MINUTES)
  if (
    /\bs\b/i.test(lower) ||
    /(?:^|_)s$/i.test(lower) ||
    /(?:^|_)s$/i.test(base)
  ) {
    return "seconds";
  }
  return null;
}

function inferFromContext(
  token: string,
  line: string,
  _settings: TimeScopeSettings,
  language?: string,
): DetectedDuration | null {
  // A timedelta call always yields a duration expressed in seconds, so its
  // keyword arguments (which can include minutes/hours) must not override the
  // unit. Only the evaluated value matters here.
  if (/\btimedelta\s*\(/i.test(token)) {
    return {
      value: 0,
      unit: "seconds",
      confidence: 0.95,
      source: "context",
      contextHint: "timedelta(...)",
    };
  }

  // First check if token is directly preceded by a named parameter or property binding (e.g. seconds=400 or ms: 50)
  const paramToken = extractPrecedingParameter(line, token);
  if (paramToken) {
    const unit = matchUnitSuffix(paramToken);
    if (unit) {
      return {
        value: 0,
        unit,
        confidence: 0.95,
        source: "context",
        contextHint: `unit suffix: "${paramToken}"`,
      };
    }
  }

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
    const unit = matchUnitSuffix(t);
    if (unit) {
      return {
        value: 0,
        unit,
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
      for (const [unit, keywords] of Object.entries(langOverrides)) {
        if (keywords.some((k) => wordToKeyword(t, k))) {
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
    const unitFromKeyword = inferUnitFromKeyword(t);
    if (unitFromKeyword) {
      let confidence = keywordConfidence(t);
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

// Check if word matches keyword using whole-word matching
function wordToKeyword(word: string, keyword: string): boolean {
  const lower = word.toLowerCase();
  const kw = keyword.toLowerCase();
  // Match normalized word parts instead of constructing a regex from keyword
  // input. This avoids ReDoS risk while preserving compound names such as
  // "time.Sleep" and "retryCount".
  const wordParts = lower.split(/[^a-z0-9]+/).filter(Boolean);
  if (wordParts.includes(kw)) return true;
  return (
    keywordMatches(word, keyword) ||
    word.replace(/[^A-Za-z0-9]/g, "").toLowerCase() ===
      kw.replace(/[^A-Za-z0-9]/g, "")
  );
}

function keywordMatches(word: string, keyword: string): boolean {
  const parts = word
    .split(/(?<=[a-z0-9])(?=[A-Z])|[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  return parts.includes(keyword.toLowerCase());
}

function inferUnitFromKeyword(word: string): DetectedDuration["unit"] | null {
  if (keywordMatches(word, "ms") || keywordMatches(word, "millisecond"))
    return "milliseconds";
  if (keywordMatches(word, "us") || keywordMatches(word, "microsecond"))
    return "microseconds";
  if (keywordMatches(word, "ns") || keywordMatches(word, "nanosecond"))
    return "nanoseconds";
  if (
    [
      "retry",
      "backoff",
      "delay",
      "wait",
      "sleep",
      "pause",
      "hold",
      "throttle",
      "rate",
    ].some((kw) => keywordMatches(word, kw))
  )
    return "milliseconds";
  if (
    [
      "timeout",
      "ttl",
      "interval",
      "duration",
      "expiry",
      "expire",
      "retention",
      "age",
      "period",
      "cache",
      "session",
    ].some((kw) => keywordMatches(word, kw))
  )
    return "seconds";
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
    "hour",
    "day",
    "week",
    "month",
    "year",
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
    if (keywordMatches(word, kw)) return 0.85;
  }
  for (const kw of mediumConfidence) {
    if (keywordMatches(word, kw)) return 0.75;
  }
  return 0.65;
}

function languageFromFilePath(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  const ext = filePath.toLowerCase().split(".").pop();
  if (!ext) return undefined;
  if (["js", "jsx", "mjs", "cjs", "ts", "tsx"].includes(ext))
    return "javascript";
  if (ext === "py") return "python";
  if (ext === "go") return "go";
  if (ext === "rs") return "rust";
  if (ext === "java") return "java";
  if (["c", "h", "cpp"].includes(ext)) return "c";
  if (ext === "rb") return "ruby";
  if (ext === "php") return "php";
  return ext;
}

export function scanCode(
  code: string,
  filePath?: string,
  settings: Partial<TimeScopeSettings> = {},
  language?: string,
): ScanResult {
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
  const resolvedLanguage = language ?? languageFromFilePath(filePath);
  const lines = code.split(/\r?\n/);
  const variables = buildSymbolTable(code);
  const items: DetectedItem[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex];
    const lineNum = lineIndex + 1;

    // Evaluate whole assignments first so expressions that reference earlier
    // variables resolve once, instead of reporting each numeric literal.
    const assignment = readAssignment(lines, lineIndex);
    if (assignment) {
      const context =
        assignment.endLine === lineIndex
          ? rawLine
          : `${rawLine.trimEnd()} ${assignment.expression}`;
      const detected = detectDuration(
        assignment.expression,
        context,
        mergedSettings,
        resolvedLanguage,
        variables,
      );
      if (detected) {
        const formatted = formatDurationFull(detected.value, detected.unit, {
          format: mergedSettings.format || "compact",
        });
        items.push({
          ...detected,
          token: assignment.expression,
          line: lineNum,
          column: assignment.expressionStart + 1,
          formatted,
          lineContext: rawLine.trim(),
          identifier: assignment.name,
        });
        lineIndex = assignment.endLine;
        continue;
      }
    }

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
      // Skip decimal spans only when the span itself is part of a version string.
      if (token.includes(".")) {
        const versionPattern = /[v@^~]\d+(?:\.\d+)+/g;
        const isVersionPart = Array.from(rawLine.matchAll(versionPattern)).some(
          (version) =>
            match!.index >= version.index! &&
            match!.index < version.index! + version[0].length,
        );
        if (isVersionPart) continue;
      }

      const detected = detectDuration(
        token,
        rawLine,
        mergedSettings,
        resolvedLanguage,
        variables,
      );
      if (detected) {
        matchedSpans.push({ start: match.index, end: spanEnd });
        const formatted = formatDurationFull(detected.value, detected.unit, {
          format: mergedSettings.format || "compact",
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
