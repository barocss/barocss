# Independent mathematical review: formal pad mass candidate

Reviewed `/tmp/barocss-formal-pad-mass-candidate.patch` without applying or executing it. No repository edit, build, lint, test, probe, benchmark or commit was performed. This review does not qualify a physical wrap or a Part mass provider.

Frozen review status: the parent reports that the work-ledger correction is prepared separately and that representation fields are being renamed to selectedQuarterRadial/selectedQuarterOuterRadial. This note preserves the originally reviewed accounting defect and scope clarification; it is not execution evidence or a separate review of those later edits.

## Required correction before integration: complete work accounting

The candidate's `Context.check` (new source approximately line65) and final `counts.work` (approximately line330) use

`structural + rawCarrierWork + sourceOperations + localQ.operations + localDirect`.

They omit the explicit local/source GCD and float-search work categories used by the D303/D304 combined-ledger convention. The separate combined GCD cap is checked, but that is not the same as including those categories in the1m work total. Extra conservative charging of source operations cannot substitute for an omitted local category. The returned work receipt also repeats this incomplete formula.

Recommended normalization, once at source import:

`importedSourceWork = carrier.work + carrier.rational.operations + carrier.rational.gcdSteps + carrier.rational.floatSearchSteps`.

The carrier's direct integer work is already included in `carrier.work`: map.ts checked() both increments integerOperations and calls charge(). Do not add its direct count again to this complete work category. Its q+direct `sourceOperations` still belongs separately to the200k exact/direct cap.

Use one shared total-work function for admission and the final receipt:

`totalWork = structural + importedSourceWork + localQ.operations + localQ.gcdSteps + localQ.floatSearchSteps + localDirect`.

Retain the existing combined exact/direct, combined GCD and8192-bit limits. A different work formula in the final receipt would remain an error even if sample requests fit both versions. No runtime overflow of the1m cap has been demonstrated by this read-only review; the concrete defect is the missing declared accounting categories. The font_sources worker has confirmed this same correction plan.

## Raw reference moments: no additional formula defect found

The declared target is an ideal formal cylinder of radius R and exact stored axial endpoints, union an ideal scale2 annular sector over one strict interior native-UV rectangle. It is explicitly not literal stored-rational B-rep mass. The two volumes overlap only on their common radial boundary, so raw moments add without double-counting volume.

With exact source midheight c=(z0+z1)/2 and local coordinate z-c, write source height H=z1-z0. The candidate's source terms are correct:

* V=pi*R^2*H.
* XX=YY=pi*R^4*H/4.
* ZZ=pi*R^2*H^3/12.
* X,Y,Z,XY,XZ,YZ=0 in this centered source frame.

For pad local midpoint zbar and axial height h, its axial monomial integrals are correctly

`L0=h`, `L1=h*zbar`, `L2=h*(zbar^2+h^2/12)`.

For radial coordinate rho between R and2R, the radial factors are correctly

`T0=(3/2)*R^2`, `T1=(7/3)*R^3`, `T2=(15/4)*R^4`.

For endpoint polar angles alpha<beta, the six angular integrals are correctly

* A0=beta-alpha.
* A1=sin(beta)-sin(alpha), for cos(theta).
* A2=cos(alpha)-cos(beta), for sin(theta).
* A3=(beta-alpha)/2 + (sin(2beta)-sin(2alpha))/4, for cos^2(theta).
* A4=(beta-alpha)/2 - (sin(2beta)-sin(2alpha))/4, for sin^2(theta).
* A5=(sin(beta)^2-sin(alpha)^2)/2, for cos(theta)*sin(theta).

The raw ordering `[V,X,Y,Z,XX,YY,ZZ,XY,XZ,YZ]` maps to

`[T0*A0*L0, T1*A1*L0, T1*A2*L0, T0*A0*L1, T2*A3*L0, T2*A4*L0, T0*A0*L2, T2*A5*L0, T1*A1*L1, T1*A2*L1]`.

The candidate's ai/ri/zi arrays implement precisely this mapping. Negative local Z and mixed XZ/YZ are handled by signed outward interval scaling. A centered axial pad has exactly zero L1, so its Z/XZ/YZ terms remain exact zero rather than an arbitrary numerical near-zero.

## Density, central inertia and translation

The rigorous density factor is the exact rational representation of the supplied Number density divided by1000. This correctly converts g/cm^3 to g/mm^3. It is distinct from the existing Number multiplication `density*1e-3` in solidMassFromIntegrals; the audit compares the actual returned Number values to the exact-factor target and therefore includes that rounding.

The central raw products are correctly enclosed as

`Qxx=XX-X^2/V`, `Qyy=YY-Y^2/V`, `Qzz=ZZ-Z^2/V`,

`Qxy=XY-X*Y/V`, `Qxz=XZ-X*Z/V`, `Qyz=YZ-Y*Z/V`.

