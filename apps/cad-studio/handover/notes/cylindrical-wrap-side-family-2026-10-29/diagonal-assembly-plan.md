# D301 original-UV line-polygon assembly: private plan

Date: 2026-10-29. Status: read-only design. Read the current assembly, D300 component, original source adapter, composition and carrier modules, and the existing assembly fixtures. No source edit, build, probe, test or benchmark was made; no agent was spawned. Root's running whole-Kernel matrix is separate evidence. D300's reported focused57/57 result is not acceptance of this proposed assembly change.

## Recommended first scope

Add a separate private line-polygon assembly entry point while preserving the existing rectilinear entry point and its receipts. Reuse common topology construction rather than copying the629-line implementation. The new entry admits explicitly supplied original-native-UV straight segments, with at least3 vertices per ring and at most32 total edges across all components and holes. It requires all original-UV polygon conditions and all D300 conditions on the actual stored base curves. It may refuse valid polygons when the sufficient stored Bernstein/cone/depth/budget tests do not resolve them.

Keep the original source family, original domains, height==actual radius, factor2 homothety, positive first-quadrant stored coefficients, exact-operation200000/work1048576/integer8192-bit limits, original binding budgets and diagnostic-only guarantee. Do not add nominal arclength coordinates, arbitrary height, font admission, a public index export, a document version or a compatibility conversion.

A minimal new ring input can be a plain-own `{ points: readonly UV[], interiorHint: Point }`, with one finite world candidate per ring; components contain one outer ring and holes. The hint is only for D300's individual-ring interior/orientation test, not material placement or carrier binding. Alternatively a private caller may supply the same hint bundle beside the existing UV-ring shape. Choose one new private contract explicitly; do not reinterpret existing component fields silently. Generating a candidate with the actual source evaluator is allowed only as a bounded hint search followed by exact D300 validation. A sampled centroid, original-UV label or font role is not proof of the stored projected role.

## Concrete current barriers and touchpoints

| Current source | Required narrow change |
| --- | --- |
| `assembly.ts:191 ringSnapshot` | Currently requires4 vertices, selects exactly one changing axis and refuses diagonals. Add new3..32 polygon admission with global32 accounting. Retain strict original-domain/cap margins. |
| `assembly.ts:181 apart`, `:187 ringsApart`, `:219 componentsSnapshot` | Axis-aligned interval gaps prove only a sufficient rectilinear clearance condition. Add charged exact closed-segment intersection/clearance and exact UV-role tests for diagonal polygons. AABB overlap cannot be treated as an actual intersection. |
| `assembly.ts:487 admittedBase` | Every nonhorizontal segment currently dispatches to verticalBase. Add an explicit third diagonal branch that fully composes the actual `source.quarter`. |
| `assembly.ts:278 guard` | Every nonhorizontal segment currently requires constant XY and unit weights. Do not remove those checks while retaining its old conclusion. New diagonal regularity must come from the actual D300 chart progress, plus exact side homothety. |
| `assembly.ts:506 buildRing` | Geometry, proof and topology are interleaved. Stage actual base/outer curves and endpoint table first, certify the complete family, then finalize side/face topology and receipts. |
| `chart-component.ts:107-109` | The current raw wrapper always allocates a context and prepares sources. Add a separate private prepared-component path for a caller-owned shared context; preserve the raw D300 wrapper's policy, arithmetic order and tests. |
| `assembly.ts:547 endpointOrder` | Useful endpoint/order checks may remain. They do not replace global diagonal pair/role proof. |
| `assembly.ts:568 protect` | Preserve permitted selected-face/shell appends only. Strengthen the new path's independent protected baseline or freeze original staged records so shared references cannot hide an accidental mutation. |

