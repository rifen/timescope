export interface TimeScopeSettings {
  defaultUnit:
    | "seconds"
    | "milliseconds"
    | "microseconds"
    | "nanoseconds"
    | "minutes"
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
}

export const DEFAULT_SETTINGS: TimeScopeSettings = {
  defaultUnit: "seconds",
  format: "compact",
  minValue: 1,
  maxValue: 31557600000,
  contextClues: true,
};

export interface DetectedDuration {
  value: number;
  unit:
    | "seconds"
    | "milliseconds"
    | "microseconds"
    | "nanoseconds"
    | "minutes"
    | "hours"
    | "days"
    | "weeks"
    | "months"
    | "years";
  confidence: number;
  source: "heuristic" | "context";
  contextHint?: string;
}

export interface FormatOptions {
  format: "compact" | "verbose" | "both";
}

export interface DetectedItem extends DetectedDuration {
  token: string;
  line: number;
  column: number;
  formatted: string;
  lineContext: string;
  identifier?: string;
}

export interface ScanResult {
  filePath?: string;
  items: DetectedItem[];
  totalCount: number;
}

export interface FileScanResult extends ScanResult {
  filePath: string;
}
