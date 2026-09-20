#!/usr/bin/env node
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 797:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.buildSymbolTable = buildSymbolTable;
exports.detectDuration = detectDuration;
exports.scanCode = scanCode;
const types_1 = __nccwpck_require__(631);
const formatting_1 = __nccwpck_require__(73);
const UNIT_THRESHOLDS = {
    nanoseconds: 1e15,
    microseconds: 1e12,
    milliseconds: 1e9,
    seconds: 0,
};
// Helpers to avoid regex nesting that triggers polynomial ReDoS warnings in CodeQL
function extractIdentifier(line) {
    // Match an identifier followed by ':' or '=', using lookahead to find
    // the right candidate without nested quantifiers (ReDoS-safe)
    const match = line.match(/(?<!\S)(\w+)\s*[:=]/);
    return match ? match[1] : undefined;
}
function extractExpressionStart(line, startIdx) {
    let end = startIdx;
    while (end < line.length) {
        // Strip leading whitespace to check for operator, but compute extension
        // relative to the original slice so we account for skipped spaces correctly
        const rawRest = line.slice(end);
        const strippedRest = rawRest.replace(/^\s+/, "");
        // Check for operator at current position
        const operatorMatch = strippedRest.match(/^[*/+-]/);
        if (!operatorMatch)
            break;
        // Consume operator
        let opEnd = operatorMatch[0].length;
        // Consume optional spaces after operator
        while (opEnd < strippedRest.length &&
            (strippedRest[opEnd] === " " || strippedRest[opEnd] === "\t")) {
            opEnd++;
        }
        const numMatch = strippedRest.slice(opEnd).match(/^\d+(?:\.\d+)?/);
        if (!numMatch)
            break;
        // The extension in original coords = stripped-match-length + leading-whitespace
        const leadingWS = rawRest.length - strippedRest.length;
        end += leadingWS + opEnd + numMatch[0].length;
    }
    return end;
}
// Hard-coded compiled ignore-pattern regexes to avoid dynamic RegExp construction
// from user-controlled settings data.
// These patterns are compiled at build time, not runtime, eliminating ReDoS risk.
const COMPILED_IGNORE_PATTERNS = [
    /^0x[0-9a-f]+$/i, // hex literals with 0x prefix
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // exact IP addresses like 192.168.1.1
    /^\d{4}-\d{2}-\d{2}$/, // exact dates like 2024-01-15
    /^\d{1,3}(?:\.\d{1,3}){3}$/, // dotted-quad with exact 4 groups
];
// Normalize language IDs from editors (VSCode, Neovim) to our internal language keys
function normalizeLanguage(language) {
    if (!language)
        return undefined;
    const lang = language.toLowerCase();
    // VSCode/Neovim use 'javascriptreact'/'typescriptreact' for JSX/TSX
    if (lang.startsWith("javascript") || lang === "jsx")
        return "javascript";
    if (lang.startsWith("typescript") || lang === "tsx")
        return "typescript";
    // Python variants
    if (lang.startsWith("python"))
        return "python";
    // Go variants
    if (lang.startsWith("go"))
        return "go";
    // Rust variants
    if (lang.startsWith("rust"))
        return "rust";
    // Java variants
    if (lang.startsWith("java"))
        return "java";
    // C/C++ variants
    if (lang.startsWith("cpp") || lang.startsWith("c++"))
        return "cpp";
    if (lang === "c")
        return "c";
    // C# variants
    if (lang.startsWith("csharp") || lang.startsWith("c#"))
        return "csharp";
    // Ruby variants
    if (lang.startsWith("ruby"))
        return "ruby";
    // PHP variants
    if (lang.startsWith("php"))
        return "php";
    return lang;
}
// Language-specific keyword to unit mappings
// These OVERRIDE the default keyword detection ONLY for cases where defaults are wrong
const LANGUAGE_KEYWORD_OVERRIDES = {
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
/**
 * ============================================================================
 * PARSER & DETECTION ARCHITECTURAL INVARIANTS (Do Not Break)
 * ============================================================================
 * 1. LINEAR TOKENIZATION (NO BACKTRACKING REGEXES):
 *    All parsing of arbitrary code strings must use deterministic, linear
 *    character-by-character scanning or bounded regexes to avoid polynomial
 *    ReDoS (Regular Expression Denial of Service). Do NOT replace linear
 *    parsers with complex regular expressions.
 *
 * 2. ASSIGNMENT GRAMMAR:
 *    - Optional declaration keywords: const, let, var, val, final, local
 *    - Identifier: [a-zA-Z_][a-zA-Z0-9_]*
 *    - Optional type annotation: ': Type' (where ':' and '=' MUST have at
 *      least one non-empty type character between them to reject Go ':=').
 *    - Assignment operator: '=' (comparisons '==', '<=', etc. are rejected).
 *
 * 3. BOUNDED LIMITS:
 *    - Symbol table max entries: MAX_SYMBOL_ENTRIES (1000)
 *    - Joined multi-line expression max length: MAX_JOINED_EXPRESSION_LENGTH (500)
 * ============================================================================
 */
const MAX_SYMBOL_ENTRIES = 1000;
const MAX_JOINED_EXPRESSION_LENGTH = 500;
const DECLARATION_KEYWORDS = ["const", "let", "var", "val", "final", "local"];
function isIdentifierStart(char) {
    return ((char >= "a" && char <= "z") ||
        (char >= "A" && char <= "Z") ||
        char === "_");
}
function isIdentifierChar(char) {
    return isIdentifierStart(char) || (char >= "0" && char <= "9");
}
function isHorizontalSpace(char) {
    return char === " " || char === "\t";
}
/**
 * Strips trailing statement/expression punctuation (';', ',', '.') from a value.
 *
 * Invariant:
 * Operates in linear time from end of string without regular expressions.
 */
function stripTrailingPunctuation(value) {
    let end = value.length;
    while (end > 0) {
        const char = value[end - 1];
        if (char === ";" || char === "," || char === ".")
            end -= 1;
        else
            break;
    }
    return value.slice(0, end);
}
/**
 * Parses a single line for an assignment statement.
 *
 * Supported forms:
 *   - `NAME = EXPR`
 *   - `const|let|var|val|final|local NAME = EXPR`
 *   - `NAME: TYPE = EXPR`
 *   - `const NAME: TYPE = EXPR`
 *
 * Rejection invariants:
 *   - Go-style walrus declarations (`:=`) are explicitly rejected.
 *   - Equality/comparison operators (`==`, `!=`, `<=`, `>=`) are rejected.
 *   - Uses linear character scanning to prevent polynomial ReDoS on untrusted input.
 *
 * @param line Single line of source code.
 * @returns Parsed assignment name, expression, and expression start index, or null if not an assignment.
 */
function parseAssignment(line) {
    const equals = line.indexOf("=");
    if (equals === -1)
        return null;
    let pos = 0;
    while (pos < equals && isHorizontalSpace(line[pos]))
        pos += 1;
    for (const keyword of DECLARATION_KEYWORDS) {
        if (!line.startsWith(keyword, pos))
            continue;
        let after = pos + keyword.length;
        if (after < equals && isHorizontalSpace(line[after])) {
            while (after < equals && isHorizontalSpace(line[after]))
                after += 1;
            pos = after;
        }
        break;
    }
    const nameStart = pos;
    if (pos >= equals || !isIdentifierStart(line[pos]))
        return null;
    pos += 1;
    while (pos < equals && isIdentifierChar(line[pos]))
        pos += 1;
    const name = line.slice(nameStart, pos);
    while (pos < equals && isHorizontalSpace(line[pos]))
        pos += 1;
    if (pos < equals && line[pos] === ":") {
        // A typed declaration needs at least one character between the colon and
        // the assignment operator, so Go-style `:=` is not treated as a type.
        if (pos + 1 >= equals)
            return null;
        pos = equals;
    }
    else if (pos !== equals) {
        return null;
    }
    let expressionStart = equals + 1;
    while (expressionStart < line.length &&
        isHorizontalSpace(line[expressionStart])) {
        expressionStart += 1;
    }
    if (expressionStart >= line.length)
        return null;
    return { name, expression: line.slice(expressionStart), expressionStart };
}
/**
 * Strips single-line comments from code while avoiding false positives.
 *
 * Supported comment styles:
 *   - `#` (Python, Shell, Ruby, YAML)
 *   - `//` (JS, TS, C, C++, Go, Rust, Java, C#)
 *   - `--` (Lua, SQL) - only when followed by whitespace, bracket, or end-of-line
 *     to prevent stripping arithmetic like `i--` or `5--3`.
 */
function stripLineComment(line) {
    let commentStart = line.search(/#|\/\//);
    // Lua/SQL style `--` comments, but not C-style `i--` or Python `5--3`.
    const dashes = line.indexOf("--");
    if (dashes !== -1 &&
        (dashes + 2 >= line.length ||
            /\s/.test(line[dashes + 2]) ||
            line[dashes + 2] === "[")) {
        if (commentStart === -1 || dashes < commentStart)
            commentStart = dashes;
    }
    return commentStart === -1 ? line : line.slice(0, commentStart);
}
/**
 * Computes net parentheses depth `(` vs `)`.
 * Used to determine if an assignment continues across multiple lines.
 */
function parenDepth(expression) {
    let depth = 0;
    for (const char of expression) {
        if (char === "(")
            depth++;
        else if (char === ")")
            depth--;
    }
    return depth;
}
/**
 * Parses an assignment statement across multiple lines until parentheses balance
 * or max length is reached.
 *
 * Invariants:
 *   - Comments are stripped from continuation lines.
 *   - Joins lines with a single space while `parenDepth > 0`.
 *   - Caps joined length at `MAX_JOINED_EXPRESSION_LENGTH` (500 chars).
 */
function readAssignment(lines, startLine) {
    const head = parseAssignment(lines[startLine]);
    if (!head)
        return null;
    let expression = stripLineComment(head.expression);
    let endLine = startLine;
    while (parenDepth(expression) > 0 &&
        expression.length < MAX_JOINED_EXPRESSION_LENGTH &&
        endLine + 1 < lines.length) {
        endLine += 1;
        expression += " " + stripLineComment(lines[endLine]);
    }
    return {
        name: head.name,
        expression: stripTrailingPunctuation(expression.trim()),
        expressionStart: head.expressionStart,
        endLine,
    };
}
/**
 * Builds a symbol table of variable definitions from a source document.
 *
 * Invariants:
 *   - Resolves `NAME = EXPR` in document order (top to bottom).
 *   - Supports referencing earlier resolved variables.
 *   - Cycles and forward references resolve to nothing (safe evaluation).
 *   - Caps total entries at `MAX_SYMBOL_ENTRIES` (1000) for performance.
 *
 * @param code Entire document text.
 * @returns Map of variable names to their evaluated numeric values.
 */
function buildSymbolTable(code) {
    const variables = new Map();
    const lines = code.split(/\r?\n/);
    for (let line = 0; line < lines.length; line++) {
        if (variables.size >= MAX_SYMBOL_ENTRIES)
            break;
        const assignment = readAssignment(lines, line);
        if (!assignment)
            continue;
        line = assignment.endLine;
        const value = (0, formatting_1.evaluateExpression)(assignment.expression, variables);
        if (value !== null)
            variables.set(assignment.name, value);
    }
    return variables;
}
function detectDuration(token, lineContext, settings = {}, language, variables) {
    const mergedSettings = { ...types_1.DEFAULT_SETTINGS, ...settings };
    const value = (0, formatting_1.evaluateExpression)(token, variables);
    if (value === null || value <= 0)
        return null;
    // Reject invalid sign before context inference. Contextual units may legitimately
    // use values above the generic raw-value ceiling (for example nanoseconds).
    if (value <= 0 || value < mergedSettings.minValue)
        return null;
    // Always try context clues first — they can override min/max, defaults, and ignore patterns
    if (mergedSettings.contextClues) {
        const contextResult = inferFromContext(token, lineContext, mergedSettings, language);
        if (contextResult) {
            return {
                ...contextResult,
                value,
            };
        }
    }
    // Generic heuristic detections must respect the configured upper bound.
    if (value > mergedSettings.maxValue)
        return null;
    // Ignore patterns
    for (const regex of COMPILED_IGNORE_PATTERNS) {
        if (regex.test(token))
            return null;
    }
    // Heuristic by digit count
    // Ignore Unix timestamp-like large numbers (seconds since epoch) when line context suggests a timestamp
    if (/timestamp/i.test(lineContext) && value >= 1e9 && value < 1e12) {
        return null;
    }
    let unit;
    let confidence = 0.5;
    if (mergedSettings.defaultUnit === "auto") {
        if (value >= UNIT_THRESHOLDS.nanoseconds) {
            unit = "nanoseconds";
            confidence = 0.9;
        }
        else if (value >= UNIT_THRESHOLDS.microseconds) {
            unit = "microseconds";
            confidence = 0.9;
        }
        else if (value >= UNIT_THRESHOLDS.milliseconds) {
            unit = "milliseconds";
            confidence = 0.9;
        }
        else {
            unit = "seconds";
            confidence = 0.7;
        }
    }
    else {
        unit = mergedSettings.defaultUnit;
        confidence = 0.6;
    }
    return { value, unit, confidence, source: "heuristic" };
}
function extractPrecedingParameter(line, token) {
    let searchPos = 0;
    while (searchPos < line.length) {
        const idx = line.indexOf(token, searchPos);
        if (idx === -1)
            break;
        const before = line.slice(0, idx).trimEnd();
        if (before.endsWith("=") || before.endsWith(":")) {
            const op = before[before.length - 1];
            const beforeOp = before.slice(0, -1).trimEnd();
            const idMatch = beforeOp.match(/([a-zA-Z_]\w*)$/);
            if (idMatch) {
                const paramStart = idMatch.index ?? 0;
                const charBeforeParam = beforeOp.slice(0, paramStart).trimEnd().slice(-1);
                const isArgOrProperty = charBeforeParam === "(" ||
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
function matchUnitSuffix(t) {
    const base = t.replace(/[=:]$/, "");
    const lower = base.toLowerCase();
    // Match unit suffixes: _NS, _US, _MS, _SEC, _S, _MIN, camelCase, or full words
    if (/(?:^|_)ns$/.test(lower) ||
        /(?:^|_)ns$/.test(base) ||
        /[a-z]Ns$/.test(base) ||
        /nano(?:s|seconds)?$/i.test(lower)) {
        return "nanoseconds";
    }
    if (/(?:^|_)us$/.test(lower) ||
        /(?:^|_)us$/.test(base) ||
        /micro(?:s|seconds)?$/i.test(lower)) {
        return "microseconds";
    }
    if (/(?:^|_)ms$/.test(lower) ||
        /(?:^|_)ms$/.test(base) ||
        /[a-z]Ms$/.test(base) ||
        /milli(?:s|seconds)?$/i.test(lower)) {
        return "milliseconds";
    }
    if (/(?:^|_)sec(?:s)?$/.test(lower) ||
        /(?:^|_)sec(?:s)?$/.test(base) ||
        /[a-z]Sec(?:s)?$/.test(base) ||
        /second(?:s)?$/i.test(lower)) {
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
    if (/(?:^|_)w(?:eeks?)?$/.test(lower) ||
        /(?:^|_)w(?:eeks?)?$/.test(base) ||
        /[a-z]Week(s)?$/.test(base)) {
        return "weeks";
    }
    if (/(?:^|_)mo(?:nth)?s?$/.test(lower) ||
        /(?:^|_)mo(?:nth)?s?$/.test(base) ||
        /[a-z]Month(s)?$/.test(base)) {
        return "months";
    }
    if (/(?:^|_)year(s)?$/.test(lower) || /year(s)?$/.test(lower)) {
        return "years";
    }
    // Standalone '_S' or '_s' suffix (not part of another word like MINUTES)
    if (/\bs\b/i.test(lower) ||
        /(?:^|_)s$/i.test(lower) ||
        /(?:^|_)s$/i.test(base)) {
        return "seconds";
    }
    return null;
}
function inferFromContext(token, line, _settings, language) {
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
    if (tokenIndex === -1)
        return null;
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
                        unit: unit,
                        confidence: 0.9,
                        source: "context",
                        contextHint: `keyword: "${t}" (${language})`,
                    };
                }
            }
        }
    }
    let bestUnit = null;
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
function wordToKeyword(word, keyword) {
    const lower = word.toLowerCase();
    const kw = keyword.toLowerCase();
    // Match normalized word parts instead of constructing a regex from keyword
    // input. This avoids ReDoS risk while preserving compound names such as
    // "time.Sleep" and "retryCount".
    const wordParts = lower.split(/[^a-z0-9]+/).filter(Boolean);
    if (wordParts.includes(kw))
        return true;
    return (keywordMatches(word, keyword) ||
        word.replace(/[^A-Za-z0-9]/g, "").toLowerCase() ===
            kw.replace(/[^A-Za-z0-9]/g, ""));
}
function keywordMatches(word, keyword) {
    const parts = word
        .split(/(?<=[a-z0-9])(?=[A-Z])|[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((part) => part.toLowerCase());
    return parts.includes(keyword.toLowerCase());
}
function inferUnitFromKeyword(word) {
    if (keywordMatches(word, "ms") || keywordMatches(word, "millisecond"))
        return "milliseconds";
    if (keywordMatches(word, "us") || keywordMatches(word, "microsecond"))
        return "microseconds";
    if (keywordMatches(word, "ns") || keywordMatches(word, "nanosecond"))
        return "nanoseconds";
    if ([
        "retry",
        "backoff",
        "delay",
        "wait",
        "sleep",
        "pause",
        "hold",
        "throttle",
        "rate",
    ].some((kw) => keywordMatches(word, kw)))
        return "milliseconds";
    if ([
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
    ].some((kw) => keywordMatches(word, kw)))
        return "seconds";
    return null;
}
function keywordConfidence(word) {
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
        if (keywordMatches(word, kw))
            return 0.85;
    }
    for (const kw of mediumConfidence) {
        if (keywordMatches(word, kw))
            return 0.75;
    }
    return 0.65;
}
function languageFromFilePath(filePath) {
    if (!filePath)
        return undefined;
    const ext = filePath.toLowerCase().split(".").pop();
    if (!ext)
        return undefined;
    if (["js", "jsx", "mjs", "cjs", "ts", "tsx"].includes(ext))
        return "javascript";
    if (ext === "py")
        return "python";
    if (ext === "go")
        return "go";
    if (ext === "rs")
        return "rust";
    if (ext === "java")
        return "java";
    if (["c", "h", "cpp"].includes(ext))
        return "c";
    if (ext === "rb")
        return "ruby";
    if (ext === "php")
        return "php";
    return ext;
}
function scanCode(code, filePath, settings = {}, language) {
    const mergedSettings = { ...types_1.DEFAULT_SETTINGS, ...settings };
    const resolvedLanguage = language ?? languageFromFilePath(filePath);
    const lines = code.split(/\r?\n/);
    const variables = buildSymbolTable(code);
    const items = [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const rawLine = lines[lineIndex];
        const lineNum = lineIndex + 1;
        // Evaluate whole assignments first so expressions that reference earlier
        // variables resolve once, instead of reporting each numeric literal.
        const assignment = readAssignment(lines, lineIndex);
        if (assignment) {
            const context = assignment.endLine === lineIndex
                ? rawLine
                : `${rawLine.trimEnd()} ${assignment.expression}`;
            const detected = detectDuration(assignment.expression, context, mergedSettings, resolvedLanguage, variables);
            if (detected) {
                const formatted = (0, formatting_1.formatDurationFull)(detected.value, detected.unit, {
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
        let match;
        const matchedSpans = [];
        while ((match = numberStartRegex.exec(rawLine)) !== null) {
            // Extend match to capture full expression (e.g. "60 * 60 * 24")
            const spanEnd = extractExpressionStart(rawLine, match.index + match[0].length);
            const token = rawLine.slice(match.index, spanEnd).trim();
            const colIndex = match.index + 1;
            // Check if this overlaps with an already matched longer span
            const overlaps = matchedSpans.some((s) => match.index >= s.start && spanEnd <= s.end);
            if (overlaps)
                continue;
            // Skip tokens inside regex quantifier brackets like {1,3} or \d{10,}
            const beforeChar = match.index > 0 ? rawLine[match.index - 1] : "";
            const afterChar = spanEnd < rawLine.length ? rawLine[spanEnd] : "";
            if ((beforeChar === "{" || beforeChar === ",") &&
                (afterChar === "}" || afterChar === ",")) {
                continue;
            }
            // Skip version string parts like v1.2.3 or @1.2.3
            if (beforeChar === "v" ||
                beforeChar === "@" ||
                beforeChar === "^" ||
                beforeChar === "~") {
                continue;
            }
            // Skip decimal spans only when the span itself is part of a version string.
            if (token.includes(".")) {
                const versionPattern = /[v@^~]\d+(?:\.\d+)+/g;
                const isVersionPart = Array.from(rawLine.matchAll(versionPattern)).some((version) => match.index >= version.index &&
                    match.index < version.index + version[0].length);
                if (isVersionPart)
                    continue;
            }
            const detected = detectDuration(token, rawLine, mergedSettings, resolvedLanguage, variables);
            if (detected) {
                matchedSpans.push({ start: match.index, end: spanEnd });
                const formatted = (0, formatting_1.formatDurationFull)(detected.value, detected.unit, {
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
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 73:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.evaluateExpression = evaluateExpression;
exports.toMilliseconds = toMilliseconds;
exports.formatDuration = formatDuration;
exports.formatDurationFull = formatDurationFull;
const TIMEDELTA_FACTORS = {
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
function evaluateExpression(expr, variables) {
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
    }
    catch {
        return null;
    }
}
function parseTokens(tokens, variables) {
    let pos = 0;
    function lookupVariable(name) {
        if (!variables)
            return NaN;
        const val = variables instanceof Map ? variables.get(name) : variables[name];
        if (typeof val === "number" && Number.isFinite(val)) {
            return val;
        }
        return NaN;
    }
    function parseExpression() {
        let value = parseTerm();
        while (pos < tokens.length &&
            (tokens[pos] === "+" || tokens[pos] === "-")) {
            const op = tokens[pos++];
            const right = parseTerm();
            value = op === "+" ? value + right : value - right;
        }
        return value;
    }
    function parseTerm() {
        let value = parseFactor();
        while (pos < tokens.length &&
            (tokens[pos] === "*" || tokens[pos] === "/")) {
            const op = tokens[pos++];
            const right = parseFactor();
            value = op === "*" ? value * right : value / right;
        }
        return value;
    }
    function parseFactor() {
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
        if (Number.isNaN(num))
            return NaN;
        return num;
    }
    function evaluateFunctionCall(funcName) {
        const fnLower = funcName.toLowerCase();
        if (fnLower === "timedelta" || fnLower === "datetime.timedelta") {
            let totalSeconds = 0;
            let positionalIndex = 0;
            while (pos < tokens.length && tokens[pos] !== ")") {
                // Check if keyword argument: name = expr
                if (pos + 1 < tokens.length &&
                    tokens[pos + 1] === "=" &&
                    /^[a-zA-Z_]/.test(tokens[pos])) {
                    const kwName = tokens[pos++].toLowerCase();
                    pos++; // consume '='
                    const val = parseExpression();
                    if (Number.isNaN(val))
                        return NaN;
                    const factor = TIMEDELTA_FACTORS[kwName];
                    if (factor !== undefined) {
                        totalSeconds += val * factor;
                    }
                }
                else {
                    // Positional argument
                    const val = parseExpression();
                    if (Number.isNaN(val))
                        return NaN;
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
                }
                else {
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
function tokenize(expr) {
    const tokens = [];
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
function toMilliseconds(value, unit) {
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
function formatDuration(ms, options) {
    if (ms < 0) {
        const positive = formatDuration(-ms, options);
        return `-${positive}`;
    }
    if (ms < 1) {
        return options.format === "verbose" ? "less than 1 millisecond" : "<1ms";
    }
    const breakdown = computeBreakdown(ms);
    const visibleBreakdown = options.showBreakdown === false ? breakdown.slice(0, 1) : breakdown;
    const compact = formatCompact(visibleBreakdown, options.showUnitLabel !== false);
    const verbose = formatVerbose(visibleBreakdown, options.showUnitLabel !== false);
    if (options.format === "compact")
        return compact;
    if (options.format === "verbose")
        return verbose;
    return `${verbose} (${compact})`;
}
function formatDurationFull(value, unit, options) {
    const ms = toMilliseconds(value, unit);
    return formatDuration(ms, options);
}
function computeBreakdown(ms) {
    let remaining = ms;
    const result = [];
    for (const { unit, ms: unitMs, short } of UNITS) {
        if (remaining >= unitMs) {
            const value = Math.floor(remaining / unitMs);
            result.push({ unit, short, value });
            remaining = remaining % unitMs;
        }
    }
    return result;
}
function formatCompact(breakdown, showUnitLabel = true) {
    if (breakdown.length === 0)
        return "<1ms";
    const toShow = breakdown.slice(0, 2);
    return toShow
        .map(({ short, value }) => showUnitLabel ? `${value}${short}` : `${value}`)
        .join(" ");
}
function formatVerbose(breakdown, showUnitLabel = true) {
    if (breakdown.length === 0)
        return "less than 1 millisecond";
    return breakdown
        .map(({ unit, value }) => {
        const plural = value === 1 ? "" : "s";
        return showUnitLabel ? `${value} ${unit}${plural}` : `${value}`;
    })
        .join(", ");
}
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 425:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DEFAULT_SETTINGS = exports.evaluateExpression = exports.formatDurationFull = exports.formatDuration = exports.toMilliseconds = exports.buildSymbolTable = exports.scanCode = exports.detectDuration = void 0;
var detection_1 = __nccwpck_require__(797);
Object.defineProperty(exports, "detectDuration", ({ enumerable: true, get: function () { return detection_1.detectDuration; } }));
Object.defineProperty(exports, "scanCode", ({ enumerable: true, get: function () { return detection_1.scanCode; } }));
Object.defineProperty(exports, "buildSymbolTable", ({ enumerable: true, get: function () { return detection_1.buildSymbolTable; } }));
var formatting_1 = __nccwpck_require__(73);
Object.defineProperty(exports, "toMilliseconds", ({ enumerable: true, get: function () { return formatting_1.toMilliseconds; } }));
Object.defineProperty(exports, "formatDuration", ({ enumerable: true, get: function () { return formatting_1.formatDuration; } }));
Object.defineProperty(exports, "formatDurationFull", ({ enumerable: true, get: function () { return formatting_1.formatDurationFull; } }));
Object.defineProperty(exports, "evaluateExpression", ({ enumerable: true, get: function () { return formatting_1.evaluateExpression; } }));
var types_1 = __nccwpck_require__(631);
Object.defineProperty(exports, "DEFAULT_SETTINGS", ({ enumerable: true, get: function () { return types_1.DEFAULT_SETTINGS; } }));
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 631:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DEFAULT_SETTINGS = void 0;
exports.DEFAULT_SETTINGS = {
    defaultUnit: "seconds",
    format: "compact",
    minValue: 1,
    maxValue: 31557600000,
    contextClues: true,
};
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 231:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


/**
 * TimeScope Core Bridge for Neovim
 *
 * Reads JSON from stdin: { token: string, line: string, language?: string, settings?: object, code?: string }
 * Returns JSON on stdout: { text: string, hint?: string } | null
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
const timescope_core_1 = __nccwpck_require__(425);
const readline = __importStar(__nccwpck_require__(481));
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
});
rl.on("line", (line) => {
    try {
        const { token, line: context, language, settings, assignment, code } = JSON.parse(line);
        const mergedSettings = settings
            ? { ...timescope_core_1.DEFAULT_SETTINGS, ...settings }
            : undefined;
        const variables = typeof code === "string" ? (0, timescope_core_1.buildSymbolTable)(code) : undefined;
        // Prefer the assignment RHS (the whole expression) so hovering any part of
        // `X = a + b` evaluates the same as the VS Code extension. Fall back to the
        // cursor-local token when the RHS is not evaluable (e.g. constructors).
        let result = typeof assignment === "string"
            ? (0, timescope_core_1.detectDuration)(assignment, context, mergedSettings, language, variables)
            : undefined;
        if (!result) {
            result = (0, timescope_core_1.detectDuration)(token, context, mergedSettings, language, variables);
        }
        if (!result && variables) {
            // The token may start a multi-line assignment (e.g. `MIN = (`); resolve
            // the assigned name against constants declared in the document. The
            // declaration can be indented (for example inside a Python `try:`).
            const name = context
                .replace(/^\s*(?:const|let|var|val|final|local)\s+/, "")
                .trimStart()
                .match(/^[A-Za-z_]\w*/)?.[0];
            if (name && variables.has(name)) {
                result = (0, timescope_core_1.detectDuration)(name, context, mergedSettings, language, variables);
            }
        }
        if (result) {
            const formatOptions = mergedSettings
                ? { format: mergedSettings.format }
                : { format: "compact" };
            const formatted = (0, timescope_core_1.formatDurationFull)(result.value, result.unit, formatOptions);
            const response = {
                text: formatted,
                hint: result.contextHint || undefined,
            };
            console.log(JSON.stringify(response));
        }
        else {
            console.log(JSON.stringify(null));
        }
    }
    catch (err) {
        console.error(JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
        }));
    }
});


/***/ }),

/***/ 481:
/***/ ((module) => {

module.exports = require("node:readline");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/asset-relocator-loader */
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(231);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;