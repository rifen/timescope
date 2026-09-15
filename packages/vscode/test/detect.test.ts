import * as assert from "assert";
import { suite, test } from "mocha";
import { detectDuration } from "@rifen/timescope-core";

suite("Detection Tests", () => {
  test("detectDuration: returns null for non-numeric tokens", () => {
    const result = detectDuration("hello", "hello", {});
    assert.strictEqual(result, null);
  });

  test("detectDuration: handles decimal numbers appropriately", () => {
    const result = detectDuration("3.14", "value = 3.14", {});
    assert.notStrictEqual(result, null);
  });

  test("detectDuration: respects minimum value", () => {
    const result = detectDuration("0", "value = 0", {});
    assert.strictEqual(result, null);
  });
});
