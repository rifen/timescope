#!/usr/bin/env node
/**
 * Quick verification script for TimeScope hover detection
 * Run this to verify detection logic without publishing to VS Code
 *
 * Usage: node verify-hover.js
 */

const path = require('path');
const { detectDuration } = require('../../core/dist/detection/index.js');
const { formatDurationFull } = require('../../core/dist/formatting/index.js');

const TEST_CASES = [
  // Basic cases
  { token: '120', line: 'const HELLO = 120;', expected: '2m', desc: 'Basic seconds' },
  { token: '300', line: 'const TIMEOUT = 300;', expected: '5m', desc: 'Timeout context' },
  { token: '5000', line: 'const DELAY = 5000;', expected: '5s', desc: 'Delay context' },
  { token: '30000', line: 'const RETRY_INTERVAL = 30000;', expected: '30s', desc: 'Retry interval' },
  { token: '3600', line: 'const CACHE_TTL = 3600;', expected: '1h', desc: 'Cache TTL' },
  { token: '86400', line: 'const MAX_AGE = 86400;', expected: '1d', desc: 'Max age' },

  // Context clues
  { token: '5000', line: 'const retryDelayMs = 5000;', expected: '5s', desc: 'Ms suffix' },
  { token: '120', line: 'const timeoutSeconds = 120;', expected: '2m', desc: 'Seconds suffix' },
  { token: '48', line: 'const cacheDurationHours = 48;', expected: '2d', desc: 'Hours suffix' },
  { token: '30', line: 'const sessionTTLMinutes = 30;', expected: '30m', desc: 'Minutes suffix' },

  // Expressions (no unit suffix to avoid context override)
  { token: '60 * 60', line: 'const ONE_MINUTE_SECONDS = 60 * 60;', expected: '1h', desc: 'Expression' },
  { token: '24 * 60 * 60', line: 'const ONE_DAY_SECONDS = 24 * 60 * 60;', expected: '1d', desc: 'Complex expression' },

  // New units (context will detect unit from variable name)
  { token: '24', line: 'const VALUE_HOURS = 24;', expected: '1d', desc: 'Hours unit' },
  { token: '7', line: 'const VALUE_DAYS = 7;', expected: '1w', desc: 'Days unit' },
  { token: '2', line: 'const VALUE_WEEKS = 2;', expected: '2w', desc: 'Weeks unit' },
  { token: '3', line: 'const VALUE_MONTHS = 3;', expected: '3mo', desc: 'Months unit' },
  { token: '1', line: 'const VALUE_YEARS = 1;', expected: '12mo 5d', desc: 'Years unit' },

  // Edge cases
  { token: '0', line: 'const ZERO = 0;', expected: null, desc: 'Zero (should ignore)' },
  { token: '9999999999999', line: 'const VERY_LARGE = 9999999999999;', expected: null, desc: 'Very large (should ignore)' },
  { token: '0xFF', line: 'const HEX = 0xFF;', expected: null, desc: 'Hex (should ignore)' },
];

let passed = 0;
let failed = 0;

console.log('🧪 TimeScope Hover Detection Quick Test\n');
console.log('='.repeat(60));

for (const test of TEST_CASES) {
  const result = detectDuration(test.token, test.line, { contextClues: true }, 'typescript');

  if (test.expected === null) {
    if (result === null) {
      console.log(`✅ PASS: ${test.desc} - correctly ignored`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${test.desc} - should be ignored but got:`, result);
      failed++;
    }
  } else {
    if (result !== null) {
      const formatted = formatDurationFull(result.value, result.unit, { format: 'compact' });
      if (formatted === test.expected) {
        console.log(`✅ PASS: ${test.desc}`);
        console.log(`   Input: ${test.token} → Output: ${formatted}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${test.desc}`);
        console.log(`   Input: ${test.token}`);
        console.log(`   Expected: ${test.expected}`);
        console.log(`   Got: ${formatted} (unit: ${result.unit}, confidence: ${result.confidence})`);
        failed++;
      }
    } else {
      console.log(`❌ FAIL: ${test.desc} - no detection result`);
      console.log(`   Input: ${test.token}`);
      console.log(`   Expected: ${test.expected}`);
      failed++;
    }
  }
}

console.log('='.repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${TEST_CASES.length} tests`);

if (failed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
