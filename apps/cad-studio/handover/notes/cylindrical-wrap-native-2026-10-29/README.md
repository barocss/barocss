# D298 private native cylindrical wrap diagnostics — 2026-10-29

Runtime source: `0edecf9d5e01ecd702fea493700b8a1554d14c66`. This checkpoint qualifies internal source,
rectilinear shell and moment helpers. It adds no native Part feature, Model node, public API or Studio command.
The returned shell keeps `solidQualified:false`, `representedVolumeCertified:false`,
`globalEvaluatorErrorCertified:false` and `generalTextSupported:false`.

## Source and coefficient authority

The source adapter admits one origin-centered native upright circular single slab, no holes, its two original
caps and complete cached B-rep. It compares all own fields, binary64 bits, array order, IDs, names, senses,
pcurves and tolerances against the existing native producer's reconstruction of that same source. The
reconstruction is for comparison; the original independently copied coefficients are returned. Radius labels
or a provenance string alone do not suffice. Historical producer authenticity is not certified.

The actual second half-arc has a shifted stored start/sweep, not two ideal Math.PI literals. Those parameters
are compared with the actual existing producer, never overwritten. The selected positive-Y carrier is unique;
both original halves may start at +X, and the negative-Y weight bit remains protected. Direct-copy splitting
retains the original quarter U=[0,0.5] and original V domain, poles, weights and Z levels.

`certifyCylindricalWrapCarrier` reports W/D/K/circle-defect/minimum/radial proofs only. It skips the inverse's
unused second/radial derivatives, length bounds, atan/pi work and nodes. `buildCylindricalWrapUVSource`
returns this `.carrier`, with no `.map`. It cannot satisfy a nominal-arclength inverse request. Full-map
admission/tolerance/budget remain separate: actual R100 at tolerance0.01 still refuses BUDGET. Seven selected
full-map success/refusal comparisons against739978a27 have identical complete receipts, including operation
counts. This is selected differential evidence, not all-input equivalence or a timing result.

## Rectilinear native-UV shell diagnostic

Input is explicit original native UV, strictly inside the first quarter and between caps. Rings are line-only
rectilinear, simple and separated. Counters must be strictly inside their component; touching, overlap,
nesting and a component inside another component/counter are refused. The admitted lower native-to-world
metric protects gaps with the original tolerance. Height must equal the source radius: XY uses exact factor2,
Z remains unchanged. This is not a general depth, a nominal font chart or general text support.

Horizontal XY composition is cached per U interval on an exact XY projection with Z=0. That degenerate
calculation Surface is never substituted for a source or output carrier. Exact affine Z and its one-rounding
error are supplied separately. V-independent original XY/weights justify the transfer. Vertical edges use
constant XY and a uniform-weight affine-Z cubic, with a Cartesian Bernstein residual. The outer curve is an
exact XY factor2 copy with binding bound at most2 times the base bound. Base and outer allocations remain
at most tolerance/16 and tolerance/8; no native tolerance is increased.

Angular progress uses the exact stored cubic's degree5 K=XY'-YX' coefficients. A common dyadic denominator
permits one integer sum per coefficient; an independent generic rational Bernstein product in the test
checks the exact minimum, including reverse/cached directions. Vertical unit weights give W=1, so strict
Bernstein signs of Z' suffice. Same-U points remain bit-identical and every V ordering check remains; repeated
identical ray pairs share one exact cross-product calculation. All direct integer arithmetic is bounded and
included in the200000 aggregate, with8192-bit guards and the existing1m work bound.

Deep-copied old records retain IDs, names, order, coefficients, pcurves, twins and tolerances. Only selected
wall loops and shell faces may append. Each counter has its own exposed basal island face on the original
carrier. Shared endpoint, edge and radial tables build opposite two-use twins. Pcurves always retain the
canonical edge's t direction; reversed coedges do not reverse their pcurves again.

The independent ring+stroke fixture (N12/C2/H1) yields V28/E42/F19/L22/coedges84, one body/closed shell,
genus0 and strict validity. Its aggregate is185431=150454 helper+34460 local rational+517 direct integer
operations. The finite strict checker observes maximum gaps below5.1e-15. Its samples are not a global
native evaluator, exact trim-closure, physical-solid or represented-volume certificate. The counters measure
bounded mathematical work, not every CPU instruction, memory operation or wall time.

