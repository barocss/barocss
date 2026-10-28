Status update: D296 is qualified on runtime `62069bbd1`; this D297 provider proposal remains design only.
No wrap implementation or new wrap test is included in the D296 completion.

# Next bounded cylindrical text wrap: read-only design draft

Status: design only, 2026-10-28. No implementation, new tests, build, feature probe or browser run. Parent reports D296 related kernel checks/lint passed at WIP `acead9d16`; whole qualification remains parent-owned. No additional D296 approval blocker was found in the normal native document path during the prior self-review. This draft was saved before returning to D296 arithmetic-budget review.

Repository/worktree: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`.

## Intended support boundary

The useful next feature is **bounded outward cylindrical text emboss**, not general wrap. Start with one closed physical native Z-axis circular cylinder, its outward wall selected by one exact persistent face name, no bore, steps, earlier fillets, other material near the new lettering, or arbitrary imported near-cylinder. Keep the ink strictly inside one regular rational Bezier angular span of that selected face, away from its seam, caps, trim boundaries and angular knots. Keep every glyph occurrence/component/counter; refuse overlap/contact between raw components until an ink-union contract exists. Require positive added height, an interior radial seat when building a tool, unchanged target/cap references, one strict-valid closed physical result body, positive material change, and atomic refusal.

Original selected TTF bytes, descriptor, text, size, tracking and flattening tolerance stay in the Model recipe, never in Kernel. Kernel receives line-only component sketches in an unwrapped `(s,z)` chart. Here `s` means physical arc length at the selected source radius R, not NURBS parameter distance. Source radius/axis must come from the selected admitted cylinder, not an authored override. Frame/angle/placement meanings must be explicit; initially keep axis +Z and a fixed seam/frame, then add rotated placements separately. No silent normalization, shaping, kerning, font substitution, triangulation or tolerance increase.

Positive embedding means all individual strokes join existing target material. Creating standalone text, bending its displayed mesh, or blindly unioning a transformed text body does not establish this feature. Engrave, inner-cylinder wrap, tilted axes, multiple selected faces, seam crossing, a whole turn, cones/spheres/freeform surfaces and arbitrary target trims remain typed refusals.

## Mathematical split: exact carrier versus inexact arc-length map

For the ideal cylinder,

`W(s,z,rho) = c + rho*(e1*cos(theta0+s/R) + e2*sin(theta0+s/R)) + z*a`.

At rho=R this is a local isometry. For an ink region of chart area A, ideal outward height h gives

`addedVolume = A*(h+h*h/(2*R))`.

A radial seat of thickness b inside the source gives

`overlapVolume = A*(b-b*b/(2*R))`, with `0 < b < R`.

These follow from Jacobian `rho/R`; holes subtract and independent components add only after overlap has been excluded. The chart must be injective; periodic duplication would count material with multiplicity. An independent agent checked these formulas without running code.

An axis-parallel chart edge maps to a ruling or circle arc. A general diagonal chart edge maps to a helix. A finite rational NURBS does not generally represent the arc-length-parameterized helix exactly. Reusing ordinary curve interpolation, quarter-turn thread cubics, or a uniform grid does not remove this limitation.

**Preferred next provider:** retain the original rational cylinder carrier `S(u,v)`. Within one degree-2 rational Bezier angular span, construct a bounded **monotone polynomial approximation** `u=P(theta)` to the inverse angular map. For each flattened chart line, theta(t) and v(t) are affine, so `S(P(theta(t)),v(t))` is an algebraic rational composition. For polynomial degree p, the homogeneous composed curve needs at most degree `2*p+1` for a degree-(2,1) cylinder. The current core degree limit5 permits p<=2; the concrete D297 minimum below uses p1. Compose in homogeneous Bernstein coefficients; if the Bernstein coefficients of U remain in [0,1], positive source weights yield a positive composed denominator. Prove monotonicity from positive derivative Bernstein coefficients, rather than observations at a few points.

The original cylinder surface itself then remains unchanged; the composed edge and its source pcurve share the same algebraic construction. The arc-length placement remains approximate and must carry a global bound. Build the outer carrier by radial homothety of the admitted cylinder, and side faces as ruled surfaces between corresponding base/outer curves with matching bases and weights. Share edge objects by authored chart identity, not geometric welding. Stored binary64 coefficient conversion needs its own error bound and must fit the existing edge/surface binding policy. Algebraic composition is exact over represented coefficients before this conversion; neither the true helix nor rounded geometry is “bit-exact wrap.”

This provider is not present in the inspected source. Its key gaps are the global inverse-angle approximation/error bound, positive derivative and parameter-domain proof, rational composition with bounded degree/positive weights, and consistent trimmed carrier/side topology. Do not hide them in an interpolation call.

## Smallest analytic tranche

A simpler first tranche can accept **rectilinear chart polygons only**. Every edge then maps to an existing line/circle carrier. Decompose an orthogonal ink region into disjoint angular-height rectangles; make annular sectors using the existing partial `revolveProfile`, and remove internal seams/union consistently. This can support an admitted TTF glyph only when its actual flattened contours are rectilinear. Ordinary A/O glyphs with diagonals/quadratics will refuse. This is useful native geometry groundwork, not completion of TTF wrap or roadmap07. Orthogonal decomposition and seam removal still need independent verification.

A faceted alternative has a useful theoretical bound, but it would be a separate explicitly faceted product: for a line interval with angular width delta, linear interpolation of its mapped endpoints has safe error at most `rho*delta*delta/8`. Circle sagitta alone must not be presented as the full diagonal 3D parameter-matched error. Existing mixed facet Booleans can increase rim tolerances to chord deviation, so they are not a drop-in route to an unchanged-tolerance smooth wrap.

## Error and topology conditions

The outward map is Lipschitz with factor `L=1+h/R`, so original font flatness epsilon becomes at most `L*epsilon` at the outer face. Add mapping, coefficient-conversion and Boolean/rebuild error separately. A total wrap guarantee must not reuse the planar font epsilon unchanged.

On an angular window of width alpha<pi, with radial minimum rhoMin>0, a conservative chart-to-world separation factor is `k=min(1,(rhoMin/R)*sin(alpha/2)/(alpha/2))`. Thus a chart gap g must leave a physical gap above existing native tolerance even after both boundaries' approximation errors: use a proved inequality such as `k*g > existingPolicy + errorA + errorB`, with outward bounds. C versus selected F, C versus actual material, C versus its holes and C versus other components each need their own applicable error terms. An outer AABB or a few sampled source normals is insufficient.

A monotone chart inside one angular span and positive radius prevents ideal periodic folds. The approximated mapping must retain positive derivative/Jacobian and keep all error tubes disjoint. Failure to establish this refuses; segment or fit budgets must not trigger coarser approximation. Track counts before geometry work: source/ink edges, angular pieces, composed degrees/poles, face pairs, exact operations and generated faces/edges/vertices. Existing 64-component/1024-loop/4096-boundary and fixed work limits are possible ceilings, not permission to raise D296's limits.

Volume checks need an independent ideal formula plus a bound for the mapped region's deviation. Existing `brepMassProperties().volumeBound` is a convergence estimate, not a certified global bound. Scalar volume equality alone does not prove set equality. The native source/B-rep construction relation, footprint/trim inclusion and topology proofs remain separate.

## Reuse map and limits

- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/font/profiles.ts`: `buildFontProfiles` already returns per-occurrence `{outer,holes}` line components with requested flatness and topology admission. A hole-inside-island remains another component.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/part.ts`: `textProfiles`, `textReliefFeatures`, `textInternalId`, complete `kernelParamCadPartDoc` expansion/preflight. Reuse one canonical font recipe; do not save generated glyph data in Made or duplicate a text document in Kernel.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/doc.ts`: current `TextReliefNode` and source/sizing/document checks are a pattern. A future wrap recipe needs an explicit chart contract; do not silently expand planar text-relief semantics. Reuse `parent`, `faces:[oneName]`, original font descriptor/text and node extras. Existing curved signatures carry radius but no cylinder axis; fresh native axis/family admission is still necessary.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/blobs.ts`, `engine/ids.ts`, `app/textReliefCommand.ts`, `app/editCommand.ts`, `api/part.ts`: existing original-font refs, native name-to-authored-node mapping, font upload/edit and face-query patterns. Any new kind must be covered by node refs and prepared/open-proposal font collection, Save/Open, template refusal and editable recipe paths.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/features/profile-relief.ts`: bounded component admission, exact stored-number area, strict gaps, budget and atomic-result patterns. Planar slab mass proof and XY/+Z cap detection do not apply directly to a cylinder.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/features/revolve.ts`: `revolveProfile`, `unitArc`, `revolveHollow` provide native line/arc revolution and partial caps. No arc-length helix fitting contract is provided.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/part/part-model.ts`, `case 'face-thread'`: selected cylindrical name grouping, whole-cylinder cap/axis checks and positive/negative wall examples. Its tolerances and broad family recognition are examples, not automatically adequate admission for new wrap.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/brep/analytic-boolean.ts`: `faceGeometry`, cylinder chart `(r*theta,height)`, `curve2/curve3Of`, `splitFaceAlongCurve`, `booleanAnalyticTraced`. Geometry recognition and curve fitting are tolerance-based. `fitWith` checks interior samples; it is not a global curve error proof. Complete traced receipts provide source supersets, not full-face preservation.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/blend/polynomial-face-fillet.ts`: `sameSurface`, `sameCurve`, `sameFace`, `preserveProtectedVertices` show conservative protected-face comparison/restoration. Reuse only with the same unique correspondence proof; retain representative tolerances and reject incomplete provenance.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/machine/thread-helical.ts`: `helixRow`, `cutSpan`, `joined`, `assemble` illustrate coherent parametric bands and algebraic cuts. The current quarter-circle cubic is an approximation; `assemble` uses `1e3*tol`. Neither is a ready original-tolerance wrap primitive.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/brep/sew-solid.ts`: natural four-edge patches only, no arbitrary glyph trims. Default tolerance is size-scaled and too broad for this task. `thickenSolid` creates a sampled faceted body, not smooth native cylindrical wrap.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/brep/brep-tessellate.ts`: `circleOf`, `triangulatePolygonWithHoles`, cylindrical display triangulation are useful observations/display tools. They do not certify a wrap's source geometry, triangulation topology or global error.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/section-rational-internal.ts`, exact planar predicates and Bezier subdivision helpers can support coefficient bounds and bounded rational composition. Reuse exact contexts without expanding their per-context budgets.

