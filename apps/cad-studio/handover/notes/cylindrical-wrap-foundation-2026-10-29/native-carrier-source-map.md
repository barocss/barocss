# D297 native cylinder carrier and B-rep binding map

Status: source-only inspection after D296 completion `06c33222a`. No feature probe, build, test, benchmark,
browser or source edit was run. This note does not repeat the separate inverse-angle investigation and does not
adopt a new wrap algorithm. Repository paths below are relative to:

`/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`.

## 1. Ordinary native Z cylinder uses the prismatic producer

The ordinary Part circle-sketch/zero-draft-extrude path is:

1. `src/part/part-model.ts:1368`, `profile`: a circle is one CCW arc starting at `[cx+r,cy]`.
2. `src/part/part-model.ts:1413`, extrude operation: zero draft returns an upright `prismaticFromProfile` result;
   `from`/height set its Z levels. `brepOf` at:850 converts it with `brepFromPrismatic`.
3. `src/features/prismatic-solid.ts:76`, `prismaticFromProfile`: `buildProfileLoop`, curved-region difference and
   normalize create the section. `src/brep/curved-arrangement.ts:420`, `halves`, splits an arc above half a turn
   into two so no piece starts and ends at the same vertex. `simplify` at:644 does not merge beyond a half turn.
4. `src/features/prismatic-solid.ts:171`, `brepFromPrismatic`, builds canonical pieces and one wall per piece/run.
   `curveOf` at:210 uses `segmentCurve`; the wall at:249 uses `extrudedSurface`.

For the clean single-slab ordinary cylinder, this source path yields two semicircular wall faces. Each has two
quarter spans. This is a derivation from the producer, not a newly executed primitive/output observation. Do not
hard-code the same face count after booleans, splits, imported/reparameterised geometry or additional source points.

### Actual carrier coefficients

`src/features/extruded-profile-solid.ts:192`, `segmentCurve`, constructs an arc as follows:

```text
spans = max(1, ceil(abs(sweep)/(pi/2) - 1e-12))
dt = sweep/spans
w = cos(abs(dt)/2)
degree = 2
```

Each span uses endpoint weight1 and middle weight w. Endpoints/interior poles use the source endpoints plus
`center + radius*cos(angle), center + radius*sin(angle)`; the middle pole uses `radius/w` at the middle angle.
The final endpoint comes from the stored segment end. For a semicircle:

| Entity | Degree/grid | Knots | Weights |
|---|---|---|---|
| Bottom/top curved edge | degree2,5 poles | `[0,0,0,0.5,0.5,1,1,1]` | `[1,w,1,w,1]`, w computed by the producer |
| Wall surface | degreeU2/V1,5x2 | same U knots; V `[0,0,1,1]` | row i `[wi,wi]` |
| Vertical seam edge | degree1,2 poles | `[0,0,1,1]` | `[1,1]` |

`extrudedSurface` at:211 directly duplicates the arc's XY poles at z0/z1 and duplicates each weight across V.
World Z is linear in V; U is the stored rational-curve parameter, not an angle. The canonical curve direction can
be reversed relative to the original ring. Preserve the actual face sense and use/parameter orientation.

The wall base tag is the original segment side tag. `nameFaces` at `prismatic-solid.ts:375` gives repeated base tags
`#1`, `#2`, ... by midpoint position; a consumer must select the actual persistent name, not assume one global
unpartitioned cylinder face. Bottom/top faces and curved/seam edges use their own persistent-name construction.

**Original coefficient boundary:** do not rebuild ideal cardinal poles from only center/radius or replace the
producer's weight with a newly recomputed value. Trigonometric calculations and source endpoint choices can leave
different final binary64 bits. The authoritative support is the actual stored Surface/Curve. Circular intent is
not permission to overwrite it with a canonical ideal circle or assert a zero residual from a radius classifier.

`stored-circle-prism-solid.ts:117` is a different bounded source contract: a whole9-pole ring with knots
`[0,0,0,1,1,2,2,3,3,4,4,4]` and alternating Math.SQRT1_2 weights. The explicit circle-prism shell/source APIs are
not the ordinary Part prismatic wall representation above. Their fixtures/certificates must not be substituted
for admission of an existing Part face.

## 2. Existing exact quarter extraction without changing the source

Preferred Surface helper:

`src/nurbs/surfaces/surface-parameter-split.ts:101`, `splitSurfaceAtParameter(input, options)`;
public export `src/index.ts:98`.

For one actual5x2 semicircle wall, use axis u and parameter0.5 with distinct bounded child Surface IDs.
The existing knot has multiplicity2, equal to degree2. Therefore requiredInsertions=0, refinement is `direct-copy`,
and child construction copies the original pole rows/weights without homogeneous interpolation:

- lower: source rows0..2, U knots `[0,0,0,0.5,0.5,0.5]`;
- upper: source rows2..4, U knots `[0.5,0.5,0.5,1,1,1]`;
- each quarter remains degreeU2/V1,3x2, with original V knots and unchanged row weights;
- original endpoint/nonselected domain bits are retained. The original input is independently snapshotted.

The helper admits degree1..3, native axis grids up to16, original coordinate range±10000 and ASCII IDs up to48.
It creates and compiles its own source/model and checks retained bits; it does not create a face, trim or solid.
The public helper returns lower/upper Surface values plus provenance. It does not renormalize a quarter to `[0,1]`.
Any new normalized chart must explicitly keep the exact affine parameter map back to this original U interval.

For boundary curves, `extractCurveBezierSpans` (`src/nurbs/curves/curve-bezier-spans.ts:198`, export index:164) uses
`extractCurveBezierSpanTrusted` (`src/nurbs/source-wide/curve-wide-adaptive-sampling.ts:236`). The latter has an
explicit one-hot `original-copy` pole branch at:270–276. Existing degree-multiplicity quarter knots make the local
basis extraction identity on the active three poles. Preserve/report those original-copy receipts rather than
assume every arbitrary span extraction is bit-exact: other extraction coefficients use floating arithmetic and
the helper explicitly does not provide a global binary64/manufacturing error certificate.

`extractSurfaceIsoCurve` (`src/nurbs/surfaces/surface-isocurve.ts:88`, export index:96) is another useful boundary:
fixed V at its min/max directly copies the source row endpoint pole/weight data at:104–110. It produces the actual
bottom/top rational Curve, from which the quarter can be extracted. Interior fixed values use homogeneous
contraction and need their own representability reasoning. `extractCurveInterval`/`splitCurveAtParameter` are
available for broader interval cuts, but are unnecessary for the existing repeated quarter knot.

## 3. Degree3 trim, degree1 UV pcurve and4x2 radial side fit core limits

`src/core/math.ts:20`, `validateKnots`: degrees1..5, open clamped, finite nondecreasing knots; count=controls+degree+1;
positive domain; interior multiplicity≤degree. `validateCurve` at:48 permits2..64 poles. `validateSurface` at:60
permits2..16 per axis and≤256 total. Weights must be finite in[1e-6,1e6], and core Cartesian coordinates within±1e6.
Feature admission commonly uses the stricter existing CAD±10000 range; the larger core bound is not permission
to weaken the wrap feature's bounds.

Thus a single rational cubic edge has4 poles/8 clamped knots, a UV line has2 poles/4 knots, and a radial ruled
side degreeU3/V1 has4x2 poles/knotsU length8/knotsV length4. These fit the core without new runtime dependencies,
WASM or wider geometry limits. This statement is capacity/admission, not an embedding/solid proof.

Reusable radial side constructor:

`src/nurbs/surfaces/rational-ruled-surface.ts:120`, `buildRationalRuledSurface`, public index:108. It requires the
two Curve sections to have equal degree/count and Object.is-equal knot arrays, then copies pole pairs into rows
and weight pairs into rows. With two same-basis cubic trims and identical weights this yields4x2 and ordinary
linear interpolation between the two stored points at each U. If weights differ, its documented meaning is
denominator-weighted section interpolation; do not silently call that the requested radial extrusion.

`buildDegreeMatchedBezierRuledSurface` can elevate degree, but that extra conversion is unnecessary when the
candidate already owns matching cubic trims. Degree elevation preserves endpoint copies but can perform interior
homogeneous arithmetic; its observations are not a zero-residual rational-cylinder binding certificate.

