#!/bin/bash
# Quick test script for TimeScope VS Code extension
# This opens VS Code with the test file for quick hover testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_FILE="$SCRIPT_DIR/sample.ts"

echo "🚀 Opening TimeScope Quick Test..."
echo ""
echo "This will open VS Code with a test file."
echo "After VS Code opens:"
echo "  1. Press F5 to launch 'Extension Development Host'"
echo "  2. In the new window, open: $TEST_FILE"
echo "  3. Hover over any number to see TimeScope in action"
echo ""
echo "Test cases in the file:"
echo "  - Basic: HELLO = 120 (should show '2 minutes')"
echo "  - Context: retryDelayMs = 5000 (should show '5 seconds')"
echo "  - Expressions: ONE_HOUR = 60 * 60 (should show '1 hour')"
echo "  - New units: HOURS = 24, DAYS = 7, etc."
echo "  - Edge cases: ZERO, VERY_LARGE, HEX, IP (should be ignored)"
echo ""

# Open VS Code with the test file
code --new-window "$TEST_FILE"

echo "✅ VS Code opened with test file"
echo ""
echo "Quick commands:"
echo "  - F5: Launch Extension Development Host"
echo "  - Ctrl+Shift+P → 'Timescope: Dump Settings' to see current config"
echo "  - Ctrl+Shift+P → 'Timescope: Log Hover Target' to debug hover"
echo ""
echo "To run automated tests:"
echo "  cd $PROJECT_ROOT"
echo "  pnpm test"
