// Launch the extension in a real VS Code extension host and run the compiled
// integration suite. This is intentionally self-contained so contributors do
// not need a globally installed VS Code binary.
const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const { runTests } = require("@vscode/test-electron");

function compileTests() {
  const configPath = path.resolve(__dirname, "..", "tsconfig.test.json");
  const config = ts.readConfigFile(configPath, (fileName) =>
    fs.readFileSync(fileName, "utf8"),
  );
  if (config.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
    );

  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const emitResult = program.emit();
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);
  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics) {
      console.error(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      );
    }
    throw new Error("VS Code integration test compilation failed");
  }
}

async function main() {
  compileTests();
  await runTests({
    extensionDevelopmentPath: path.resolve(__dirname, ".."),
    extensionTestsPath: path.resolve(
      __dirname,
      "..",
      "dist",
      "test",
      "suite",
      "index.js",
    ),
    launchArgs: ["--disable-extensions"],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
