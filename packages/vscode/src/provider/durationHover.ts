import * as vscode from "vscode";
import {
  buildSymbolTable,
  detectDuration,
  formatDurationFull,
} from "@rifen/timescope-core";
import { getSettings } from "../config/settings.js";

// Match the document path against configured file-type glob patterns.
function matchesFileType(
  document: vscode.TextDocument,
  patterns: string[],
): boolean {
  if (patterns.includes("*")) return true;
  return patterns.some(
    (p) => p === document.languageId || makeMinimatch(p, document.fileName),
  );
}

function makeMinimatch(pattern: string, name: string): boolean {
  // Match glob syntax directly so configured file patterns never become
  // executable regular expressions. Supports *, **, and ? without allowing
  // pattern input to introduce ReDoS-prone regex constructs.
  const glob = pattern.replaceAll("\\\\", "/");
  const value = name.replaceAll("\\\\", "/");
  const memo = new Map<string, boolean>();

  function matches(patternIndex: number, valueIndex: number): boolean {
    const key = `${patternIndex}:${valueIndex}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let result: boolean;
    if (patternIndex === glob.length) {
      result = valueIndex === value.length;
    } else if (glob.startsWith("**", patternIndex)) {
      result =
        matches(patternIndex + 2, valueIndex) ||
        (valueIndex < value.length && matches(patternIndex, valueIndex + 1));
    } else if (glob[patternIndex] === "*") {
      result =
        matches(patternIndex + 1, valueIndex) ||
        (valueIndex < value.length &&
          value[valueIndex] !== "/" &&
          matches(patternIndex, valueIndex + 1));
    } else if (glob[patternIndex] === "?") {
      result =
        valueIndex < value.length &&
        value[valueIndex] !== "/" &&
        matches(patternIndex + 1, valueIndex + 1);
    } else {
      result =
        valueIndex < value.length &&
        glob[patternIndex] === value[valueIndex] &&
        matches(patternIndex + 1, valueIndex + 1);
    }

    memo.set(key, result);
    return result;
  }

  return matches(0, 0);
}

export class DurationHoverProvider implements vscode.HoverProvider {
  private readonly log: (message: string, ...args: unknown[]) => void;

  constructor(logFn: (message: string, ...args: unknown[]) => void) {
    this.log = logFn;
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.Hover | null {
    const settings = getSettings();
    if (!settings.enabled || !matchesFileType(document, settings.fileTypes)) {
      return null;
    }

    const lineText = document.lineAt(position.line).text;
    this.log("hover request", {
      line: position.line,
      char: position.character,
      lineText,
    });

    const candidate = this.extractCandidate(
      lineText,
      position.character,
      position.line,
    );
    if (!candidate) {
      this.log("no candidate");
      return null;
    }

    const { token } = candidate;
    let range = candidate.range;
    const sanitized = this.stripComments(token).trim();
    this.log("sanitized token", sanitized);

    const language = document.languageId;
    // Resolve constants declared earlier in the document so assignments that
    // reference other variables (and multi-line expressions) evaluate.
    const variables = buildSymbolTable(document.getText());
    let duration = detectDuration(
      sanitized,
      lineText,
      settings,
      language,
      variables,
    );

    if (!duration) {
      // The whole expression may be unevaluable (for example
      // `let t = Duration::from_secs(15)`); retry the word under the cursor
      // when it is a resolved symbol or when the line context identifies a
      // unit, so ignored shapes (quoted dates, IPs) do not start hovering.
      const wordRange = this.getWordRangeAtPosition(
        lineText,
        position.character,
      );
      const word = wordRange
        ? lineText.slice(wordRange.start, wordRange.end)
        : null;
      if (word) {
        const retry = detectDuration(
          word,
          lineText,
          settings,
          language,
          variables,
        );
        if (retry && (variables.has(word) || retry.source === "context")) {
          duration = retry;
          if (wordRange) {
            range = new vscode.Range(
              new vscode.Position(position.line, wordRange.start),
              new vscode.Position(position.line, wordRange.end),
            );
          }
        }
      }
    }

    if (!duration) {
      this.log("no detection result");
      return null;
    }

    this.log("detection result", duration);

    const formatted = formatDurationFull(duration.value, duration.unit, {
      format: settings.format,
    });

    this.log("formatted result", formatted);

    const lines = [formatted];
    if (duration.source === "context" && duration.contextHint) {
      lines.push(`*inferred from ${duration.contextHint}*`);
    }

    return new vscode.Hover(lines.join("\n"), range);
  }

  private extractCandidate(
    line: string,
    charPos: number,
    lineNum: number,
  ): { token: string; range: vscode.Range } | null {
    this.log("extractCandidate", { line, charPos });

    const assignmentMatch = line.match(
      /^(\s*)(?:(const|let|var|val|final|local)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/,
    );
    if (assignmentMatch) {
      // Regex groups: 1=leading, 2=keyword, 3=varName, 4=expression
      const [, leading, , varName, expression] = assignmentMatch;
      const varStart = line.indexOf(varName, leading.length);
      const varEnd = varStart + varName.length;
      const exprStart =
        varEnd +
        (assignmentMatch[0].length -
          (leading.length + varName.length + expression.length));

      this.log("assignment match", {
        varName,
        expression,
        varStart,
        varEnd,
        exprStart,
        charPos,
      });

      if (charPos >= varStart && charPos <= varEnd) {
        this.log("cursor on variable name");
        // Strip comments and trailing ; or , from the captured expression
        let expr = this.stripComments(expression);
        expr = expr.replace(/\s*[;,]\s*$/, "");
        return {
          token: expr.trim(),
          range: new vscode.Range(
            new vscode.Position(lineNum, varStart),
            new vscode.Position(lineNum, varEnd),
          ),
        };
      }

      if (charPos >= exprStart && charPos <= exprStart + expression.length) {
        this.log("cursor on expression");
        // Strip comments and trailing ; or , from the captured expression
        let expr = this.stripComments(expression);
        expr = expr.replace(/\s*[;,]\s*$/, "");
        return {
          token: expr.trim(),
          range: new vscode.Range(
            new vscode.Position(lineNum, exprStart),
            new vscode.Position(lineNum, exprStart + expression.length),
          ),
        };
      }
    }

    const wordRange = this.getWordRangeAtPosition(line, charPos);
    if (!wordRange) {
      this.log("no word range");
      return null;
    }

    const word = line.slice(wordRange.start, wordRange.end);
    this.log("word range", wordRange, word);

    const expressionMatch = this.findContainingExpression(
      line,
      wordRange.start,
      wordRange.end,
    );
    if (expressionMatch) {
      this.log("expression match", expressionMatch);
      return {
        token: expressionMatch.expression.trim(),
        range: new vscode.Range(
          new vscode.Position(lineNum, expressionMatch.start),
          new vscode.Position(lineNum, expressionMatch.end),
        ),
      };
    }

    this.log("fallback to word");
    return {
      token: word,
      range: new vscode.Range(
        new vscode.Position(lineNum, wordRange.start),
        new vscode.Position(lineNum, wordRange.end),
      ),
    };
  }

  private getWordRangeAtPosition(
    line: string,
    charPos: number,
  ): { start: number; end: number } | null {
    let start = charPos;
    let end = charPos;

    // Skip leading keywords (const, let, var, etc.) when expanding word range
    const keywordPattern =
      /\b(const|let|var|function|async|await|return|if|else|for|while|switch|case|default|break|continue|try|catch|finally|throw|new|typeof|instanceof|delete|void|yield)\b/;

    while (start > 0 && /[\w.$*]/.test(line[start - 1])) start--;
    while (end < line.length && /[\w.$*]/.test(line[end])) end++;

    // If the resulting word is a keyword, return null to force expression matching
    const word = line.slice(start, end);
    if (keywordPattern.test(word)) {
      return null;
    }

    if (start === end) return null;
    return { start, end };
  }

  private findContainingExpression(
    line: string,
    wordStart: number,
    wordEnd: number,
  ): { expression: string; start: number; end: number } | null {
    const expressionCharacters = /[\w.$+\-*/()\s]/;
    let start = wordStart;
    let end = wordEnd;

    while (start > 0 && expressionCharacters.test(line[start - 1])) start--;
    while (end < line.length && expressionCharacters.test(line[end])) end++;

    const expression = line.slice(start, end).trim();
    const leadingWhitespace = line.slice(start, wordStart).length;
    start += leadingWhitespace;
    end = start + expression.length;
    if (/[+\-*/]/.test(expression)) {
      return { expression, start, end };
    }

    return null;
  }

  private stripComments(expr: string): string {
    let result = expr.replace(/\s*#[^\n]*/g, "");
    result = result.replace(/\s*\/\/.*$/gm, "");
    result = result.replace(/\s*--(?=\s|\[|$).*$/gm, "");
    result = result.replace(/\/\*[\s\S]*?\*\//g, "");
    return result.trim();
  }
}
