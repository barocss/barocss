---
work_id: D531
artifact_type: bounded-public-step-loss-channel
status: done
owner_role: executor
last_updated: 2026-11-05
---

# D531 — Expose the existing Model STEP report, refuse unsupported reporting

Priority P0-R11, rows04/13. Parent `8fdf94a3d0d3f5e686f762100e77d89948e87ed1`. [Roadmap](../../roadmap.md) · [Qualification](qualification.json).

## Contract and implementation

The Model string facade discarded exportStudioStep's existing source/loss report except its band-sheet refusal. The native CAD writer returns only text; it had no report to forward. Original19 checks have2 PASS/17 FAIL:16 missing-report API assertions and1 native-name fixture precondition error. The two passing controls are legacy string parity and constructor admission; the latter does not execute a report refusal.

Part.stepReport(name=this.name) is additive and returns detached {text,source,omitted?} through an optional PartBackend capability. Model forwards the actual existing exporter result. Its source is the document revision, not a native/mesh representation label or an output digest. Other reporting backends define their own provenance. Omission absence remains absence; the list is copied and never inferred or synthesized. The native CAD and third-party backends without reporting throw existing UNAVAILABLE rather than inventing omitted:[] or loss-free support. CAD-native report production remains unsupported, not implemented by this item.

Legacy step(name):string keeps the same all-body export/name semantics, including after body selection. Model routes both paths through one guarded existing export and keeps band-sheet, empty/invalid and other refusals. A report does not authorize a previously refused partial band-sheet export. No new loss scanner, writer option, timestamp API, error code, schema, geometry or tolerance is added. The public type is exported by both facades, with an optional backend field for structural compatibility.

## Current bytes and retained independent reader

Before implementation, the current existing exchange-profile producer recreates the exact saved D406 Docs and complete STEP bytes with name D404 box/assembly and timestamp2026-11-01T00:00:00. Box6523 bytes SHA-25617422b076f9c617e1297487e042943659cd8133c7102426dd362e4b385c66152; assembly14513 bytes SHA-2564103e2691d11938cf584aaafd778825dadd9ab9e14561e953b474d36f81dc9fa. Both equal the positive historical native-reader input pins.

After implementation, the new versioned public replay tool loads those exact retained Docs and calls current public Model.stepReport and legacy.step. A standard fixed UTC Date uses the writer's existing toISOString().slice(0,19) path; no file/header normalization occurs. Complete public text bytes equal the retained files, and the entire report equals the current direct exporter result. Original Docs, files and positive qualification remain unchanged. Bundled current source, own tool/lock and input hashes are captured through final cleanup.

This qualifies reuse of D406's historical independent readback only for those identical two inputs. Native OCCT8.0.1 recorded valid box1solid/6faces/12edges/8vertices, volume39999.99999999999 and bounds[0,0,0]–[80,50,10]; assembly3solids/18faces/36edges/24vertices, volume3000 and bounds[-20,0,0]–[100,90,5]. Load/transfer warning/failure counts are zero in the final positive cases. Original native-smoke's two load failures are excluded. Four explicit-set/empty ShapeProcess flags pass; not every built-in translator adjustment was disabled. Recorded maximum tolerance1e-7, bounds tolerance1e-6mm and volume tolerance1e-5mm³ retain their old scope.

No native reader runs now. OCP cache, approved source and native executable remain removed as requested; no download/install is made. Source hashes and identical bytes establish eligibility for the old physical result, not a new accuracy certificate. Current public files have that exact input binding; unrelated/new profiles do not inherit it.

## Verification and actual Studio

Tier FULL. Implementation/tests and two independent final source reviews use GPT-6.1 Sol Medium, both APPROVED. A reviewer separately approves the replay tool's input/claim boundary and the test-only typing correction.

PASS:19 new API cases plus32 related Model API/export/name/infill cases and22 CAD API legacy regressions,73 unique controlled tests/0 FAIL/0 skipped/cancelled. Native CAD dist is freshly transpiled using the existing build:fast before its22 cases. New cases cover actual report fields/source revision, history/parameters/appearance/PMI/datums/visible hierarchy/native names/infill/bbox/default mesh losses, selected-view all-body/name semantics, unchanged legacy text/band refusal, explicit unsupported backends, one export and detached/absent lists. Invalid-doc constructor admission remains a separate positive control. Docs samples185 PASS; CAD/Studio/final Model types, scoped lint, syntax and diff pass. Final Model tsc follows the last test edit.

