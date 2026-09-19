#!/bin/bash
# Quick test script for TimeScope VS Code extension
# Opens VS Code with the extension workspace; the shared manual fixtures live
# at <repo>/test-data/manual and open automatically in the development host.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VSCODE_DIR="$SCRIPT_DIR/.."
MANUAL_DIR="$PROJECT_ROOT/test-data/manual"

# Check if the extension is built
if [ ! -f "$VSCODE_DIR/dist/extension.js" ]; then
  echo "⚠️  Extension not built. Building now..."
  cd "$VSCODE_DIR" && npm run build
fi

echo "🚀 Opening TimeScope Quick Test..."
echo ""
echo "This will open VS Code with the extension workspace."
echo "After VS Code opens:"
echo "  1. Press F5 and select 'Extension Development Host (Clean - No Extensions)' to launch"
echo "     a clean VS Code instance with NO other extensions loaded"
echo "  2. Press F5 and select 'Extension Development Host' to launch with your extensions"
echo "  3. The manual fixtures open as tabs and the fixture folder opens in the Explorer"
echo "  4. Hover over any number to see TimeScope in action"
echo ""
echo "Manual fixtures (each line's trailing comment states the expected result):"
for file in "$MANUAL_DIR"/durations.*; do
  [ -f "$file" ] && echo "  - $(basename "$file")"
done
echo ""
echo "See $MANUAL_DIR/README.md for the full guide."
echo ""

# Open VS Code with the extension workspace (not just the test file)
# This ensures workspaceFolder is resolved correctly
code --new-window "$VSCODE_DIR"

echo "✅ VS Code opened with extension workspace"
echo ""
echo "Quick commands:"
echo "  - F5 → 'Extension Development Host (Clean - No Extensions)': Clean test environment"
echo "  - F5 → 'Extension Development Host': Normal test with your extensions"
echo "  - Ctrl+Shift+P → 'Timescope: Dump Settings' to see current config"
echo "  - Ctrl+Shift+P → 'Timescope: Log Hover Target' to debug hover"
echo ""
echo "To run automated tests:"
echo "  cd $PROJECT_ROOT"
echo "  pnpm test"