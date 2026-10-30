# D336 Model trim guards

Source frozen on base HEAD 1fb2d11e9e4713bac3bfbc1131fc45302aa558f3.

Changed only Model engine/direct.ts and new test/direct-trim-guards.test.ts. No Kernel, schema, dependency, tolerance, transform, native trim display, or trim projection changes. No commit/push.

Private guards refuse Reverse, Split, Extract region, Extend with DIRECT_VALUE; either selected intersection operand with DIRECT_INTERSECT; any visible trimmed surface in whole IGES export with IGES_EXPORT. Resolution preserves existing missing-id/kind codes. Extend positive-distance validation stays first. Hidden trimmed objects do not block IGES. Empty arrays and explicit Untrim retain existing operations. Non-array trim containers refuse at the same seam. No new public helper/API/code.

Exact direct input snapshots remain equal after every tested refusal. Deep frozen inputs cover authored inside/outside trim fixtures, actual public trimByCurve output (160 UV samples), malformed containers, and either intersection operand. Positive tests cover Reverse/Split/Region/Extend, intersection, actual public IGES reimport and exact support control points/domains, empty arrays and Untrim. Existing direct tests retain their existing geometry/curve/intersection checks. No exact sampled-mesh or general trim-preserving modeling claim.

Validation, exact Node /Users/user/Library/pnpm/nodejs/22.19.0/bin/node:

- First run direct-trim-guards + direct.test + direct-fill-exact: PASS 24/24, zero failures, skips, cancellations (tests-first.log).
- Added only malformed-container focused test; reran affected direct-trim-guards: PASS 7/7, zero failures, skips, cancellations (tests-focused.log).
- Model tsc --noEmit -p packages/barocss-cad-model: PASS exit0, no diagnostics (types-first.log).
- Scoped eslint direct.ts + direct-trim-guards.test.ts: PASS exit0, no diagnostics (lint-first.log).
- git diff --check: PASS.
- No first failing run occurred. All original validation logs retained verbatim.
- Heavy gate acquired for both sessions; EXIT released, final gate holder none.

Final SHA256:

a0c927e4e2af7d61f15f88d431c99f88e8d3882ea3563e95ee331a797b90f9ac  packages/barocss-cad-model/src/engine/direct.ts
10c483e5ff521ba2c04b2d1721c9f7d35d3c9f3344ae25f443f3f3880b328b7d  packages/barocss-cad-model/test/direct-trim-guards.test.ts

Browser/Studio refusal, undo/redo/selection/no-download, native Save/Open, witness solid mass/names, actual thicken UI, broad suites and remote/release status were not run by this owner. Root owns those checks and proof boundaries.