## Proposed evidence before product adoption

Native tests should begin with a hand-authored ring plus separate stroke, not generated font expectations. For R=10, h=1, source height30, chart outer `[2,8]..[10,16]`, counter `[4,10]..[8,14]`, stroke `[12,8]..[14,12]`: A=56, ideal added volume58.8, and seat b=.5 gives overlap27.3. Original cylinder volume is3000*pi. All ink lies strictly inside the first quadrant, avoiding seam/caps. Compare actual added volume to the independent formula plus a derived error bound; do not approve a broad relative epsilon.

Then separately check diagonal edges and curved-font flattening only once the global mapping bound exists; preserved counters/islands, every stroke seated, positive added volume/one body, strict edge/pcurve binding, monotonicity, protected source faces/names/trim, unchanged input, parameter radius/height edits, missing/merged/changed references, fail-atomic history, and saved original font bytes. Refusal cases include seam/angular-knot crossing, repeated turns, boundary proximity, unsupported surface/axis, inner wall, too little radial web/seat, overlap, tiny gaps, nonfinite coordinates, bad dtype and exhausted budgets. Selected font/glyph cases remain selected evidence, not general font or shaping certification.

Actual Studio evidence must include individual cylinder pick, prepared user font, preview/apply, edit, Undo/Redo, Save/Open with font bytes, re-edit, and failed preview preserving the last accepted document. No such evidence is produced by this draft.

