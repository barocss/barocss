# D297 inverse-angle map: independent mathematical review

Scope: the concrete minimum in `apps/cad-studio/handover/notes/research-text-wrap-2026-10-28.md`, with an optional further restriction to a single synthetic cardinal quarter having Cartesian poles (R,0),(R,R),(0,R), original stored weights [1,w,1], w exactly the native binary64 Math.SQRT1_2. This is mathematical source/design review only. No candidate/source edit, code execution, probe, build, geometry or test was performed. Only this /tmp report was written.

The proposed derivative, radial-defect and forward-secant formulas are valid with the conditions below. They do not by themselves certify arclength semantics, native binding after storage, global chart topology or a solid.

## 1. Minimal source and denominator conditions

Take the represented binary64 R as an exact positive rational. Derive exact homogeneous X,Y,W from the represented Cartesian poles and original weights, after exact represented-center subtraction. Require:

- one source degree2 Bezier span with unambiguous exact affine local parameter u in [0,1];
- positive Bernstein lower bound mW>0 for W;
- X,Y in the admitted quadrant, with an explicit positive lower Dmin for D=X²+Y²; neither coordinate may vanish simultaneously;
- exact positive lower Kmin for K=X Y'−Y X' in the intended original-u parameter, proving a single increasing angle branch;
- exact source endpoint/quadrant provenance, not only tolerant cylinder classification;
- preserved source poles, weights, knot endpoints and frame. Bounds must use stored numbers, not an ideal substituted square-root weight.

A failed global control-hull sign is inconclusive, not evidence of failure or positivity. Bounded exact subdivision may tighten it; reaching that budget without a positive proof refuses. Source translations such as fl(cx+R) can already differ from exact cx+R, so the generic certificate must include that effect. The stricter zero-centered cardinal template avoids this admission ambiguity and is a sound smaller first scope.

## 2. Angle derivatives and Bernstein bounds

For W>0, atan2(Y/W,X/W)=atan2(Y,X). On the admitted quadrant branch:

    theta' = K / D
    theta'' = (K' D − K D') / D²

No W derivatives belong in these angle formulas. X,Y have degree2; exact leading cancellation gives K degree at most2. The second-derivative numerator has degree at most5; D has degree4 and D² degree8. It is valid to retain an elevated polynomial representation rather than reduce degree, provided every coefficient and restriction is exact and the whole numerator is bounded. These private polynomial arrays are not native Curve objects.

For an exact restricted Bernstein representation, let Nmax bound max|K'D−KD'| and Dmin>0 bound D on that same interval. Then M2=Nmax/Dmin² is a safe second-derivative bound. All coefficient rounding or interval arithmetic must be outward or exact. A sampled maximum of theta'' is not a proof.

**Parameter-scale hazard:** if the restricted cell is reparameterized by t in [0,1], u=ui+t*deltaU, derivatives of its restricted coefficients are t derivatives. Then theta''_t=deltaU²*theta''_u. Use either M2_u*deltaU²/8 or M2_t/8, not M2_t*deltaU²/8. The same rule applies to r' times deltaU and to transforming original knot-domain derivatives. Double scaling would falsely understate the global error.

## 3. Rational atan and pi enclosures

For 0<=x<=1/2, A24=sum(k=0..23)(−1)^k*x^(2k+1)/(2k+1) ends with a negative term. Decreasing positive term magnitudes give:

    A24 <= atan(x) <= A24 + x^49/49
    0 <= remainder <= 2^−49/49

For x<0, negate and reverse the positive interval endpoints. The exact remainder is about 3.63e−17 at 1/2; the exact rational bound, not this decimal, belongs in acceptance. Range reduction atan(q)=atan(1/2)+atan((q−1/2)/(1+q/2)) for 1/2<q<=1 has the second argument in [0,1/3]. Prove the selected quadrant and the denominator sign before applying an identity. Cardinal X=0 must be handled without dividing by zero.

The design's positive-sum identity pi/2=2*(atan(1/2)+atan(1/3)) is valid: the inner sum is in the first quadrant and has tangent1. It is distinct from the usual Machin identity, but either supplies a valid rational pi enclosure.

If the provider uses Machin instead, pi/2=8*atan(1/5)−2*atan(1/239). With atan intervals [L5,U5] and [L239,U239], the correct interval is [8L5−2U239,8U5−2L239]. The negative term must reverse endpoints. An elementary independent identity check is tan(4atan(1/5))=120/119 and tan(4atan(1/5)−atan(1/239))=1 on the first-quadrant branch. Likewise theta=pi/2−atan(X/Y) uses [piLo−atanHi,piHi−atanLo].

