# D311 cap correspondence, closed reference and mass — 2026-10-29

Runtime `749b1b666` connects the actual stored cap boundaries and all nine wrapped faces to one
closed reference, then certifies the returned volume/mass/centroid/inertia against that
reference. This is a private fixed one-rectangle/no-hole/height==R construction. It is not
a Part mass provider, public API, Studio feature or general glyph wrap.

## One actual source execution

The new entry owns/freezes the same user inputs and constructs the native assembly with a
fresh native source. Its complete existing native proof/cost is retained. The same immutable
source is passed synchronously to the formal mass continuation. The continuation does not
execute source extraction; its sourceOperations is zero. No executed cost is subtracted,
no previously returned/serialized receipt is accepted, and no caller flag supplies authority.

The old independent D309/D310 paths still execute both fresh source checks. Their complete
retained serialized results/counts are unchanged. Direct tests also compare the actual native
result, all formal numerical fields and the wall proof. New sourceChecks=1 and sourceCosts
metadata describe the real call graph. The existing producer Number-reconstruction/accounting
limits remain; operation counts do not claim to count every JavaScript instruction.

## Caps and source closure

Actual cap nets are checked as complete affine unit-domain patches with original outward
normals and Z values. Each cap pcurve retains the original two spans, weights, domain and
world-edge owner. Its full control hull stays in the cap domain. The top and bottom arrays
are exact transposes, so their world XY images coincide and their actual outward uses oppose.

The four actual top cap spans are proved to form a simple positive radial graph. The proof
uses exact normalized coordinates(2u-1,2v-1) formed with common-denominator integers, without
rounding an affine lift into new Number poles. The original two vertical seams are checked
against complete wall rows, pcurves, endpoint vertices and reciprocal opposite uses.

The literal rounded cap boundary and original world boundary are slightly different. Both
are radial graphs with matched span parameters. The disk map s*capBoundary(t)->s*sourceBoundary(t)
is a homeomorphism, including their common center. Its whole-disk L1 displacement is bounded
by the previously certified actual affine cap/world-curve coefficient residual. In all four
R10 fixtures that bound is1.7763568394002505e-15. No source coefficient is snapped or changed.

This constructs the closed source reference Omega_rho x[z0,z1], where rho(theta) is the actual
original wall radial graph. It does not claim literal stored cap/wall coincidence.

## All retained faces and the added pad

The actual four rectangle edges must have the same original UV endpoints and positive order.
The source hole and outer loop have opposite uses of the same boundaries. All36 coedges have
reciprocal opposite twins and next/prev incidence. The source retains one rectangular hole;
the outer face is the original quarter scaled exactly by2 in XY. Actual side faces retain
the fresh D301/D304 homothetic coefficient bindings and outward senses.

The closed target is the source prism united with the factor2 radial pad over that rectangle.
In(angle,Z), each cross-section has radius rho or2*rho. Positive wall angle, affine positive Z
and a strict interior rectangle establish the complete nine-patch decomposition: interiors
are disjoint, and patches meet exactly on their prescribed reference boundaries. The shared
source/pad interface is removed. The reference has V12/E18/F9 and genus0.

Every actual face receives a map to its reference face. Source/outer wall interior model
error is zero; cap disk error is the actual cap residual; side error is at most twice the
actual base-curve residual. Adding the fresh whole-family native D0 L1 error proves native
face association within the unchanged1e-7 tolerance. Its domain is the admitted exact face
trim domain, not arbitrary untrimmed Surface parameters or a renderer/trim-admission test.
The max bound is approximately3.43925e-11 for the standard fixture and3.19361e-11 for the
centered fixture. Literal stored closure remains false in the receipt.

## Complete geometric and numerical mass error

The formal cylinder/annular-sector result has exactly the same angle/Z partition as the
closed rho-reference. D310 supplies the full original-wall bound |rho-R|<=delta. For a raw
monomial x^a*y^b*(z-zCenter)^c, with d=a+b, the added absolute geometry error is bounded by

    2^(d+5) * H * delta * (R+delta)^(d+1) * (H/2)^c.

At each angle/Z the radial extent is s*rho or s*R with s in{1,2}. The symmetric-difference
radial interval has length at most2*delta and radius at most2*(R+delta). Integrating its
absolute monomial bound over2*pi andH, using pi<4, gives the formula. This bound treats the
union as one body and does not count the internal source/pad interface as material.

Outward fixed128 arithmetic adds these errors to all ten formal raw-moment intervals.
Positive volume, density/1000, centroid ratios and central inertia are propagated through
interval operations. Each actual returned Number is then compared exactly with its expanded
interval and the caller's original absolute budget. No budget is relaxed. Returned properties
stay unchanged; their new audit includes both radial geometry and formal arithmetic errors.
Native SI accuracy, literal stored-B-rep mass and a Part mass provider remain unqualified.

