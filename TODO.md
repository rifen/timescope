# TODO

Review findings: simplifications and bugs found during a code audit of `packages/`.
Items marked **[bug]** were empirically reproduced; **[cleanup]** items are dead/duplicated code.

---

## Bugs

### Core — `packages/core/src/detection/index.ts`

- **[bug] Unit-suffix regexes cause massive false positives (reproduced).**
  In `inferFromContext`, the suffix checks `(?:[A-Z]|_)ms$/i`, `(?:[A-Z]|_)us$/i`, `(?:[A-Z]|_)ns$/i`, `(?:[A-Z]|_)min(?:utes?)?$/i` use `/i`, so the `[A-Z]` alternative matches *any* letter — i.e. "any identifier ending in ms/us/ns/min". Verified results:
  - `const status = 200;` → **microseconds** @ 0.95
  - `let items = 5;` → **milliseconds** @ 0.95
  - `admin = 30` → **minutes** @ 0.95
  - `local lens = 3` → **nanoseconds** @ 0.95

  Fix: anchor to a real boundary — require start-of-token or `_` before the suffix, case-sensitively for the camelCase variant, e.g. `(?:^|_)ms$` or `[a-z]Ms$` (split into two case-sensitive alternatives). Add regression tests for `status`, `items`, `admin`, `lens`.

- **[bug] `scanCode()` never passes `language` to `detectDuration()`.**
  `LANGUAGE_KEYWORD_OVERRIDES` (time.sleep → seconds, Go `time.sleep` → ns, `setTimeout` → ms, etc.) is only reachable via the `language` parameter, which `scanCode` does not supply. All language-aware inference is dead code in the scan path; e.g. scanning Python `time.sleep(2)` falls through to the default `sleep` → milliseconds. Either thread a language through `scanCode` (from file extension) or delete the overrides table.

- **[bug] Unary minus is rejected even though the sanitizer allows it.**
  `detectDuration` accepts `/^[\d+\-*/().]+$/`, but `evaluateExpression`'s `parseFactor` has no unary-minus case, so `-5` and `2*-3` return `null` (reproduced). Either handle unary +/- in `parseFactor` or exclude `-` as a leading/unary char from the sanitizer regex.

- **[bug] Overbroad version-string skip in `scanCode`.**
  `if (token.includes(".") && /[v@]\d+\.\d+/.test(rawLine)) continue;` skips *every* decimal token on any line that merely mentions a version anywhere (e.g. a trailing comment `# requires v1.2.3` disables detection of `timeout = 1.5` on that line). Should test the version pattern against the token's immediate context, not the whole line.

- **[cleanup] Dead code in `extractExpressionStart`.**
  `const m = { 0: ... }; if (!m) break;` — `m` is an object literal, never falsy. Replace with a plain string and drop the check.

- **[cleanup] `settings.ignorePatterns`, `settings.keywords`, `settings.languageOverrides` are declared in `TimeScopeSettings`/`DEFAULT_SETTINGS` but never used.**
  Detection uses only hard-coded `COMPILED_IGNORE_PATTERNS` and hard-coded keyword tables. Honor the settings (compiling user regexes safely) or remove them from the public settings surface — currently they silently mislead users.

- **[cleanup] Hard-coded `_MINUTES` special case in `detectDuration`.**
  `lineIdentifier.endsWith("_MINUTES")` duplicates what `inferFromContext`'s `min` suffix check already does (and only for exact uppercase), and it runs even when `contextClues` is off, unlike every other context rule. Fold into `inferFromContext`.

### Core — `packages/core/src/formatting/index.ts`

- **[cleanup] `FormatOptions.showBreakdown` / `showUnitLabel` are accepted but never used.**
  Every caller (CLI, VS Code, nvim bridge) dutifully forwards them; `formatDuration` ignores both. Honor them or remove them from the type and all call sites.

### VS Code — `packages/vscode/`

- **[bug] Settings are read from the wrong configuration section (reproduced by inspection).**
  `src/config/settings.ts` calls `vscode.workspace.getConfiguration('timelens')`, but `package.json` contributes `timescope.*` and the `timescope.toggle` command writes `timescope.enabled`. Result: every user setting is ignored and defaults always apply. Change to `'timescope'`.

- **[bug] `timescope.toggle` appears to do nothing.**
  It flips `timescope.enabled`, but the hover provider reads the (mismatched) `timelens.enabled` — until the config-section bug above is fixed, toggling has no effect on hover behavior.

