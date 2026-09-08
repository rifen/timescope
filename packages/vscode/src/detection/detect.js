"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDuration = detectDuration;
var vscode = require("vscode");
var settings_1 = require("../config/settings");
var UNIT_THRESHOLDS = {
    nanoseconds: 1e15, // > 1e15 ns (15+ digits) → likely ns
    microseconds: 1e12, // > 1e12 µs (13+ digits) → likely µs
    milliseconds: 1e9, // > 1e9 ms (10+ digits) → likely ms
    seconds: 0 // otherwise seconds
};
function detectDuration(token, document, position) {
    var settings = (0, settings_1.getSettings)();
    // Skip if disabled
    if (!settings.enabled)
        return null;
    // Must be a pure integer
    if (!/^\d+$/.test(token.trim()))
        return null;
    var value = parseInt(token, 10);
    // Filter by value range
    if (value < settings.minValue || value > settings.maxValue)
        return null;
    // Always try context clues first — they can override generic ignore patterns
    if (settings.contextClues) {
        var contextResult = inferFromContext(token, document, position, settings);
        if (contextResult) {
            return contextResult;
        }
    }
    // Check ignore patterns (only if no strong context signal)
    for (var _i = 0, _a = settings.ignorePatterns; _i < _a.length; _i++) {
        var pattern = _a[_i];
        if (new RegExp(pattern).test(token))
            return null;
    }
    // Determine base unit from heuristics / defaultUnit
    var unit;
    var confidence = 0.5;
    var source = 'heuristic';
    if (settings.defaultUnit === 'auto') {
        // Heuristic by digit count
        if (value >= UNIT_THRESHOLDS.nanoseconds) {
            unit = 'nanoseconds';
            confidence = 0.9;
        }
        else if (value >= UNIT_THRESHOLDS.microseconds) {
            unit = 'microseconds';
            confidence = 0.9;
        }
        else if (value >= UNIT_THRESHOLDS.milliseconds) {
            unit = 'milliseconds';
            confidence = 0.9;
        }
        else {
            unit = 'seconds';
            confidence = 0.7;
        }
    }
    else {
        unit = settings.defaultUnit;
        confidence = 0.6;
    }
    // Always try context clues when enabled — they can override any defaultUnit
    if (settings.contextClues) {
        var contextResult = inferFromContext(token, document, position, settings);
        if (contextResult) {
            // Only override if context is more specific or higher confidence
            if (contextResult.confidence >= confidence) {
                unit = contextResult.unit;
                confidence = contextResult.confidence;
                source = 'context';
            }
        }
    }
    return { value: value, unit: unit, confidence: confidence, source: source };
}
function inferFromContext(token, document, position, _settings) {
    var line = document.getText(new vscode.Range(new vscode.Position(position.line, 0), new vscode.Position(position.line, position.character + 100)));
    // Split on whitespace + operators, but KEEP underscores inside identifiers
    // e.g. "RETRY_DELAY = 30000" → ["RETRY_DELAY", "30000"]
    var tokens = line.split(/[\s=*+/\-()]+/).filter(Boolean);
    // Find the token at or near the cursor position
    var tokenIndex = tokens.findIndex(function (t) { return t === token; });
    if (tokenIndex === -1)
        return null;
    // Check surrounding tokens (±2) for keywords / unit hints
    var contextStart = Math.max(0, tokenIndex - 2);
    var contextEnd = Math.min(tokens.length, tokenIndex + 3);
    var contextTokens = tokens.slice(contextStart, contextEnd);
    var bestUnit = null;
    var bestConfidence = 0;
    var bestHint = '';
    for (var _i = 0, contextTokens_1 = contextTokens; _i < contextTokens_1.length; _i++) {
        var t = contextTokens_1[_i];
        var lower = t.toLowerCase();
        // Check config-file context first (YAML, nginx, etc. → seconds)
        var fileName = document.uri.path.split('/').pop() || '';
        var fileExt = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
        var configExtensions = ['yml', 'yaml', 'toml', 'conf', 'ini', 'json'];
        if (configExtensions.includes(fileExt) && !bestUnit) {
            bestUnit = 'seconds';
            bestConfidence = Math.max(bestConfidence, 0.75);
            bestHint = "file context: ".concat(fileExt);
        }
        // Direct unit abbreviations in variable name: NANOS, DURATION_NS, MS, US, NS
        // Match as whole word OR underscore-separated suffix (e.g. DURATION_NS)
        if (/\bns\b/i.test(lower) || /(?:^|_)ns$/i.test(lower) || /nano(?:s)?$/i.test(lower)) {
            return { value: parseInt(token, 10), unit: 'nanoseconds', confidence: 0.95, source: 'context', contextHint: "unit suffix: \"".concat(t, "\"") };
        }
        if (/\bus\b/i.test(lower) || /(?:^|_)us$/i.test(lower) || /micro(?:s)?$/i.test(lower)) {
            return { value: parseInt(token, 10), unit: 'microseconds', confidence: 0.95, source: 'context', contextHint: "unit suffix: \"".concat(t, "\"") };
        }
        if (/\bms\b/i.test(lower) || /(?:^|_)ms$/i.test(lower) || /milli(?:s)?$/i.test(lower)) {
            return { value: parseInt(token, 10), unit: 'milliseconds', confidence: 0.95, source: 'context', contextHint: "unit suffix: \"".concat(t, "\"") };
        }
        if (/\bsec(?:s)?\b/i.test(lower) || /(?:^|_)sec(?:s)?$/i.test(lower) || /second(?:s)?$/i.test(lower)) {
            return { value: parseInt(token, 10), unit: 'seconds', confidence: 0.95, source: 'context', contextHint: "unit suffix: \"".concat(t, "\"") };
        }
        // Semantic keywords → infer likely unit
        var unitFromKeyword = inferUnitFromKeyword(lower);
        if (unitFromKeyword) {
            var confidence = keywordConfidence(lower);
            if (confidence > bestConfidence) {
                bestUnit = unitFromKeyword;
                bestConfidence = confidence;
                bestHint = confidence >= 0.85 ? "keyword: \"".concat(t, "\"") : "keyword: \"".concat(t, "\" (weak)");
            }
        }
    }
    if (bestUnit) {
        return {
            value: parseInt(token, 10),
            unit: bestUnit,
            confidence: bestConfidence,
            source: 'context',
            contextHint: bestHint
        };
    }
    return null;
}
// Returns the most likely unit for a keyword match
function inferUnitFromKeyword(word) {
    // Explicit unit abbreviations
    if (/\bms\b/.test(word) || /millisecond/.test(word))
        return 'milliseconds';
    if (/\bus\b/.test(word) || /microsecond/.test(word))
        return 'microseconds';
    if (/\bns\b/.test(word) || /nanosecond/.test(word))
        return 'nanoseconds';
    // Short-duration operations → usually milliseconds
    if (word.includes('retry') ||
        word.includes('backoff') ||
        word.includes('delay') ||
        word.includes('wait') ||
        word.includes('sleep') ||
        word.includes('pause') ||
        word.includes('hold') ||
        word.includes('throttle') ||
        word.includes('rate')) {
        return 'milliseconds';
    }
    // Timeouts, TTLs, intervals, sessions → usually seconds
    if (word.includes('timeout') ||
        word.includes('ttl') ||
        word.includes('interval') ||
        word.includes('duration') ||
        word.includes('expiry') ||
        word.includes('expire') ||
        word.includes('retention') ||
        word.includes('age') ||
        word.includes('period') ||
        word.includes('cache') ||
        word.includes('session')) {
        return 'seconds';
    }
    return null;
}
// Higher confidence for more specific keywords
function keywordConfidence(word) {
    // Very specific words → higher confidence
    var highConfidence = ['retry', 'backoff', 'timeout', 'ttl', 'interval', 'delay', 'sleep'];
    var mediumConfidence = ['duration', 'expiry', 'expire', 'retention', 'throttle', 'wait', 'pause', 'hold', 'cache', 'session', 'age', 'period', 'rate'];
    for (var _i = 0, highConfidence_1 = highConfidence; _i < highConfidence_1.length; _i++) {
        var kw = highConfidence_1[_i];
        if (word.includes(kw))
            return 0.85;
    }
    for (var _a = 0, mediumConfidence_1 = mediumConfidence; _a < mediumConfidence_1.length; _a++) {
        var kw = mediumConfidence_1[_a];
        if (word.includes(kw))
            return 0.75;
    }
    return 0.65;
}
