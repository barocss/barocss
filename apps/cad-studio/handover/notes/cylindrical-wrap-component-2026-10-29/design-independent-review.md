# D300 projected component: independent design challenge

Status: read-only design review, 2026-10-29. This note reads `/tmp/barocss-wrap-loop-component-plan.md` and the current D299 chart/cone/separation/pair contracts. It does not review a completed D300 implementation. No repository file was edited and no build, test, feature probe or heavy command was run. D299 runtime/full-matrix results are Root's separate evidence.

## Conclusion

The proposed component theorem is sound with all the stated prerequisites enforced: exact owned cyclic incidence; every individual projected edge injective and regular; every unordered pair certified, using a one-endpoint cone only for authored same-ring adjacency; strict disjointness for every other pair; exact winding orientation and containment after those pair facts; and one context for the complete request. One deterministic owned hole vertex is sufficient for each containment direction after complete cross-ring separation. No all-vertices claim should be recorded when only representatives are queried.

No mathematical counterexample to this complete algorithm was found. The risks below are omitted-precondition or implementation-order failures that must be caught by tests. They do not justify relaxing a sufficient predicate or claiming that every valid component fits the resource limits.

## Why the topology follows

A ring must have at least three distinct uses, every source must have exactly one use, and every world end/start join including the closing join must be bit-identical under `Object.is`. Clamped rational endpoint positions are the stored Cartesian CPs even when endpoint weights differ. A sense changes traversal endpoint indices and winding contribution, not canonical source coefficients.

Each D299 owned chart has a strict nonzero K or L numerator, so it is individually projected-injective and regular. A cone proves two adjacent complete projected intervals meet only at their one prescribed endpoint. Strict separation includes endpoints for all nonadjacent and cross-ring pairs. Those conditions make every closed ring a Jordan curve and make different ring boundaries disjoint. Merely checking source IDs, pair counts, endpoint closure or finite samples would not establish these facts.

For N total distinct uses, dispatch each of N(N-1)/2 unordered pairs once. Rings of length at least three give exactly N adjacency relations, including one closing adjacency per ring. All remaining N(N-1)/2-N relations must be disjoint. For the closing pair, endpoint selection depends on incidence even when the unordered pair's source order is the opposite of traversal order. A two-edge lens shares two endpoints and is outside the current cone relation; reject it explicitly rather than reclassifying its one unordered pair twice.

## Winding sign and unique-root scope

Coordinates are ordered `(q,z)=(Y/X,Z/W)`. An upward ray uses `min(q_start,q_end) <= q0 < max(q_start,q_end)` and an above-query crossing contributes `-sign(q_end-q_start)`. This gives+1 for a counterclockwise rectangle and-1 for a clockwise rectangle. Reversed use changes that sign exactly once. Do not reverse both stored coefficients/cache direction and the use contribution.

This ray method requires strict q progress, or exact constant q with strict height progress. D299's general height fallback alone is insufficient. Example: X=W=1, Y controls[2,1,1,2], Z controls[0,1,2,3]. Then q=2-3t+3t^2 is nonmonotone while z=3t is strictly increasing. A query q=3/2 has two roots. It must refuse the D300 narrow family, even though D299 correctly admits the edge through height progress. Exact constant-q classification by all `Yi*X0 == Y0*Xi` is a sound identity test on the original controls; no numeric ratio or near-zero test is needed.

Boundary detection must precede half-open crossing accumulation. Otherwise maximum-q vertices and vertical edges can be silently treated as exterior. Check every exact vertex; for constant q at the query q, check its closed exact endpoint height interval. For nonconstant q, handle exact endpoint/midpoint roots by exact height. An unresolved interior root-height relation at depth8 must throw, never contribute zero. Restricting to the unique bracketing child is sound only after strict canonical q monotonicity has been established.

## Representative containment and nonnesting

After complete pair separation, a connected hole boundary is disjoint from the outer Jordan boundary. Its winding against the outer is constant on that connected boundary, so one deterministic owned vertex with outer winding+1 places the entire hole boundary inside the outer. Because the exterior of the outer is connected and unbounded, the bounded hole interior is also inside the bounded outer interior.

Two disjoint Jordan boundaries have either disjoint interiors or one interior nested in the other. For every pair of holes, query a representative vertex of B against A and a representative of A against B. Both must be0. One direction alone is insufficient: a large hole's vertex can be outside a small nested hole even though that small hole is inside the large one. Both input orders of a nested pair must be tested.

Own-hint winding+1 for the outer and-1 for each hole establishes their orientation and the hint's location inside its own ring. These do not alone establish the ring roles; the outer-containment and mutual-hole queries remain mandatory.

