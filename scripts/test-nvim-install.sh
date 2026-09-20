#!/usr/bin/env bash
set -euo pipefail

# This script simulates a fresh installation of the Neovim plugin
# as if it were downloaded from GitHub.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT

echo "Using temporary directory: $TEST_DIR"

if ! command -v nvim >/dev/null 2>&1; then
  echo "Neovim is required. Install it and run this script again." >&2
  exit 1
fi

# 1. Build the bridge
echo "Building the bridge..."
pnpm --filter timescope-nvim build

# 2. Simulate the 'nvim' branch structure (flattened)
# This is how the plugin is actually distributed on the nvim branch/tags.
INSTALL_DIR="$TEST_DIR/timescope-nvim"
mkdir -p "$INSTALL_DIR/bin"
cp -r "$REPO_ROOT/packages/nvim/lua" "$INSTALL_DIR/lua"
cp "$REPO_ROOT/packages/nvim/bin/timescope-bridge.js" "$INSTALL_DIR/bin/"
# Templates are not part of the published artifact
rm -f "$INSTALL_DIR/lua/timescope/lazy.lua" \
  "$INSTALL_DIR/lua/timescope/lazy-example.lua"
cp "$REPO_ROOT/LICENSE" "$INSTALL_DIR/LICENSE"

# 3. Create a minimal headless test script for the "installed" plugin
cat > "$TEST_DIR/test_init.lua" <<EOF
-- Simulate an installed plugin by adding it to rtp
vim.opt.rtp:prepend("$INSTALL_DIR")

-- Try to load the plugin
local ok, timescope = pcall(require, 'timescope')
if not ok then
  print("FAILED: Could not require('timescope')")
  os.exit(1)
end

timescope.setup({ debounceMs = 0 })

-- Verify commands are registered
if vim.fn.exists(':TimeScopeEnable') ~= 2 then
  print("FAILED: :TimeScopeEnable not registered")
  os.exit(1)
end

-- Smoke test the bridge
local hover = require('timescope.hover')
local sample = 'TIMEOUT = 60'
local col = sample:find('60') - 1

vim.api.nvim_buf_set_lines(0, 0, -1, false, { sample })
vim.api.nvim_win_set_cursor(0, { 1, col })
hover.show_duration()

-- Wait for the bridge to respond
local completed = vim.wait(5000, function()
  return #vim.api.nvim_buf_get_extmarks(0, hover.namespace, 0, -1, {}) > 0
end, 50)

if not completed then
  print("FAILED: No virtual text produced (bridge timeout or error)")
  os.exit(1)
end

local marks = vim.api.nvim_buf_get_extmarks(0, hover.namespace, 0, -1, { details = true })
local text = marks[1][4].virt_text[1][1]
print("SUCCESS: Found virtual text: " .. text)

if text ~= "1m" then
  print("FAILED: Expected '1m', got '" .. text .. "'")
  os.exit(1)
end

print("INSTALLATION TEST PASSED")
vim.cmd('qa!')
EOF

# 4. Run Neovim
echo "Running Neovim smoke test..."
if ! nvim --headless --clean -u "$TEST_DIR/test_init.lua"; then
  echo "Installation test FAILED"
  exit 1
fi