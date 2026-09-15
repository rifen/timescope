#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURE="$PLUGIN_ROOT/test-data/sample.lua"

cd "$PLUGIN_ROOT/../.."
pnpm --filter @rifen/timescope-core build
pnpm --filter timescope-nvim build

if ! command -v nvim >/dev/null 2>&1; then
  echo "Neovim is required. Install it and run this script again." >&2
  exit 1
fi

exec nvim --clean -u NONE \
  --cmd "set rtp^=$PLUGIN_ROOT" \
  "$FIXTURE" \
  -c "lua require('timescope').setup()"
