# D363 — Drawing fixtures and tolerance locating follow D331's own-feature rule (2026-10-30)

Defect: three cad-model tests failed since `ccbdf285e` (D331): `o7-legacy` test 3 (drawing-holes.bcad with the sample rows) and `tolerance` r14-tol-row-geometric / r14-tol-row-plus-minus, each with a new `HOLE_NOT_LOCATED`. D331's run (drawing248) did not include these two test files. Found by the refactor lane at `fa79c9969`; reproduced by the coordinator (14 pass / 3 fail).

Diagnosis (Opus sub-agent, read-only probes): D331 made the issue check locate a hole only through a dimension that depends on that hole's own feature (`issues.ts` `holeLocated`/`targetLocated` → `samePointDependency`). The three fixtures hold drawings saved before D331, where one dimension per coordinate stood for every hole on it. It is a real gap under D331, not a false positive (D331's own tests require this): hole-row n3 (M6 at 20,30) lacks X; drawing-holes n3 lacks X, n4 (Ø5.5 at 60,34) lacks X and Y, n5 (Ø9 at 90,34) lacks Y. `tolerance.ts` `locating` still matched by coordinate, so the Ø6.6 hole's own X location got the M6 value ±0.1 instead of ±0.21.

Repair (Sonnet sub-agent from a frozen brief; reviewed by the coordinator on Opus): `drawing/tolerance.ts` `locating` now uses `samePointDependency` with the issue check's location owner, plus the same counted-pitch row/pattern rule; a pitch circle's own centre is still placed by coordinate. Fixtures: r14 `tol-row-plus-minus` and `tol-row-geometric` regenerated with `UPDATE_R14_FIXTURES=1` (new own X 20 location for n3; tolerances `[0.1, 0.1, 0.21, 0.21]` → `[0.1, 0.1, 0.21, 0.21, 0.21]`; geometric basic 4 → 5); `tol-plate-geometric` and `tol-cross-hole-geometric` byte-identical. `o7-legacy/expected.json` edited by hand (the writer would overwrite every fixture without the sample rows): drawing-holes gains the `HOLE_NOT_LOCATED` issue, M6 and Ø9 suggestions count 1 location dimension each, the Ø5.5 suggestion disappears (it has no own location); the `.bcad` fixture is unchanged.

Checks after merging `origin/local/cad-dev` at `168c72a0b`:

```bash
cd packages/barocss-cad-model && node scripts/test.mjs o7-legacy tolerance drawing-independent-locations auto-dimension auto-layout drawing-issues drawing-standalone-frame-consumer
```

- cad-model affected 63/63 PASS; cad-model tsc PASS; eslint on `tolerance.ts` PASS (before merge).
- Actual Studio: D331's driver `apps/cad-studio/test/drawing-independent-location-browser.mjs` rerun once (WebGPU, one Chrome) PASS, errors 0, console errors 0, all contexts/browser/server closed ([receipt](studio-d331-rerun-receipt.json)). Root viewed the grid Auto-dimension image: 12 dimensions, 8 hole positions, 0 issues, tolerance "4× Ø6 THRU: ±0.07 on 8 location dimensions".
- NOT_RUN: full cad-model/Studio suites, remote CI. Screenshots are not committed (repository guard).
