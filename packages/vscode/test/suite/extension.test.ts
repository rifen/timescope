import * as assert from "assert";
import * as vscode from "vscode";
import * as myExtension from "../../src/extension";
import { DurationHoverProvider } from "../../src/provider/durationHover";

suite("Extension Test Suite", () => {
  test("Extension activates properly", () => {
    assert.ok(myExtension.activate);
  });

  test("TimeScope extension activates in the real extension host", async () => {
    const ext = vscode.extensions.getExtension("rifen.rifen-timescope");
    assert.ok(ext, "TimeScope extension was not discovered by VS Code");
    await ext!.activate();
    assert.strictEqual(ext!.isActive, true);
  });

  test("hover provider returns a duration for an assignment", async () => {
    const provider = new DurationHoverProvider(() => undefined);
    const line = "const timeout = 30;";
    const document = {
      fileName: "/tmp/timescope-e2e.ts",
      languageId: "typescript",
      lineAt: () => ({ text: line }),
    } as unknown as vscode.TextDocument;

    const hover = provider.provideHover(
      document,
      new vscode.Position(0, line.indexOf("30")),
      {} as vscode.CancellationToken,
    );
    assert.ok(hover, "expected a hover result");
    const contents = Array.isArray(hover!.contents)
      ? hover!.contents
          .map((item) => (typeof item === "string" ? item : item.toString()))
          .join(" ")
      : String(hover!.contents);
    assert.match(contents, /30s/);
  });
});
