# G1c finite frame and input design

READY_FOR_PARENT_FREEZE; execution NOT_RUN. This is a static design at
`a30dba781cd9e0c987e08b6b87d8d9b79389cdfd`. It changes no kernel, admission,
tolerance or old receipt. The next population has eight new input pairs and
one accepted step per pair. It uses the authenticated G1b M02 providers and
the saved M02 reference endpoint 2 at both precisions. No old World campaign,
build, ODE, root or trigonometric calculation is repeated. New exact cuboid
integration performs nine one-dimensional monomial moments per audit:
144 moments across 16 Source/Native audits. This is new reference work.

## Actual support boundary

`validation.ts` admits box half extents in [1e-4, 1e3] m, mass in
[1e-6, 1e6] kg, each world-spin component in [-1000, 1000] rad/s, and raw
quaternion components in [-1, 1] with norm error at most 1e-6.
`model-admission.ts` admits fixed steps in [1/240, 1/30] s. The frame is
right-handed xyz and the quaternion maps body coordinates to world coordinates.
The current production `world.ts` still uses the uniform-world-spin update;
the repaired common-World providers remain staged.

The private G1b leaf has narrower conditions. Actual moments must be finite,
positive and pairwise unequal. Its step must be positive and at most 1/60 s.
For a general flow, with J = 1/16 and local spin u = R(q)^T omega:

- d_i = J / I_i; 2 max(i,j) abs(d_i - d_j) < 5.
- p_i = I_i u_i / J; norm(p) < 15/16.
- Each of 27 signed midpoint stages uses four Newton updates. Iterates stay
  within component magnitude 1; Jacobian perturbation is at most 1/4; each
  pivot magnitude is at least 1/4; both residual gates remain 64*2^-52 times
  their existing scales. Coefficient magnitudes remain strictly below 3.
- Original finite/component-1000/angular-movement-10 guards and the result
  quaternion norm guard of 1e-12 remain in force.

Zero and exact principal-spin reductions occur after the time/inertia check
and before the general d/p checks. They do not qualify the general flow.
These checks are runtime limits, not a theorem that every admitted state
inside them passes. Their fixed J does not give arbitrary mass/length
equivariance. Parser bounds, this guarded domain and measured finite PASS
are three different sets.

The qualified G1b plant is mass 1, actual native half extents corresponding
to [0.1, 0.2, 0.3], identity/negative-identity q and the named spins. Its
general trajectory horizon is nominally 0.1 s. The intended moments are
[13/300, 1/30, 1/60]; the actual native moments and integral moments remain
separate authorities. This design adds no new inertia aspect ratio, spin
magnitude, time-step endpoint or horizon.

## Independent transport proof

Let S and W be proper signed-permutation matrices in body and world space.
Let their chosen quaternion lifts be s and w. For positive uniform length
scale lambda and mass scale mu, set c = mu*lambda^2. For the same time:

    h' = lambda * abs(S) h       m' = mu m
    I_body' = c S I_body S^T     R' = W R S^T
    q' = w * q * inverse(s)      omega_world' = W omega_world
    u' = S u                    L_world' = c W L_world
    E' = c E                    p' = c S p; d' = abs(S) d / c

The quaternion product here is the exact Hamilton product, in XYZW order.
Reference code must use explicit rational component maps, not a production
quaternion/rotation helper or a candidate output. A transformed q keeps the
chosen continuous sign; do not select a new positive-w/positive-trace branch.
The transformed R provides an independent cross-check of the q map.

Change variables x' = lambda S x in the cuboid volume-integral
certificate. Density becomes mu/lambda^3 times the old density. Total mass,
zero COM, and the complete inertia tensor then follow from that certificate;
this proves I_body' above without the parser's primitive inertia formula.
The new audit also evaluates the exact cuboid monomial integrals directly
for each actual input. Compute observed world L and E from each returned
state and that independent integral tensor. Do not transform
old numerical residuals and call them new observations.

All transforms below have c = 1. Signed permutations preserve the Euler
cross product because det(S) = det(W) = +1. Constant frame maps preserve
Rdot = [omega]_cross R and the exact trajectory. Uniform similarity with
c = 1 leaves rotational dynamics unchanged. Both saved 80/120 interval
targets therefore transport without new ODE work. Rational endpoint
transform operations are new counted reference work; old integration counts
are provenance, not zero historical work or newly performed work.

## Eight one-step cases

