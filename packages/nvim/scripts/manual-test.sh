#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANUAL_DIR="$PLUGIN_ROOT/../../test-data/manual"

cd "$PLUGIN_ROOT/../.."
pnpm --filter @rifen/timescope-core build
pnpm --filter timescope-nvim build

if ! command -v nvim >/dev/null 2>&1; then
  echo "Neovim is required. Install it and run this script again." >&2
  exit 1
fi

FILES=()
for file in "$MANUAL_DIR"/durations.*; do
  [ -f "$file" ] && FILES+=("$file")
done

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No manual fixtures found in $MANUAL_DIR" >&2
  exit 1
fi

echo "TimeScope manual test: opening ${#FILES[@]} fixtures."
echo "Move the cursor over a value to see virtual text; use :next / :bnext to cycle files."
echo "Each line's trailing comment states the expected result."

exec nvim --clean -u NONE \
  --cmd "set rtp^=$PLUGIN_ROOT" \
  "${FILES[@]}" \
  -c "lua require('timescope').setup()"