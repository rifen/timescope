#!/usr/bin/env node

/**
 * TimeScope Core Bridge for Neovim
 *
 * Reads JSON from stdin: { token: string, line: string, language?: string, settings?: object }
 * Returns JSON on stdout: { text: string, hint?: string } | null
 */

import {
  detectDuration,
  formatDurationFull,
  DEFAULT_SETTINGS,
  type TimeScopeSettings,
} from "@rifen/timescope-core";
import * as readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line: string) => {
  try {
    const { token, line: context, language, settings } = JSON.parse(line);
    const mergedSettings = settings
      ? ({ ...DEFAULT_SETTINGS, ...settings } as TimeScopeSettings)
      : undefined;
    const result = detectDuration(token, context, mergedSettings, language);

    if (result) {
      const formatOptions = mergedSettings
        ? { format: mergedSettings.format }
        : { format: "compact" as const };

      const formatted = formatDurationFull(
        result.value,
        result.unit,
        formatOptions,
      );

      const response = {
        text: formatted,
        hint: result.contextHint || undefined,
      };

      console.log(JSON.stringify(response));
    } else {
      console.log(JSON.stringify(null));
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
});
