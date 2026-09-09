import * as vscode from "vscode";

export interface TimeScopeSettings {
  enabled: boolean;
  defaultUnit:
    | "seconds"
    | "milliseconds"
    | "microseconds"
    | "nanoseconds"
    | "hours"
    | "days"
    | "weeks"
    | "months"
    | "years"
    | "auto";
  format: "compact" | "verbose" | "both";
  minValue: number;
  maxValue: number;
  contextClues: boolean;
  fileTypes: string[];
}

const DEFAULTS: TimeScopeSettings = {
  enabled: true,
  defaultUnit: "seconds",
  format: "compact",
  minValue: 1,
  maxValue: 31557600000, // ~1000 years in milliseconds
  contextClues: true,
  fileTypes: ["*"],
};

export function getSettings(): TimeScopeSettings {
  const config = vscode.workspace.getConfiguration("timescope");

  return {
    enabled: config.get("enabled", DEFAULTS.enabled),
    defaultUnit: config.get("defaultUnit", DEFAULTS.defaultUnit),
    format: config.get("format", DEFAULTS.format),
    minValue: config.get("minValue", DEFAULTS.minValue),
    maxValue: config.get("maxValue", DEFAULTS.maxValue),
    contextClues: config.get("contextClues", DEFAULTS.contextClues),
    fileTypes: config.get("fileTypes", DEFAULTS.fileTypes),
  };
}
