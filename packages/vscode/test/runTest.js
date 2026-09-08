// @ts-nocheck
const path = require("path");
const { execSync } = require("child_process");

function runCommand(args) {
  return execSync(args.join(" "), { stdio: "inherit" });
}

async function runTests() {
  try {
    // Compile test files using the tsconfig
    runCommand(["npx", "tsc", "-p", "./tsconfig.test.json"]);

    // Find compiled JS files
    const stdout = execSync('find dist/test -name "*.js" -type f', {
      encoding: "utf8",
    });
    const testFiles = stdout.split("\n").filter(Boolean);

    if (testFiles.length === 0) {
      console.error("No compiled test files found");
      return;
    }

    // Run mocha with compiled files
    const mochaArgs = [
      "npx",
      "mocha",
      ...testFiles.map((f) => path.relative(process.cwd(), f)),
      "--require",
      "source-map-support/register",
    ];
    runCommand(mochaArgs);
  } catch (e) {
    console.error("Tests failed:", e.message);
    process.exit(1);
  }
}

runTests().catch(console.error);
