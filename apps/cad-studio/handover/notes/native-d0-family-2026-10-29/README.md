# D303 one unchanged-native D0 family envelope — 2026-10-29

Runtime source: 4e8516b788e276cbf4a540555f7ae96667337b48. The private family entrypoint covers all admitted actual Curve/Surface
snapshots with one common native position-error envelope. It adds explicit original quadratic two-span
support while preserving D302's standalone policy, serialized results and mathematical work order.
No evaluator, Part/Model/API/Studio feature, original geometry or native tolerance is changed.

## Admission and monotone common envelope

A family has1..64 actual objects and at most512 stored poles. Every current own source field is copied and
validated. Each single-span source retains D302's family: curves degree1..3, tensors degreeU1..3 by V1,
exact span widths0.5/1 inside[-1,1], weights[0.5,1], coordinates within10000.

The added template is quadratic5-pole Curve or5x2 Surface with original knots[a,a,a,m,m,b,b,b], both exact
half widths m-a=b-m=0.5 and full domain[a,b]. Native basisInto selects three active U poles on either half;
the repeated middle knot selects the right span and the final endpoint the final span. All active fractions
still use exact half-width denominators and scale1. Source endpoints, negative-Y weight bits, original knot
order and all5/10 poles are preserved; the entire source contributes to the envelope and stored-pole cap.

The global minimum/maximum weight and maximum absolute source coordinate on each axis feed one worst
native degree3-by1/count8 bound. Every positive outward128 recurrence is monotone in basis degree, active
term count, maximum coordinate/weight and inverse minimum weight. This tensor bound dominates smaller
admitted tensors, single-basis curves and the3/6-active-term original quadratic half-wall branches. Constant
axes are conservatively false for the family: a locally constant active span never becomes an unjustified
full-source Object.is shortcut. Existing standalone exact constant-axis restoration remains unchanged.

Repeated native pcurve IDs are normal. The family preserves every original ID and never uses it as proof
identity, dedup key or rename target. Ordered curve/surface slots and their original per-kind index retain
independent complete snapshots, including different geometries with the same ID. A later consumer must
bind actual coedges to full source data/slots; ID-only or caller-certified flags do not establish binding.

World objects and pcurves may share the numeric envelope, but each error is in its own source coordinate
units. UV error needs exact carrier Lipschitz/range/clamp/residual accounting before addition to a world edge
tolerance. The family D0 certificate is not that coedge binding proof, native topology or mass.

## One work ledger and existing behavior

One200000 rational/direct operation,8192-bit and1048576-work context covers the whole request. Per-object
contexts are never reset. Family structure/string scanning has a separate conservative structuralWork
charge included in the same work cap, never mislabeled as exact/direct arithmetic. Standalone calls use
zero structuralWork and retain their earlier complete serialized counts. Input copy limits remain separate;
this ledger does not count every machine instruction, allocation or latency.

Unknown fields/getters, unsupported templates, object/pole/work/bit/operation limits and too-tight requested
error budgets refuse atomically. Requested budgets only tighten the existing native linear-floor1e-7.
Owned sources, ordered slot receipts, envelope and counts are deeply frozen and independent of caller data.

## Verification and exact boundary

Node22.19.0 first build/changed lint and focused29/29 pass (3356.215125 ms), including7 added family blocks,
D302's10 blocks, existing math and error registry tests. Independent exact piecewise Bernstein oracles cover
both quadratic half-spans, m-ulp/m/m+ulp, endpoints, whole-domain indexing and nonlocal constant axes. The
native fixture walks every actual edge Curve, every coedge pcurve and every face Surface of the existing
D298 one-pad B-rep. It preserves repeated IDs and original coefficients, validates slot coverage, and tests
64/512/work/tight global budgets, unsupported knots, no aliasing and serialization. The source review notes
that the fixture asserts its actual family count<=64; the external selected receipt records the exact count.

Five selected complete D302 standalone receipts/counts are equal to the preserved earlier-version runtime
baseline after the family addition. This external differential is stronger than the test's same-version
noninterference check, but still only selected result evidence, not all-input or speed equivalence. Independent
design and source reviews find no material false acceptance within the actual supported templates.

Whole kernel2126 total/2120 pass/0 fail/6 existing skips passes (246978.425 ms). Code-shape/
generated tools/refusals and unchanged six-rule API inventory SCOPED_PASS pass. Docs pass68 pages/53 shots/
4488 KiB/852 labels. The initial design's structural scan charge was corrected to work-only before first
build/lint/focused execution; no failed runtime result is hidden by that draft correction.

The native fixture has63 objects/214 stored poles,
with52 unique IDs preserved across all slots. Common L1<=3.438973512255934e-11 uses
57349 exact/direct operations and109361 work, including
9043 structural work. Earlier assembly costs67093 separately;
source/composition/assembly/side proof, coedge residual/range/Lipschitz and mass costs are excluded from this
D0 receipt. Complete inputs, slot metadata and exact bounds are in native-family-receipt.json.

The family bound is whole-domain D0 for the actual stored sources, not sampled native-shape acceptance.
Pcurve range/native coedge residual binding, derivative/normal accuracy, topology, a complete closed physical
reference, full source/added-band mass and combined construction budget remain unqualified. Model/Studio/
browser/performance are NOT RUN for D303; their last whole/types remain D299901b4ce45. No source checksum
test, runtime dependency, speedup, push, PR or release. Next D304 must consume this actual family bound in
all native coedge/vertex error ledgers, account for the actual checker clamp path and use each unchanged
entity tolerance, before closed-reference/mass/Part/Model/API/Studio wiring. Owner07->08->09 is unchanged.
