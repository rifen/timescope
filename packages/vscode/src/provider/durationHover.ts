import * as vscode from "vscode";
import { detectDuration, formatDurationFull } from "@rifen/timescope-core";
import { getSettings } from "../config/settings.js";

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
    if (!settings.enabled) {
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

    const { token, range } = candidate;
    const sanitized = this.stripComments(token).trim();
    this.log("sanitized token", sanitized);

    const language = document.languageId;
    const duration = detectDuration(sanitized, lineText, settings, language);
    if (!duration) {
      this.log("no detection result");
      return null;
    }

    const formatted = formatDurationFull(duration.value, duration.unit, {
      format: settings.format,
    });

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
      /^(\s*)(?:(const|let|var|val|final)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/,
    );
    if (assignmentMatch) {
      const [, leading, varName, expression] = assignmentMatch;
      const varStart = leading.length;
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
        return {
          token: expression.trim(),
          range: new vscode.Range(
            new vscode.Position(lineNum, varStart),
            new vscode.Position(lineNum, varEnd),
          ),
        };
      }

      if (charPos >= exprStart && charPos <= exprStart + expression.length) {
        this.log("cursor on expression");
        // Strip trailing ; or , from the captured expression
        const expr = expression.replace(/\s*[;,]\s*$/, "");
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

    for (; start > 0 && /[\w.$*]/.test(line[start - 1]); start--) {
      // Check if we've hit a keyword boundary
      const beforeChar = line[start - 1];
      if (!/[\w$*]/.test(beforeChar)) break;
    }

    for (; end < line.length && /[\w.$*]/.test(line[end]); end++) {
      // Check if we've hit a keyword boundary
      const afterChar = line[end];
      if (!/[\w$*]/.test(afterChar)) break;
    }

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
    const operators = /[+\-*/()]/;

    let start = wordStart;
    let end = wordEnd;

    // Expand backward
    for (; start > 0; ) {
      const char = line[start - 1];
      if (/\s/.test(char)) {
        let i = start - 1;
        for (; i >= 0 && /\s/.test(line[i]); i--);
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

    // Expand forward
    for (; end < line.length; ) {
      const char = line[end];
      if (/\s/.test(char)) {
        let i = end;
        for (; i < line.length && /\s/.test(line[i]); i++);
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

    const expression = line.slice(start, end);
    if (/[+\-*/]/.test(expression)) {
      return { expression, start, end };
    }

    return null;
  }

  private stripComments(expr: string): string {
    let result = expr.replace(/\s*#[^\n]*/g, "");
    result = result.replace(/\s*\/\/.*$/gm, "");
    result = result.replace(/\/\*[\s\S]*?\*\//g, "");
    return result.trim();
  }
}