## Separate added-band moment enclosure

The helper integrates ten raw monomials V/X/Y/Z/XX/YY/ZZ/XY/XZ/YZ for a scale2 radial band over at most8 explicit
disjoint UV rectangles on one admitted rational XY x linear-Z tensor product. Native U/V normalize exactly;
physical Z and signed moments are integrated exactly. This mathematical helper can also admit authored
noncircular synthetic carriers; it does not prove a rectangle cover of arbitrary glyph rings or a cylinder.

Primitive Bernstein derivative hulls and Leibniz give conservative derivative bounds. Positive denominator
floors round downward; derivative/quotient bounds round upward to128 bits. Composite Simpson uses the whole
interval fourth-derivative remainder width^5*M4/(180*N^4), not a coarse/fine difference estimate. Exact node
fractions Nx^a*Ny^b*K/W^(a+b+2) are divided outward as unreduced bounded integer ratios. Negative floors,
rounding width, scaled remainder and final estimate rounding are included. One unchanged200k context and
8192-bit limit covers all supplied tiles/moments; requested ten error budgets are enforced independently.
No panel or error request is silently relaxed. Leibniz bounds can be wider than full-product bounds.

Exact triangular-band and non-affine polynomial monomial oracles, disjoint tiles/cache, nonunit native U/V,
negative Z, original native rational quarter at explicit2/8 panels, refusals and immutability pass. Six selected
before/after node comparisons have identical final receipts; counts differ. One original R10 rectangle
U[0.1,0.4]/V[0.2,0.7], H30, panels8 gives added V2192.3394307508997 with error at most1.9005899585893957,
using180216 operations. That width does not meet a native manufacturing/geometry precision claim.
This request is separate from the185431-operation assembly example; their combined budget is not qualified.

No result equates the original upright pi*R^2*H mass with exact stored rational B-rep mass. Full source mass,
centroid/inertia error propagation and mass of the assembled tolerant shell remain unqualified.

## Verification and retained failures

Node22.19.0 build and changed-source/test lint pass. Focused49/49 pass. Whole kernel:
2049 total /2043 pass /0 fail /6 existing skips (248547.438375 ms). Agent-tools/refusals checks pass;
unchanged API inventory returns its six-rule SCOPED_PASS only. Docs pass:68 pages/53 shots/4488 KiB/852 labels. `kernel-result.txt` is the original final
summary; the unchanged full log is `/tmp/barocss-wrap-native-kernel-full.log`.

Original failure outputs are adjacent unchanged files. The initial source run1/8 rejected the wrong ideal
half-turn assumption. The first assembly build reported TS2322 for inferred literal1e-7; explicit:number fixes
it. The next8/16 run also exposed a frozen negative fixture and the unchanged native inverse work limit.
Cloned mutation fixtures and explicit map-BUDGET propagation repair those tests. Later runs24/26,41/48,
42/48,44/49 and12/17 retained real aggregate/derivative/node work refusals. Exact reuse, coefficient-only
admission, dyadic K sums, repeated-ray caching, conservative derivative hulls and raw node fractions reduce
required work without increasing limits. The final49/49 and whole pass apply to the fixed source.

Model/Studio were not rerun for D298; their last whole1824/1824 and365/365 belong to76a5d5c59's separate
text-relief reference correction. No new D298 browser flow or screenshot, benchmark or stable speedup result
exists. Read-only mathematical reviews are evidence of their stated formulas/limits, not runtime receipts.
The conditional evaluator review has not changed any false certification flag. No push, PR or release.

Next: D299 must prove general diagonal projected-chart embedding and adjacent vertex sectors, bind complete
trims within the original native error policy, connect a complete original-source/added-band mass contract,
and only then qualify a native Part/Model/API/Studio wrap feature. General glyphs, arbitrary depths, seam
crossing, engraving, tilted cylinders and general rational surfaces remain open. The owner's07→08→09 order
is unchanged.
