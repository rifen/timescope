"use strict";
var __spreadArray =
    (this && this.__spreadArray) ||
    function (to, from, pack) {
        if (pack || arguments.length === 2)
            for (var i = 0, l = from.length, ar; i < l; i++) {
                if (ar || !(i in from)) {
                    if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                    ar[i] = from[i];
                }
            }
        return to.concat(ar || Array.prototype.slice.call(from));
    };
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
var vscode = require("vscode");
var durationHover_js_1 = require("./provider/durationHover.js");
var settings_js_1 = require("./config/settings.js");
var outputChannel;
function log() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var message = args
        .map(function (arg) {
            return String(arg);
        })
        .join(" ");
    outputChannel.appendLine("[TimeScope] ".concat(message));
}
function activate(context) {
    outputChannel = vscode.window.createOutputChannel("TimeScope");
    log("Activating TimeScope extension");
    // Register hover provider for all languages (we filter in the provider)
    var selector = "*";
    var provider = new durationHover_js_1.DurationHoverProvider(
        function (message) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            log.apply(void 0, __spreadArray([message], args, false));
        },
    );
    var disposable = vscode.languages.registerHoverProvider(selector, provider);
    context.subscriptions.push(disposable);
    // Register a command to manually toggle (optional)
    var toggleCmd = vscode.commands.registerCommand(
        "timescope.toggle",
        function () {
            var config = vscode.workspace.getConfiguration("timescope");
            var current = config.get("enabled", true);
            config.update(
                "enabled",
                !current,
                vscode.ConfigurationTarget.Global,
            );
            vscode.window.showInformationMessage(
                "TimeScope ".concat(!current ? "enabled" : "disabled"),
            );
        },
    );
    context.subscriptions.push(toggleCmd);
    // Command to dump current settings to the TimeScope output channel
    var dumpSettingsCmd = vscode.commands.registerCommand(
        "timescope.dumpSettings",
        function () {
            var settings = (0, settings_js_1.getSettings)();
            log("=== Current Settings ===");
            for (
                var _i = 0, _a = Object.entries(settings);
                _i < _a.length;
                _i++
            ) {
                var _b = _a[_i],
                    key = _b[0],
                    value = _b[1];
                log("".concat(key, ":"), value);
            }
            log("=== End Settings ===");
            outputChannel === null || outputChannel === void 0
                ? void 0
                : outputChannel.show(true);
        },
    );
    context.subscriptions.push(dumpSettingsCmd);
    // Command to log current hover target info
    var logHoverTargetCmd = vscode.commands.registerCommand(
        "timescope.logHoverTarget",
        function () {
            var editor = vscode.window.activeTextEditor;
            if (!editor) {
                log("No active editor");
                outputChannel.show(true);
                return;
            }
            var position = editor.selection.active;
            var lineText = editor.document.lineAt(position.line).text;
            log("=== Hover Target Info ===");
            log("File: ".concat(editor.document.fileName));
            log("Line ".concat(position.line, ': "').concat(lineText, '"'));
            log("Cursor at character: ".concat(position.character));
            log("Note: Use the built-in hover to see duration detection.");
            log(
                "For debugging, enable 'timescope.logHoverTarget' verbose logging.",
            );
            outputChannel.show(true);
        },
    );
    context.subscriptions.push(logHoverTargetCmd);
    log("TimeScope extension activated successfully");
}
function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}