An outer hint may be inside a hole and still have outer winding+1. Label it an **outer-ring interior/orientation witness**, not a material-interior witness. If a material-interior claim is desired, additionally require winding0 against every hole. A hole vertex is a boundary representative, not a point in material. Neither label affects the basic projected containment theorem when the stated role queries all pass.

## Ownership and one request budget

The fixed32 family factory must create a fresh branded context with its own q ledger and private state. It must not upgrade or mutate a fixed2 pair context or accept a caller maxCurves/capability/profile switch. `Object.create(ChartContext.prototype)` does not execute class field initializers, so private initialization must explicitly install a new q, the fixed family limits, tightened maxOperations/maxDepth and private state before freezing. Existing pair counter behavior and third-curve refusal remain regression requirements.

Prepare sources once in deterministic source order. Validate unique IDs, exactly-once ring use and no unused sources before expensive pair work. New uses/query points must be immutable context-owned capabilities; a structurally equal copied point/use/chart or one from another context must refuse before geometry arithmetic. Exact hole representatives must come from owned H endpoints, not Number(Y/X) reconstruction. This matters for tiny positive X whose exact ratio may exceed finite Number range.

Every preparation, cone, separation, winding branch, comparison and graph/query loop uses the same ledger. A pair helper's cell limit512 can remain local only because its arithmetic and all node allocations remain in that same global ledger. Do not call the pair wrapper, which creates its own fixed2 context, from the component caller. Do not sum cumulative counts from nested helpers; report the final one context snapshot.

The family starts with N nodes and has at most256 globally. At N=32 only112 binary splits remain for every pair and ray query together. There are at most496 source pairs and at most9 holes under the minimum-three-use rule. Representative role queries total `h^2+h+1` including own hints, outer containment and both directions for each hole pair, at most91 when h=9. These are finite bounds, not promises that their exact operations fit200000.

Depth/uncertainty remains UNRESOLVED; operation/work/node/bit/payload exhaustion remains BUDGET. A late failure after successful pairs or earlier hole queries returns no component certificate and does not mutate caller input. Cached immutable nodes may reduce repeated computation, but their consumed counters do not reset. Keep detailed witnesses bounded and avoid redundant cumulative pair snapshots. Copy/serialization work is a separate bounded implementation resource, not an assertion that counts measure every CPU instruction.

## Independent adversarial cases to require

Use exact geometric or algebraic oracles, not source hashes or implementation-generated expected tables. Fixtures below are suggestions, not executed results. A valid fixture can still refuse BUDGET under fixed caps; that refusal must not be repaired by increasing caps or weakening predicates.

| Case | Independent expectation / bug detected |
| --- | --- |
| Outer rectangle q[1,10], z[0,9], X=W=1, counterclockwise | Interior winding+1; outside0. World poles `[1,q,z]` with edge increments divisible by3 give exact linear cubic geometry. Confirms the upward-ray sign. |
| CW hole q[4,7], z[3,6] inside that outer | Own hint winding-1 and hole representative outer winding+1. Reversing hole orientation must refuse even with perfect separation. |
| Two sibling holes and two nested holes, tested in both source/input orders | Siblings have both mutual winds0. Nested holes must fail one direction. Detects testing only one hole-pair direction. |
| A hole outside the outer; a hole enclosing the outer | All boundaries can be simple and mutually disjoint, and own hints can have the requested signs. Role containment must still refuse. |
| Outer hint inside a hole | Can pass outer-ring orientation. It must not become a material-interior witness without the extra hole-zero queries. |
| Canonical curve reversal plus use-sense flip; reversed ring order plus use-sense flip; one isolated use reversed | Reversing stored CP/weight order and flipping that use's sense preserves the oriented trace and winding. Reversing ring use order and flipping all senses instead reverses traversal, so winding changes sign and the original outer/hole role must refuse. One isolated use flip breaks incidence. Test the last-to-first cone endpoint pair explicitly; never silently rewrite canonical storage in the caller. |
| Duplicate/unused IDs, repeated use, one source in two rings, empty ring, two-edge lens, broken closing endpoint | Admission refuses; exact pair counts alone cannot substitute for unique ownership and incidence. |
| World join[1,4,z] versus[2,8,z], near-equal CPs, +0 versus-0 | Equal projection or numerical proximity never repairs a world endpoint. Object.is joins must refuse. |
| A bow tie, repeated nonadjacent vertex, cross-ring touch, coincident projected loops at different radii | Complete pair coverage must refuse before a winding hint can promote the shape. A selected lobe can otherwise have winding+1. |
| Nonconstant-q height fallback X=W=1,Y=[2,1,1,2],Z=[0,1,2,3] | Must refuse D300's unique-root family. Strict height does not imply one q root. |
| CCW triangle(1,0)->(7,0)->(4,6)->(1,0) in(q,z) | Upward rays below its min-q/max-q vertices have winding0; an exact vertex query must refuse even at the excluded max-q vertex. Tests half-open extrema and exact boundary precheck. |
| A query on a constant-q edge, at each closed endpoint height and strictly between them | Boundary refusal in every sense. Above/below the closed range contributes0. |
| Strict-q curve X=W=1,Y=[1,2,3,4],Z=[0,1,2,3], query(q,z)=(2,1) | The boundary parameter t=1/3 is not dyadic. The root-height enclosure cannot turn uncertainty at depth8 into zero contribution or exterior success. |
| X=W=1,Y=[1,2,4,7],Z=[0,1,2,3] | q=1+3t+3t^2. At q=3 the root has height strictly between1 and2 (check q(1/3)=7/3 and q(2/3)=13/3). Above/below decisions must use exact enclosures, not rounded cubic roots. At q=13/4, t=1/2 is an exact midpoint root. |
| Unequal adjacent weights in[.5,1], negative world Z and tiny positive X | Exact endpoint/projected ratios and sense are preserved. No ideal carrier, large finite Number quotient or rounded vertex query is substituted. |
| Early pair success followed by late containment uncertainty/resource failure | No partial component success. Inputs unchanged; final counts remain the same cumulative request, including all previous work. |
| Original fixed2 context curve3; factory curve33; smaller ops/depth; foreign uses/points/charts; shared global node exhaustion | Policy cannot be widened through the component factory, copied brands, per-pair contexts or repeated root-query caches. |

