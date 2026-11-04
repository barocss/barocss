---
work_id: D530
artifact_type: bounded-public-mass-provenance
status: done
owner_role: executor
last_updated: 2026-11-05
---

# D530 — Preserve the native mass method through both facades

Priority P0-R10, rows04/16. Parent `2bcf798ec29575e1abaa5415d3de7ac3b4bca548`. [Roadmap](../../roadmap.md) · [Qualification](qualification.json).

## Native source and public contract

Native MassProperties already reports closed-form, planar-exact, quadrature or tessellated, with an optional tessellation volume estimate. Model discarded the full method in its central massFields adapter; both public facades returned only four numeric fields. Original29 runtime checks have6 PASS/23 behavioral FAIL. The first two fixture checks establish original native method before asserting the facade. Three controlled CAD fallback checks were added later; original29 and final32 are different matrices.

The common MassResult now optionally reports method and volumeBasis. CAD forwards the actual native method and tessellated estimate. Model copies only provided producer metadata and detaches its basis record. New generated mass fields carry massMethod through eager/deferred results, mesh transport, placements and Studio patch types. Native field signatures include method, and validation admits only its four values. Existing private native-SI provenance remains separate; method metadata grants no new SI authority.

Legacy/custom Model bodies without method omit it. Pending/unavailable mass still refuses with MASS_UNKNOWN. Other native methods omit tessellated basis. Existing bound is a refinement-derived volume-error estimate in mm³, not a certified maximum or a centroid/inertia estimate. Missing estimate is null; zero remains zero. Density changes mass and inertia, never volume estimate or method. planar-exact concerns the represented planar/facet boundary, not an unavailable smooth source. No numerical formula, tolerance, B-rep operation, schema or message family changes.

This is an additive result-field change. Structural consumers can still construct the old four-field MassResult, but exact key/JSON comparisons now see method on generated results. The affected API expectations were updated while retaining numeric parity. Packed/version-crossing consumer and publication compatibility are not qualified by source tests or a fast JS build.

## Controlled and source qualification

Tier FULL. Implementation/test author and two independent final source reviewers use GPT-6.1 Sol Medium; both audits APPROVED and retained after the narrow test-only corrections. Existing native fixture methods are observed, not judged as new geometry accuracy claims.

PASS:95 selected Model checks, including27 corrected new provenance cases;3 unchanged passing CAD forced-provider cases;6 Studio patch/client cases, including2 new;22 CAD API regression cases. Unique controlled total126 =32 new+94 related,0 FAIL/0 skipped/cancelled. Model27 is rerun after its final lint/type-only edits. Documentation samples185 PASS separately. CAD/Studio types, scoped lint, syntax/diff and final Model types after the last mutation-runner edit pass. CAD API tests consume dist: current source is transpiled with the existing build:fast before their final pass. That is a fast JS build, not a declaration/library/packed release gate.

Methods are established from actual native box, imported STEP sphere quadrature and facet tetra planar-exact results before facade comparison. Eager/deferred fields, mesh round-trip, placement, density, omission, enum and signed-field tampering have finite controls. The Model tessellation case uses an actual kernel result with quadrature explicitly disabled. The three CAD fallback controls compile the real facade unchanged in an external test bundle and replace only its imported provider with actual forced kernel tessellation; null/zero estimate cases explicitly override metadata. These are controlled forwarding proofs, not organic public fallback incidence or new error bounds.

The external mutation runner executes32 positive baseline checks and11 variants, each completing all32 checks without cancellation. CAD method/basis, Model method/basis, producer drop/constant, deferred drop, signature omission, enum removal, density scaling and basis alias regressions are killed by6/3/7/5/8/3/4/3/5/2/3 ERR_ASSERTION failures. No compiler/load failure counts as a kill. Canonical targets, shadow source hashes and override traces remain external. Worktree sources are never rewritten by mutation runs; child test files run serially.

## Root actual Studio and boundaries

Root original repro02 runs the public20×10×10 Box/material/BOM/UndoRedo/native Save/fresh own Open flow, with5 independent Python literal-dimension/density/display-arithmetic checks. Original Worker transport omits method, while a separate same-Doc native producer lookup reports closed-form. This older driver's volume-selected rows establish a transport-omission witness and numeric regression only; they are not retrospectively qualified under the strengthened exact-input binding.

Fixed01 uses the corrected passive observer. It decodes cloned actual posted payloads through a separately bundled existing WireReceiver, evaluatedPart and evaluationKey. Initial and fresh-Open proof require the exact evaluated input/key, body key, request/native envelope epoch/id/revision/slot; deferred patches also join the pending body/ref. Volume comparison at the existing1e-8 mm³ display-oracle precision is secondary. A separate owned Node inspector reads original nativeMassPropertiesOfBody before cloning; it does not infer from the new field, name, geometry family or volume. Received method equals that original native closed-form method, with no tessellated basis. No handler, request, result, event, geometry or status is substituted.