The original source path already provides the right family: `source.ts:161 sourceCore` compares every own field of the cached original B-rep with a same-source reconstruction used only for comparison; returns independent original data; selects the original forward positive-Y wall; and extracts U[0,.5] by direct-copy split. `buildCylindricalWrapUVSource:200` requests only the coefficient carrier certificate. Preserve native-source consistency=true and historical-producer provenance=false. Never replace returned coefficients with a reconstructed ideal circle.

## Actual original-UV contour admission

Own all input first. Validate exact fields, dense finite arrays, no repeated closing point, no zero-length segment, and3..32 vertices per ring. Count the total edges across every outer/hole/component before expensive work; require N<=32, so the total number of rings is at most10. A larger old rectilinear allowance is not an allowance for this new path.

Keep each point strictly within the **original** quarter U and V domains with the unchanged source metric and4*tolerance margin. Since the authored segments are linear in original UV and the permitted domain rectangle is convex, endpoint margins imply the whole segment remains interior. Do not remap the stored face UV domain to[0,1]. The original selected half-wall and the direct-copy quarter share these original U/V values even though their full surface knot vectors differ.

Use exact charged predicates for the actual line segments:

1. Adjacent segments may meet only at their prescribed endpoint. Reject collapse and collinear retrace/overlap. For a collinear triple, the dot product of the incoming and outgoing direction must be positive for straight continuation; zero/negative is not an accepted turn.
2. Every nonadjacent closed-segment pair must be disjoint, including endpoint contact and overlap. Compare exact orientation signs and exact on-segment ranges; refuse all contact, crossing, repeated nonadjacent vertices and unresolved narrow gaps. This is a polygon admission test, not an arrangement/Boolean operation that silently repairs a contour.
3. Compute signed area by exact shoelace. Preserve the existing normalization on a private copy, outer CCW and holes CW, before generating canonical curves. Record normalized UV rings distinctly from the caller's untouched original data. A zero-area ring refuses.
4. After full boundary separation, an exact winding test at one owned hole vertex proves the hole lies inside the outer. Hole pairs need zero winding in both directions to refuse nesting. Different components must have disjoint boundaries and mutually outside outer rings, preserving the existing refusal of nested/overlapping components, even when an inner component might otherwise fit inside a counter.

The existing `exactOrient2` call is exact but its internal BigInt arithmetic is outside assembly's exact-operation ledger; `orient` charges only one work unit. Do not use that unchanged wrapper to claim new fully metered diagonal predicates. Cache input dyadics and implement the small orientation/on-segment/area/winding operations through the request's charged rational/direct methods. Likewise, do not invoke the full planar Boolean arrangement: it has broader touching/repair semantics, its own unmetered arithmetic and rounded output conversion.

For native clearance, retain `apart` as an inexpensive sufficient fast path. Where diagonal AABBs overlap, use an exact fallback in metric-scaled UV. With the admitted positive lower metric factors mU,mV, original surface distances obey the same separate XY-chord and axial lower bounds already used by assembly. Use scaled coordinates `(mU*u,mV*v)` and exact squared point-to-segment distances. For endpoint P and segment A--B, let d=B-A, e=P-A and l=d dot d>0:

* e dot d<=0: distance squared=e dot e;
* e dot d>=l: use squared distance to B;
* otherwise: distance squared=cross(d,e)^2/l.

For disjoint planar segments the minimum is among the four endpoint-to-segment distances. Require it strictly greater than the unchanged margin squared; use exact comparisons, no square root or epsilon. This is a sufficient world-source clearance bound, not a claim of final side-surface clearance. The existing source minimum-edge condition can use `max(mU*abs(du),mV*abs(dv))>=1e-4` for a diagonal. Do not call that a proof that a rounded stored edge has length>=1e-4 without subtracting its binding errors or checking its actual endpoints separately.

## Source-to-stored binding and shared endpoints

For a diagonal, call `composeCylindricalWrapCurve(source.quarter,{start,end},...)` with the actual source snapshot, canonical IDs, unchanged `baseBudget=tolerance/16`, endpoint-table anchors, and the request's remaining exact-operation reservation. Import its actual count immediately. Do not use the zero-Z horizontal projection and then assign an affine Cartesian Z without a new global proof: for variable weights the homogeneous Z numerator and denominator must retain the composition relation.

