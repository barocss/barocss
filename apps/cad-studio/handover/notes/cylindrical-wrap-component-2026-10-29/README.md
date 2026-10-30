# D300 private complete stored projected components — 2026-10-29

Runtime source: 225005fd57cccf90e788e460bc63d6e7b2562a04. This checkpoint adds complete private projected component certificates in
psi=(Y/X,Z/W). It proves stored projected cycles, all pair relations, orientation and hole containment for a
bounded admitted family. It does not add a native Part feature, public API, Model node or Studio command.

## Input, ownership and one family budget

Each input canonical Curve is admitted exactly once and used exactly once in exactly one ring. Every use has
explicit forward/reversed sense; source poles, knots and weights retain their original canonical ordering.
All cycle endpoints, including last-to-first, match with Object.is on the three world coordinates. Duplicate,
unused/unknown IDs, repeated uses and signed-zero closure mismatches refuse. Rings have at least3 edges;
a two-edge lens needs a different adjacent proof and is outside this family.

The ordinary ChartContext constructor still admits at most2 curves. A new private factory directly initializes
a fresh fixed32 family context. It never upgrades a released pair context or accepts a maxCurves/profile knob.
Both profiles retain200000 combined rational/direct operations,8192 bits,1048576 work,256 global nodes and
depth8. Caller maxOperations/maxDepth only tighten. Curve preparation, cached boxes/halves, every adjacent and
nonadjacent pair, exact candidate conversion and every winding query consume one family ledger. The final
family count is authoritative; intermediate query count snapshots are cumulative and must not be summed.
The ledger measures its defined bounded mathematical work, not every CPU instruction or allocation.

A winding edge has strict whole-span slope progress, or exact constant q=Y/X plus strict height progress.
The latter requires Yi*X0=Y0*Xi for every original homogeneous coefficient. A height-progress edge with
nonconstant q is explicitly unsupported here; no endpoint/sample inference makes it monotone in q.
Uses and query points are frozen and branded to the same context. A complete query validates all brands
before geometry work or getter access. World hints convert y/x,z exactly; vertex queries retain owned exact
homogeneous endpoint ratios and canonical endpoint indices even for reversed uses.

## Complete topology in the exact stored projection

For N curves, all N(N-1)/2 unordered pairs are checked. The N cyclic adjacent pairs use the existing exact
whole-interval endpoint cones, including sense-selected closing endpoints. Every other same-ring/cross-ring
pair uses strict complete original-parameter product separation. Counts must match exactly before success.
Individual injectivity, cyclic closure, exact-one-vertex adjacency and complete nonadjacent separation imply
Jordan rings with mutually disjoint boundaries. This is a projected topological proof, not native B-rep topology.
Closing-pair receipt names are aligned with the cone certificate's own curve order, including its endpoints.

Exact upward-ray winding uses min(q_start,q_end)<=q_query<max(q_start,q_end). A crossing strictly above the
query contributes minus the sign of the traversed delta-q. Sense reverses traversal once without changing
canonical subdivision. Every vertex is tested for boundary first, including the excluded maximum-q endpoint.
A constant-q edge tests its closed height interval for boundary before contributing0. Interior q roots have
unique exact monotone brackets; cached dyadic halves and strict height boxes classify above/below. Exact
midpoint/endpoint roots use exact heights. Equality or unresolved depth refuses UNRESOLVED; resource exhaustion
refuses BUDGET. A subdivision stop never turns boundary uncertainty into an interior or exterior point.

The outer ring must have winding+1 at its candidate interior hint; each hole must have winding-1 at its own.
Each hole's deterministic owned start vertex must have outer winding+1. Each pair of holes must have mutual
representative winding0. One vertex is sufficient only after the complete pair separation: a connected ring
cannot change complementary region without crossing the other Jordan boundary. This excludes outside and
nested holes without redundant all-vertex queries. Hints certify individual ring interior/orientation only;
an outer hint may lie inside a hole and is never called a material-interior witness.

The result freezes the owned input, complete pair/query receipts and final counts. Only projected loop
embedding and projected component containment flags become true. Source/carrier/native-UV trim binding,
physical B-rep/solid, represented volume, global native Number-evaluator error, general text support and a
combined source/composition/assembly/moment construction budget remain false.

## Verification and limits

Node22.19.0 first build, changed-source/test lint and focused57/57 pass (3124.599 ms), including the existing
error-code registry tests. Cases cover weighted reversed canonical storage, one/two holes, wrong orientation,
outside/nested/touching/crossing boundaries, bow tie, exact closure/IDs, boundary/exterior hints, late budget
failure, vertical/max-q boundary, local extrema, endpoint/midpoint/non-dyadic roots, decreasing/reversed roots,
height fallback restriction, foreign/getter graphs, tiny positive X and fixed pair/family limits. Conservative
contact/crossing refusal tests permit either unresolved geometry or a real budget refusal; they do not claim
an intersection-location algorithm. Independent static reviews found no concrete false acceptance within
their stated source scope. A closing-pair receipt order ambiguity was corrected before the first build.

Whole kernel2103 total/2097 pass/0 fail/6 existing skips passes (249990.372709 ms). Code-shape
check passes. Generated tools/refusals and unchanged API inventory six-rule SCOPED_PASS pass. Docs pass:
68 pages/53 shots/4488 KiB/852 labels. No source checksum test or widened production tolerance was added.

Selected actual receipts are in selected-receipts.json. Counts cover only that complete projected component
request; source admission/composition, assembly, moments and native evaluation are excluded.

* four-edge-outer: N4/rings1, pairs6, nodes4, operations7302 (q1206+direct6096).

* weighted-eight-edge-outer-plus-hole-with-reversed-storage: N8/rings2, pairs28, nodes8, operations15224 (q2608+direct12616).

* twelve-edge-outer-plus-two-sibling-holes: N12/rings3, pairs66, nodes12, operations23226 (q3720+direct19506).

* actual-original-native-R10-H30-diagonal-triangle: N3/rings1, pairs3, nodes5, operations8892 (q4424+direct4468).

Model/Studio and browser are NOT RUN for D300: there is no product wiring or changed public error type in
this checkpoint. The last fresh1824/1824 and365/365 plus types belong to D299 runtime901b4ce45. Source-only
private geometry checks do not extend prior product browser evidence. Performance benchmark is NOT RUN and
no speedup is claimed. No push, PR or release. Next D301 must bind complete original-native trims and errors,
prove the radial-side transfer/physical assembly and connect full source/added-band mass before product wiring.
General glyphs, arbitrary depths, seam crossing, engraving, tilted cylinders and general surfaces remain open.
The owner's07->08->09 order is unchanged.