## Recommendation

Do not mark wrap complete from a bent mesh or an unqualified generic Boolean. The next meaningful implementation is a **private one-span cylindrical profile-solid provider**, starting from the independent native rectangle/ring oracle and proving the monotone inverse map, rational composition and shared trim topology before API/Studio expansion. The rectilinear revolve tranche is a smaller optional proof step; it remains explicitly partial. General wrap on arbitrary surfaces stays open.

## D297 concrete minimum: piecewise-affine inverse, no sampled angle certificate

This section narrows the earlier polynomial proposal to **degree1**. The core permits Curve/Surface degree1..5; a general inverse polynomial of degree p would produce degree at most2p+1, so p3 would be inadmissible. Degree1 produces degree3 world curves, a degree1 UV pcurve, and degree-(3,1) ruled side surfaces. Each span has4 curve poles /4x2 side poles, within the existing64 Curve poles and16-per-axis Surface limits. Keep spans as separate B-rep edges; a cubic C0 joined chain can carry at most21 spans under64 poles (`3*n+1`). Do not raise those limits or manufacture a degree7 Curve.

The parent's D296 checkpoint is now `62069bbd1` and remains frozen for whole qualification. D297 is still design only. No algorithm code, new test, build, benchmark or probe was written/run for this section.

### 1. Admit and retain a real original carrier

