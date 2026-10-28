# D299 chart and nonadjacent separation: independent static review

Scope: read-only source review. No source edit, runtime probe, build, lint or test was run by this reviewer. Root's runtime run is separate and its result is not inferred here. The cone module is not independently reviewed by its own author in this note.

Snapshots:
- `packages/barocss-cad/src/features/cylindrical-wrap-chart.ts`: SHA-256 3a041d5e40a00628dbc1b3245fa98414e56f4b9fb08a67990896672e8e13e485
- `packages/barocss-cad/src/features/cylindrical-wrap-chart-separation.ts`: SHA-256 7c672380abcff81d033dc0cdc1eb542335170939edb7fcc6ccc25ff1695c3f91

## Result

No material mathematical false-acceptance defect was found in the reviewed chart/source, progress, exact subdivision, ratio hull or full product-cover paths. The one budget-enforcement timing qualification below concerns refused execution; it does not let an over-budget successful certificate return.

## Exact stored source and homogeneous scale

`sourceSnapshot` admits only an owned four-pole stored rational cubic on the original clamped[0,1] domain, with finite native-range poles, strict positive X/Y and weights in[0.5,1]. These are deliberately narrower conditions than an arbitrary native Curve. `ownSnapshot` rejects foreign prototypes/getters/sparse arrays and creates independent data before `freezeData` recursively freezes the complete owned source.

At chart.ts138–154, each stored cp coordinate and weight is separately read by q.from and multiplied by q.mul. There is no preliminary rounded Number(cp*weight). Every exact denominator is checked positive and power-of-two. The largest denominator therefore is a common positive multiple of all of them. Exact division D/d and charged integer multiplication n*(D/d) produce precisely D times the original homogeneous coordinate. This is one common D for all four axes of every pole, not row-dependent projective scaling.

The original source and its signed-zero bits remain in the frozen copied Curve. Integer zero represents the same exact mathematical coordinate; it is not used to claim bit identity of distinct authored endpoints.

## Progress/injectivity/regularity sign

At chart.ts156–178, cubic Bernstein controls multiplied by quadratic derivative controls use C3_i*C2_j*(10/C5_k). Every C5 divisor is1,5 or10, so this small Number factor is an exact integer. The resulting coefficients equal10*D^2 times A*B'-B*A'. For(A,B)=(X,Y), this is X*Y'-Y*X', the numerator of(Y/X)'. For(W,Z), it is W*Z'-Z*W', the numerator of(Z/W)'. There is no reversed height sign.

Strict same nonzero coefficient signs imply a strict derivative sign on the complete closed[0,1] interval by the Bernstein partition of unity. Positive X and W give positive derivative denominators. Thus one coordinate is strictly monotone, the projected edge is individually injective and its derivative is never zero. If neither coordinate has the sufficient strict sign proof, source admission refuses UNRESOLVED; pair boxes do not substitute for individual progress.

## Exact half subdivision and original parameter intervals

The sums triangle at chart.ts222–237 represents the ordinary de Casteljau level r multiplied by2^r. Left pole i is selected from level i and multiplied by2^(3-i), so every left pole has the same factor8. Right pole i is selected from level3-i/indexi and multiplied by2^i, so every right pole also has the same factor8. All four homogeneous axes receive the same factor. The increasing-parameter right child is not reversed.

Both children are exact restrictions of the original rational cubic, with original intervals[index/2^depth,(index+1)/2^depth]. Their indices2i/2i+1 and depth+1 preserve the original t chart. Positive X/W coefficients remain positive under sums and positive shifts. Depth is at most8, so serialized dyadic interval endpoint Numbers are exact; they are not sampled or rounded geometry.

The global node precheck reserves both children before subdivision. Nodes, rows, controls and returned child tuples are frozen and owned by the private context state. Per-node split caching can reuse the exact same restrictions but cannot manufacture a different interval or consume a fresh budget.

## Cubic ratio hulls