## Result boundary

Only `projectedLoopEmbeddingCertified` and `projectedComponentContainmentCertified` may become true after the full wrapper succeeds. Source/cylinder/native-UV binding, full radial-side homothety, original carrier closure, B-rep topology, physical solid, represented area/volume/mass, global floating-point evaluator error, general text and combined construction-budget qualification remain false. The abstract Jordan/winding proof must not be described as a physical wrapped solid or a material volume receipt.


## Follow-up: Root component draft inspection

Read-only draft snapshots:
- `/tmp/barocss-wrap-component-root-draft/cylindrical-wrap-chart-component.ts`: SHA-256 e717791bd4c2c974db1c7d0519934643d3ad0b01644290adefaca0ea7b0cea0f
- matching `.test.mjs`: SHA-256 2e6e383782b4c46f05041c7fa0e94dda632fc37f5f7f46f5f525938b88cc0e04

No concrete geometry/topology false acceptance was found in this draft. This is a static result, not a build or test result.

- Source preparation is once in input source order. Unique source IDs, one use per source, unknown references, unused sources, ring minimum length and exact sense-selected last-to-first closure are checked.
- The unordered pair loop covers every located use pair once. `next` and `previous` use cyclic positions only within the same ring. The closing pair correctly calls the cone with the actual predecessor's end and successor's start, even when this reverses the unordered iteration order. Cross-ring and nonadjacent pairs always call strict separation on the same context.
- Coverage counts require adjacent=N and disjoint=C(N,2)-N before any component certificate can return.
- Winding own hints is required to equal+1/-1. The result explicitly labels hints individual-ring-only, so an outer hint inside a hole is not promoted into material placement.
- A hole's first sense-selected owned vertex is queried against the outer. Every hole pair is queried in both directions. The winding helper draft documents endpoint indices as canonical0/1, so passing `start(use)` here is correct.
- The final one context count is authoritative. The wrapper calls prepared primitives, never the per-pair context-creating wrapper. A failure in a later query throws before `complete:true` is returned. The result freezes the owned copied input, pair array, winding array and counters; nonprojected qualifications remain false.

One receipt-order ambiguity should be fixed or documented: `pairProof`'s `previous` branch calls `certifyChartCone(second,first,...)`, but the outer PairReceipt still stores `first=first.id, second=second.id`. Thus `certificate.curves` can be reversed relative to its enclosing names. The proof is still about the correct unordered pair, so this is not a false embedding acceptance. However, a receipt consumer could associate endpoint indices or functional signs with the wrong outer name. Prefer aligning the outer names with `certificate.curves`, or explicitly name them an unordered source pair and always bind side-specific proof data through the certificate's own curve order.

The draft test definitions cover the main ownership/role/late-failure boundaries and a native diagonal triangle, but their expected success and failure have not been executed by this reviewer. The adversarial winding/root cases listed above remain suggestions for the dedicated winding test owner; a full component fixture need not duplicate every primitive oracle.


### Receipt ordering correction confirmed

A later read of the corrected Root component draft confirms that PairReceipt.first/second now use certificate.curves[0/1]. The closing-pair order ambiguity above is resolved in that later draft. No repository source was edited by this reviewer. The initializer/factory follow-up is recorded in `/tmp/barocss-wrap-component-core-review.md`.