Use one original clamped degree-(2,1) rational Bezier cylinder span,3x2 poles, identical positive U weights in both V columns, identical XY per row, and a Z translation independent of U. Initially require a known native Z-axis circular-prism construction relation and one cardinal first-quadrant chart with increasing U/angle. A tolerant `faceGeometry==='cylinder'` observation is not the whole admission proof. Imported arbitrary near-cylinders, tilted frames and generic normalized directions remain outside this first scope.

If the selected native face carries two original quadratic spans, select an existing full-multiplicity span and copy its3 poles/weights and actual knot endpoints directly. Do not use floating knot insertion merely to find the original span. The original surface is retained; local t∈[0,1] is only an internal exact affine map to its original U interval. Center subtraction and the cardinal XY frame are exact rational operations on represented inputs. A source translation such as `cx+R` may already have rounded; include the actual stored relative poles in all following coefficient bounds.

Write the XY carrier in homogeneous form `C(u)=(X(u)/W(u),Y(u)/W(u))` relative to the admitted axis center. X,Y,W are exact degree2 Bernstein polynomials formed from **stored binary64 poles and weights**, not a symbolic ideal `sqrt(1/2)` replacement. Prove W>0 with its positive coefficient minimum. Prove first-quadrant membership and a positive lower bound for `D=X²+Y²`; both XY numerators must not vanish together. Prove `K=XY'-YX' >0` by exact Bernstein sign bounds, subdividing the fixed admitted interval if necessary. The nominal analytic cylinder radius R remains separately tied to the native primitive.

### 2. Bound the source's binary64 circle defect

Form exact degree4 `Q=X²+Y²-R²*W²`. The global maximum absolute Bernstein coefficient bounds `|Q(u)|`. With `mW=min(W_i)>0`, a safe radial bound is

`eRadius <= maxAbs(Q_i)/(R*mW²)`.

This uses `|r-R|=|r²-R²|/(r+R)` and `r+R>=R`; it requires no square root or sampled radius. A tighter bound may use a separately proved rMin. In the exact quarter template with poles `(R,0),(R,R),(0,R)` and weights`[1,w,1]`, the exact identity is

`Q = 2*R²*(2*w²-1)*u²*(1-u)²`.

The factor `2*w²-1` is generally nonzero for the stored binary64 w. The generic coefficient Q also includes rounded pole/center effects, so the template identity must not silently replace the generic proof. Require this defect to fit its allocated source-radius budget. It does not turn an arbitrary rounded ellipse into an admitted native cylinder.

Nominal arc length means `R*theta`, not the exact arclength of a slightly noncircular stored rational curve. If the product promises actual stored-carrier arclength, include a separate bound. From `r²=R²+Q/W²`, a certified rMin>0 gives