- **[bug] `timescope.logHoverTarget` leaks a second `DurationHoverProvider` + hover call with no throttling.**
  Every invocation constructs a fresh provider and runs a full hover; also every hover logs multi-line diagnostics unconditionally to the output channel (`hover request`, `extractCandidate`, …) — noisy for a production extension. Gate the verbose logging behind a debug setting.

- **[bug] `getWordRangeAtPosition` has contradictory dot handling (dead logic).**
  Loop conditions include `.` (`/[\w.$*]/`), but the inner `if (!/[\w$*]/.test(...)) break;` fires exactly when the char is `.`, so a word range can never actually cross a dot. The outer `.` inclusion is dead. Pick one behavior and delete the other.

- **[cleanup] `src/detection/detect.ts`, `src/formatting/format.ts`, `src/config/settings.ts` (interface) are stale parallel copies of core.**
  `src/detection/detect.ts` is imported only by a test (`test/detect.test.ts`); the extension itself uses `@rifen/timescope-core`. The local `format.ts` is a near-verbatim duplicate of core `formatting`. Port the detect test to core and delete the duplicates. Inside `detect.ts` there is also a double `inferFromContext` call (line 38 returns early, line 76 recomputes the identical result) — moot once the file is deleted.

- **[cleanup] `src/extension.ts` `log()` can recreate a disposed output channel.**
  `deactivate()` sets `outputChannel = undefined`, but the lazily-creating `log()` would silently spin up a new undisposed channel on any late call. Simplify: always create the channel in `activate` and let `context.subscriptions` own disposal.

### CLI — `packages/core/src/cli.ts`

- **[bug] Help text and examples say `timelens`, the binary is `timescope`** (6 occurrences). Copy-paste from the pre-rename era; confusing in `--help`.

- **[cleanup] `--unit=` accepts any string without validation.**
  `--unit=fortnight` is silently stored as `defaultUnit` and then ignored downstream. Validate against the allowed enum and error out.

- **[cleanup] Unreadable files are skipped silently in `scan`** (`catch (_) {}`). At minimum count and report skipped files in the summary line.

### Repo hygiene

- **[cleanup] Compiled `.js` artifacts are committed to git.**
  `git ls-files` shows `packages/core/*.js`, `packages/vscode/src/**/*.js`, `packages/vscode/test/**/*.js`, `packages/nvim/bin/timescope-bridge.js` etc. checked in alongside the `.ts` sources — guaranteed to go stale (e.g. `packages/vscode/src/extension.js` already diverges from `extension.ts`). Delete from the index and gitignore build output (except intentional `dist/` artifacts consumed by packaging, if any).

- **[cleanup] Stray files at repo root:** `tmp-0.1.5.vsix` (build artifact) and both `timescope-icon.jpg` / `timescope.jpeg` — remove or move to `extension/`.

- **[cleanup] `packages/nvim/lua/` contains both `timelens/` and `timescope/` trees** — same pre/post-rename duplication; confirm which is loaded by the plugin and delete the other.

- **[cleanup] `FileScanResult` in `packages/core/src/types/index.ts` is exported but never used** (ScanResult already has optional `filePath`).

---

## Round 2 audit findings

New simplifications and bugs found in a second pass (all **[bug]** items reproduced against `packages/core/dist`).

### Core — `packages/core/src/detection/index.ts`

- **[bug] Substring keyword matching causes false positives (reproduced).**
  `inferUnitFromKeyword` uses `word.includes(...)` instead of word-boundary matching, so any identifier *containing* a keyword matches:
  - `storage = 100` → **seconds** @ 0.75 ("age")
  - `threshold = 300` → **milliseconds** @ 0.75 ("hold")
  - `message = 5` / `package = 7` → **seconds** @ 0.75 ("age")
  - `separate = 3` → **milliseconds** @ 0.75 ("rate")
  - `usage = 200` → **seconds** @ 0.75 ("age")

  Fix: match whole tokens with boundaries (`\b(age|rate|hold|...)\b`) or exact token equality for the short keywords. Same family as the unit-suffix false positives above, but a separate code path (`inferUnitFromKeyword` vs `inferFromContext` suffix regexes) — both need fixing.

