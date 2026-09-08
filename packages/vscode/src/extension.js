"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
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
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel("TimeScope");
    }
    var message = args.map(function (arg) { return String(arg); }).join(" ");
    outputChannel.appendLine("[TimeScope] ".concat(message));
}
function activate(context) {
    var _this = this;
    outputChannel = vscode.window.createOutputChannel("TimeScope");
    log("Activating TimeScope extension");
    // Register hover provider for all languages (we filter in the provider)
    var selector = "*";
    var provider = new durationHover_js_1.DurationHoverProvider(function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        log.apply(void 0, __spreadArray([message], args, false));
    });
    var disposable = vscode.languages.registerHoverProvider(selector, provider);
    context.subscriptions.push(disposable);
    // Register a command to manually toggle (optional)
    var toggleCmd = vscode.commands.registerCommand("timescope.toggle", function () {
        var config = vscode.workspace.getConfiguration("timescope");
        var current = config.get("enabled", true);
        config.update("enabled", !current, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage("TimeScope ".concat(!current ? "enabled" : "disabled"));
    });
    context.subscriptions.push(toggleCmd);
    // Command to dump current settings to the TimeScope output channel
    var dumpSettingsCmd = vscode.commands.registerCommand("timescope.dumpSettings", function () {
        var settings = (0, settings_js_1.getSettings)();
        log("=== Current Settings ===");
        for (var _i = 0, _a = Object.entries(settings); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            log("".concat(key, ":"), value);
        }
        log("=== End Settings ===");
        outputChannel === null || outputChannel === void 0 ? void 0 : outputChannel.show(true);
    });
    context.subscriptions.push(dumpSettingsCmd);
    // Command to log current hover target info
    var logHoverTargetCmd = vscode.commands.registerCommand("timescope.logHoverTarget", function () { return __awaiter(_this, void 0, void 0, function () {
        var editor, position, lineText, provider;
        return __generator(this, function (_a) {
            editor = vscode.window.activeTextEditor;
            if (!editor) {
                log("No active editor");
                outputChannel === null || outputChannel === void 0 ? void 0 : outputChannel.show(true);
                return [2 /*return*/];
            }
            position = editor.selection.active;
            lineText = editor.document.lineAt(position.line).text;
            log("=== Hover Target Info ===");
            log("File: ".concat(editor.document.fileName));
            log("Line ".concat(position.line, ": \"").concat(lineText, "\""));
            log("Cursor at character: ".concat(position.character));
            provider = new durationHover_js_1.DurationHoverProvider(function (message) {
                var args = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                }
                log.apply(void 0, __spreadArray([message], args, false));
            });
            provider.provideHover(editor.document, position, {});
            log("=== End Hover Target ===");
            outputChannel === null || outputChannel === void 0 ? void 0 : outputChannel.show(true);
            return [2 /*return*/];
        });
    }); });
    context.subscriptions.push(logHoverTargetCmd);
    log("TimeScope extension activated successfully");
}
function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
        outputChannel = undefined;
    }
}