The existing full composer already normalizes the original native U/V line exactly (`curve.ts:164`), builds exact degree3 homogeneous coefficients, rounds the stored Curve with supplied endpoints (`:192`), and bounds the degree6 homogeneous cross residual using positive ideal/stored denominator minima (`:237`). It returns a degree1 pcurve with the same original UV endpoints and canonical t direction. Its global stored-model residual applies to exactly the returned stored fields, not arbitrary later curves with the same ID.

Before accepting that authority, require:

* `composition.original` matches every field of the actual source quarter, including poles, weights, original knots, degrees and ID; sourceId alone is insufficient.
* The input line, returned pcurve endpoints/domain/weights and recorded UV endpoints agree exactly. Canonical pcurve direction stays the world Curve's direction; coedge sense is a separate traversal choice.
* The actual base edge installed in the staged B-rep has all the same Curve fields as the composed/admitted curve, including original stored weight bits. Do not re-round it after bounding.
* Shared corner endpoints are supplied **during** composition/binding, not patched afterward. The first edge may create nearest endpoints, subsequent edges anchor the prior corner, and the last edge anchors the first corner. `fillCorner` remains an exact bit equality check.

Keep the existing separately proved horizontal and vertical fast paths for those exact UV cases if needed for the finite budget. Their authorities remain distinct. A diagonal must not fall into verticalBase. If direct vertical/horizontal branches meet a diagonal anchor, their actual endpoints must agree exactly, and any anchor substitution must be included in that branch's residual proof. Reject a mismatch rather than repairing an already certified curve.

Initial diagonal edges should use the existing full composer without a new diagonal cache. Reusing a zero-Z U-interval template with a newly derived rational Z residual could be a later measured optimization, but is additional algebra/proof work. A budget refusal does not authorize that reuse, a looser tolerance, a raised cap or a skipped axis bound.

## Shared D300 family proof and source identity

The new assembly needs one prepared family, not one raw D300 wrapper call per component. Factor D300's preparation/certification boundary so the existing wrapper still creates its own fixed32 loop context, while the assembly can:

1. Stage every actual base curve, canonical use and matching pcurve once after UV normalization. For the simplest generation path, canonical t follows normalized ring traversal and uses are forward. If any cache supplies a reversed canonical curve, carry an explicit reversed sense and keep source storage unchanged.
2. Create one `createChartLoopContext({maxOperations:remaining})` for all components and all cross-component checks. Prepare each actual base curve once, with global<=32 roots and global256 subdivision nodes/depth8.
3. Run the existing per-component closure, adjacent-cone, nonadjacent-separation, orientation and hole-containment logic on already owned charts/uses. A new prepared-component capability must be immutable and context-branded, or revalidate all core/winding brands; a plain caller `certified:true` graph is not authority.
4. Test every cross-component base-curve pair by strict separation in that same context. Test outer representatives in both directions for winding0 to preserve the nonnested-component restriction. Per-component proof alone does not establish these cross relations.
5. Compare the final installed base Curve fields back to the D300-owned source snapshots before publication. IDs alone cannot connect a certificate to the B-rep. Return a bounded mapping from every edge/use to its projected certificate and source binding.

Do not pass the complete family chart map into an unchanged single-component unused-source check: each component uses only its own subset, while the host must separately prove every global source is used exactly once. Also distinguish local component edge counts from the shared context's cumulative global curve count. D300 standalone receipts remain unchanged; a new prepared path can expose a family count explicitly.

The per-piece regularity proof can consume the owned chart's strict K or L coefficients, sign and minimum rather than recomputing the old rectilinear guard. Its physical numerator scale is the integer minimum divided by `10*D^2`; record that scale correctly if converting to a SectionFraction. The constant-q fallback uses strict height progress. Do not reuse the old vertical authority to imply unit weights or constant Cartesian XY for a more general projected-height curve.

