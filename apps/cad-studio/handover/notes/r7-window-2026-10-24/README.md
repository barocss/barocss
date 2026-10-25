# R7.3b / R7.7b consumer preparation contract

Status: PREPARATION ONLY. Product integration is HOLD. This base is intentionally not a consumer-qualified product checkpoint.

The owner directly requested a fixed common base and scopes in Kernel chat on 2026-10-24. This contract combines adopted product code `af40fbbe87be51232c85c9a7be41a3c7c1d11c4e` with kernel `a9d777a7ebdd2e0fc09b2a11689182f41a0c95bc` in an isolated preparation worktree. It contains no P2 checkpoint and no other lane WIP. The product branch has not adopted the kernel.

## Fixed contracts

Read `field-map.json` and `ownership.json`. The contextual field map is derived from the preserved kernel survey, with final spring and mass/unit rules overriding its historical fields. A name-only edit is insufficient for mass, density and inertia. No aliases, schema branches, tolerance changes, WASM or new runtime dependencies are allowed.

For an explicit 10 x 10 x 10 mm box at [0,0,0] with density 2.7 g/cm^3, independently expect volume 1000 mm^3, mass 2.7 g, centroid [5,5,5] mm and centroidal inertia diagonal [45,45,45] g*mm^2, with zero off-diagonals. Preserve established comparison tolerances. Keep robot internal angle math in radians and public/document angles in degrees.

Replace output/snapshot methods with the kernel free functions: massPropertiesOf(output, density), checkOutput(output), exportStl(output, options), exportStep(output, options), reevaluate(snapshot, { parameters | document }), saveCadPart(snapshot), and the corresponding surface/flat-pattern functions. Do not invent names: read the actual exports at the pinned kernel.

## Preserve active work, then branch from this exact base

1. Keep the existing assigned worktree. Finish a safe bounded checkpoint or save interrupted source on its ORIGINAL branch as WIP ... NOT VERIFIED. Keep uncommitted evidence/logs/images outside Git. Do not reset, discard, rebase, amend or cherry-pick WIP into this preparation.
2. With a clean worktree, create the assigned codex/cad-r7-LANE-20261024 branch at the exact common-base SHA supplied by the coordinator. The original Claude branch remains recoverable. P2 code and its ancestry are excluded from the common base, regardless of its partial test results.
3. Edit only the assigned paths. Report new cross-owner dependencies and exact shared-file patches. The coordinator retains browser-flow.mjs; Outer receives the explicit App/chat/bench leases; Docs owns its generators and generated text in its preparation branch.
4. Build the local kernel in that worktree under Node 22 and the shared heavy gate before dependent checks; do not reuse another lane's dist. Do not run checks against a moving branch name.
5. Run focused owned tests, lint and independent MMGS checks. Keep first failures and exact SHAs. Whole-package checks can still fail on unconverted foreign consumers: identify those dependencies, do not edit their files or label the package green. Submit the immutable source-ready commit and scoped proof; its final qualification happens on the isolated assembled consumer aggregate.

## Qualification and product-adoption gates

The coordinator collects disjoint consumer deltas and checks them together in a separate preparation aggregate. All five required participants (Kernel, Outer, API, Docs, Drawings), plus any demonstrated GPU/shared consumer fix, must be reconciled. Whole model/Studio types, affected suites, docs samples and generated text, unit/value checks and necessary file/browser flows must pass on an immutable aggregate before product promotion.

Only then can the coordinator perform one serial product window with --no-ff checkpoints and mandatory docs checks. A failing intermediate check is retained and is not full acceptance. Never stop with the product branch promoted to the kernel alone. If serial intermediate heads cannot satisfy the contract, promote the already qualified aggregate as one no-ff product adoption instead of exposing an incomplete state.

Kernel limits remain explicit: source qualified with limits; suite 1727 PASS / 6 SKIP / 1 Node-version FAIL out of 1734; strict 869-case fingerprint differs in exactly three refusal field names (rootFilletRadiusMM, toolTipRadiusMM, heightMM lose suffixes); final RB NEW 0 with two old TODOs. Do not mark these as green or loosen a tolerance. No PG-3, new API cleanup, unrelated feature, live model, push, PR, publication or release follows from this preparation.
