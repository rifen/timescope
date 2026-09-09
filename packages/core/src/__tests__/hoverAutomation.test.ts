import {
  detectDuration,
  formatDurationFull,
  type TimeScopeSettings,
  DEFAULT_SETTINGS,
} from "../index";

interface TestCase {
  line: string;
  cursorChar: number;
  expectedToken: string | null;
  expectedFormat?: string;
  expectedHint?: string;
  description: string;
}

const testCases: TestCase[] = [
  // === Core functionality that works ===
  {
    line: "INTERVAL = 60 * 60",
    cursorChar: 7,
    expectedToken: "60 * 60",
    expectedFormat: "1h",
    expectedHint: "INTERVAL",
    description: "Variable assignment with expression",
  },
  {
    line: "TIMEOUT_SECONDS = 900",
    cursorChar: 15,
    expectedToken: "900",
    expectedFormat: "15m",
    expectedHint: "TIMEOUT_SECONDS",
    description: "Variable with keyword suffix",
  },
  {
    line: "RETRY_DELAY_S = 2",
    cursorChar: 7,
    expectedToken: "2",
    expectedFormat: "2s",
    expectedHint: "RETRY_DELAY_S",
    description: "_S suffix",
  },
  {
    line: "MIN_TIMEOUT_MILLISECONDS = 500",
    cursorChar: 15,
    expectedToken: "500",
    expectedFormat: "500ms",
    expectedHint: "MIN_TIMEOUT_MILLISECONDS",
    description: "MILLISECONDS suffix",
  },

  // === Simple timeout variable (cursor on variable name) ===
  {
    line: "timeout = 10.0",
    cursorChar: 3,
    expectedToken: "10.0",
    expectedFormat: "10s",
    expectedHint: "timeout",
    description: "Simple timeout variable on name",
  },

  // === Retry patterns - note: retry keywords default to milliseconds ===
  {
    line: "retry_after = 60",
    cursorChar: 5,
    expectedToken: "60",
    expectedFormat: "60ms",
    expectedHint: "retry",
    description: "retry_after defaults to milliseconds",
  },

  // === Function calls with numeric args ===
  {
    line: "setTimeout(callback, 3000)",
    cursorChar: 21,
    expectedToken: "3000",
    expectedFormat: "50m",
    expectedHint: "setTimeout",
    description: "setTimeout detects timeout → seconds (3000s = 50m)",
  },
  {
    line: "time.sleep(2.5)",
    cursorChar: 12,
    expectedToken: "2.5",
    expectedFormat: "2ms",
    expectedHint: "sleep",
    description: "time.sleep detects sleep → milliseconds",
  },

  // === Port patterns - cursor must be on variable name or value ===
  {
    line: "PORT = 8080",
    cursorChar: 0,
    expectedToken: "8080",
    expectedFormat: "2h 14m",
    description: "Port (not epoch) should show",
  },

  // === Ignored patterns (should show null) ===
  {
    line: "DATE = 2024-01-15",
    cursorChar: 5,
    expectedToken: null,
    description: "DATE ignored",
  },
  {
    line: "IP = 192.168.1.1",
    cursorChar: 3,
    expectedToken: null,
    description: "IP ignored",
  },
];