Start from the exact saved M02 raw input pair. Keep its actual binary64
dt120 word, zero translation/gravity, empty commands, one dynamic box,
primitive-COM inertia, direct broad phase and no contact/joint/domain/CCD.
The common endpoint is the saved `/bank/80/2/values` and
`/bank/120/2/values`. Their ODE time is the exact recorded dt120, not a fresh
decimal 1/120 conversion. Do not add an unchanged identity baseline case.

Define P1(x,y,z) = (y,z,x) and P2(x,y,z) = (z,x,y). Set W=S=P1 or
W=S=P2 for simultaneous body/world conjugation. Their lifts can be chosen
as [1/2,1/2,1/2,-1/2] and [1/2,1/2,1/2,1/2], respectively. Define
D_x = diag(1,-1,-1), D_y = diag(-1,1,-1), D_z = diag(-1,-1,1).
The half extents below describe exact permutations/scalings of saved words.

| ID | Change from saved raw base | Initial q XYZW | Initial world omega | Exact target map |
| --- | --- | --- | --- | --- |
| B01 | W=S=P1; h'=[h_y,h_z,h_x] | identity | [1,1,1] | R'=P1 R P1^T; q'=[q_y,q_z,q_x,q_w] |
| B02 | W=S=P2; h'=[h_z,h_x,h_y] | identity | [1,1,1] | R'=P2 R P2^T; q'=[q_z,q_x,q_y,q_w] |
| W01 | W=D_x; unchanged h | [1,0,0,0] | [1,-1,-1] | R'=D_x R; q'=[q_w,-q_z,q_y,-q_x] |
| W02 | W=D_y; unchanged h | [0,1,0,0] | [-1,1,-1] | R'=D_y R; q'=[q_z,q_w,-q_x,-q_y] |
| W03 | W=D_z; unchanged h | [0,0,1,0] | [-1,-1,1] | R'=D_z R; q'=[-q_y,q_x,q_w,-q_z] |
| N01 | raw q=[0,0,0,a], a=1-2^-21 | admitted q must be +identity | [1,1,1] | unchanged R/omega/q target |
| N02 | raw q=[0,0,0,-a] | admitted q must be -identity | [1,1,1] | unchanged R/omega; negate target q |
| S01 | mu=4, lambda=1/2; m'=4; h'=h/2 | identity | [1,1,1] | unchanged R/omega/q; c=1 |

For B01/B02, q'=s q inverse(s) preserves identity initially. Omega also
permutes, but the base vector [1,1,1] is unchanged. Body-only relabeling
would instead need q'=q inverse(s); it is not the selected population.
For W01/W02/W03, rotate world omega, not the body inertia diagonal.
Never use a determinant-negative permutation as an ordinary rotation.

For S01, every positive base extent, its square, sums, and moments are far
from overflow, underflow and exponent boundaries. Binary exponent scaling
commutes with the parser's rounded operations: (4/3) is four times the
rounded (1/3), each extent-square sum scales by 1/4, and the final product
is identical. Require observed admitted moment words to equal the saved
base words exactly. B01/B02 require the exact corresponding permutation.
This is a test of distinct mass/length input with the same inertia, not
qualification of an interval of inertia scales.

## Admission and axis safeguards

`transform()` first checks the authored q. `parseBody()` then repeats the
check and divides by Math.hypot before it creates Body. `getModel()` retains
authored data. Zero-spin free flow sees this admitted Body q. The additive
`ADMISSION-NORMALIZATION-CORRECTION-01.json` already rejects the earlier
inference that initial near-unit q is an established result-guard bug.

N01/N02 have norm defect exactly 2^-21, below the unchanged admission
threshold. Before using identity targets, require the observed numeric Body
and public initial quaternion to have the specified identity values and
sign. Preserve the actual raw zero signs. A mismatch stops this case; do
not silently retarget the bank or change normalization. These two radial,
nonzero-spin cases do not cover arbitrary near-unit directions or zero-spin
near-unit behavior. Those remain NOT_RUN.

Axis classification uses exact admitted numbers. G1a needs an exactly
equal extent pair and the corresponding exactly equal moment pair. G1b
needs pairwise unequal actual moments. Near-equal dimensions can round to
equal moments. Do not add an epsilon class or assert that geometric and
rounded-inertia classes always coincide. A nonisotropic null result in the
staged overlay refuses; there is no legacy fallback. The two cyclic cases
above remain triaxial and do not exercise G1a x/y-symmetric branches.
Those later branches can reuse the paid G1a z-symmetric reference with the
same exact P1/P2 conjugation maps and an independent dispatch observation.

