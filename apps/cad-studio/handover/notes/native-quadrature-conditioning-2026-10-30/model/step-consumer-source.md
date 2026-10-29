# D344 Studio STEP consumer source map

Status: READ_ONLY_SOURCE_TRACE. No runtime, browser, build, or source edits were performed for this consumer trace. Benchmark candidate execution remains a separate root-controlled stage.

## Finding

The actual Studio Export STEP action uses raw native BRep mass integration for geometric validation metadata. It does not pass the upright mass result, displayed body mass, a nativeMassWire brand, density override, or provided mass to the STEP writer. D344 therefore changes this actual product consumer even when the upright Model/UI mass was already correct in D343.

## Exact action path

1. `apps/cad-studio/src/App.tsx:1510` constructs `useModelExports` with the evaluated document and current model state. `App.tsx:1990` binds the existing `Export STEP` tool button to `exportStepFile()`.
2. `apps/cad-studio/src/files/useModelExports.ts:43-51` selects the existing mesh option if required, then calls `engine.step({ ...evaluated, instances: doc.instances }, fileName, meshes)`. Exact native cylinder bodies require no mesh-choice dialog. On success, the text is downloaded as `<fileName>.step` with MIME `model/step`.
3. `apps/cad-studio/src/engine/client.ts:310-316` sends `{type:'step',id,doc:wire.pack(doc),name,meshes?}`. It sends a document and options, not BodyResult mass fields. `apps/cad-studio/src/engine/engine.worker.ts:15-16` calls `exportStudioStep(doc,{name,meshes?})`; the worker branch is at line 142-143. A thrown refusal becomes `{error:message}`.
4. `packages/barocss-cad-model/src/engine/evaluate.ts:480-499` collects actual `o.brep` from `snapshotOf(doc).outputs` and non-hidden placed instances. It excludes the existing infill-role bodies. It calls Kernel `exportStep(breps,{name,description:[...,sourceRevision],meshes?,timestamp?})`. There is no supplied mass option. The public facade `src/api/core.ts:41-42` uses this same function for `Part.step` through `stepOf`.
5. `packages/barocss-cad/src/io/step.ts:69-85` accepts BReps or an output and extracts only `.brep` from an output. The exact cylinder remains an exact BRep; mixed/faceted policies are unrelated to this fixture. `StepExportOptions` at lines 33-55 has no density or provided-mass field. `validationProperties` defaults on.
6. `step.ts:190-191` calls `writeValidationProperties(given,...)` unless explicitly disabled. `step.ts:204-213` reads `brepMassProperties(b,1)` for every solid, then `brepSurfaceArea(b)`, and `brepBounds(b)`. It sums native volume and volume-weighted centroid across the exported solids. Density is fixed at 1 only to obtain geometric volume/centroid; it does not write material mass. The mass and area calls can share the existing per-BRep quadrature cache. Whether cached or fresh, both use the same provider's integrals.
7. `step.ts:215-222` writes CAx-IF volume, area, centroid and bounding-box property representations. D344's wholePatch integration is reached through the curved native cylinder's `brepMassProperties` route in `src/brep/solid-mass.ts:121-130`.

The relevant file action is `useModelExports`, rather than a generic useFileActions hook. No new STEP implementation or App hook is needed.

## Why nativeMassWire does not override this path

`packages/barocss-cad-model/src/engine/nativeMassWire.ts` tracks private native SI inertia provenance beside BodyResult/worker mass packets. `rememberNativeMass` at lines 32-34 reads an already computed Kernel mass result. It does not change STEP options. The STEP worker request carries only the packed document and name/mesh options, and `exportStudioStep` pushes BReps only. Thus the private inertia brand cannot substitute the repaired D343 upright mass into STEP validation properties.

## Units and metadata readback