`|r'| <= (max|Q'|/mW² + 2*max|Q|*max|W'|/mW³)/(2*rMin)`.

Then over any interval,

`|actualLength-R*deltaTheta| <= max|r'|*deltaU + eRadius*deltaThetaUpper`.

Use rational Bernstein derivative bounds. For example, prove `max|Q|/mW² <= 3*R²/4` to use the exact conservative choice `rMin=R/2`, without a square root. For a quadrant one can obtain rational `deltaThetaUpper` from the angle enclosure below. This explicitly accounts for both radial deviation and its variation; radial deviation alone is not an arclength proof.

### 3. Enclose each grid-node angle by fixed rational Taylor intervals

Choose dyadic U nodes in the single original span. Evaluate X,Y,W at each node by exact rational de Casteljau. The actual angle is `atan2(Y,X)`; W cancels. No native atan2 value enters an acceptance bound.

For `|x|<=1/2`, use a fixed24-term alternating series

`A24(x)=sum(k=0..23) (-1)^k*x^(2k+1)/(2k+1)`.

For x>=0 its true atan lies between A24 and A24 plus the first omitted positive term; the remainder magnitude is at most `|x|^49/49 <= 2^-49/49`. Use odd symmetry for negative x. All endpoints and remainder bounds are exact rationals. A fixed count gives a fixed budget; exhaustion refuses rather than reducing the series count or relaxing error.

Reduce a nonnegative ratio q<=1 without a slow series at1:

- q<=1/2: direct interval above.
- q>1/2: `atan(q)=atan(1/2)+atan((q-1/2)/(1+q/2))`; the second argument is in[0,1/3].
- For Y>X, compute `theta=pi/2-atan(X/Y)`.
- Enclose `pi/2=2*(atan(1/2)+atan(1/3))` by the same rational series; the identity follows from tan addition in the known first quadrant. No Math.PI constant is needed in this certificate.
- Handle exact cardinal endpoints separately, including X=0,Y>0.

To avoid repeating large GCD reductions for every series term, the fixed Taylor sum can use the same exact integer/common-denominator principle as D296. For reduced x=a/b, put the24 terms over `b^47 * lcm(1,3,...,47)`, sum their signed integer numerators, and reduce once; the remainder uses `a^49/(49*b^49)`. Prove/charge every fixed-degree integer step under a bounded work ledger. Require a preflight bit estimate below the existing8192-bit guard; an initial argument numerator/denominator cap128 bits leaves room for the49th power and small LCM factors. Larger exact arguments refuse rather than truncating fewer terms. Translations containing extremely small binary64 offsets can create high-bit exact ratios even in the allowed coordinate range; bounded refusal is explicit, not a claim of all finite-cylinder support.

A shared request-local enclosure of atan(1/2), atan(1/3) and pi/2 avoids recomputation. Sum interval endpoints outward with existing rational arithmetic, not a hand-picked decimal epsilon. Fixed24 terms yield angle remainders around4e-17 per primitive atan, far below the existing modeling length floor after the allowed10000 scale, but the actual summed interval/rounding budget must still be checked.

At each node ui obtain `[thetaLo_i,thetaHi_i]`. Choose a finite stored chart node `sHat_i` by one `q.nearest` conversion of an exact interior estimate of `R*theta_i`. Keep and bound its error as

`eNode_i=max(|sHat_i-R*thetaLo_i|,|sHat_i-R*thetaHi_i|)`.

The stored s nodes must be strictly ordered, distinct and within the admitted chart. This is a **generated grid**, not movement of authored glyph points. Preserve original font/text coordinates. The end-chart boundary and its small rounding uncertainty are part of the boundary-clearance proof.

### 4. Global error of the piecewise-affine inverse

On `[sHat_i,sHat_j]`, define U(s) by the exact affine interpolant between ui and uj. Its slope `(uj-ui)/(sHat_j-sHat_i)` is strictly positive. To prove the whole interval, use the forward-angle interpolation theorem, not a finite set of inverse samples.

