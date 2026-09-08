"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DurationHoverProvider = void 0;
var vscode = require("vscode");
var timescope_core_1 = require("@rifen/timescope-core");
var settings_js_1 = require("../config/settings.js");
var DurationHoverProvider = /** @class */ (function () {
    function DurationHoverProvider(logFn) {
        this.log = logFn;
    }
    DurationHoverProvider.prototype.provideHover = function (document, position, _token) {
        var settings = (0, settings_js_1.getSettings)();
        if (!settings.enabled) {
            return null;
        }
        var lineText = document.lineAt(position.line).text;
        this.log("hover request", {
            line: position.line,
            char: position.character,
            lineText: lineText,
        });
        var candidate = this.extractCandidate(lineText, position.character, position.line);
        if (!candidate) {
            this.log("no candidate");
            return null;
        }
        var token = candidate.token, range = candidate.range;
        var sanitized = this.stripComments(token).trim();
        this.log("sanitized token", sanitized);
        var language = document.languageId;
        var duration = (0, timescope_core_1.detectDuration)(sanitized, lineText, settings, language);
        if (!duration) {
            this.log("no detection result");
            return null;
        }
        var formatted = (0, timescope_core_1.formatDurationFull)(duration.value, duration.unit, {
            format: settings.format,
            showBreakdown: settings.showBreakdown,
            showUnitLabel: settings.showUnitLabel,
        });
        var lines = [formatted];
        if (duration.source === "context" && duration.contextHint) {
            lines.push("*inferred from ".concat(duration.contextHint, "*"));
        }
        return new vscode.Hover(lines.join("\n"), range);
    };
    DurationHoverProvider.prototype.extractCandidate = function (line, charPos, lineNum) {
        this.log("extractCandidate", { line: line, charPos: charPos });
        var assignmentMatch = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
        if (assignmentMatch) {
            var leading = assignmentMatch[1], varName = assignmentMatch[2], expression = assignmentMatch[3];
            var varStart = leading.length;
            var varEnd = varStart + varName.length;
            var exprStart = varEnd +
                (assignmentMatch[0].length -
                    (leading.length + varName.length + expression.length));
            this.log("assignment match", {
                varName: varName,
                expression: expression,
                varStart: varStart,
                varEnd: varEnd,
                exprStart: exprStart,
                charPos: charPos,
            });
            if (charPos >= varStart && charPos <= varEnd) {
                this.log("cursor on variable name");
                return {
                    token: expression.trim(),
                    range: new vscode.Range(new vscode.Position(lineNum, varStart), new vscode.Position(lineNum, varEnd)),
                };
            }
            if (charPos >= exprStart && charPos <= exprStart + expression.length) {
                this.log("cursor on expression");
                return {
                    token: expression.trim(),
                    range: new vscode.Range(new vscode.Position(lineNum, exprStart), new vscode.Position(lineNum, exprStart + expression.length)),
                };
            }
        }
        var wordRange = this.getWordRangeAtPosition(line, charPos);
        if (!wordRange) {
            this.log("no word range");
            return null;
        }
        var word = line.slice(wordRange.start, wordRange.end);
        this.log("word range", wordRange, word);
        var expressionMatch = this.findContainingExpression(line, wordRange.start, wordRange.end);
        if (expressionMatch) {
            this.log("expression match", expressionMatch);
            return {
                token: expressionMatch.expression.trim(),
                range: new vscode.Range(new vscode.Position(lineNum, expressionMatch.start), new vscode.Position(lineNum, expressionMatch.end)),
            };
        }
        this.log("fallback to word");
        return {
            token: word,
            range: new vscode.Range(new vscode.Position(lineNum, wordRange.start), new vscode.Position(lineNum, wordRange.end)),
        };
    };
    DurationHoverProvider.prototype.getWordRangeAtPosition = function (line, charPos) {
        var start = charPos;
        var end = charPos;
        // Skip leading keywords (const, let, var, etc.) when expanding word range
        var keywordPattern = /\b(const|let|var|function|async|await|return|if|else|for|while|switch|case|default|break|continue|try|catch|finally|throw|new|typeof|instanceof|delete|void|yield)\b/;
        for (; start > 0 && /[\w.$*]/.test(line[start - 1]); start--) {
            // Check if we've hit a keyword boundary
            var beforeChar = line[start - 1];
            if (!/[\w$*]/.test(beforeChar))
                break;
        }
        for (; end < line.length && /[\w.$*]/.test(line[end]); end++) {
            // Check if we've hit a keyword boundary
            var afterChar = line[end];
            if (!/[\w$*]/.test(afterChar))
                break;
        }
        // If the resulting word is a keyword, return null to force expression matching
        var word = line.slice(start, end);
        if (keywordPattern.test(word)) {
            return null;
        }
        if (start === end)
            return null;
        return { start: start, end: end };
    };
    DurationHoverProvider.prototype.findContainingExpression = function (line, wordStart, wordEnd) {
        var operators = /[+\-*/()]/;
        var start = wordStart;
        var end = wordEnd;
        for (; start > 0;) {
            var char = line[start - 1];
            if (/\s/.test(char)) {
                var i = start - 1;
                for (; i >= 0 && /\s/.test(line[i]); i--)
                    ;
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
        for (; end < line.length;) {
            var char = line[end];
            if (/\s/.test(char)) {
                var i = end;
                for (; i < line.length && /\s/.test(line[i]); i++)
                    ;
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
        var expression = line.slice(start, end);
        if (/[+\-*/]/.test(expression)) {
            return { expression: expression, start: start, end: end };
        }
        return null;
    };
    DurationHoverProvider.prototype.stripComments = function (expr) {
        var result = expr.replace(/\s*#[^\n]*/g, "");
        result = result.replace(/\s*\/\/.*$/gm, "");
        result = result.replace(/\/\*[\s\S]*?\*\//g, "");
        return result.trim();
    };
    return DurationHoverProvider;
}());
exports.DurationHoverProvider = DurationHoverProvider;
