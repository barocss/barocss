# D338 — Add an owned whole-surface Thicken recipe

D338 is BOUNDED_QUALIFIED at `0396200d313670aa711e50a5ba21f0d5008dc5db` (22files), based on published D337 `8c0710d7ab0cce6e09d4fb9c8c7379dba1f3d717`. [Qualification](qualification.json) records the final documentation and generated-check status. Whole08 remains open.

The shared `Part.thicken(surface,{t,side})` method creates one new body from an owned six-field `RawNurbsSurface` snapshot. KernelPart and StudioPart inherit it. The recipe contains degreeU, degreeV, knotsU, knotsV, controlPoints and weights. Plain dense own data is copied; extra fields, wrappers, trim metadata, accessors and foreign containers refuse. Existing validateSurface remains the geometry validator. A standalone raw recipe means whole support; it cannot recover direct trim context that a caller already discarded.

Only t binds to a dimension parameter. Side is normal/reverse/both; default normal is omitted. Normal follows du×dv, reverse uses its opposite, and both splits total thickness equally. The existing Core thicken algorithm, default40 sampling, fold checks and geometry limits remain unchanged. Curved results are faceted approximations. No exact curved-offset or trimmed-solid support is added.

The Model command accepts a raw snapshot context or one unique current selected Direct surface. Direct admission checks trims before compilation/copy and rejects malformed non-array trim containers. Model stores an existing thicken node with a copied surface and editable thickness/side. The source label is no live dependency. DirectInspector opens the existing App preview/Cancel/Apply path. A source-current Apply guard prevents accepting a stale command document. Selection clears only after successful commit. The actual flow below qualifies the bounded selected-source UI path.

The chat run_command tool has no direct-selection or raw-snapshot argument, so Thicken is excluded from CHAT_COMMANDS. Strict checked features.add raw nodes, public API and selected Direct UI remain available. No tool argument blob is added. Schema, package export-map keys and core-result checks remain unchanged.

## Checks so far

Kernel final new6 plus api-verbs16:22PASS. Earlier successful api-part5/api-parameters3/raw thicken1 plus fold-control1 are10 separate control passes. Build, lint and corrected declaration-consumer check pass. Model final new6PASS, related Model7PASS, Studio20PASS, both typechecks and lint pass. Root chat23PASS and Studio build PASS. High source review reports NO_REQUIRED_FINDINGS over32 listed inputs; reviewer runtime is NOT_RUN. Five existing geometry files are byte-identical to base in that capsule. Root agent-tools/refusals --check both pass. Final High snapshot32 inputs are unchanged. No full Kernel run is claimed.

API inventory candidate:12 added exports,0 removed,7 changed. The changed rows add the FeatureSpec case, inherited Part/KernelPart/StudioPart thicken method and optional Ctx.thickenSnapshot. No old member is removed. Metadata, export maps, schema and core-result checks are unchanged. The check is six-rule SCOPED_PASS; this does not accept the whole API. Root lint has0errors/1existing console warning.

## Names, errors and retained first failures

On this planar fixture, native B-rep has73 facet names; Model public selectors have6 display groups, including composite names joined with `+`. Existing exact native coplanarity and display merge policies explain the difference. Neither count is a universal family contract. No tolerance or grouping algorithm changed. Preserve native atoms and public groups separately through edits/file flows.

Kernel focused-first retains exact floating bounds/mass assertion failures and inferred fold mapping errors. Retry1 used unchanged tests after an edit at the wrong cwd. Later test-only fixes cover actual73 names, native category CAPABILITY versus facade OFFSET_FOLDS/details.kernelCode, parameter10001 FORMAT rather than PARAMETER, Location tuple API and stock Y fixture. The first declaration-consumer attempt used the wrong relative tsc launcher. Model first5PASS/1FAIL assumed native73 equals public6; retry1 guessed the wrong composite-name regex; repaired first-test1PASS and final whole-new6PASS follow. All first logs must remain. No production or tolerance repairs followed these test failures.

Initial bad surface/side/t maps VALUE. Unknown parameter is PARAMETER_UNKNOWN; invalid edited0/-1 is PARAMETER, while10001 fails earlier FORMAT. Native fold is OFFSET_FOLDS with category CAPABILITY. Kernel facade exposes OFFSET_FOLDS/where evaluate/details.kernelCode; Model uses its existing mapped OFFSET_FOLDS and details.friendly, without kernelCode/category. These are distinct adapter boundaries.

## Actual native flow

[Run-01](studio/run-01/receipt.json) is one clean first-invocation FULL_FLOW PASS: one Chrome WebGPU process,5 serial contexts,25 observational states and10 accepted public geometry reads. The25 states are not25 tests. No browser FAIL occurred. Two native Save/download/fresh Open recipes preserve accepted semantics; no raw-byte identity is claimed. Readonly native checkBrep confirms valid closed geometry.

Actual DirectPanel preview shows total mesh volume2820; subtracting witness420 gives plate2400, while accepted doc remains unchanged. Preview centroid was not proved. Accepted native plate mass is2400 at[30,9,4]. Actual literal Thickness3 gives3600/[30,9,4.5]; SideBoth gives3600/[30,9,3] withz bounds1.5..4.5. Cancel/retry/Apply, UndoRedo, reopened editable fields and source Move/delete preserve the owned accepted snapshot, bodies and public names.

Actual public160 trimmed context refuses. Quarter-cylinder radius10/wall12 fails preview, displays expanded Kernel detail OFFSET_FOLDS and disables Apply. Both refusal flows preserve accepted doc/selection/download/history; valid retry succeeds. Displayed diagnostic is browser evidence; structured native/facade code mappings remain focused-test evidence.

The public API seed has a wall parameter2 and a bound recipe. Save/fresh Open preserves it and reopens Thickness parameter wall/Side. The browser edits literal Thickness and side in the selected-source flow; it does not edit the named wall parameter's value. Named-parameter mutation is focused Model-test proof only. Actual Model6 composite public names are preserved. Browser native validity is separate from the native73 name set checked by Kernel/Model tests. Witnessb1/six names/420/[86,.5,3.5] stays stable. Errors, console errors and watched changes are0. All5contexts/browser/server close. Coordinator viewed02-preview.png,09-both.png and18-fold-refusal.png.

Initial source19 is a subset that matches frozen721. Frozen721 matches after browser and cleanup. This is not a721-input before-generation claim or full served-graph attestation. [Provenance](source-provenance.json) retains original/stored hashes; large bundles/HTML are deterministic gzip (`gzip -dc FILE.gz`). [Manifest](artifact-manifest.json) excludes only itself at the note root, retaining nested manifests. All first unit-test failures/retries, launcher errors and corrected expectation logs remain. The17MB duplicate API candidate is represented by its exact hash and actual delta/member-delta/check rather than another full copy.

Independent planar support40×30 atz3 with nonunit domains gives t2 volume2400; centroid z4/2/3 for normal/reverse/both. t3 both gives volume3600, bounds z1.5..4.5. Kernel mass tolerance1e-6 and centroid/bounds1e-7 remain separate; Model focused numeric checks use1e-7. The unrelated witness volume420/centroid[86,.5,3.5] proves only witness retention. Curved global mass/offset accuracy, generic trim/sew, full suites, performance, remoteCI/release and whole08 remain open. Continue remaining08 before09; Electron15 stays queued.

Original assertion/build logs contain trailing whitespace. The all-evidence diff whitespace check reports it; [raw output](root/raw-evidence-diff-check.log.gz) is preserved. Source and prose pass the scoped whitespace check excluding raw logs. This is not a geometry or product-test failure.
