---
work_id: D532
artifact_type: repeatable-cad-api-smoke
status: qualified-bounded
last_updated: 2026-11-05
---

# D532 — Repeatable current-JS API smoke and command inventory

P0-R12, rows04/16/22/32. Parent `b722ae92f338b7da783f606fd3a6d7b5ca72550c`. [Roadmap](../../roadmap.md) · [Qualification](qualification.json).

The default CAD test command reads emitted JavaScript without rebuilding it. A named small current-source smoke was absent. This item adds test:api-smoke using the existing build:fast path before the three existing api-part/api-verbs/api-mmgs test files, serially. It preserves every existing default/build/type/packed/exchange/browser command and changes no test, product algorithm, schema or dependency. This is a tooling gap, not a newly observed geometry defect.

The CAD README and existing verification page explain the six library defaults (CAD, Model, React, interop, GPU, Viewer), Studio/docs separately, and optional browser/consumer/physical/manual checks. Viewer default is a CPU clipping contract; GPU default has current CAD/GPU dist prerequisites. The fast CAD build emits current JS but does not clear dist, check types or rebuild declarations. A smoke pass does not qualify old declarations, packed consumers, independent readers, native GPU or the whole suite. Other commands in the inventory are source descriptions, not new execution results. Historical T1/T2/T3 text is subordinate to the active SMALL/FEATURE/FULL policy; raw logs/images remain external.

## Selected validation

Tier SMALL; ordinary implementation and source inventory use GPT-6.1 Sol Medium. No independent FULL audit or mutation campaign is required for this private command wrapper and documentation. Node22.19.0, serial heavy gate, root-owned resources only.

PASS: the new documented command completes22 tests,0 failures/skips/cancellations after its own fast build. JSON and diff checks pass. D532 changes no TypeScript, test or browser helper, so D531's eligible affected type/lint results remain retained, not a fresh type/lint execution claim. No unrelated default or whole-kernel campaign is repeated.

Root separately runs the unchanged public-density-material-browser.mjs with its historical D526 label and current external D532 custody. Actual Studio creates a20×10×10mm Box, applies Aluminium6061 then mild Steel, verifies one-part BOM, first material Undo/Redo, own native Save and fresh-context Open. Five independent Python literal arithmetic checks pass at the existing display limits: Al5.4g, Steel15.7g, centroid10/5/5mm, volume2000mm³ and central inertia. These are displayed-value consumer comparisons, not a new native B-rep accuracy certificate. The GUI bypasses the public facade and smoke launcher.

The actual flow has9 snapshots/2 contexts,293 frozen source paths unchanged through cleanup,0 page/console errors,0 watched source changes and1 expected own-save download (no external download). Root views original Aluminium, Steel/BOM and fresh-open/BOM PNGs. Both owned contexts, browser and server close. No worktree writes occur during actual execution.

FAIL: none in this selected item. NOT_RUN: other inventory commands, new full/declaration/type builds, packed/version-crossing consumers, fresh native/physical reader, whole kernel/Studio build, CI/mobile/release/develop integration. OCP and historical native source/build remain removed; no download/install occurs.

## Commands and continuation

```sh
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
# All heavy execution is serial under gate.sh acquire heavy60/release.
pnpm --filter @barocss/cad test:api-smoke
# From apps/cad-studio, all writers frozen until cleanup:
D526_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/public-density-material-browser.mjs /tmp/barocss-d532-studio01
git diff --check
```

R01–R12 now have bounded D521–D532 closeouts. This does not erase R04's native-collision UNKNOWN or the other records' limits, implement CAD-native STEP reports or accept a whole product. B01–B10 remains NOT_ADJUDICATED and whole CAD/core remains NOT_MEASURED. Issue#541 remains open because its broader reliability, performance and packed-consumer requirements are not all satisfied.

Next D533/P1, rows07/08/12/16: qualify the missing Hole+Chamfer dependency lifecycle on an exact retained ordinary part, after Sol High fixes the native/independent numerical profile. Do not repeat D448's already-qualified bracket or D508's isolated Chamfer prefix as new breadth. Verify upstream finishing edit, Hole references/refusal/history, project persistence and a geometry-changing post-Open edit; reproduce before any fix. All existing HOLDs remain.
