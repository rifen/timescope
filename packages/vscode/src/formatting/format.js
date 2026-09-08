"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMilliseconds = toMilliseconds;
exports.formatDuration = formatDuration;
exports.formatDurationFull = formatDurationFull;
var UNITS = [
    { unit: 'year', ms: 31557600000, short: 'y' },
    { unit: 'week', ms: 604800000, short: 'w' },
    { unit: 'day', ms: 86400000, short: 'd' },
    { unit: 'hour', ms: 3600000, short: 'h' },
    { unit: 'minute', ms: 60000, short: 'm' },
    { unit: 'second', ms: 1000, short: 's' },
    { unit: 'millisecond', ms: 1, short: 'ms' }
];
function toMilliseconds(value, unit) {
    switch (unit) {
        case 'seconds': return value * 1000;
        case 'milliseconds': return value;
        case 'microseconds': return value / 1000;
        case 'nanoseconds': return value / 1000000;
    }
}
function formatDuration(ms, options) {
    if (ms < 1) {
        return options.format === 'verbose' ? 'less than 1 millisecond' : '<1ms';
    }
    var breakdown = computeBreakdown(ms);
    var compact = formatCompact(breakdown);
    var verbose = formatVerbose(breakdown);
    if (options.format === 'compact')
        return compact;
    if (options.format === 'verbose')
        return verbose;
    return "".concat(verbose, " (").concat(compact, ")");
}
function computeBreakdown(ms) {
    var remaining = ms;
    var result = [];
    for (var _i = 0, UNITS_1 = UNITS; _i < UNITS_1.length; _i++) {
        var _a = UNITS_1[_i], unit = _a.unit, unitMs = _a.ms, short = _a.short;
        if (remaining >= unitMs) {
            var value = Math.floor(remaining / unitMs);
            result.push({ unit: unit, short: short, value: value });
            remaining = remaining % unitMs;
        }
    }
    return result;
}
function formatCompact(breakdown) {
    if (breakdown.length === 0)
        return '<1ms';
    // Show max 2 units for compact
    var toShow = breakdown.slice(0, 2);
    return toShow.map(function (_a) {
        var short = _a.short, value = _a.value;
        return "".concat(value).concat(short);
    }).join(' ');
}
function formatVerbose(breakdown) {
    if (breakdown.length === 0)
        return 'less than 1 millisecond';
    return breakdown
        .map(function (_a) {
        var unit = _a.unit, value = _a.value;
        var plural = value !== 1 ? 's' : '';
        return "".concat(value, " ").concat(unit).concat(plural);
    })
        .join(', ');
}
function formatDurationFull(value, unit, options) {
    var ms = toMilliseconds(value, unit);
    return formatDuration(ms, options);
}
