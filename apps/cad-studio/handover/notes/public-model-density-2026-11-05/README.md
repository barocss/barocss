---
work_id: D526
artifact_type: bounded-public-contract-fix
status: done
owner_role: executor
last_updated: 2026-11-05
---

# D526 — Refuse invalid public Model density

Priority P0-R06, rows04/16. Parent `804f5d1b331851720067d8d45d2ccd2f799096ff`. [Roadmap](../../roadmap.md) · [Qualification](qualification.json).

## Original failure and correction

Declared @barocss/cad-model/api StudioPart.mass reaches Model massOf without density validation, while the existing CAD facade already refuses nonpositive or nonfinite density. The corrected original22-case public-entry run has14 PASS/8 FAIL: six Model public invalid values, direct-core invalid read/refusal checks and direct-core unknown-volume precedence. CAD refusals and positive controls pass. The first run's14 FAIL also includes six overly strict analytic centroid assertions on both facades (4.999999999999999 versus5); the existing1e-9 scalar oracle is applied componentwise, with no product number or tolerance change. Both logs remain.

The only product change copies CAD's existing positive-finite guard before Model bodyMass. Zero, negative zero, negative, NaN and both infinities refuse through the shared BarocssError, code DENSITY, where facade. Positive mass/volume/centroid/inertia, material defaults, MassResult fields, bodyMass and provenance remain unchanged. Public docs add the numeric density contract. Body selection/evaluation can fail before massOf; the direct-core invalid/unknown precedence test is not a public combined-invalid-input precedence policy.

## FULL verification

Implementation/test authoring GPT-6.1 Sol Medium. One independent contract-plan audit and two independent final source/test/mutation audits approve the bounded public API scope. Root runs all commands and actual Studio. No B-rep-core change justifies a blanket full-kernel campaign.

PASS:22 new plus7 related api-part/api-mmgs tests,29 unique current tests/0 FAIL/0 cancelled/0 skipped; Studio types; final Model types after the last test edit; driver/mutation syntax; diff. Direct behavior covers both declared public facades, six invalid values each, analytic MMGS at1/2.7/7.85, named/default material equivalence, Doc/body immutability, successful reads after refusal and valid-density MASS_UNKNOWN.

External mutation bundles override exactly the canonical Model core file through esbuild onLoad, never rewriting the worktree. The22-case baseline passes; remove-guard/finite-only/positive-only/allow-zero are killed with8/5/2/4 assertion failures. Each completes all22 tests with no cancellation, compile/load failure or second source override. Root separately confirms every failed mutant case is ERR_ASSERTION. Mutation baseline is not added to the unique test count. Temporary bundles are removed; requested logs remain external.

Read-only refusal documentation check passes. DENSITY is already a shared code; the scanner's BUILDERS omit facade refuse() calls, including the existing CAD call. This new call-site changes neither registry nor generated output. No unrelated regeneration is performed.

## Actual Studio consumer boundary

Root personally runs public Box20×10×10, Aluminium6061→Steel(mild), selected-body properties, root-fallback BOM, Undo/Redo, public Save and fresh own-file Open. Five independent Python checks use literal volume2000mm³ and catalog input densities2.7/7.85g/cm³. Mass5.4/15.7g, centre[10,5,5], central inertia[90,225,225]/[261.6667,654.1667,654.1667]g·mm² and BOM quantity1/total mass pass at explicit display rounding limits0.05g/0.5g·mm². The BOM has no material column; material is checked in the selected-body controls. Root views actual03/04/09 PNGs.

This Studio path calls bodyMass/BOM directly and bypasses the repaired public facade. It is a valid-consumer regression, not GUI invalid-density proof; invalid density is covered by the declared public-entry tests. Source-bundled entries are not installed/tarball consumer qualification. The293-path Studio/consumer capsule remains unchanged, page/console errors and worktree changes are zero. One own localbcad download is expected. Both contexts, Chrome and Vite close. Guard/test/mutation/docs source pins are separately recorded.

FAIL retained: original eight contract failures and first-run six analytic-oracle precision mistakes. All corrected/changed checks pass. No actual Studio failure occurs.

NOT_RUN: packed/emitted package, arbitrary density through catalog GUI (not reachable), overflow/new provenance/borrowed observation policy, broad native geometry accuracy, whole-kernel/production build, docs sample rerun (no snippets changed), CI, mobile, release or develop integration. Existing numeric authority/tolerances stay intact. Whole CAD/core remains NOT_MEASURED; broad engineering/API epics stay open. Next MAIN D527/P0-R07 isolates evaluation memo ownership per callback.

## Commands

Node22.19.0, serial gate.sh acquire heavy60 with release on exit. Run model tests from the model package or the explicit root path; all writers freeze for actual Studio. Mutation evidence directory must already exist outside the worktree; Studio output must be new.

```sh
# Original/corrected baseline and final public tests
TEST_CONCURRENCY=1 node packages/barocss-cad-model/scripts/test.mjs api-density
TEST_CONCURRENCY=1 node packages/barocss-cad-model/scripts/test.mjs api-density api-mmgs api-part
node packages/barocss-cad-model/scripts/test-api-density-mutations.mjs /tmp/barocss-d526-mutations01
node apps/library-docs/scripts/refusals.mjs --check
pnpm --filter @barocss/cad-studio-app run type-check
pnpm --filter @barocss/cad-model run type-check
node --check packages/barocss-cad-model/scripts/test-api-density-mutations.mjs
node --check apps/cad-studio/test/public-density-material-browser.mjs
D526_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node apps/cad-studio/test/public-density-material-browser.mjs /tmp/barocss-d526-studio-fixed01
git diff --check
```

qualification.json pins commands' logs, mutation receipts, reviewed screenshots, independent arithmetic outputs and saved Doc. Raw files stay outside Git. Custody hashes are separate from numerical correctness.