No Math.atan2, Math.atan, Math.PI, tolerance-fit epsilon or observed sample residual may narrow these rational intervals. Those values can appear only as separately labelled observations.

## 4. Stored chart nodes and the entire P1 interval

At exact dyadic ui enclose theta(ui) in [Li,Hi]. Choose one generated stored node sHat_i by nearest conversion of the exact midpoint R*(Li+Hi)/2. Its certified error is:

    e_i = max(|sHat_i−R*Li|, |sHat_i−R*Hi|).

This includes both transcendental interval uncertainty and actual binary64 node rounding. Keeping only half the angle interval width or a generic ulp epsilon would omit the stored-node residual. Form each difference with the exact represented R and sHat_i; do not first round R*Li, R*Hi or sHat_i/R in ordinary floating arithmetic.

Require strictly increasing finite stored s nodes, increasing exact u nodes and a nonzero representable cell width. For s between consecutive stored nodes, U(s) is their exact affine inverse. Put t=(U−ui)/deltaU. The stored-node line s=(1−t)sHat_i+t*sHat_j and true angle secant differ by at most max(e_i,e_j). The interpolation remainder gives:

    |R*theta(U(s))−s| <= max(e_i,e_j) + R*M2_u*deltaU²/8.

Thus this is a whole-cell proof, not a sampled inverse check. Include original-domain affine conversion and later stored-UV rounding separately. Avoid extrapolation beyond the stored chart. Endpoint s rounding uncertainty also belongs in the chart-clearance/domain contract; no authored glyph point is silently moved to the grid.

The positivity of the affine slope and K prove angle monotonicity before generated-UV storage. They do not prove that independently rounded edge endpoints preserve order, prevent cross-edge intersections or bind to their stored world curves. Those require their own residual/separation checks.

## 5. Degree4 source circle defect

For exact represented polynomials Q=D−R²W², a Bernstein control hull gives Qmax=max|Qi|. Since r=sqrt(D)/W and r+R>=R:

    |r−R| <= Qmax/(R*mW²).

A safe rMin=R/2 follows when Qmax/mW² <= 3R²/4. Differentiating r²=R²+Q/W² then gives:

    max|r'| <= (QprimeMax/mW² + 2*Qmax*WprimeMax/mW³)/(2*rMin).

All derivatives must use the same u scale. This bound is conservative but valid. Very small R is not harmless merely because coordinates fit10000: divisions, bit sizes, radial/thickness ratios and combined error budgets can still force refusal.

For the exact quarter-template Cartesian poles and weights [1,w,1], independently:

    Q(u) = 2R²(2w²−1)u²(1−u)².

Its degree4 Bernstein vector is [0,0,R²(2w²−1)/3,0,0]. This identity is a useful test oracle for the template, not a replacement for a generic rounded-center/pole proof. The stored w must stay unchanged. Math.SQRT1_2 is the binary64 value just above the real 1/sqrt(2), so its exact 2w²−1 is positive. A one-ulp decrease crosses below the real value and reverses this template defect sign. Establish signs with exact represented-number arithmetic, not a rounded subtraction close to zero.

Small independent relations for tests, requiring no atan sample oracle:

- u0: C=(R,0), theta=0, Q=0, r=R.
- u1: C=(0,R), theta=pi/2, Q=0, r=R.
- u1/2: C=(a,a), a=R*(1+2w)/(2*(1+w)), so theta=pi/4 exactly for w>0.
- At u1/2, Q=R²*(2w²−1)/8 and r²−R²=R²*(2w²−1)/(2*(1+w)²). The original stored native weight therefore gives positive radial defect inside the quadrant.
- Symmetry: X(1−u)=Y(u), W(1−u)=W(u), theta(1−u)=pi/2−theta(u); theta''(1/2)=0.
- Endpoint theta' values are 2w; theta'(1/2)=4/(1+2w). A rational Bezier quarter is not angle-linear even for the ideal weight.
- The template K has degree2 Bernstein coefficients 2R²*[w,1/2,w], an immediate positive monotonicity proof for R,w>0. The generic K computation must reproduce it.

These are algebraic/local oracle relations. They do not establish the global M2 or storage certificate by themselves.

## 6. Nominal versus actual arclength and radial height

