#!/usr/bin/env bash
set -euo pipefail

echo "==> Running pre-commit checks..."

# Build all packages to catch TypeScript/lint issues early
echo "==> Building all packages..."
pnpm -r run build

# Run core tests to catch regressions
echo "==> Running core tests..."
pnpm --filter @rifen/timescope-core test

# Install gitleaks if missing
GITLEAKS_VERSION="8.18.2"
GITLEAKS_BIN="${HOME}/.local/bin/gitleaks"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "==> Installing gitleaks ${GITLEAKS_VERSION}..."
  mkdir -p "$(dirname "${GITLEAKS_BIN}")"
  curl -sSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" |
    tar -xz -C "$(dirname "${GITLEAKS_BIN}")" gitleaks
  chmod +x "${GITLEAKS_BIN}"
fi

echo "==> Scanning for secrets..."
"${GITLEAKS_BIN}" detect --source . --redact --no-git

echo "==> Pre-commit checks passed."
