"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var mocha_1 = require("mocha");
var format_1 = require("../src/formatting/format");
(0, mocha_1.suite)('Formatting Tests', function () {
    (0, mocha_1.test)('toMilliseconds: converts seconds', function () {
        assert.strictEqual((0, format_1.toMilliseconds)(60, 'seconds'), 60000);
        assert.strictEqual((0, format_1.toMilliseconds)(3600, 'seconds'), 3600000);
        assert.strictEqual((0, format_1.toMilliseconds)(900, 'seconds'), 900000);
    });
    (0, mocha_1.test)('toMilliseconds: converts milliseconds', function () {
        assert.strictEqual((0, format_1.toMilliseconds)(1000, 'milliseconds'), 1000);
        assert.strictEqual((0, format_1.toMilliseconds)(500, 'milliseconds'), 500);
    });
    (0, mocha_1.test)('toMilliseconds: converts microseconds', function () {
        assert.strictEqual((0, format_1.toMilliseconds)(1000000, 'microseconds'), 1000);
        assert.strictEqual((0, format_1.toMilliseconds)(5000000, 'microseconds'), 5000);
    });
    (0, mocha_1.test)('toMilliseconds: converts nanoseconds', function () {
        assert.strictEqual((0, format_1.toMilliseconds)(1000000000, 'nanoseconds'), 1000);
        assert.strictEqual((0, format_1.toMilliseconds)(5000000000, 'nanoseconds'), 5000);
    });
    (0, mocha_1.test)('formatDuration: compact format', function () {
        var opts = { format: 'compact', showBreakdown: true, showUnitLabel: true };
        // 15 minutes
        assert.strictEqual((0, format_1.formatDuration)(900000, opts), '15m');
        // 1 hour
        assert.strictEqual((0, format_1.formatDuration)(3600000, opts), '1h');
        // 1 day
        assert.strictEqual((0, format_1.formatDuration)(86400000, opts), '1d');
        // 1 week
        assert.strictEqual((0, format_1.formatDuration)(604800000, opts), '1w');
        // 1 year
        assert.strictEqual((0, format_1.formatDuration)(31557600000, opts), '1y');
        // 2 hours 30 minutes
        assert.strictEqual((0, format_1.formatDuration)(9000000, opts), '2h 30m');
    });
    (0, mocha_1.test)('formatDuration: verbose format', function () {
        var opts = { format: 'verbose', showBreakdown: true, showUnitLabel: true };
        // 15 minutes
        assert.strictEqual((0, format_1.formatDuration)(900000, opts), '15 minutes');
        // 1 hour
        assert.strictEqual((0, format_1.formatDuration)(3600000, opts), '1 hour');
        // 2 hours
        assert.strictEqual((0, format_1.formatDuration)(7200000, opts), '2 hours');
        // 1 hour, 30 minutes
        assert.strictEqual((0, format_1.formatDuration)(5400000, opts), '1 hour, 30 minutes');
    });
    (0, mocha_1.test)('formatDuration: both format', function () {
        var opts = { format: 'both', showBreakdown: true, showUnitLabel: true };
        assert.strictEqual((0, format_1.formatDuration)(900000, opts), '15 minutes (15m)');
        assert.strictEqual((0, format_1.formatDuration)(3600000, opts), '1 hour (1h)');
    });
    (0, mocha_1.test)('formatDuration: handles edge cases', function () {
        var opts = { format: 'compact', showBreakdown: true, showUnitLabel: true };
        // Less than 1ms
        assert.strictEqual((0, format_1.formatDuration)(0.5, opts), '<1ms');
        assert.strictEqual((0, format_1.formatDuration)(0, opts), '<1ms');
        // Very small values
        assert.strictEqual((0, format_1.formatDuration)(1, opts), '1ms');
    });
});