For r>0 and theta'>0, source speed is sqrt(r'²+(r*theta')²). Reverse triangle inequality bounds its difference from R*theta' by |r'|+|r−R|*theta'. Hence on any oriented subinterval:

    |actualLength−R*deltaTheta| <= rPrimeMax*deltaU + eRadius*deltaThetaUpper.

For the full normalized quarter, deltaU=1 and deltaThetaUpper can be the certified pi/2 upper endpoint. Thus the peer's max|r'|+eRadius*piHalfUpper is valid only with that normalized full interval and positive-angle orientation. A radial-distance bound alone does not bound arclength.

The private map's s variable is nominal R*theta. If an eventual product promises distance measured along the actual stored carrier, it must add this nonzero arclength drift to the semantic guarantee, or implement a different actual-arclength inversion. For the current map, |actualLength(U(s))−s| <= eMap+deltaArc. Do not call nominal and actual distances identical just because the defect is small. A smaller honest first contract is nominal-circle arc coordinates plus an explicit source-carrier drift bound.

Outer homothety lambda=(R+h)/R has an additional meaning limit: the actual radial offset from the actual stored carrier is h*r(u)/R, not constant h. Its departure from h is bounded by h*eRadius/R. A provider may expose nominal radial homothety with that defect accounted for, but cannot claim an exact constant normal offset from a slightly noncircular source. A seat homothety needs 0<=b<R to retain positive radius/Jacobian.

## 7. Combined world error and refusal budgets

For comparison with the ideal nominal circle, base placement obeys distance <= eRadius+eMap by inserting the ideal radius-R point at the actual mapped angle. Outer homothety multiplies this bound by lambda. Font flattening can use the ideal chart map's Lipschitz factor L=1+h/R and then the provider's global pointwise placement error by triangle inequality. L is not automatically a derivative bound for the actual P1/source map; using it directly for that different map would require a separate derivative/Jacobian proof.

Keep allocations distinct, then sum them outward against the exact user/request tolerance: ideal-font flattening, source radial defect, chosen nominal/actual arclength semantics, P1 map distance, source/outer coefficient storage, UV storage, world curve storage, binding, and later rebuild/Boolean error when present. Do not double count a term and call the inflated value exact; do not omit it when it is required by the promised reference shape. The private inverse-only stage need not certify a whole text or solid budget that is not yet implemented. Mapping tolerance and native edge/carrier binding tolerance have different purposes; neither can silently substitute for the other.

A valid P1 approximation can remain exactly on the original rational carrier in exact arithmetic despite having a finite angle-map error. Conversely, a good angular map does not prove stored curve/pcurve binding. Distinguish these tests and bounds.

The 128-bit atan argument cap bounds an individual49th power but does not alone prove every later sum/comparison fits8192 bits: distinct large rational denominators can multiply during interval combination and cross-products. Charge and preflight every fixed integer step; keep the existing context/bit guards. Cache fixed atan/pi intervals request-locally. A budget refusal is correct; increasing the guard, truncating terms, reducing grid resolution or moving source points is not a numerical repair.

Refuse when any positive denominator/quadrant/monotonicity proof is unresolved, source defect exceeds allocation, combined bound exceeds request, stored nodes or UV endpoints collapse/reverse/escape domain, chart endpoints are ambiguous, exact arithmetic exceeds budget, or cell/edge/pole limits are reached. Fixed depth8/256 intervals is an explicit support ceiling; a tight requested error that needs more cells must refuse, not receive a coarse approximation described as meeting the tolerance.

This report supplies a mathematical review of the stated contract. It does not approve a particular implementation, imported cylinder family, source extraction, glyph topology, pcurve/world binding, positive material volume, B-rep shell or Boolean result. Those remain separate provider and integration gates.

## Final temporary-candidate contract check

The final inverse-map candidate explicitly rejects p0.y!=0. Together with nonnegative XY and the certified Dmin>0, this forces p0.x>0, so theta0, nominal s0 and actual source-start length L0 are all exactly0. There is no hidden −R*theta0 origin bias over the admitted near-quarter input family. A finite positive actual knot-span width is also required.

For each dyadic share, node() forms exact native U=a+(b−a)*share with rational arithmetic. It uses a Number arithmetic candidate only if q.compare(q.from(candidate),exact) proves equality; otherwise q.exactFloat(exact) requires an exactly representable binary64 U. Thus an unrepresentable intermediate native knot-domain U is refused, not silently rounded. Accepted native-U endpoints retain the exact affine correspondence to normalized-original-full-span shares. The later consumer must still form inverse interpolation/composition in exact affine arithmetic; no general Number interpolation/evaluator error bound is supplied.

The returned meanings now explicitly say quantified-near-quarter-caller-retains-native-provenance and exact-affine-certificate-no-number-interpolation-bound. Field names arclengthDrift and actualLengthResidual identify a scalar length residual, not existence of an actual-arclength point outside the source interval. No Number inverse evaluator is returned. These changes resolve the identified origin/domain naming concerns without claiming a cylinder adapter, composition, binding, trim or solid. This was a final read-only code check; no candidate was executed or modified.