## Exact factor2 side transfer

For each installed base Curve B(t), require that its installed outer Curve has identical degree, original canonical knots and weight bits, and every Cartesian pole is exactly `(2*x,2*y,z)` by `Object.is`. Multiplication by2 must remain finite and inside native coordinate bounds. The side Surface must have degree(3,1), the same base t knots, radial knots[0,0,1,1], rows `[baseCP_i,outerCP_i]`, and both row weights exactly equal to the base weight. Check the actual constructed coefficients, not a caller homothety flag.

These identities imply the exact stored side is

`H(t,r)=((1+r)*Bx(t),(1+r)*By(t),Bz(t)), 0<=r<=1`.

On positive X, `psi(H)=(By/Bx,Bz)`, independent of r. A D300-injective projected edge gives one t for each side point; positive Bx then gives one r. Strict projected progress also makes the side Jacobian rank2. Strictly separated projected edges give disjoint sides, and the one-prescribed-endpoint relation gives precisely the shared radial edge when the actual world endpoint and radial range agree. The theorem transfers the whole proved base family, including diagonal edges; it does not rely on constant Z.

This certifies the newly constructed radial-side family only. It does not prove equality to the original carrier or the outer carrier's trim, nor absence of intersections with those retained faces. Keep the scope explicit in a new `projectedSideFamilyEmbedding` receipt rather than silently strengthening `solidQualified`.

## One aggregate200000-operation request ledger

Retain assembly's host `Context.remaining()/countHelpers()` model, with one monotone full-request total. A minimal safe phase schedule avoids a broad shared-rational refactor:

1. Import original carrier rational and direct counts/work exactly once. The current coefficient carrier has no arclength integer work, but include its direct-count field rather than assume it will always be zero.
2. Perform charged UV validation, endpoint/binding work and all sequential compositions. Each composer receives only the current remaining reservation and its actual count is imported before the next call.
3. After all base/outer geometry is staged, create the **one** chart-family context with the then-remaining operation budget. During this exclusive chart phase, run all components, cross-component relations, query conversions and receipt serialization there. Do not interleave unaccounted host arithmetic that would invalidate the fixed remaining reservation.
4. Import that chart context's final `totalOperations` exactly once, and its work/max-bits into the host receipt. Do not sum its cumulative per-component or winding snapshots. Then charge all later guard/transfer/topology work through the host and continue checking the same remaining total.

The acceptance invariant is

`host rational + host direct + source carrier exact + sum(actual composition exact) + one final chart-family exact <= 200000`.

The chart's total already includes its q and direct arithmetic. Its local512 pair-cell cap remains a per-pair limit inside one global context, not another operation allowance. Caps remain global<=32 curves,256 chart nodes, depth8,8192 bits and1048576 charged work; no reset per component or per pair is permitted. Check at every phase boundary and before publication; return no partial success on late refusal.

This is one aggregate exact-arithmetic ledger using existing bounded helper reservations. It is not a claim that all code shares one SectionRationalContext object or that every JavaScript/native source-reconstruction instruction is counted. If a literal single q instance is required later, carrier/composer internals need separate context-injection factoring. That larger refactor is not necessary to preserve the existing effective200000 request ceiling, and must not be implied to exist now. Work charges for newly used helper work must be included explicitly; composition has only an exact-operation receipt, so a documented conservative work charge can use that count rather than omit it.

The parent-reported current pair/component figures exclude source and composition. Do not quote them as full assembly totals. Some32-edge polygons may refuse well below the maximum edge count because composition dominates. No source-only design establishes that a real glyph, or even every small valid polygon, fits the unchanged budget.

## Topology, counter basal islands and original protection

Preserve the current construction rules, independent of ring edge directions:

* Normalized outer is CCW; holes are CW in original U/V. The original main wall receives reversed outer uses as an inner loop.
* The raised carrier face receives forward outer uses and forward hole uses, retaining outer/inner loop kinds.
* Every counter receives its own basal face on the **actual original selected surface**, original sense, with reversed CW hole uses as a CCW outer loop. Do not fill it with the raised surface or discard it because projected hole proof passed.
* Side surfaces keep their canonical rectangular(t,r) pcurves and use order forward base, forward end radial, reversed outer, reversed start radial. World/pcurve direction is canonical; coedge sense controls traversal.
* Every new edge has exactly two opposite coedge uses and mutual twins. Never rewrite an original coedge or twin. Preserve all IDs, names, senses, knots, poles, weights, pcurves and tolerances of original records, including the opposite half's nonideal stored middle weight.

For N edges, C components and H counters, the same independent incidence oracle must hold: added vertices2N, edges3N, facesN+C+H, loopsN+2(C+H), coedges6N. It is valid for triangles as well as rectangles. Retain strict checkBrep, one solid body/one closed shell and the diagnostic genus check, without treating those sampled checks as the global geometric proof.

The source helper already isolates the caller's Part/cache. Within the new builder, keep a separate protected original snapshot or freeze original staged records before construction. Existing array copies share record objects with the helper's source snapshot; comparing those aliases after an accidental mutation could miss it. Only append selected-face loops through a new face object and selected-shell faces through a new shell object. Final protection and binding comparison must precede returning the result. All failures discard staging and leave input Part, cached B-rep and UV data unchanged.

## Remaining blockers to physical qualification

1. Base composition gives a bounded stored-model residual, not exact equality of a cubic edge to the original rational surface along the native UV line. The outer clone inherits at most2 times that error. The unchanged tolerance/16 and tolerance/8 budgets must remain attached to the actual returned coefficients.
2. D300 side-family embedding does not prove retained original-wall or raised-trim face closure. A rounded base curve can be slightly inside or outside its original carrier. Even a globally injective radial side can therefore have an unproved near-carrier interaction. Original-UV simplicity and projected simplicity are both necessary evidence here, not an equality/homotopy/sewing theorem.
3. The global native evaluator error path remains unintegrated. The previous conditional evaluator-bound review is not a runtime certificate. Position, trim and checker tolerances need a complete composed budget before globalEvaluatorErrorCertified may change.
4. The moments helper certifies parameter-rectangle added-band moments only. It is not a general diagonal-polygon integration receipt or full represented B-rep mass. Ideal cylinder formulas must not replace the nonideal stored source. Source/retained/basal/raised/side trimmed surfaces still need a full mass authority, including signs and cancellation.
5. Strict checkBrep and correct incidence/genus do not settle those geometric and mass gaps. Keep diagnosticOnly=true; solidQualified, representedVolumeCertified, globalEvaluatorErrorCertified and generalTextSupported=false. No product/Model/Studio/font wiring follows from this private extension.

## Suggested bounded acceptance sequence, not executed

First implement/test a native UV diagonal triangle with three full compositions and explicit candidate hint, then a mixed horizontal/vertical/diagonal simple polygon, a diagonal counter with basal island, and two separated components. Use independent exact UV predicates, original stored tensor-product formulas and rational Bernstein oracles. Include both UV orientations with normalization, supplied endpoint closure, canonical/reversed use mapping, wrong source snapshot, altered post-proof weights, source records/tolerances protection, intersecting/touching/retracing UV lines, projected crossing despite a simple intended contour, nested/outside counter, cross-component nesting, candidate boundary/outside, depth/node/bit/global budget refusals and late failure immutability.

Reuse valid D300 receipts, but verify that raw D300 standalone pair/component behavior remains unchanged after factoring the prepared path. Measure the new full-request count including source/composition/D300. Only root should run the sequential build/focused/full checks under the normal heavy lane. This design establishes none of those runtime outcomes.