For positive X_i, Y(t)/X(t) is a positive convex combination of Y_i/X_i with weights B_i(t)*X_i/X(t). The analogous formula for Z/W uses positive W_i and remains valid for negative Z. Thus the independent ratio extrema at chart.ts203–215 enclose the entire projected interval, even though the two rectangle coordinates use different positive weights. This is conservative and does not require the same pole to attain both bounds.

Ratio comparisons use charged cross products with positive denominators. There is no Number division, approximate extremum or epsilon in approval. A large unreduced product may refuse BUDGET at8192 bits; it is not silently rounded into a successful comparison.

## Full product-domain cover and strict contact refusal

The separation starts with the two complete branded roots, explicitly rejects nonroot depth/index and self-pairs, and maintains pending cells over the original[0,1]^2 domain. A cell can be accepted only when one closed ratio-hull upper bound is strictly less than the opposite lower bound (separation.ts86–92).

Every unresolved cell is replaced by both exact children of one interval, each paired with the complete other interval. `children` checks depth, index and curve identity; no partial child or uncovered neighborhood is discarded. Closed child intervals overlap on the split boundary, which is conservative. Empty pending work plus leaves=splits+1 and visits=2*splits+1 is checked before returning complete:true. If witnesses are requested, all accepted leaves must be present; payload exhaustion throws rather than returning a truncated proof.

A common projected point belongs to both closed interval hulls of at least one remaining product cell. Such a cell cannot pass a strict upper<lower comparison. Exact endpoint contact, crossing or any unresolved touching therefore refuses at the depth/resource bound. A failed sufficient hull test does not assert actual intersection; UNRESOLVED remains the appropriate geometric uncertainty result.

## Ownership and resource gates

- Chart and node membership are private WeakMap-state brands, checked before node/curve consumption. Caller lookalikes, another context's graphs and arbitrary partial nodes cannot substitute for complete owned roots.
- Source copies, control rows, progress coefficient arrays, nodes, boxes, ratio records, split tuples, witnesses and result records are frozen. Box/split caches use immutable node identity and do not expose their mutable maps.
- The successful ledger combines the same q counts and charged direct operations. Integer results are guarded at8192 bits. There is no new q context per subdivision or per pair.
- The context can only tighten200000 operations and depth0..8. Curves<=2, globally cached nodes<=256, work<=1048576, pair visits<=512 and optional witness leaves<=256 are enforced.
- The precheck visits+pending+2 reserves enough remaining pair visits for both children of a binary replacement. If neither interval can split at the tightened depth, the result is UNRESOLVED. Pair/work/node/bit exhaustion remains BUDGET.

### Budget timing qualification

q operations are observed by `ctx.check` at explicit checkpoints or the next charged direct operation, rather than through a hook on every individual q call. For example, the fixed four-value homogeneous row at chart.ts141 can perform a bounded q chunk before line143 checks the aggregate q+direct ledger. A refused request can therefore execute a small bounded extra q chunk after its aggregate allowance is logically reached. q retains its own original hard limits, and no successful certificate can pass the subsequent aggregate check over its requested cap. This is not the former per-composer full-allowance reset or an accepted proof undercount.

If the documented cap is intended to be an immediate execution interrupt on every q operation, add an aggregate hook/check around each q primitive or describe the cap as enforced at these bounded checkpoints. This note makes no source change. Input own-data copying and private bounded proof-string serialization are also not a count of every JavaScript CPU instruction.

## Qualification boundary retained

These modules prove exact properties of two stored projected curves and their original normalized parameter intervals. They do not prove cylinder provenance, original carrier binding, native evaluator floating-point error, all-pair graph adjacency, whole-loop orientation/containment, trim closure, physical solid embedding or represented volume. The returned source/carrier/loop/solid/volume/global-evaluator flags remain false. A native gap/sliver policy also needs a separate world metric bound; strict disjointness in the dimensionless slope/world-Z chart is not such a clearance certificate.
