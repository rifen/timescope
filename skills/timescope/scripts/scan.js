#!/usr/bin/env node

/**
 * TimeScope Skill Helper Script
 * Scans paths using the core CLI.
 */

const path = require("path");
const corePath = path.resolve(__dirname, "../../../packages/core/dist/cli.js");

try {
 const { runCLI } = require(corePath);
 runCLI();
} catch (e) {
 // If core hasn't been built yet, execute via ts-node or give actionable message
 console.error(
  "Error loading @rifen/timescope-core CLI. Ensure `pnpm --filter @rifen/timescope-core build` has run.",
 );
 process.exit(1);
}