## Actual costs, comparison and validation

All four accepted cases use R10, H30 and height10. Original requested caps remain
200000 exact operations,1048576 work and8192 bits. Their complete actual counts are:

| Fixture | Exact operations | Total work | Max bits |
|---|---:|---:|---:|
| Z0, U[1/16,5/16], V[1/4,3/4], density1 | 196425 | 424858 | 1187 |
| Z-5, U[.125,.375], V[.25,.75], density7.85 | 195846 | 423416 | 1178 |
| Z-5, U[.125,.375], V[.25,.5], density1 | 199120 | 430791 | 1178 |
| Z-5, U[.125,.375], V[.5,.75], density1 | 199168 | 430879 | 1178 |

The standard total is186945 retained wall-prefix+4629 local rational+4851 local direct.
Its shared native/formal prefix is181746=160132 native+21551 formal+63 outer. The actual
formal continuation performs zero source operations. All native source work remains counted.
The standard volume audit error is7.31671835814867e-11 against1e-8; mass error is
7.242821913629619e-14 against1e-10. All centroid and central inertia errors meet the original
1e-10 and1e-7 budgets. See receipts.json for exact fractions and every Number audit.

The extra lower/upper fixtures have matching volume10343.766029945915, mass10.343766029945915
and centroid XY0.9502958422302166. Their centroid Z values are9.666832636253082 and
10.333167363746918. Both Ixz and Iyz are respectively+33.58622741273295 and-33.58622741273295.
Independent exact interval oracles verify these signed quantities; zero-symmetry alone is
not the acceptance test. The old Z-7/U[.1,.4]/V[.2,.7]/density7.85 frontier still refuses:

    Formal pad mass: the aggregate source, rational, direct, or work limit was exceeded

The code/source remain BUDGET/cylindrical-wrap-formal-mass. No general-offset success is claimed.

Validation used Node22.19.0 and the serial heavy gate:

- Final full kernel build and lint/code-shape PASS. Counts remain119/32/273/75.
- Whole kernel:2179 total,2173 PASS,0 FAIL,6 existing SKIP;260893.378583ms.
- After the whole run, only the two signed-height fixtures were added to the existing test
  block. No production source changed. Final expanded focused set:39/39 PASS,1226.487125ms.
- The focused set covers bound-reference, closed-reference, formal-mass, native-position
  and source-walls. Independent cap Bernstein/fraction, outward-shell moment and exact
  Number-distance oracles, malformed topology/cap/side rejection, ownership, no caller flags,
  complete exact-total/total-minus-one and arithmetic-only-versus-geometry budget tests pass.
- All three retained D310 serialized results and counters are unchanged (prefix-review.json).
- Generated agent-tools/refusals checks PASS without regeneration. API inventory unchanged,
  SCOPED_PASS for its six named rules only. Docs:68 pages,53 shots,852 labels.
- Mandatory perf-bench closed-reference-pad, RUNS7:31ms before(D310 walls only) to28ms after
  (D311 complete proof); actual B-rep fingerprint3dc47a62fa4c37a6 SAME. This is one local rounded
  pair across different proof workloads, not a stable speedup or Studio latency claim.

The complete actual receipts are compacted only by omitting repeated B-rep arrays. Run the
adjacent measure.mjs and measure-offsets.mjs from packages/barocss-cad after the full build to
regenerate them. final-phase-costs.txt is a diagnostic phase harness with a smaller outer
output object; its work total is not the constructor's total. Use receipts.json counts above.
The preserved focused TAP and whole-run summary give the final verification scope.

The first complete candidate exceeded the existing200000 cap. Indexed ownership lookup avoids
repeated scans of immutable entity arrays. New exact output fractions retain their common
positive denominator, avoiding unnecessary Euclidean reductions at serialization. Every
integer, predicate, bit size, GCD/structural/limb/string cost remains in the cumulative ledger.
No cap, tolerance, precision, expected result or test assertion was weakened.

The initial path diagnostics are retained in setup-diagnostics.txt and wrong-build-directory.txt.
The original first budget results are in first-budget-refusals.json. No lint or focused test
failure occurred. Pure helper continuations require the caller's fresh owned inputs; only the
final constructor creates the combined receipt from user inputs.

Model/Studio/types/browser NOT RUN; latest whole consumers/types D299901b4ce45. No push/PR/release,
new dependency, WASM, lockfile, schema version or public package-index change. Next D312 is
Part/provider/API/Model/Studio integration for this bounded reference profile, including actual
consumer and browser validation. General text/rational/smooth wrap and broader07 ranges remain
open before08->09.