With `D=X²+Y²` and `K=XY'-YX'`,

`theta'=K/D`,

`theta''=(K'*D-K*D')/D²`.

The numerator has degree at most5 after exact leading-term cancellation; D has degree4. Exact Bernstein control hulls of the restricted polynomials give `M2 >= sup|theta''|` from a positive lower D. The coefficient products used for the bound may have degree8, but these are private polynomial arrays, **not native Curve objects**. No core degree limit is bypassed.

For every s in the whole piece,

`|R*theta(U(s))-s| <= max(eNode_i,eNode_j) + R*M2*(uj-ui)²/8`.

This follows because s/R is affine between the stored s nodes while theta's secant interpolation remainder is bounded by its second derivative. This bound includes actual stored-weight angle behavior. Add eRadius for base world position; on the outer radial homothety use factor `(R+h)/R`. Font flatness, actual-carrier arclength defect, generated UV rounding and coefficient-storage errors remain separate terms.

Bisect a failing dyadic interval only under fixed node/segment/degree/work budgets. An initial structural ceiling can be256 dyadic intervals (depth8), charged before splitting any glyph, while the unchanged exact-arithmetic/work guards may refuse earlier. Stop with a typed refusal if the budget or representability fails. A P1 inverse may need many nodes for a large radius/tight mapping request; this is a real support limit. Mapping tolerance is distinct from the existing native edge/surface binding tolerance. Do not set both silently to1e-7 or widen the latter to make a coarse inverse pass. A coarse fixed grid with a reported large bound is not an acceptable replacement for a requested smaller bound.

### 5. Exact chart splitting and shared endpoints

A glyph edge `(s(t),z(t))` is affine. At each stored grid boundary sHat, compute the exact rational split parameter `t=(sHat-s0)/(s1-s0)`. Classify/order/uniquify cuts by exact rational comparisons; do not perturb a near-boundary authored point. Retain the split's exact rational z before storage. An edge on a grid boundary needs one deterministic half-open owner, with its U exactly the shared grid node, so it is not duplicated.

Use one table keyed by authored glyph/component/loop/vertex or by `(originalEdgeId,reducedExactSplitT)` for generated vertices. Generate the stored UV endpoint once and reuse its bits and B-rep vertex identity in both adjacent pieces, carrier trims and side faces. Cross-component vertices are not welded by nearness. Closing-loop identity is explicit. New source grid cuts must not modify TTF contours, recipe text, or original source surfaces.

Original glyph vertices inside a P1 cell may map to a non-binary rational U or V. Round generated UV once with q.nearest, record the exact residual, and reject collapsed/reversed/domain-escaping segments. A vertical edge has constant U; a nonvertical edge must retain its U ordering in the appropriate direction. Per-edge UV rounding need not preserve a globally identical affine map across unrelated edges, so retain separation/error-tube checks after rounding. Shared endpoints alone do not prove absence of remote crossings.

### 6. Degree3 homogeneous composition and storage budget

On one split piece U(t),V(t) are affine. Restrict the original degree2 homogeneous XY/W carrier by exact de Casteljau; call its three coefficients Xk,Yk,Wk. Elevate X,Y,W from degree2 to3. Multiply the degree2 W by the affine world-Z line (or compose the full degree-(2,1) homogeneous surface without relying on a cancelled form). This gives a degree3 homogeneous world curve before storage. The native UV pcurve is only a line. Keep all composed weights positive; same-source convex restriction and degree elevation preserve positive weights.

Example Bernstein product for Z endpoints z0,z1:

`Z0=z0*W0`,

`Z1=(2*z0*W1+z1*W0)/3`,

`Z2=(z0*W2+2*z1*W1)/3`,

`Z3=z1*W2`.

The elevated denominator is `[W0,(W0+2*W1)/3,(2*W1+W2)/3,W2]`. X/Y elevation follows the same weights. These are algebraic identities over the exact represented source coefficients, not claims that division by3 is always representable in binary64.

