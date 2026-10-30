# Declared STEP length admission — #2240 (2026-10-29)

Source baseline: `800ff27f9ab65daec84fc7bf0ff11dd482a10b79`, with this scoped local change.
Runtime: Node22.19.0. Heavy checks used the existing local gate serially; all slots were released.

## Accepted-state contract

Any unsupported SI length prefix found by the existing file-level length-declaration matcher causes a typed
`NOT_READ` refusal. A supported SI or named conversion unit elsewhere cannot hide it. Supported SI factors,
no-prefix metres, named conversion precedence (including INCH/FOOT), and undeclared-millimetre fallback remain.
Angle units do not become length units. This is not a new representation-context resolver or general STEP parser.

Studio reads the unit once, immediately after `file.text()`. Refusal occurs before worker geometry/mesh reading,
repair admission, document replacement, file-name changes or dirty-state changes. The existing Open error handler
shows the refusal. Reference admission uses the same reader before evaluation or reference insertion. Original
STEP text is not rewritten; supported imports retain it alongside the existing scale operation.

## Changes

- `packages/barocss-cad-model/src/engine/stepUnits.ts`: validate all existing SI-length matches before selecting
  a supported unit; reuse the existing `NOT_READ` refusal code.
- `apps/cad-studio/src/App.tsx`: parse once at STEP Open entry and reuse the result in B-rep and AP242 mesh paths.
- Unit regression: all existing SI factors and both entity orders, FOOT, NANO/PICO/unknown refusal,
  mixed supported/unsupported declarations in both orders, and angle exclusion. Existing INCH/mm/metre/undeclared
  checks remain unchanged.
- Focused reference regression: unsupported declarations refuse before evaluator calls; failed add_reference
  preserves accepted document and bodies; actual mm/cm reference volume and source text survive the codec.

No kernel importer, scale algorithm, schema, runtime dependency, numeric cap or tolerance changed.

## Evidence and first failures

| Check | Result | Original log |
|---|---|---|
| New unit regression on unchanged production source | 4 total / 3 pass / 1 fail; exit1, `Missing expected exception.` | `baseline.log` |
| Scoped Model unit + reference files after production change | 6/6 pass, 0 fail/skip; exit0 | `after.log` |
| First Model types | exit2: new reference test accessed the STEP/mesh union without narrowing (`TS2339`) | `model-types-first-failure.log` |
| Final Model types, including new tests | exit0 | `model-types.log` |
| Studio types | exit0 | `studio-types.log` |
| Initial changed Model files lint | exit0 | `model-lint.log` |
| Final reference test + App lint | exit0 | `final-lint.log` |
| Reference test after the added union-narrowing assertion | 2/2 pass, 0 fail/skip; exit0 | `reference-final.log` |

The type repair added only `assert.ok('step' in ref.source)` before reading its STEP text. No expectation,
accepted-state assertion or production boundary was weakened. Empty type/lint logs are preserved; exit codes
above were captured by the calling shell.

Commands ran from `packages/barocss-cad-model`, with the Node22.19.0 directory prepended to PATH:

```sh
node scripts/test.mjs step-units
node scripts/test.mjs step-units step-reference-units
node ../../node_modules/typescript/bin/tsc --noEmit -p .
node ../../node_modules/typescript/bin/tsc --noEmit -p ../../apps/cad-studio
node ../../node_modules/eslint/bin/eslint.js src/engine/stepUnits.ts test/step-units.test.ts test/step-reference-units.test.ts
node ../../node_modules/eslint/bin/eslint.js test/step-reference-units.test.ts ../../apps/cad-studio/src/App.tsx
node scripts/test.mjs step-reference-units
```

## Limits

Actual Studio Open/accepted-state/Save-Open proof is pending the root's browser run. The Model reference tests are
not browser proof. Whole Model/Studio/Kernel suites, unrelated imports, general unit-context resolution,
unknown conversion-based units, performance, release and remote acceptance were not checked here.
Commit and push remain with the root.
