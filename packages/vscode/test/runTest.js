// @ts-nocheck
const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Mocha = require("mocha");

function findTestFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      results.push(fullPath);
    }
  }

  return results;
}

function compileTypeScript(configPath) {
  const config = ts.readConfigFile(configPath, fs.readFileSync);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath)
  );

  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const emitResult = program.emit();

  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  allDiagnostics.forEach((diagnostic) => {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n"
      );
      console.error(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
      );
    } else {
      console.error(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      );
    }
  });

  return emitResult.emitSkipped === false;
}

async function runTests() {
  try {
    // Compile test files using TypeScript API (no shell)
    const testConfigPath = path.resolve(__dirname, "tsconfig.test.json");
    console.log("Compiling TypeScript tests...");
    const compileSuccess = compileTypeScript(testConfigPath);

    if (!compileSuccess) {
      console.error("TypeScript compilation failed");
      process.exit(1);
    }

    // Find compiled JS files
    const testFiles = findTestFiles(path.resolve(__dirname, "..", "dist", "test"));

    if (testFiles.length === 0) {
      console.error("No compiled test files found");
      process.exit(1);
    }

    // Run mocha programmatically
    const mocha = new Mocha({
      require: ["source-map-support/register"],
    });

    testFiles.forEach((file) => {
      mocha.addFile(file);
    });

    mocha.run((failures) => {
      process.exitCode = failures > 0 ? 1 : 0;
    });
  } catch (e) {
    console.error("Tests failed:", e.message);
    process.exit(1);
  }
}

runTests().catch(console.error);