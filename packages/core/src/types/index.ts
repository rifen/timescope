export interface TimeScopeSettings {
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
  keywords: string[];
  // Language-specific keyword overrides
  languageOverrides?: Record<string, string[]>;
}

export const DEFAULT_SETTINGS: TimeScopeSettings = {
  defaultUnit: "seconds",
  format: "compact",
  minValue: 1,
  maxValue: 31557600000,
  showBreakdown: true,
  showUnitLabel: true,
  contextClues: true,
  ignorePatterns: [
    "^0x[0-9a-f]+$",
    "^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$",
    "^\\d{4}-\\d{2}-\\d{2}$",
    "^\\d{1,3}(?:\\.\\d{1,3}){3}$",
  ],
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

export interface DetectedDuration {
  value: number;
  unit: "seconds" | "milliseconds" | "microseconds" | "nanoseconds" | "minutes";
  confidence: number;
  source: "heuristic" | "context";
  contextHint?: string;
}

export interface FormatOptions {
  format: "compact" | "verbose" | "both";
  showBreakdown: boolean;
  showUnitLabel: boolean;
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
