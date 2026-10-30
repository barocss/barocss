# D300 exact winding draft: static review

Date: 2026-10-29. Reviewed `/tmp/barocss-wrap-component-winding-draft/cylindrical-wrap-chart-winding.ts` as read, lines1-210. The writer was still drafting tests. This review changed no source or draft and ran no build, TSC, test or probe. No agent was spawned.

## Result and dependency boundary

No concrete mathematical false-acceptance path was found in this source snapshot under the existing ChartContext guarantees. The exact root bracket, decreasing-slope branch, half-open count, constant-q boundary test, original-t receipt and context ownership are consistent. No definite TypeScript/interface error is apparent against the core/profile draft and root component wrapper, but compilation was not run.

The result remains an exact stored projected-chain upward-ray count. It does not itself prove closure, simplicity, component roles, carrier/native-UV binding, a physical B-rep, mass or native Number-evaluator accuracy. Its false guarantee flags preserve that boundary.

## Per-edge admission

Lines77-88 use the already owned per-edge strict derivative certificate. A strict slope profile also checks that the original endpoint slope order has the same sign. The height fallback compares `Y_i*X_0 == Y_0*X_i` for i=1..3, then checks strict height endpoint order. Since all X_i>0 and these are exact common-denominator integer controls, these identities imply `Y(t)=q*X(t)` for every t. Together with the existing strict L certificate, the fallback is an exact vertical projected segment with no stationary height.

A height-progress curve with nonconstant q refuses with `SUPPORT`. That is the declared first winding family; it is not evidence that such a curve self-intersects. No finite samples, endpoint-only q monotonicity inference, new tolerance or ideal carrier is used.

## Complete boundary exclusion before counting

Lines142-151 execute before any per-edge contribution:

* Both exact projected endpoint coordinates are tested against the query. This includes an endpoint later excluded by the maximum-exclusive rule.
* A constant-q edge first checks q equality, then the closed exact endpoint height interval. Continuity and strict height progress imply that every height in this interval lies on that projected segment, so refusal is correct.
* For a strict-q edge, an interior boundary query has q strictly inside its endpoint range. It therefore reaches the unique-root path. A valid exact height hull containing that boundary point cannot yield a strict above/below answer; an exact dyadic root gives equality/refusal, otherwise subdivision ultimately refuses unresolved. It is not accepted because depth ends.

Outside q ranges and maximum-q exclusions cannot hide any other boundary point because strict q progress makes the endpoint range exact and each q value unique. Ignoring constant-q edges only after the boundary pass is sound for the half-open vertical-ray convention, including a ray collinear with a vertical segment outside the query point's height range.

## Half-open rule and traversal direction

Lines186-190 compute the canonical minimum/maximum q using the certified canonical sign, independent of traversal sense. The selected range is precisely `minimum <= q0 < maximum`. Lines191-192 use canonical sign times sense to get the sign of oriented delta-q, then contribute `-sign(delta-q)` only for a root strictly above the query. This gives+1 for a counterclockwise closed ring in(q,z) axes and-1 for a clockwise one.

The maximum endpoint is excluded for either traversal direction, not merely canonical t=1. At a local q extremum, the two incident half-open contributions either both exclude the maximum or cancel at an included minimum when above the point. At a nonextremal shared vertex, exactly the appropriate one incident interval counts. Exact endpoint boundary queries were already refused. Reversed uses change traversal only; their canonical source and subdivision cache remain unchanged.

## Exact unique-root bracket and original parameter

`rootRelation` is called only after strict-q range selection. It first handles equality to either original canonical endpoint exactly, so the remaining q0 is strictly between the two endpoint values. This is the initial bracket invariant.

At each iteration, strict canonical progress remains true on the exact restricted node. A strict height-box lower bound above z0 or upper bound below z0 therefore classifies the unique q root in that node, even if the root is not explicitly solved. Positive X/W and exact common-scale half-controls justify both independent ratio hulls.

If the height hull overlaps z0, lines174-180 split exactly and compare q0 with the shared midpoint. Equality uses its exact height. Otherwise `comparison * profile.sign < 0 ? left : right` preserves the bracket:

* Increasing q: q0<qmid selects left, q0>qmid selects right.
* Decreasing q: q0>qmid selects left, q0<qmid selects right.

Traversal sense is correctly absent from this branch because subdivision remains in canonical original t. The discarded child has no q root by strict monotonicity, so no coverage branch is lost. Node identity, curve ordinal, depth and dyadic index are checked against both children. A geometry depth exhaustion is `UNRESOLVED`; any shared node/bit/operation/work exhaustion from the core remains `BUDGET`.

The midpoint receipt is correct. For a parent(depth=d,index=i), the left child is(depth=d+1,index=2i). `pointRelation(...,left,null,...)` records `(left.index+1)/2^left.depth = (2i+1)/2^(d+1)`, exactly the parent's original midpoint. The recorded interval is the left child, whose upper endpoint is that root. It is not the midpoint of the recorded left interval, and consumers should use the explicit root fraction rather than infer one from the method label. Original endpoint receipts use canonical0/1 with the root interval[0,1]. At depth<=8 all serialized interval numbers and root numerator/depth are exact binary64 integers/dyadics.

## Ownership and one ledger

`prepareChartWindingUse` calls the original ChartContext prototype's `requireCurve`, so a foreign graph or spoofed instance method cannot establish ownership. Per-context preparation/profile caches retain the same immutable chart and frozen use. Profile endpoints and all numerator/denominator records are frozen. Preparing both senses reuses the one exact profile.

World query creation uses ownSnapshot, finite bounded coordinates and positive world X, then the caller's existing q context for exact y/x and z. Vertex queries require the owning branded use and select canonical0/1, independent of its sense. Both factories brand frozen points in that same winding state; vertex endpoint caches are per chart. The state itself can only be created after the original core context check succeeds.

`certifyChartWinding` validates the whole plain dense use array by descriptors and ownership, and validates the point brand, before charging geometry work or reading point/use fields for calculation. Sparse, extra, accessor, copied or foreign-use graphs cannot become valid sources. A duplicated owned use can be counted twice by this standalone chain primitive; the root component wrapper separately refuses repeated use IDs and claims closure/simplicity only after all pair tests. The standalone result correctly keeps both of those flags false.

All exact cross-products and comparisons use shared charged core methods. World conversion uses only ctx.q and then checks the combined q+direct count. Subdivision/hulls use the same core node and box caches. Cached use/vertex lookups still charge their documented work; they do not reset counters or create another rational context. Text conversion charges work and serializes integers already bounded by8192 bits. The direct/rational ledger is the existing specified budget, not a count of all JavaScript instructions or descriptor-validation work.

## Receipts and remaining validation

The returned query fractions, root/interval records, heights, edge array, rational counts and meaning records are frozen. The cumulative context count is captured after query serialization and the final check. Summing successive query count snapshots would double-count earlier work; the component wrapper correctly uses the final family count instead.

`boundaryExcluded:true` is supported by the boundary and unique-root reasoning above. The false flags for loop closure/simplicity, component containment, source, carrier, solid, volume and global evaluator error remain appropriate. Negative Z, zero height, unequal weights and arbitrarily small positive X are handled algebraically within the existing integer/operation limits; this is not a promise that every such input fits the finite budget.

The writer's tests, integrated TSC, default/tight-budget runs, decreasing and reversed branch fixtures, exact midpoint/endpoint receipts, boundary/depth refusals and whole component tests remain NOT RUN by this review. No source fix is requested from this static reading.