`buildSectionExactSurfaceBinding` (`features/section-exact-surface-binding.ts:65`) is **not** a drop-in binder here:
its inspected proof at:89–104 requires constant Surface span weights and constant World weights and creates a
degree2 UV pcurve for its existing V-linear plane-section contract. An actual cylinder quarter has nonconstant
rational weights. Likewise the own-plane-cylinder intersection helpers bind their own explicit plane/canonical
circle-prism contract, not an arbitrary new linear-UV text edge. The new wrap candidate must establish its own
stored homogeneous coefficient agreement against the original rational quarter; samples alone cannot replace it.

## 4. buildBrep/trim conditions that the new assembler must supply

`src/brep/brep-core.ts:355–368` defines BrepBuildInput/FaceInput/LoopInput and `buildBrep`. It assigns hierarchical
body/shell/face/loop/coedge IDs, sets next/prev, and twins edges only when exactly two uses have opposite senses.
It does not split/sew curves, fit surfaces, solve pcurves, prove a solid, infer loop orientation or run checkBrep.

- Every geometric edge has one canonical Curve over its full domain and two endpoint vertex IDs. Consecutive
  coedges must share the same endpoint ID, not merely nearby coordinates. Reuse one shared edge record across
  adjacent faces. A closed shell requires exactly two opposite coedge uses per edge, mutual twins and one manifold
  vertex link. A face needs exactly one outer loop; counters are separate inner loops.
- Face `sense:'forward'` means outward normal Su×Sv. Reversed uses alter traversal, not the stored edge curve.
  Plan the complete outer/inner loop ordering and radial side face senses from that convention; buildBrep does
  not correct a reversed/inward solid for the caller.
- A pcurve is a Curve with z=0 in native Surface UV and **exactly the same numeric parameter domain as its edge**
  (`brep-core.ts:23–28,257–271`). For a cubic edge t∈[a,b], a degree1 pcurve can use knots `[a,a,b,b]`, weights[1,1]
  and control points `[u0,v0,0]`,`[u1,v1,0]`. It must satisfy S(pcurve(t))=edge(t) at the same t.
- **Do not reverse the pcurve for a reversed coedge.** Coedge sense determines loop traversal; both forward and
  reversed uses retain edge-parameter-direction pcurves. The same shared edge needs a separate pcurve on each
  incident face. On a4x2 radial ruled side, its two long boundaries use constant radial V0/V1 and the same U as the
  cubic; endpoint struts use fixed U and the line's own edge parameter. On the original carrier use its retained
  original-quarter U/V map, not an implicit normalized/angle parameter.
- `buildBrep` copies vertex point arrays but retains supplied Curve, Surface and pcurve objects. It is not an
  independent geometry deep-copy boundary. Own the new records/copies before assembling if later mutation could
  otherwise alias source support. No source geometry is changed by the builder itself.
- Default entity tolerance is max(existing linear floor, existing relative policy×vertex scale). Builder edge
  and vertex tolerances become max(global,input entity tolerance). It can therefore increase a small supplied
  entity tolerance if its global value is larger. Do not use a large sewing tolerance to cover any binding gap;
  explicitly preserve/check protected source records and use only the existing policy budget.

`checkBrep` and `assertValidBrep` are public at index:616. The ordinary pcurve check samples5 values, checks domain
equality, UV-domain inclusion and gap≤edge.tolerance. Strict checks (`brep/brep-check-geometry.ts:110`) additionally
check edge/surface proximity, loop crossing, slivers and tolerance cap1e-3×max(1,size). Curved edges use9 initial
samples and loop crossing gets a finer confirmation. Strict checks are necessary finite checks, not a whole-curve
coefficient proof or general manifold/geometry certificate. Keep exact homogeneous binding/provenance and explicit
physical-solid/outward-orientation checks in addition to them; never widen their tolerance to make them pass.

## 5. Excluded shortcut

`src/machine/thread-helical.ts:28`, `helixRow`, uses cubic quarter-circle handles for a polynomial helix approximation
(the file header explicitly says cubic round per quarter). It is unsuitable as an exact source-cylinder carrier.
Do not copy its kappa handles, substitute its support, or accept a thread approximation through a loose sew.

Summary of the reuse boundary: copy the actual half-wall Surface; direct-split its existing degree-multiplicity
knot for an original-coefficient quarter; retain explicit UV parameter mapping; create/verify matching rational
cubic trims and same-basis radial sides; assemble shared topology and per-face pcurves; apply the existing policy
checks and an independent exact coefficient/solid proof. Native feature/browser support remains unimplemented
and unverified by this source-only note.