## Gates and adoption decision

Authenticate the original M02 raw input, geometry certificate, both endpoint
rows, provider manifests, coefficient words and their transitive pins before
use. No missing bank/provider pin permits a recomputation or fallback.
Observe actual admitted q and moments. Audit each initial and accepted state
immediately. Complete all eight Source cases and their helper/ownership
checks before Native construction. Compare Source/Native raw state words
within each new case, with each path's own provider identity. Do not demand
binary64 equivariance against old transformed candidate outputs: arithmetic
order, pivot ties and zero signs need not commute with a coordinate map.

Keep all prior gates: L/E residual <= e+e*max(1,abs(initial),abs(current)),
e=1e-12; squared-q-norm, COM and linear momentum absolute error <=1e-12;
world omega, R and continuous-sign q trajectory error <=1e-11 plus
1e-12*abs(reference), against both interval endpoint bounds at both
precisions. Preserve the 1e-24 observable-width ceiling and required
80/120 enclosure consistency after transformation. This one-step population
adds no refinement grid; refinement/order is NOT_RUN, with old 1.8/floor
receipts unchanged. Keep source-before-native, rollback, first-failure,
resource and cleanup rules. Never enlarge a cap to force completion.

A future complete PASS can add only these eight finite cases to staged
evidence. Today they are NOT_RUN. Existing G1a/G1b PASS remains limited to
its recorded plants, horizons and providers. Whole admitted range, G1a x/y
branches, general near-unit/zero-spin inputs, near-degenerate shapes, new
inertia/spin/step bounds, longer horizons, downstream kicks/motors/contact/
projection/joints/recorder/coupling, canonical-root builds and production
adoption remain NOT_RUN or HOLD as already recorded. No public support
migration, deploy, legacy fallback or release follows from this design.
All original NO_GO results, tolerances and first failures stay immutable.

READY; STOP. Static reads and mathematical design only; no kernel, World,
reference, build or numerical campaign was executed by this author.

## Static reference review

Reviewed `reference-frame.py` SHA-256
`91966d1e3d2fc3cabea2156dd670463faf70af811f05aecbf32d182e20590d19`
and `CONTRACT.md` SHA-256
`104c631ffbe0d5bb5824bae2f3661f6f9ee3c837c272e84d37f2a392d62df1cc`.
READY_FOR_FROZEN_FINITE_EXECUTION_REVIEW, not a runtime PASS.

The two cyclic row/column permutations implement simultaneous P R P^T,
with omega and the vector part of q permuted by the same P. The three
half-turn q maps are the exact Hamilton left products listed above.
Their signs agree with H R and H omega. Negation reverses interval
endpoints. The radial negative case negates q only. Both target precisions
retain ordered endpoints, width <=1e-24 and enclosure intersection checks.

The independent antiderivative moments integrate degrees 0, 1 and 2 on
each symmetric interval. Cartesian products and mass-normalized density
give the diagonal cuboid inertia, zero COM and zero off-diagonal terms by
odd symmetry. The homogeneous rational quaternion matrix is proper even
when the actual output norm has rounding error. The audit explicitly checks
orthogonality and determinant +1 before computing R^T omega, world L and E.
Initial identity/half-turn poses and spin are checked before conservation.
L/E retain the complete initial/current scale and all trajectory component
and squared-norm limits remain unchanged.

The reviewed revision counts binary Fraction arithmetic, integral powers,
endpoint negations and absolute values. It reports nine new monomial
integrals per audit and zero new ODE/Decimal/sqrt/trig work. The parent also
corrected the driver status mismatch, enforces exactly eight rows, binds
actual private moment words to the saved/permuted authority, and checks the
595-record general-flow trace population. No remaining mathematical blocker
was found in this named finite scope. Syntax, resources, provider execution
and actual PASS remain the parent's separate frozen checks. READY; STOP.

The final authored `CASES.json` has exactly the eight table rows, in order.
Its cyclic extent permutations, half-turn spin signs, positive/negative
radial literals and mass4/half-length scale agree with the target maps.
The radial decimal literal rounds to the exact dyadic 1-2^-21. The scaled
decimal extent literals round to the exact halves of the base native
extent values. No new case or unproved orientation was introduced.