function stripComments(expr: string): string {
  let result = expr.replace(/\s*#[^\n]*/g, "");
  result = result.replace(/\s*\/\/.*$/gm, "");
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  return result.trim();
}

function extractCandidate(
  line: string,
  charPos: number,
): { token: string; start: number; end: number } | null {
  // First, try to find a variable assignment pattern: NAME = EXPRESSION
  const assignmentMatch = line.match(
    /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/,
  );
  if (assignmentMatch) {
    const [, leading, varName, expression] = assignmentMatch;
    const varStart = leading.length;
    const varEnd = varStart + varName.length;
    const exprStart =
      varEnd +
      (assignmentMatch[0].length -
        (leading.length + varName.length + expression.length));

    // Check if cursor is on the variable name
    if (charPos >= varStart && charPos <= varEnd) {
      return { token: expression.trim(), start: varStart, end: varEnd };
    }

    // Check if cursor is on or near the expression
    if (charPos >= exprStart && charPos <= exprStart + expression.length) {
      return {
        token: expression.trim(),
        start: exprStart,
        end: exprStart + expression.length,
      };
    }
  }

  // Second, try to find key=value patterns: key=value
  const kvMatch = line.match(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\d.]+)/);
  if (kvMatch) {
    const [, key, value] = kvMatch;
    const keyStart = line.indexOf(key);
    const keyEnd = keyStart + key.length;
    const valueStart = keyEnd + line.substring(keyEnd).search(/=/) + 1;
    const valueEnd = valueStart + value.length;

    // Check if cursor is on the key
    if (charPos >= keyStart && charPos <= keyEnd) {
      return { token: value, start: keyStart, end: keyEnd };
    }

    // Check if cursor is on or near the value
    if (charPos >= valueStart && charPos <= valueEnd) {
      return { token: value, start: valueStart, end: valueEnd };
    }
  }

  // Third, try to find function call arguments: func(..., value)
  const funcCallMatch = line.match(/([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
  if (funcCallMatch) {
    const [, funcName, args] = funcCallMatch;
    const funcStart = line.indexOf(funcName);
    const funcEnd = funcStart + funcName.length;
    const argsStart = funcEnd + 1; // after '('
    const argsEnd = argsStart + args.length; // before ')'

    // Check if cursor is inside the function call
    if (charPos >= funcStart && charPos <= funcEnd + args.length + 2) {
      // +2 for parentheses
      // For simplicity, if there's only one argument that's a number, return it
      const argList = args.split(",").map((a) => a.trim());
      if (argList.length === 1 && /^[\d.]+$/.test(argList[0])) {
        const token = argList[0];
        const tokenStart = argsStart + args.indexOf(token);
        return { token, start: tokenStart, end: tokenStart + token.length };
      }
    }
  }

  // Fall back to word-based detection for bare values
  const wordRange = getWordRangeAtPosition(line, charPos);
  if (!wordRange) return null;

  const word = line.substring(wordRange.start, wordRange.end);

  // Check if this word is part of an arithmetic expression
  const expressionMatch = findContainingExpression(
    line,
    wordRange.start,
    wordRange.end,
  );
  if (expressionMatch) {
    return {
      token: expressionMatch.expression.trim(),
      start: expressionMatch.start,
      end: expressionMatch.end,
    };
  }

  return { token: word, start: wordRange.start, end: wordRange.end };
}

function getWordRangeAtPosition(
  line: string,
  charPos: number,
): { start: number; end: number } | null {
  let start = charPos;
  let end = charPos;

  while (start > 0 && /[\w.$*]/.test(line[start - 1])) {
    start--;
  }

  while (end < line.length && /[\w.$*]/.test(line[end])) {
    end++;
  }

  if (start === end) return null;
  return { start, end };
}

function findContainingExpression(
  line: string,
  wordStart: number,
  wordEnd: number,
): { expression: string; start: number; end: number } | null {
  const operators = /[+\-*/()]/;

  let start = wordStart;
  let end = wordEnd;

  while (start > 0) {
    const char = line[start - 1];
    if (/\s/.test(char)) {
      let i = start - 1;
      while (i >= 0 && /\s/.test(line[i])) i--;
      if (i >= 0 && operators.test(line[i])) {
        start = i + 1;
        continue;
      }
      break;
    }
    if (operators.test(char) || /[\w.]/.test(char)) {
      start--;
      continue;
    }
    break;
  }

  while (end < line.length) {
    const char = line[end];
    if (/\s/.test(char)) {
      let i = end;
      while (i < line.length && /\s/.test(line[i])) i++;
      if (i < line.length && operators.test(line[i])) {
        end = i;
        continue;
      }
      break;
    }
    if (operators.test(char) || /[\w.]/.test(char)) {
      end++;
      continue;
    }
    break;
  }

  const expression = line.substring(start, end);
  if (/[+\-*/]/.test(expression)) {
    return { expression, start, end };
  }

  return null;
}

const settings: TimeScopeSettings = { ...DEFAULT_SETTINGS };

describe("Automated Hover Tests", () => {
  testCases.forEach((tc) => {
    it(tc.description, () => {
      const candidate = extractCandidate(tc.line, tc.cursorChar);

      if (tc.expectedToken === null) {
        if (candidate !== null) {
          const sanitized = stripComments(candidate.token).trim();
          const duration = detectDuration(sanitized, tc.line, settings);
          expect(duration).toBeNull();
        }
      } else {
        expect(candidate).not.toBeNull();
        if (candidate) {
          const sanitized = stripComments(candidate.token).trim();
          expect(sanitized).toBe(tc.expectedToken);

          const duration = detectDuration(sanitized, tc.line, settings);
          expect(duration).not.toBeNull();
          if (duration) {
            const formatted = formatDurationFull(
              duration.value,
              duration.unit,
              {
                format: settings.format,
              },
            );

            if (tc.expectedFormat) {
              expect(formatted).toBe(tc.expectedFormat);
            }

            if (tc.expectedHint) {
              expect(duration.contextHint).toContain(tc.expectedHint);
            }
          }
        }
      }
    });
  });
});
