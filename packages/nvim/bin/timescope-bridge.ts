#!/usr/bin/env node

/**
 * TimeScope Core Bridge for Neovim
 *
 * Reads JSON from stdin: { token: string, line: string, language?: string, settings?: object, code?: string }
 * Returns JSON on stdout: { text: string, hint?: string } | null
 */

import {
  buildSymbolTable,
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
    const { token, line: context, language, settings, assignment, code } =
      JSON.parse(line);
    const mergedSettings = settings
      ? ({ ...DEFAULT_SETTINGS, ...settings } as TimeScopeSettings)
      : undefined;
    const variables =
      typeof code === "string" ? buildSymbolTable(code) : undefined;
    // Prefer the assignment RHS (the whole expression) so hovering any part of
    // `X = a + b` evaluates the same as the VS Code extension. Fall back to the
    // cursor-local token when the RHS is not evaluable (e.g. constructors).
    let result =
      typeof assignment === "string"
        ? detectDuration(assignment, context, mergedSettings, language, variables)
        : undefined;
    if (!result) {
      result = detectDuration(
        token,
        context,
        mergedSettings,
        language,
        variables,
      );
    }

    if (!result && variables) {
      // The token may start a multi-line assignment (e.g. `MIN = (`); resolve
      // the assigned name against constants declared in the document. The
      // declaration can be indented (for example inside a Python `try:`).
      const name = context
        .replace(/^\s*(?:const|let|var|val|final|local)\s+/, "")
        .trimStart()
        .match(/^[A-Za-z_]\w*/)?.[0];
      if (name && variables.has(name)) {
        result = detectDuration(
          name,
          context,
          mergedSettings,
          language,
          variables,
        );
      }
    }

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