After generating actual stored Cartesian poles and weights, independently reconstruct their exact homogeneous coefficients `Nhat_i=Phat_i*what_i`. Let eN bound the max coefficient-vector residual, eW the max weight residual, mHat>0 the minimum stored weight, and B a source-coordinate/control-hull bound. A conservative whole-curve storage bound is

`storedCurveGap <= (eN+B*eW)/mHat`.

Use an L1/component upper bound if avoiding square roots. Actual stored UV rounding adds at most `sup|Su|*eU+sup|Sv|*eV`, with proved rational derivative bounds. The sum must fit the **existing** carrier binding policy; otherwise refuse. The original carrier remains bit-preserved. The stored world curve lies on it to this proven bound, not necessarily with exactly zero coefficient residual after rounding.

Build outer-carrier coefficients by the exact intended radial homothety, then one storage conversion with a separate surface-coefficient bound. Compose world edges from the **actual stored** outer carrier and the shared stored pcurve. For each side surface, copy the two actual stored boundary curves' pole/weight arrays; the identical weight vector permits Cartesian linear radial interpolation. Its natural boundary is the copied Curve, so there is no independent side-edge refit. Reuse endpoint table coordinates and natural side pcurves. Do not perform separate sampled fits for carrier, side and edge and later weld their discrepancies.

The complete ledger therefore separates: font flattening; source circle/radial defect; nominal versus stored actual arclength; P1 angular inversion; exact split to stored UV; outer-carrier pole conversion; composed world-curve storage; and later B-rep/Boolean rebuild if used. Zero manufactured residual is available only when exactFloat succeeds. Existing native D0/D1 observations remain separate evidence and retain C0-knot derivative refusals.

### 7. Material/volume follow-through

Before a solid claim, bound the chart mapping Jacobian as well as position. For this carrier,

`Jbase(u) = (K(u)/W(u)²) * (uj-ui)/(sHat_j-sHat_i)`.

It should be close to R and strictly positive. Bernstein quotient intervals give a conservative bound per cell. Radial homothety multiplier lambda in[1,1+h/R] contributes lambda, so the ideal area formula `A*(h+h²/(2R))` gets an explicit Jacobian interval/error. Exact chart subdivision areas may tighten the bound; a single global min/max is a simpler conservative first refusal rule. Position error alone is not a certified volume error bound. Existing quadrature convergence estimates do not replace this proof.

Retain the earlier counter/ink-disjointness, selected-trim, source-material, positive per-stroke seating, protected-face and closed-one-solid requirements. A provider that certifies curve-on-carrier placement has not yet certified a trimmed glyph face, manifold body or target Boolean.

### 8. Existing helpers: useful boundary and missing primitive

Verified source locations under this worktree:

- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/core/math.ts:20` `validateKnots`: degree1..5; `validateCurve` at48:2..64 poles; `validateSurface` at60:2..16 poles per axis. Positive weight admission is1e-6..1e6, Cartesian coordinates have the existing geometry range. D297 must keep its stricter authored10000 range.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/section-rational-internal.ts`: exact represented-number arithmetic, q.nearest/q.upward/q.exactFloat, existing200000-op/GCD and8192-bit guards. Suitable for fixed Taylor intervals, coefficient products and exact split receipts; no atan/transcendental interval helper currently exists here.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/features/section-exact-surface-binding.ts:77`: private exact Bernstein product/elevation and an independently recomposed world/pcurve residual pattern. Current provider requires globally uniform weights and constant denominators, so it **does not admit a rational circle**. Reuse the fixed coefficient formulas/pattern in a small internal helper; do not relax the established provider's contract.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/exact-proof/exact-paired-vlinear-polynomial-internal.ts`: exact polynomial conversion/composition helpers are local to a uniform-weight, specially axis-reduced section contract. They are not a general rational cylinder composition API.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/nurbs/surfaces/surface-isocurve.ts:98` `extractSurfaceIsoCurve`: endpoint direct pole/weight copying is useful for source identity. Interior contraction/observations are float and its report explicitly says not-certified; it is not the new global bound.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/nurbs/surfaces/rational-ruled-surface.ts`: `buildRationalRuledSurface` copies compatible input curves with independent weights; degree<=3 and<=16 poles fit the proposed cubic pieces. Its point/D1 observations do not supply the new angular/global-error proof. Equal weight vectors are a stronger admitted special case for radial sides. Calling its full Source0/report/observation wrapper per glyph edge may be unnecessarily expensive; a private row-copy construction can reuse the same coefficient identity and native validation, without claiming that wrapper report or repeating its compiler work.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/nurbs/curves/curve-segment.ts` `curvePiece`: existing floating homogeneous Boehm restriction preserves source shape to arithmetic rounding, but is not an exact rational split certificate. At original full-multiplicity knots, direct original pole copying avoids unnecessary re-projection.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/nurbs/curves/curve-bezier-subdivision-internal.ts:30` `splitBezierCurveTrusted`: trusted existing subdivision/provenance/evaluator path; floating coefficients still need the new storage bound. `curve-c0-degree-elevation-internal.ts:55` and `bezier-curve-degree-elevation.ts:77` likewise provide native coefficient patterns, not global source-to-wrap error bounds.
- `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/intersect/own-homogeneous-bernstein-roots.ts`: its quadratic coefficient/root routine uses float uncertainty and brackets. It should not certify these transcendental inverse angles or exact chart cuts. The proposed split is rational affine arithmetic, not a quadratic root search.

No reusable public helper found in this inspected scope performs arbitrary rational surface+affine-pcurve composition with a global rounded-coefficient bound. A small private degree-(2,1) to degree3 routine is the actual new primitive. Keep helpers at module scope; no per-edge or per-grid-loop closures. Add no dependency, WASM, new persisted certificate schema, document version or legacy conversion.

### 9. Small independent native oracle plan (not implemented/run)

Use a hand-authored degree-(2,1) quarter carrier with R8, z0=0,z1=20, poles at `(8,0)`, `(8,8)`, `(0,8)` in both Z rows, and original stored `[1,w,1]` weights, w the native binary64 quarter weight. This is a small explicit Surface fixture for composition; full target-solid family admission is a separate test.

1. Independently derive exact fractional Bernstein coefficients for U(t)=1/4+t/4 and V(t)=1/4+t/2, using the formulas above, from stored binary64 values. Check q residuals and a derived post-storage bound. Native observations at t=0,1/8,1/2,7/8,1 check the actual generated degree3 Curve against the unchanged Surface and stored line pcurve, but do not serve as the global certificate.
2. Outer scale17/16 gives h=.5 and the same weights. Independently verify copied side-iso boundary bits, positive weights, degree3/4 poles and natural pcurve domains. A selected native original weight and a one-ulp weight perturbation must each retain their own nonzero Q/radial enclosure; neither may be replaced by ideal sqrt(1/2).
3. Check one P1 grid cell's exact Taylor node enclosure, K positivity, M2 secant bound, and all private coefficient bounds. A separate high-precision atan integration/oracle may be used for test observation only; the acceptance proof is the rational interval.
4. A tiny chart triangle crossing a stored sHat node exercises exact rational cuts, duplicate-cut removal, bit-shared UV/world endpoints and preserved loop orientation. Include a vertical grid-line edge and a source vertex exactly on the grid boundary. Compare split area to the unsplit exact area; do not duplicate the internal seam.
5. The earlier hand ring+separate-stroke A56/R10/h1 example provides the independent ideal58.8 volume reference only after the mapping Jacobian and closed solid are implemented. Font cases come after native primitive checks; no selected-font or product acceptance is implied now.

Refuse ambiguous angle quadrant, nonpositive K/D/W bound, excessive radial defect, nonrepresentable ordered nodes, a grid/edge/pole budget overflow, collapsed stored UV ordering, a coefficient-storage bound over existing binding tolerance, or unresolved gap/error-tube topology. None of these should trigger a coarser grid, moved profile point, wider entity tolerance, or exact-wrap label.
