import * as vscode from "vscode";

export interface TimeScopeSettings {
  enabled: boolean;
  defaultUnit:
    | "seconds"
    | "milliseconds"
    | "microseconds"
    | "nanoseconds"
    | "auto";
  format: "compact" | "verbose" | "both";
  minValue: number;
  maxValue: number;
  showBreakdown: boolean;
  showUnitLabel: boolean;
  contextClues: boolean;
  ignorePatterns: string[];
  fileTypes: string[];
  keywords: string[];
}

const DEFAULTS: TimeScopeSettings = {
  enabled: true,
  defaultUnit: "seconds",
  format: "compact",
  minValue: 1,
  maxValue: 31557600000, // ~1000 years in milliseconds
  showBreakdown: true,
  showUnitLabel: true,
  contextClues: true,
  ignorePatterns: [
    "^0x[0-9a-f]+$", // Hex colors, addresses
    "^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$", // IPv4
    "^\\d{4}-\\d{2}-\\d{2}$", // ISO dates
    "^\\d{10,}$", // Unix timestamps (epoch)
  ],
  fileTypes: ["*"],
  keywords: [
    "timeout",
    "interval",
    "delay",
    "duration",
    "ttl",
    "expiry",
    "expire",
    "retention",
    "age",
    "period",
    "rate",
    "throttle",
    "backoff",
    "retry",
    "wait",
    "sleep",
    "pause",
    "hold",
    "cache",
    "session",
  ],
};

export function getSettings(): TimeScopeSettings {
  const config = vscode.workspace.getConfiguration("timescope");

  return {
    enabled: config.get("enabled", DEFAULTS.enabled),
    defaultUnit: config.get("defaultUnit", DEFAULTS.defaultUnit),
    format: config.get("format", DEFAULTS.format),
    minValue: config.get("minValue", DEFAULTS.minValue),
    maxValue: config.get("maxValue", DEFAULTS.maxValue),
    showBreakdown: config.get("showBreakdown", DEFAULTS.showBreakdown),
    showUnitLabel: config.get("showUnitLabel", DEFAULTS.showUnitLabel),
    contextClues: config.get("contextClues", DEFAULTS.contextClues),
    ignorePatterns: config.get("ignorePatterns", DEFAULTS.ignorePatterns),
    fileTypes: config.get("fileTypes", DEFAULTS.fileTypes),
    keywords: config.get("keywords", DEFAULTS.keywords),
  };
}
