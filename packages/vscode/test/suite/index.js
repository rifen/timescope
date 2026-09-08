"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
var path = require("path");
var Mocha = require("mocha");
var glob = require("glob");
function run(argv) {
    // Create the mocha test
    var mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 60000
    });
    var testsRoot = path.resolve(__dirname, '.');
    return new Promise(function (resolve, reject) {
        glob.glob('**/**.test.ts', { cwd: testsRoot }).then(function (files) {
            // Add files to mocha
            files.forEach(function (f) { return mocha.addFile(path.resolve(testsRoot, f)); });
            try {
                // Run the mocha test
                mocha.run(function (failures) {
                    if (failures > 0) {
                        reject(new Error("".concat(failures, " tests failed.")));
                    }
                    else {
                        resolve();
                    }
                });
            }
            catch (err) {
                reject(err);
            }
        }).catch(reject);
    });
}