- **[bug] Context-clue path returns zero and negative durations (reproduced).**
  The context branch returns before the min/max range check, so:
  - `retry = 0` → **0 milliseconds** @ 0.85
  - `retry = 5 - 10` → **-5 milliseconds** @ 0.85

  Overriding min/max by design is fine, but zero/negative values are never meaningful durations. Clamp: reject `value <= 0` in the context path (also `formatDuration` renders any negative as `"<1ms"`, masking the bug). Add regression tests.

- **[cleanup] `detectDuration` and `evaluateExpression` sanitize/validate the same expression twice.**
  `detectDuration` does `token.trim().replace(/\s+/g, "")` + `/^[\d+\-*/().]+$/` test, then `evaluateExpression` repeats the exact same replace + test + length check. Pick one place (prefer `evaluateExpression`) and delete the duplicate.

- **[cleanup] `LANGUAGE_KEYWORD_OVERRIDES` is mostly empty tables.**
  `cpp`, `c`, `csharp`, `php` have only empty arrays; `javascript`/`typescript`/`java`/`ruby`/`python` each carry empty `seconds: []` / `milliseconds: []` filler. Delete the empty entries — only Go, Rust, and the JS `setTimeout` family actually add anything.

- **[cleanup] `scanCode` reports 1-based `column` (`match.index + 1`) while every VS Code API position (and the hover provider's ranges) is 0-based.**
  Not wrong per se (it's human-facing), but inconsistent for any consumer that maps a `DetectedItem.column` onto an editor `Position`. Pick a convention and document it on the type.

### Core — `packages/core/src/cli.ts`

- **[bug] `--min=` / `--max=` accept non-numeric values, and NaN silently disables the bound (reproduced).**
  `settings.minValue = Number(arg.split("=")[1])` — `--min=abc` yields `NaN`, and every comparison against NaN is false, so the min bound is simply skipped (`{ minValue: NaN }` lets `x = 100` through even when it should be filtered). Same treatment as the existing `--unit=` item: validate with `Number.isFinite` and error out.

### VS Code — `packages/vscode/`

- **[bug] A trailing `;` or `,` breaks every assignment hover (reproduced via core; untested — no test uses semicolons).**
  `extractCandidate`'s assignment regex captures the expression verbatim via `(.+)$`, so for `timeout = 30;` the token is `"30;"`. `stripComments` doesn't strip statement punctuation, `detectDuration("30;")` → `null` (sanitizer rejects `;`), and because the assignment branch returns unconditionally there is no word-range fallback — **no hover at all** on the most common JS/TS/C/Java syntax (`timeout = 60 * 60;` likewise). Fix: strip trailing `;`/`,` from the captured expression before detection (adjusting the range end). Add hover tests with semicolons.

- **[bug] Assignment fast-path misses `const`/`let`/`var` declarations (reproduced via regex).**
  The assignment regex `^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$` has no keyword prefix, so `const timeout = 30` never matches it. Hovering the variable name falls to the word-range path, where `findContainingExpression` expands into `"const timeout"` (no operator) → fallback word `"timeout"` → non-numeric → null: **no hover on the var name of any declaration** (works only for bare `timeout = 30`). Fix: allow an optional `(?:const|let|var|val|final)\s+` prefix and exclude it from the var range.

- **[cleanup] `fileTypes` setting is read by `getSettings()` but never applied.**
  The hover provider registers with selector `"*"` and never filters on `settings.fileTypes`. Honor it (re-register per pattern, or check `document.fileName`/`languageId` in `provideHover`) or drop it from the settings interface and `package.json` contributes.

- **[cleanup] `timescope.logHoverTarget` discards the hover result it computes.**
  It constructs a provider, calls `provider.provideHover(...)`, and throws the returned `Hover` away — only the provider's verbose internal logs appear. Fold into the existing `logHoverTarget` item: log the detection result (or explicitly note it's a dry-run), and gate the verbose logging.

---

## Suggested order

1. Config-section bug (`timelens` → `timescope`) — one-line fix, currently disables all user settings.
2. Unit-suffix false positives — wrong hovers shown to users today.
3. Thread `language` through `scanCode` or drop the overrides table.
4. Delete vscode-parallel duplicates (`detect.ts`, `format.ts`) and committed `.js` artifacts.
5. Round 2: assignment-hover bugs (trailing `;` + `const` declarations) — the most common syntax produces no hover today.
6. Round 2: substring keyword false positives (`storage`, `threshold`, `message`, …).
7. Remaining small cleanups (both rounds).
