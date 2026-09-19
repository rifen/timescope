import * as assert from "assert";
import * as vscode from "vscode";
import { DurationHoverProvider } from "../../src/provider/durationHover";

function createDocument(code: string): vscode.TextDocument {
  const lines = code.split("\n");
  return {
    fileName: "/tmp/timescope-hover.py",
    languageId: "python",
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] ?? "" }),
    getText: () => code,
  } as unknown as vscode.TextDocument;
}

function hoverText(hover: vscode.Hover): string {
  const contents = Array.isArray(hover.contents)
    ? hover.contents
    : [hover.contents];
  return contents
    .map((item) => (typeof item === "string" ? item : item.value))
    .join("\n");
}

suite("Hover automation (#26, #28)", () => {
  const provider = new DurationHoverProvider(() => undefined);

  function hoverAt(
    code: string,
    line: number,
    identifier: string,
  ): vscode.Hover | null {
    const document = createDocument(code);
    const character = code.split("\n")[line].indexOf(identifier);
    return provider.provideHover(
      document,
      new vscode.Position(line, character),
      {} as vscode.CancellationToken,
    );
  }

  test("resolves a variable defined from an earlier variable", () => {
    const code = [
      "COMMIT_TIMER_ARM_TIMEOUT_SECONDS = 15.0",
      "COMMIT_TIMER_ARM_ACTIVITY_SECONDS = int(COMMIT_TIMER_ARM_TIMEOUT_SECONDS) + 15",
    ].join("\n");

    const hover = hoverAt(code, 1, "COMMIT_TIMER_ARM_ACTIVITY_SECONDS");
    assert.ok(hover, "expected a hover result");
    assert.match(hoverText(hover), /30s/);
  });

  test("resolves a multi-line parenthesized assignment", () => {
    const code = [
      "COMMIT_TIMER_SETTLE_SECONDS = 5",
      "COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS = 15.0",
      "COMMIT_TIMER_CONFIRM_MARGIN_SECONDS = 10",
      "MIN_COMMIT_TIMER_SECONDS = (",
      "    COMMIT_TIMER_SETTLE_SECONDS",
      "    + int(COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS)",
      "    + COMMIT_TIMER_CONFIRM_MARGIN_SECONDS",
      ")",
    ].join("\n");

    const hover = hoverAt(code, 3, "MIN_COMMIT_TIMER_SECONDS");
    assert.ok(hover, "expected a hover result");
    assert.match(hoverText(hover), /30s/);
  });

  test("resolves timedelta keyword arguments", () => {
    const code = "start_to_close_timeout=timedelta(seconds=400)";

    const hover = hoverAt(code, 0, "start_to_close_timeout");
    assert.ok(hover, "expected a hover result");
    assert.match(hoverText(hover), /6m 40s/);
  });

  test("resolves a Lua local declaration", () => {
    const code = [
      "local RETRY_DELAY_MS = 250",
      "local TIMEOUT_SECONDS = 90",
    ].join("\n");

    const hover = hoverAt(code, 0, "RETRY_DELAY_MS");
    assert.ok(hover, "expected a hover result");
    assert.match(hoverText(hover), /250ms/);
  });

  test("resolves a number inside an unevaluable constructor call", () => {
    const code = "let timeout = Duration::from_secs(15);";

    const hover = hoverAt(code, 0, "15");
    assert.ok(hover, "expected a hover result");
    assert.match(hoverText(hover), /15s/);
  });

  test("does not invent a duration for a quoted date", () => {
    const code = 'const CREATED_AT = "2024-01-15";';

    assert.strictEqual(hoverAt(code, 0, "2024"), null);
  });
});