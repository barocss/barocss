---
work_id: D479
artifact_type: part-types-extraction
status: qualified
owner_role: executor
source_request: "Owner requested part-model.ts decomposition; type/document contracts first after D478"
last_updated: 2026-11-03
---

# D479 — Extract part type contracts without runtime changes

SMALL structural maintenance for rows08/16/30. `part-model.ts` is reduced from2245 to1520 lines; new `part-types.ts` has750 lines. Thirty-four existing exported type contracts move, with explicit type re-exports at the old path. No feature or geometry profile is added. [Qualification](qualification.json) records the two source hashes and key receipts. Parent is `a4c0d130f671813c5ba5d49b59abac129b767b94`, plus the two known candidate files during proof.

## Mechanical boundary

Document, feature, output, result, representation and three evaluation/profiling type contracts move with their definitions/comments retained. `Base` and `Placed` stay private. `Frame` is exported only from the new internal module for `import type`; it is absent from all old public re-exports. Package exports and index entry points are unchanged. Moving the profiling type contracts removes the direct foundational back-import; this does not move profiling state.

`CadPartError`, limits/constants, functions, admission, evaluation/cache, Boolean state, facet limits, profiling, helpers, `Tools` and `PartHelpers` remain in the runtime owner. The new module uses only type imports and emits no runtime imports or initializers. No B-rep core, runtime behavior, refusal, name, order, tolerance, schema, public API or UI change is intended or admitted.

## Compiler, contract and import proof

The original source is preserved outside Git: SHA`6d4d1d2e70b6c18b3e4b7f60eef3f537a7ea9b09002e6693f9def394e45a1571`. Under explicit Node22.19.0 and installed TypeScript5.9.3, the static proof checks41 type/interface contracts, all70 existing part-model export names and runtime import order. It compares emitted runtime JavaScript with comments/types erased. The actual package config is pinned: ES2022, NodeNext, package type:module, verbatimModuleSyntax unset/defaultfalse. A fresh full library build provides semantic/declaration checks; its actual emitted `dist/part/part-model.js` also matches the original canonical runtime output. Isolated transpilation alone is not presented as semantic proof.

Root runs nine checks successfully: static proof; full CAD library build; actual-dist equivalence;69 focused part/API/parameter/refusal tests; nine fresh-process family-first imports; targeted lint; diff check; StudioTSC; final ModelTSC. Family-first smoke initializes the existing gear, machine, finish, mesh, shell, band, sheet, face-fillet and frame modules before the model in separate processes, without geometry evaluation. No duplicate CAD type check follows the full semantic build. No broad kernel suite or new test fixture is required.

Commands and proof artifacts remain under `/tmp/barocss-d479-types01`. Root runs `node prove-types.mjs`, the full CAD `build:library`, `node verify-dist.mjs`, the selected existing tests and `node family-first-smoke.mjs` under its gate. Checks receipt SHA is `80ec538e364249dbafc1e55bca9b85950fba148b89398f522fc31f0e3c67ac8d`.

## Unchanged-document desktop smoke

Root runs `bash /tmp/barocss-d479-root/run-studio02.sh`: public Open of the exact full source-authored D478 prefix, own OPFS Save, then Close/same-context reload/Open. All three checkpoints pass with three fresh Python/Worker/SVG bindings: one native whole-document capture and two exact-document reuses. At each binding, all native outputs match the retained executed D478 prefix observations exactly. Maximum Worker relative-volume error is0; centroid absolute error is5.395614644290433e−16, not zero.

This prefix retains the known right-view16.5 hidden-dimension warning. It is not the completed D478 drawing. No public construction, Fix invocation, edit, producer or new geometry qualification is replayed. [D478's seven-checkpoint completed Fix proof](../shaft-drawing-fix-2026-11-03/README.md) remains separate.

Attempt01 is NOT_RUN_HARNESS_CONFIG_READINESS: the driver config omitted finalChecks and stopped before flow-helper/product/browser startup. Root corrects config only; driver code, product and tests stay unchanged. Its wrapper review is preserved. The successful attempt02 config SHA is `41ae8f9b55cf0e4d9098666c2095914d42624f8f83a8c4651c573b1735c7b9d7`; actual receipt SHA is `08cb8065999558fcb5f0869cb374b60e471ba1005714f262600962609090afe2`.

Root reviews three images. Wrapper2466/helper2468 pinned paths stay equal through cleanup/current. Owned namespace D479-types-run02 is removed and absent; context/browser/server close, PID22447 is absent and gate/freeze release. Errors, console errors, watched changes and downloads are0. Preview only; export, browser restart and mobile are NOT_RUN (mobile by owner rule). Sol Medium owns source/proof preparation; root owns all runtime, custody and visual review. No new High audit is needed for this type-only SMALL step; the unchanged native criteria are explicitly reused.

#534 remains an open epic with unmet breadth; no feature closure or new feature qualification follows. Core readiness stays NOT_MEASURED, legacy43% frozen, C1/C2 first-pass closeout and all owner HOLDs unchanged. **Next D480:** C3 inventory and controlled diagnosis of the parent31c ASME PDF golden failure. Do not blindly rewrite the golden. Transform/pattern and profile/detail extraction remain separate queued follow-ups, not completed work.
