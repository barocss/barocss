# D336 independent source review

Result: no actionable finding in the approved six-consumer guard scope. Source inspected at base HEAD1fb2d11e9e4713bac3bfbc1131fc45302aa558f3 plus the direct.ts working change. Only direct.ts and its new focused test are product/test deltas; inherited .claude/ remains untracked. source-manifest.json hashes the inspected files. reviewed-diff.patch and source copies preserve this review boundary.

The reviewer did not edit production code, run tests/builds/geometry, open a browser, commit or push. A static git diff --check passed. The pre-fix probe and Model-owner receipts were read as external evidence; they are not reviewer runtime results.

## Guard completeness and ordering

- packages/barocss-cad-model/src/engine/direct.ts:79-96 adds private selection/guard helpers only. Surface id and geometry kind resolve through the existing DIRECT_PICK/DIRECT_SOURCE path before trim admission. requireWholeSurface refuses any defined non-array trim container and any nonempty array. Undefined and empty-array trims pass. It throws the caller-supplied existing code and gives explicit Untrim guidance. No trim is erased or mapped.
- direct.ts:148-154 guards Split and Region before usedIds/fresh output allocation, native split/extract calls and add(). direct.ts:161-163 does the same for Reverse. All use DIRECT_VALUE. Valid untrimmed axis/parameter calls still reach their prior native validators. A trimmed input can now refuse trim support before an invalid axis or interval reaches native validation; that is consistent with the guard-before-native scope and adds no separate public axis rule.
- direct.ts:232-247 keeps the preexisting Extend positive-distance check first. After surface selection it guards before surfaceDomain, sampling, evaluation, interpolation, output-source creation and add(). No distance policy was changed.
- direct.ts:373-377 resolves both selected ids/kinds in their original first-then-second order, then guards both operands with DIRECT_INTERSECT before surface-domain queries, patch construction and intersectPatches. Thus an invalid second pick retains DIRECT_PICK precedence even if the first valid surface has trims. The guard is independent of object visibility because these are explicit selected operands.
- direct.ts:528-539 retains the existing visible-object inventory, empty-export refusal and16-object cap. It resolves each visible object and guards every visible surface before exportIGES. A visible curve beside a trimmed visible surface cannot cause a partial export: the writer is called only after the full loop completes. Hidden trimmed surfaces are excluded before guard/geometry resolution. Curve-only or wholly untrimmed exports retain the original writer path.

Resolving a selected object's geometry can populate the existing compilation cache. No accepted DirectGeometry source/object collection is mutated by the new guard. The guarded producers do not reach add(), hide inputs, allocate new source/object ids or return replacement geometry after refusal.

## Existing permitted paths and contracts

- direct.ts:120-123 leaves explicit Untrim intact; it returns a copy of the selected object without trims. The guard does not require Untrim automatically or mutate the original object.
- direct.ts:107-109 and refinement call sites retain object spreading, including trim metadata, while changing the source. No blanket guard was added to knot insertion, degree elevation or pole editing.
- direct.ts:266-294 leaves affine transform/move/rotate/scale/stretch paths unchanged and spreads the object's existing metadata. No broader transform preservation claim was tested in this review.
- No public export, operation signature, refusal enum, schema, dependency, Kernel implementation, sampling rule or UV-mapping engine was changed. The helper code union uses the existing DIRECT_VALUE, DIRECT_INTERSECT and IGES_EXPORT codes from engine/refusal.ts.
- Whole-domain Region or another nominal no-op on a trimmed surface is still refused. This is consistent with guard-only scope: the unsupported consumer would otherwise emit a trim-free visible result even where the support operation appears geometrically redundant. Empty trims preserve normal whole-surface semantics.

## Studio refusal path

apps/cad-studio/src/ui/DirectPanel.tsx:27-29 calls op() inside try before onChange or its added-object selection callback. Its Reverse/Split/Region/Extend and surface intersection controls all use run. A synchronous Model guard therefore stops before commitDirect/selection/history mutation. src/ui/DirectInspector.tsx:20 already supplies a plain refusal notice.

apps/cad-studio/src/App.tsx:1977-1980 already calls directIGES inside the export try/catch. The guard throw occurs while evaluating the encode argument, before TextEncoder.encode or downloadBytes can run (the TextEncoder constructor may already have run). No Studio delta is needed for this synchronous refusal path. Browser no-download/no-pageerror/Undo/selection preservation is pending product evidence and is not claimed here.

## External evidence and proof limits

/tmp/d336-probe/report.md and results.json retain the six actual pre-fix Model consumer results: new visible outputs lost trims for four editing operations; actual IGES public reimport produced area1200 instead of the analytic kept material area1100; intersection crossed the removed10mm strip. The original hidden trimmed object remained stored after the four producers. This defect concerns the new visible material result, not permanent deletion of the original source object. Sampled original display area1100.0813802331686 is not an exact material certificate.

The Model owner's /tmp/d336-model/report.md and tests-focused.log report seven focused passing tests after malformed-container coverage, plus an earlier24-test related run. The focused test source checks deep-frozen refusal atomicity, inside/outside and public-projected trims, both intersection operands, mixed visible exports, hidden trimmed export exclusion, explicit Untrim/empty[] positives and pick/Extend-value ordering. These receipts were read and not rerun by this reviewer.

No claim is made that Studio thicken was executed or is allowed after these operations. Its UI result remains NOT_PROVEN. Existing asynchronous export ownership source observations remain outside D336; no stale-export reproduction or fix is claimed. Native file/Undo/product flows, broader suites and remote/release state remain outside this source-only review.
