#!/bin/bash
# Quick test script for TimeScope VS Code extension
# This opens VS Code with the test file for quick hover testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VSCODE_DIR="$SCRIPT_DIR/.."
TEST_FILE="$VSCODE_DIR/test-data/sample.ts"

# Check if the extension is built
if [ ! -f "$VSCODE_DIR/dist/extension.js" ]; then
  echo "⚠️  Extension not built. Building now..."
  cd "$VSCODE_DIR" && npm run build
fi

echo "🚀 Opening TimeScope Quick Test..."
echo ""
echo "This will open VS Code with the extension workspace."
echo "After VS Code opens:"
echo "  1. Press F5 to launch 'Extension Development Host'"
echo "  2. The test file will open automatically in the new window"
echo "  3. Hover over any number to see TimeScope in action"
echo ""
echo "Test cases in the file:"
echo "  - Basic: HELLO = 120 (should show '2m')"
echo "  - Context: retryDelayMs = 5000 (should show '5s')"
echo "  - Expressions: ONE_HOUR_SECONDS = 60 * 60 (should show '1h')"
echo "  - New units: VALUE_HOURS = 24, VALUE_DAYS = 7, etc."
echo "  - Edge cases: ZERO, VERY_LARGE, HEX, IP (should be ignored)"
echo ""

# Open VS Code with the extension workspace (not just the test file)
# This ensures workspaceFolder is resolved correctly
code --new-window "$VSCODE_DIR" "$TEST_FILE"

echo "✅ VS Code opened with extension workspace and test file"
echo ""
echo "Quick commands:"
echo "  - F5: Launch Extension Development Host"
echo "  - Ctrl+Shift+P → 'Timescope: Dump Settings' to see current config"
echo "  - Ctrl+Shift+P → 'Timescope: Log Hover Target' to debug hover"
echo ""
echo "To run automated tests:"
echo "  cd $PROJECT_ROOT"
echo "  pnpm test"