External mutation baseline19 passes. Ten variants complete all19 cases without cancellation and are killed by8/10/10/1/2/2/1/12/1/1 ERR_ASSERTION failures: backend loss removal, wrong source, list removal/alias/absence, legacy return shape, band guard, name/body scope and duplicate export. No build/load failure counts as a kill; source overlays, hashes and traces remain external and never rewrite the worktree.

Root executes the existing step-export-preview-browser.mjs unchanged, with STEP_PREVIEW_REMAINING unset. Actual public assembly Preview lists feature history, flattened placements/hierarchy/shared definitions, labels, colours/materials, drawings/PMI and datums; Doc stays exact and the panel docks correctly. Cancel and Escape close preparation. Open invalidates prior prepared bytes. A closed tetrahedron selects tessellated/planar/auto representation and closes. New invalidates preparation. The full driver gives3 snapshots/1 desktop context,755 source paths unchanged through cleanup,0 page/console errors,0 worktree changes and0 downloads. Root views all three original PNGs; owned Chrome/context/Vite close.

This existing GUI calls the Worker exporter, not the new public facade. It is the current loss-preview consumer regression. API and exact public file proofs are separate. There is no actual GUI Export/Save or native read of the annotated/mesh fixture, and no forced delayed-Worker GUI timing test.

FAIL retained:16 original missing-API assertions and the original native-name fixture oracle. First fixed19 gives18 PASS/1 FAIL because import names are already prefixed n0.é, not é; the fixture now checks the existing namespace and retains its loss assertion. A Model type check finds an unreachable result.error access after assert.ok(result.ok); the same runtime assertion is retained with its diagnostic argument. Neither repair changes product geometry or tolerance. All final selected checks pass.

NOT_RUN: fresh independent reader, curved/offset/seam/AP242/general STEP acceptance, CAD-native loss-report producer, actual GUI download/Save or delayed timing injection, full library/declaration/packed/version-crossing consumer, whole kernel/Studio production build, CI/mobile/release/develop integration. Nonzero-cone/NURBS/fitter/public-thicken and other HOLDs persist. Whole CAD/core remains NOT_MEASURED. R01–R11 have bounded closeouts; R04 native collision stays UNKNOWN. Broader row04/13 report/format preservation remains open.

## Commands and next item

Node22.19.0. All heavy jobs run serially under gate.sh acquire heavy60/release; every worktree writer freezes during actual Studio. Use fresh external outputs and an existing external mutation evidence directory.

```sh
node apps/cad-studio/test/exchange-profile-producer.mjs /tmp/barocss-d531-replay01
# Compare Docs semantically and complete STEP bytes/hashes to retained positive D406 inputs; comparison.json pins this run.
node apps/cad-studio/test/step-report-native-replay.mjs /tmp/barocss-d531-public-replay01 /tmp/barocss-d406-forward-fixed
TEST_CONCURRENCY=1 node packages/barocss-cad-model/scripts/test.mjs api-step-report api-part api-verbs api-mmgs step-export step-native-name-loss step-infill
# From packages/barocss-cad
node scripts/tool.mjs build:fast
node --test --test-concurrency=1 test/api-part.test.mjs test/api-verbs.test.mjs test/api-mmgs.test.mjs
# From worktree root
pnpm --filter @barocss/cad run type-check
pnpm --filter @barocss/cad-studio-app run type-check
node apps/library-docs/samples/run.mjs
pnpm exec eslint packages/barocss-cad/src/api/part.ts packages/barocss-cad/src/api/index.ts packages/barocss-cad-model/src/api/core.ts packages/barocss-cad-model/src/api/studio.ts packages/barocss-cad-model/src/api/index.ts packages/barocss-cad-model/test/api-step-report.test.ts packages/barocss-cad-model/test/api-step-report-types.ts
pnpm --filter @barocss/cad-model run type-check
node packages/barocss-cad-model/scripts/test-step-report-mutations.mjs /tmp/barocss-d531-mutations01
node --check packages/barocss-cad-model/scripts/test-step-report-mutations.mjs
node --check apps/cad-studio/test/step-report-native-replay.mjs
# From apps/cad-studio; full first assembly prefix is mandatory for this recorded case matrix
STEP_EXPORT_PREVIEW_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/step-export-preview-browser.mjs /tmp/barocss-d531-studio-preview01 /tmp/barocss-d531-replay01
git diff --check
```

Next D532/P0-R12 adds a repeatable current-source CAD API smoke entry point and a precise default/optional/browser/oracle command inventory. It must rebuild current JS before the existing22-case smoke, not rely on stale dist or claim types/declarations/packed/native/WebGPU/full-suite acceptance. One representative command and root actual desktop consumer are required; no new CI/download/whole campaign follows.