- Native geometry and STEP coordinates are millimetres. `step.ts:105` writes `SI_UNIT(.MILLI.,.METRE.)`; volume and area units derive powers 3 and 2 from that length unit at line 216. Values are mm³, mm² and mm coordinates.
- `step.ts:19-24` serializes finite numbers with JavaScript `String`, converting exponent syntax to STEP form. It does not round to a fixed decimal count. The two 4-ULP-separated cap levels can therefore remain distinct in the exported numeric text. This source observation is not yet a runtime roundtrip proof.
- `stepValidationProperties(source)` in `src/io/step-import.ts:630-657` reads the written PROPERTY_DEFINITION/REPRESENTATION values. It reads numeric metadata; it does not recompute it from imported geometry. The root index exports it with `importStep` and `compareValidationProperties` at `src/index.ts:663`.
- `compareValidationProperties` uses ordinary comparison policy, including a 1% volume criterion in existing tests. That policy is not tight enough to be the sole D344 tiny-body oracle. Compare explicit readback numbers against the independent represented-endpoint/circle references used by High, with approved tolerances; preserve each provider and method separately.
- The existing source test `packages/barocss-cad/test/step-validation.test.mjs:17-33` covers ordinary CAx-IF properties, units, metadata readback, imported geometry comparison, and `validationProperties:false`. Model existing exports have tests such as `test/r7-findings.test.ts`, `test/r4-caches.test.ts`, and `test/step-reference-units.test.ts`. These ordinary tests do not qualify the D344 4-ULP counterexample.

## Proposed minimal proof: not executed

### Node consumer

Use the immutable accepted D343 native fixture at `packages/barocss-cad/test/fixtures/native-quadrature-thin-cylinder.json` (High owns this fixture) or the actual accepted `.bcad` at `/tmp/d343-studio/run-03/captured-thin.bcad` through public `readStudioFile` and Model `exportStudioStep`. No geometry reconstruction is required for the fixture's Kernel path.

1. Kernel fixture: preserve exact input JSON, strict validity, one closed solid/shell, four native physical faces, all CP/weights/knots/names and normal levels. Call existing `exportStep` with a fixed timestamp and default validation. Read metadata via `stepValidationProperties`. Assert independent tiny volume and tangent symmetry plus normal centroid inside the exact actual interval. Assert corrected area only if High's separate area reference qualifies it. Observe the method from a separate native mass query. Check the document/fixture is unchanged. Preserve old-algorithm metadata failure as baseline.
2. Model consumer: read the accepted document, export it with `exportStudioStep` and fixed timestamp, and read metadata. Capture source revision, emitted units and unchanged document. The full D343 document includes a 420-mm³ witness. Its aggregated volume can round away the tiny target contribution, and its centroid is dominated by the witness. Aggregate metadata alone cannot discriminate the tiny target error. Add a target-only consumer document prepared through the public Model API from the exact accepted recipe, or remove the witness through the actual existing UI in the browser proof. Do not claim full-document aggregate equality proves the tiny component's metadata.
3. Native STEP readback: inspect `importStep` strict geometry, counts and names, bounds and cap levels separately from metadata. If the existing import path does not preserve this tiny geometry, preserve the failure and classify it as a separate readback limit. Do not relax the native interval assertion or replace it with float display bounds.
4. Ordinary control: same translated radius-3 native cylinder with ordinary height, default metadata and metadata disabled. No full Model86 rerun is justified merely by the already-correct upright UI path. Root can select relevant STEP and mass consumers after the candidate freezes.

### Actual Studio export

One Chrome, serial contexts, no authored document/selection hooks. Open the existing accepted native `.bcad` through the real file input. Existing readonly document/body observation can confirm exact accepted state. The browser does not need to repeat Offset or prove Float32 pixels resolve the tiny thickness.

Use the existing body selection and Delete action to remove the witness if root authorizes that isolated export step; retain the pre-delete document and Undo receipt. Alternatively generate a target-only `.bcad` through the public Model recipe API before the browser starts. Hidden body display alone is not a demonstrated export filter and must not be assumed to isolate a target. No private geometry injection is allowed.

Click the actual `Export STEP` button and capture one download. Read the downloaded STEP with the public metadata reader and compare the target-only validation volume/centroid to the approved independent reference. Preserve original units, exact native recipe, target names and interval. A fresh native `.bcad` open can be checked if needed; do not require new screenshots to prove the 4-ULP interval. Screenshots show UI presence/export action only. Record page/console/watch/download errors and close all owned contexts/browser/server. Source freeze and input caps must cover the actual export worker/Kernel graph.

This is a bounded STEP validation-metadata consumer proof. It does not qualify general STEP import fidelity, all export formats, all Boolean mass, or the unchanged upright UI mass.
