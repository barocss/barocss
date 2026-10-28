# D300 component wrapper static review

Date: 2026-10-29. Scope: read-only review of `/tmp/barocss-wrap-component-root-draft/cylindrical-wrap-chart-component.ts` and its `.test.mjs`. No repository or draft file was modified. No build, TSC, test, probe or benchmark was run. The package's actual `tsconfig.json` was read: ES2022, NodeNext, strict, declarations; no unchecked-index-access option is set.

## Result

No concrete false-acceptance path or definite TypeScript/interface defect was found in the wrapper snapshot reviewed. This is conditional on the agreed winding helper guarantees, especially branded immutable uses/points, exact constant-slope admission, boundary refusal, exact root-height classification, and use of the caller's context. The winding draft source did not yet exist at its announced path during this review; its owner confirmed the exact API contract by message. This review does not certify that unfinished implementation or claim that compilation passes.

The wrapper does not call the two-input pair wrapper and therefore does not reset the200000-operation ledger for each relation. Its success flags remain limited to the exact stored projected component; source/native-UV/B-rep/solid/mass/evaluator/general-text/combined-construction flags remain false.

## Dispatch, closure and ownership checks

* Lines108-114 make a plain-own snapshot, construct one loop context, and prepare each source once. A duplicate source ID refuses before returning a result. The second preparation can consume budget before detecting the duplicate; this is a refusal-order limitation, not false acceptance.
* Lines119-129 enforce one use per source across all rings and refuse unknown/repeated/unused sources. All prepared charts remain in the same context. The raw result snapshot is a separate owned copy from the copies prepared for proof; there is no subsequent mutation that can make them differ, and the returned raw snapshot is deeply frozen.
* Lines77-85 select canonical start/end0/1 from each use's sense and check all three stored world coordinates with `Object.is`, including the closing join. Endpoint weights need not match. No canonical curve is reversed or repaired by the wrapper.
* Lines90-98 correctly distinguish forward cyclic adjacency, reverse ordering of the same unordered adjacent pair, and nonadjacency. The last-to-first relation uses `previous`, so its cone receives last-end and first-start. Across different rings both adjacency predicates are false and strict separation is required.
* Lines131-136 enumerate every unordered pair exactly once. For rings of at least3 uses there are N adjacent relations, including all three relations of a triangle; the remaining N(N-1)/2-N pairs are disjoint relations. The explicit totals match this enumeration. The minimum3-use boundary excludes a two-edge lens, whose pair shares two endpoints and cannot use the current cone certificate.
* The ordering of `PairReceipt.first/second` is source enumeration order. For a closing adjacency, `certificate.curves` is the opposite order because the cone is called in traversal order. This is internally consistent because the certificate carries its own curve IDs/endpoints. A future consumer must not assume that endpoint indices refer to the outer receipt's first/second ordering. It is not a false-acceptance defect in this wrapper, which does not reinterpret the nested endpoints.

Individual projected progress plus exact closed cycles, adjacent-only-endpoint cone relations, and complete nonadjacent separation justify each ring's projected Jordan embedding. No pair success is promoted into a B-rep or native-trim claim.

## Ring roles and representative rule

Lines138-146 perform orientation queries only after complete pair separation. The outer hint must have winding+1 against its ring; a hole hint must have winding-1 against its own ring. Each hole's first sense-selected owned endpoint must have winding+1 against the outer. Each hole pair is tested in both directions for winding0, which excludes nesting in either input order.

One vertex is sufficient here: the queried ring is connected and its entire boundary has already been proved disjoint from the target Jordan boundary. Winding against that target is therefore constant over the queried ring. A missing cross-ring pair test would invalidate this reduction, but the complete enumeration above includes those pairs.

The outer hint may lie inside a hole. The declared `hintMeaning:'individual-ring-interior-and-orientation-only'` correctly avoids claiming a material-interior point. The dedicated test at lines60-63 exercises that distinction. The wrapper never queries a ring's own vertex against itself for containment, so it does not accidentally require a boundary point to be an interior witness.

## Winding interface compatibility

The winding owner confirmed:

* `ChartWindingUse` contains readonly `chart`, `sense`, and a private preparation classification, with a context brand.
* `prepareChartWindingUse(chart,sense,ctx)` accepts one prepared chart and creates that immutable branded use.
* Both `chartWindingPointFromWorld(world,ctx)` and `chartWindingPointFromVertex(use,canonicalEndpoint,ctx)` return the same `ChartWindingPoint` type.
* Vertex endpoint0/1 is canonical and independent of sense, matching the wrapper's explicit `start(use)` argument.
* `certifyChartWinding(readonlyUses,point,ctx)` returns `ChartWindingCertificate` with numeric `.winding` and a frozen serializable receipt; it does not certify loop closure or simplicity itself.

These names and data uses match imports, `PreparedRing`, `closure`, `ringWinding`, and both containment loops. The core draft's `createChartLoopContext` has the imported return/options contract. No definite strict-TypeScript error is apparent from the wrapper alone. Integration must include both draft dependencies before TSC; their absence from the still-frozen repository is expected at this stage.

## New test review and remaining evidence limits

The8 authored tests cover owned canonical data with mixed senses/weights, outer+hole and two sibling holes, outer-only hint meaning, wrong orientations, outside/nested holes in both orders, contact/crossing/bow-tie refusal, exact closure and signed-zero joins, source-use ownership, minimum ring size, boundary/exterior hints, unsupported options/getters, a tightened late budget, and a native composed diagonal triangle with binding flags false.

The synthetic rectangle helper's endpoint arithmetic is exact for the small integer endpoints used in these fixtures. Weighted collinear controls remain represented collinear curves, with positive monotone coordinate controls. Reversing canonical controls and weights together while setting reversed use preserves the intended traversal. The native triangle fixture supplies explicit shared endpoint anchors; actual composition/admission and its chosen interior hint remain unexecuted.

Material limits of the tests as written:

* Contact/crossing/bow-tie cases intentionally permit any typed refusal, including `BUDGET`. Their passing result proves refusal only, not which geometric check found contact.
* Nested/outside/orientation tests require `UNRESOLVED`, which is stronger than generic refusal. Their resource sufficiency is not established until executed.
* The late budget is based on the actual full-success count and tightens it by1, which is a meaningful aggregate-budget check. The test does not assert an exact failure message or a specific last phase, and should not be reported as such.
* Immutability is directly checked for the success input and several refusals, but the suite does not snapshot every individual malformed case. The wrapper's first snapshot and absence of input writes support the source-level atomicity conclusion; runtime coverage remains bounded.
* Winding's exact boundary/root edge cases belong to its separate tests; this wrapper suite is not a substitute for them. No general-font throughput,32-edge successful component, native trim closure, combined source/composition budget, physical B-rep, represented volume or global evaluator proof follows from these8 tests.

No requested source fix follows from this review. Preserve the narrow flags and execute the integrated focused matrix before recording runtime acceptance.
