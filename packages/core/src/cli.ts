#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "path";
import { scanCode, detectDuration } from "./detection";
import { formatDurationFull } from "./formatting";
import type { ScanResult, TimeScopeSettings } from "./types";

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".cpp",
  ".h",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".conf",
  ".env",
  ".lua",
  ".sh",
  ".bash",
  ".zsh",
  ".rb",
  ".php",
]);

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "target",
  ".next",
  ".cache",
  "vendor",
]);

function printHelp(): void {
  console.log(`
TimeScope CLI - AI-native code duration detection

Usage:
  timelens scan <file-or-dir> [options]
  timelens parse <expression-or-token> [options]

Commands:
  scan <path>          Scan file(s) for duration tokens (timeouts, intervals, TTLs, etc.)
  parse <expr>         Parse and evaluate a single duration expression or token

Options:
  --format=<format>    Output format: 'json' or 'text' (default: text)
  --unit=<unit>        Default unit: 'seconds', 'milliseconds', 'auto'
  --min=<number>       Minimum value filter
  --max=<number>       Maximum value filter
  --no-context         Disable contextual keyword inferences
  -h, --help           Show this help message

Examples:
  timelens scan src/ --format=json
  timelens scan config.yaml --format=text
  timelens parse "60 * 60 * 24"
  timelens parse "30000" --unit=milliseconds
`);
}

function parseArgs(args: string[]): {
  command: string;
  target?: string;
  format: "json" | "text";
  settings: Partial<TimeScopeSettings>;
} {
  let command = "help";
  let target: string | undefined;
  let format: "json" | "text" = "text";
  const settings: Partial<TimeScopeSettings> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help" || arg === "help") {
      return { command: "help", format, settings };
    }

    if (arg === "scan" || arg === "parse") {
      command = arg;
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        target = args[++i];
      }
      continue;
    }

    if (arg.startsWith("--format=")) {
      const f = arg.split("=")[1] as "json" | "text";
      if (["json", "text"].includes(f)) format = f;
      continue;
    }
    if (arg === "--json") {
      format = "json";
      continue;
    }
    if (arg === "--text") {
      format = "text";
      continue;
    }

    if (arg.startsWith("--unit=")) {
      const u = arg.split("=")[1];
      if (!["seconds", "milliseconds", "auto"].includes(u)) {
        console.error(
          `Invalid unit: ${u}. Must be one of: seconds, milliseconds, auto`,
        );
        process.exit(1);
      }
      settings.defaultUnit = u as TimeScopeSettings["defaultUnit"];
      continue;
    }

    if (arg.startsWith("--min=")) {
      const minVal = Number(arg.split("=")[1]);
      if (!Number.isFinite(minVal)) {
        console.error(
          `Invalid minimum value: ${arg.split("=")[1]}. Must be a number.`,
        );
        process.exit(1);
      }
      settings.minValue = minVal;
      continue;
    }

    if (arg.startsWith("--max=")) {
      const maxVal = Number(arg.split("=")[1]);
      if (!Number.isFinite(maxVal)) {
        console.error(
          `Invalid maximum value: ${arg.split("=")[1]}. Must be a number.`,
        );
        process.exit(1);
      }
      settings.maxValue = maxVal;
      continue;
    }

    if (arg === "--no-context") {
      settings.contextClues = false;
      continue;
    }

    // Positional target fallback
    if (!target && !arg.startsWith("-")) {
      target = arg;
    }
  }

  return { command, target, format, settings };
}

function collectFiles(dirOrFile: string): string[] {
  const stat = fs.statSync(dirOrFile);
  if (!stat.isDirectory()) {
    return [dirOrFile];
  }

  const results: string[] = [];
  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dirOrFile);
  return results;
}

export function runCLI(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printHelp();
    return;
  }

  const { command, target, format, settings } = parseArgs(args);

  if (command === "help" || !target) {
    printHelp();
    return;
  }

  if (command === "parse") {
    const detected = detectDuration(target, target, settings);
    if (!detected) {
      console.error(`Could not detect a valid duration in: "${target}"`);
      process.exit(1);
    }

    const formatted = formatDurationFull(detected.value, detected.unit, {
      format: "verbose",
    });
    const compact = formatDurationFull(detected.value, detected.unit, {
      format: "compact",
    });

    if (format === "json") {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ ...detected, formatted, compact }, null, 2));
    } else {
      // eslint-disable-next-line no-console
      console.log(`Value:      ${detected.value} ${detected.unit}`);
      // eslint-disable-next-line no-console
      console.log(`Formatted:  ${formatted} (${compact})`);
      // eslint-disable-next-line no-console
      console.log(
        `Confidence: ${(detected.confidence * 100).toFixed(0)}% (${detected.source})`,
      );
      if (detected.contextHint)
        // eslint-disable-next-line no-console
        console.log(`Hint:       ${detected.contextHint}`);
    }
    return;
  }

  if (command === "scan") {
    if (!fs.existsSync(target)) {
      console.error(`Error: Path does not exist: ${target}`);
      process.exit(1);
    }

    const files = collectFiles(target);
    const allResults: ScanResult[] = [];
    let skippedFiles = 0;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const scan = scanCode(content, file, settings);
        if (scan.items.length > 0) {
          allResults.push(scan);
        }
      } catch {
        skippedFiles++;
      }
    }

    if (format === "json") {
      console.log(
        JSON.stringify({ results: allResults, skipped: skippedFiles }, null, 2),
      );
    } else {
      let totalDetections = 0;
      for (const res of allResults) {
        // eslint-disable-next-line no-console
        console.log(`\n📄 ${res.filePath} (${res.items.length} durations):`);
        for (const item of res.items) {
          const id = item.identifier ? `[${item.identifier}] ` : "";
          // eslint-disable-next-line no-console
          console.log(
            `  Line ${item.line}:${item.column} -> ${id}"${item.token}" = ${item.formatted} (${item.unit}, ${(item.confidence * 100).toFixed(0)}% conf)`,
          );
        }
        totalDetections += res.items.length;
      }
      // eslint-disable-next-line no-console
      console.log(
        `\nScan completed: ${totalDetections} durations found across ${allResults.length} files.${skippedFiles > 0 ? ` (${skippedFiles} skipped)` : ""}`,
      );
    }
  }
}

if (require.main === module) {
  runCLI();
}