The inertia tensor has diagonal terms `k*(Qyy+Qzz)`, `k*(Qxx+Qzz)`, `k*(Qxx+Qyy)` and off-diagonal terms `-k*Qxy`, `-k*Qxz`, `-k*Qyz`. The candidate uses these signs and ordering correctly. Interval dependency loss makes these bounds wider, not unsound.

Raw moments are centered before Number conversion. Only the returned centroid Z is shifted back to world coordinates. Central inertia is unchanged by that translation. Auditing the actual `local.centroid[2]+nearest(zCenter)` against the exact centered centroid plus the outward exact zCenter interval covers both shift rounding and final addition rounding.

Transferring the retained native mass basis from the local properties to this centroid-only wrapper preserves the same estimated central products. It does not prove native SI error. The candidate correctly keeps `nativeSIAccuracy:false`, explicitly rejects the existing density*1000 overflow intermediate, and checks all actual returned scalar errors against requested budgets. No additional native SI accuracy claim should be inferred from readNativeSIInertia returning an available basis.

The audit uses the maximum exact distance from the actual returned Number to both interval endpoints. This is a valid absolute error upper bound for every target inside the interval, even if that Number lies outside the interval due to rounding. Positive finite public mass and diagonal inertia are checked; non-finite off-diagonals/centroids are rejected by audit's finite-value check.

## Angle, trigonometric and interval bounds

The24-term alternating atan series ends with the negative x^47/47 term. The exact remaining tail is positive and bounded by x^49/49 for0<=x<=1/5. The interval code propagates signed outward rounding through every product/sum and adds that upper tail; clipping a negative lower result to0 is safe for this nonnegative argument.

Machin's identity is used with the correct factors and reversed subtraction endpoints:

`pi/2 = 8*atan(1/5)-2*atan(1/239)`.

For ratios in[0,1], repeated reduction `(x-1/5)/(1+x/5)` while x>1/5 is positive and lowers the angle by atan(1/5). The maximum starting ratio1 reduces exactly through

`1 -> 2/3 -> 7/17 -> 9/46 < 1/5`.

The reduction is monotone on the admitted positive range. Therefore at most three reductions suffice; the bounded loop does not silently select a different atan branch. The y>x complement uses `pi/2-atan(x/y)` with interval endpoint reversal.

Endpoint XY values are exact homogeneous Bezier numerator values on the original quarter. Omitting division by W is correct because only their common positive ray is used. Cross-denominator integers ix,iy represent one common positive scaling of that ray. The normalization uses floor/ceil bounds for `S*sqrt(ix^2+iy^2)`; dividing `ix*S^2` and `iy*S^2` by these opposite bounds gives valid fixed-S cosine/sine intervals. The guarded integer Newton root returns floor(sqrt(N)); no sampled Math.atan2 or Math.sin/cos value is an admission authority.

The interval +,-,multiply,positive-denominator quotient,square and signed rational scale operations used in the reviewed formulas have correct endpoint directions. The raw powers through degree2 need no unsupported general trigonometric series or empirical remainder estimate.

## Source and quarter contract

The helper rebuilds a fresh `buildCylindricalWrapUVSource` from the actual Part. It does not accept a caller radius label, a generic external surface or a claimed prior receipt. That source adapter compares the complete actual cached B-rep to the current native producer and extracts the selected +Y first quarter by direct copying.

`endpoint()` uses `[knotsU[2],knotsU[3]]`, which is the complete domain of this **three-row quarter** [0,0.5]. It is not being applied to the original five-row half-wall. `sourceChecks` uses strict original-U and V interior inequalities, checks V-independent XY/weight bits and common actual Z endpoints. `axial()` then correctly evaluates the exact affine Z coordinate in original V units.

Both exact endpoint rays are in the first quadrant. Positive ray cross-product and the positive outward angle-width lower bound establish the sector's required angular order. Source quarter provenance and its coefficient positivity come from the freshly called source adapter, not from the later output flags.

### Representation metadata clarification

`representation.sourceRadial` currently copies `source.carrier.bounds.radial`, which certifies the selected **first quarter**, not all four source spans. A valid untouched native source already has a negative-Y half with a different middle-weight bit. No reviewed proof transfers the selected quarter's defect bound to that entire source.

This does not invalidate the formal mass formulas: the target is ideal reference mass and `includedInMassError:false` is deliberate. Before any consumer uses the representation fields, name or describe them as selected-quarter source/outer bounds, or add a separate complete-source coefficient audit. Do not interpret the current copied value as a full-source radial enclosure or add it silently to the formal mass error as though the target were literal B-rep mass.

## Verification boundary

No further concrete sector/source moment, density conversion, central-inertia, translation or angle-interval formula error was found in this static review. The required work-accounting correction remains before integration; representation metadata needs an explicit quarter scope.

Build/type/lint/runtime behavior, the independent oracle implementation, actual operation totals, tight-budget acceptance and performance remain unverified here. The candidate's explicit false flags for literal stored B-rep mass, wrapped-solid qualification, native binding, surface area, Part mass-provider integration and native SI accuracy must remain in place until their separate obligations are implemented and validated.
