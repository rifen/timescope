import * as vscode from "vscode";
import { DurationHoverProvider } from "./provider/durationHover.js";
import { getSettings } from "./config/settings.js";

let outputChannel: vscode.OutputChannel;

function log(...args: unknown[]) {
  const message = args.map((arg) => String(arg)).join(" ");
  outputChannel.appendLine(`[TimeScope] ${message}`);
}

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("TimeScope");
  log("Activating TimeScope extension");

  // Register hover provider for all languages (we filter in the provider)
  const selector: vscode.DocumentSelector = "*";

  const provider = new DurationHoverProvider(
    (message: string, ...args: unknown[]) => {
      log(message, ...args);
    },
  );
  const disposable = vscode.languages.registerHoverProvider(selector, provider);

  context.subscriptions.push(disposable);

  // Register a command to manually toggle (optional)
  const toggleCmd = vscode.commands.registerCommand("timescope.toggle", () => {
    const config = vscode.workspace.getConfiguration("timescope");
    const current = config.get("enabled", true);
    config.update("enabled", !current, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(
      `TimeScope ${!current ? "enabled" : "disabled"}`,
    );
  });

  context.subscriptions.push(toggleCmd);

  // Command to dump current settings to the TimeScope output channel
  const dumpSettingsCmd = vscode.commands.registerCommand(
    "timescope.dumpSettings",
    () => {
      const settings = getSettings();
      log("=== Current Settings ===");
      for (const [key, value] of Object.entries(settings)) {
        log(`${key}:`, value);
      }
      log("=== End Settings ===");
      outputChannel?.show(true);
    },
  );
  context.subscriptions.push(dumpSettingsCmd);

  // Command to log current hover target info
  const logHoverTargetCmd = vscode.commands.registerCommand(
    "timescope.logHoverTarget",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        log("No active editor");
        outputChannel.show(true);
        return;
      }
      const position = editor.selection.active;
      const lineText = editor.document.lineAt(position.line).text;
      log("=== Hover Target Info ===");
      log(`File: ${editor.document.fileName}`);
      log(`Line ${position.line}: "${lineText}"`);
      log(`Cursor at character: ${position.character}`);
      log("Note: Use the built-in hover to see duration detection.");
      log("For debugging, enable 'timescope.logHoverTarget' verbose logging.");
      outputChannel.show(true);
    },
  );
  context.subscriptions.push(logHoverTargetCmd);

  log("TimeScope extension activated successfully");
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.dispose();
  }
}