Material-only stages are numeric consumer evidence, not a new method-transport claim. Aluminium6061 is5.4g and Steel(mild)15.7g; centroid10/5/5, central inertia and BOM quantity1/total pass the unchanged literal oracle at0.05g and0.5g·mm² display tolerances. Undo/Redo restores the exact Al/Steel Docs. Actual native Save then fresh own-file Open retains Steel, exact Doc and properties/BOM. Five independent display-arithmetic checks pass; they do not establish general B-rep accuracy. The GUI bypasses the public mass facade; direct native/facade checks qualify that separate boundary.

Fixed run:9 states/2 contexts,1029 source paths unchanged through cleanup,0 unknown page/console errors and0 worktree writes. One expected own native Save blob is downloaded; no external resource/dependency download occurs. All contexts, Chrome and Vite close. Root views original Steel03 and fixed Al01/SteelBOM04/freshOpen08 PNGs. Raw logs, bundles, native files, source overlays and images stay external.

FAIL retained:23 original assertions; initial actual repro01's exact volume===2000 filter missed2000.0000000000002 and failed the harness. It did not reveal a geometry error. The final driver uses exact input/source binding, not volume as authority. First fixed Model30 has29 PASS/1 overstrict native-versus-facade mass equality failure (5.421010862427522e-20g); the test now uses the existing literal volume*density/1000 formula, with unchanged other numeric equality and no EPS relaxation. First CAD22 has14 PASS/8 FAIL from stale generated dist; the fresh fast JS build resolves them. One test self-package import violates lint and is replaced by the relative public index. One assertion-induced bound literal narrowing fails Model types; an explicit public-type alias to the same returned object preserves the detachment mutation. All final selected checks pass.

NOT_RUN: organic tessellated-fallback incidence, native GUI quadrature/planar/tessellated/placed families (direct producer/controlled cases only), broad precision/performance/memory, fresh independent native geometry reader, declaration/packed/version-crossing consumer, whole kernel/whole Studio production build, CI/mobile/release/develop integration. Whole CAD/core remains NOT_MEASURED. R01–R10 have bounded closeouts; R04 native collision remains UNKNOWN. Related ENG epic remains open.

## Commands and next boundary

Node22.19.0; heavy runs serial under gate.sh acquire heavy60/release. Freeze every worktree writer for actual Studio. Use fresh external outputs; mutation evidence directory must exist outside the worktree.

```sh
TEST_CONCURRENCY=1 node packages/barocss-cad-model/scripts/test.mjs api-mass-provenance cad-mass-provenance
TEST_CONCURRENCY=1 node packages/barocss-cad-model/scripts/test.mjs api-mass-provenance api-density api-mmgs api-part api-verbs cylindrical-wrap volume-basis o18-deferred-mass native-mass-wire
# From apps/cad-studio
TEST_CONCURRENCY=1 node scripts/test.mjs mass-provenance native-mass-client
# From packages/barocss-cad; the first raw test attempt read old dist and is not the final result
node scripts/tool.mjs build:fast
node --test --test-concurrency=1 test/api-part.test.mjs test/api-verbs.test.mjs test/api-mmgs.test.mjs
# From the worktree root
pnpm --filter @barocss/cad run type-check
pnpm --filter @barocss/cad-studio-app run type-check
node apps/library-docs/samples/run.mjs
pnpm exec eslint packages/barocss-cad/src/api/core.ts packages/barocss-cad-model/src/api/core.ts packages/barocss-cad-model/src/engine/evaluate.ts packages/barocss-cad-model/src/engine/nativeMassWire.ts apps/cad-studio/src/app/bodyResults.ts apps/cad-studio/src/engine/engine.worker.ts packages/barocss-cad-model/test/api-mass-provenance.test.ts packages/barocss-cad-model/test/cad-mass-provenance.test.ts packages/barocss-cad-model/test/api-mass-provenance-types.ts apps/cad-studio/test/mass-provenance.test.ts
node packages/barocss-cad-model/scripts/test-mass-provenance-mutations.mjs /tmp/barocss-d530-mutations01
pnpm --filter @barocss/cad-model run type-check
node --check apps/cad-studio/test/mass-provenance-browser.mjs
node --check packages/barocss-cad-model/scripts/test-mass-provenance-mutations.mjs
# From apps/cad-studio, fixed final exact-binding driver
D530_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/mass-provenance-browser.mjs /tmp/barocss-d530-mass-fixed01 --expect=fixed
git diff --check
```

Next D531/P0-R11 starts by replaying the retained D406 box/assembly Docs with the original name/timestamp and comparing complete output bytes before reusing their historical independent readback. OCP/source/native executable were removed per owner request; no fresh reader or download is implied. Current source loss-report propagation then needs a coherent public channel, existing Studio preview and explicit unsupported CAD/backend behavior. If the exact reuse boundary cannot be qualified, retain the unknown and continue the next unheld item rather than inventing a fresh reader PASS.
