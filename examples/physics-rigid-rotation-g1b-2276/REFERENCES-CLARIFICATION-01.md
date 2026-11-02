# G1b reference and load-order clarification 01

PROPOSAL_ADDENDUM_AUTHOR_ONLY. The three original proposal documents remain byte-identical. This addendum clarifies their planned work and protocol; it authorizes no implementation or numerical call. Phase M has no principal controls. Future Phase T does not begin without actual M PASS and a separate parent freeze.

## 1. Principal-control truth and window ledger

The48 planned Taylor-window evaluations cover only the general off-axis plant: M2 windows per precision, then T reuses those exact two authenticated windows and adds22 per precision. Zero/t0 controls are exact. Negative q reuses the same general R/omega bank and explicitly reverses the quaternion sign; any rational negations are counted in the existing scalar ceiling.

T's three principal controls do not launch another Taylor, ODE, trig or square-root evaluation. Reuse the actual accepted G1a80/120 principal-z bank row:

`principal:4803839602528529/576460752303423488`

This is the native dt1/120, initial identity q and unit positive z spin. Require the G1b control dt word and unit spin word to match that authenticated G1a input exactly. Require both saved precision proofs and their enclosures, positive-trace/sign interpretation and actual Context settings/flags; no display decimal or producer pose is substituted.

The reduction is physical: with diagonal positive inertia and only body omega_j=1 nonzero, l=I_j*e_j and l cross D*l=0. The fixed body axis maps to the same world axis throughout, so R is uniform unit rotation about that axis, independent of the value of I_j. This justifies reusing pose/omega truth for a different triaxial tensor. It does not justify reusing the old G1a mass, momenta or energy. All G1b state-derived volume-integral L/E/norm/COM/linear audits still use the actual G1b geometry.

For principal x use proper cyclic P with row-index permutation[2,0,1]; for principal y use[1,2,0]. Both are orientation-preserving3-cycles. Copy the interval data as R_j=P*R_z*transpose(P), q_j.xyz=P*q_z.xyz, q_j.w=q_z.w, omega_j=P*omega_z. These operations are index permutations with no rounding, trig, ODE or new analytic sample. They do not permute the G1b model or its inertia. Principal z copies the row directly. Verify the literal permutation matrices' axis/basis/determinant identities once as DATA/symbolic proof; if a scalar arithmetic implementation is used instead, count those operations inside the existing ceiling.

Consequently the original108 endpoint Decimal sqrt ceiling is retained as a ceiling; planned new G1b q extractions need at most96 endpoints for24 general nonzero times at two precisions. The12 formerly available endpoints for principal truth are unused, never relabelled as observed work. Principal reuse requires0 new reference sqrt/trig/Taylor work. Initial/accepted control-state invariant audits remain part of the110 Phase T audits.

Required G1a authority pins (repo-relative; no re-execution):

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| examples/physics-rigid-rotation-g1-2276/evidence/g1a-repair-02/reference/analytic-bank.json | 174532 | `d237da7777cb95ce1a1fc7d2e974a8da9262976f0137b35c7a385ab62fa0f99a` |
| examples/physics-rigid-rotation-g1-2276/evidence/g1a-repair-02/reference/summary.json | 16912 | `b1dcfbf24f7894dbba51647b5aa695f647e39efd6def41a62db58bf81a633f42` |
| examples/physics-rigid-rotation-g1-2276/evidence/g1a-repair-02/reference-final.json | 21551 | `581d0645a4907d026be49f166bee3f0a0e6cb23903b188b9ff91d3a4cf49005f` |
| examples/physics-rigid-rotation-g1-2276/evidence/g1a-repair-02/summary.json | 13796 | `a5de3e5a74b50404b9499744731cf15e2dfbeba1f60d873df76e55d80cb13e1d` |
| examples/physics-rigid-rotation-g1-2276/evidence/g1a-repair-02/input-raw.json | 51725 | `c4f477062679febde74f01c178eaa4df5c105e9623f56c99ef237d72b18e978d` |
| examples/physics-rigid-rotation-g1-2276/REPAIR-RESULTS-02.json | 98940 | `417252e8e450f602fb2918bab6e8aa2bac879efd15f73df7a138a9974a457a40` |
| examples/physics-rigid-rotation-g1-2276/REPAIR-RESULTS-02.md | 7447 | `16fca445a198b7b1acf110ee3825a81ca798edaaa10a7109b2e02ccd93f58e73` |
| examples/physics-rigid-rotation-g1-2276/repair-reference.py | 42638 | `1115b0e79eb952b0e9ae8a324cf92c17f4e16c8b3e3705ff27306aae08c515d9` |

T must authenticate these exact artifacts and the bank row selection/reduction before using them. If unavailable, stop; do not silently compute a new reference outside the declared ledger. M may pin them for provenance but does not use principal truth or add controls.

## 2. Phase M source/native constant observation order

After complete source/tool/authority authentication and the bounded build, start the one reference child and receive its READY line. READY certifies no trajectory/constant result. Evaluate only the actual staged SOURCE module's constant initialization next: three Math.pow calls for exponents3/5/7, native a/b arithmetic and the fixed27-weight expansion. Observe all actual resulting F64 words through a private copied DATA record. This is declared candidate constant math before a World, not a hidden warmup, extra oracle call or Native result. Reference code never imports this module.

Request1 INIT supplies the raw model/options and actual SOURCE coefficient/weight words. It independently certifies those SOURCE values, computes the one geometry certificate and both precision micro banks. It does not assume or certify unobserved Native values. Require INIT PASS before the Source constructor.

Requests2/3 audit the Source initial/returned step1 states. After Source physical/helper/count/ownership PASS and Source dispose, and before constructing a Native World, evaluate the actual emitted NATIVE candidate module: its own three Math.pow calls and actual27-weight expansion. Read every Native root/a/b/weight word and compare exactly with the already certified SOURCE record. This is an explicit observed DATA transfer check. Native coefficients are certified transitively only because the observed words are identical. On any discrepancy stop, preserve Source PASS plus the first Native constant failure, and construct no Native World. Do not recompute, average or choose a favorable constant.

Then requests4/5 audit Native initial/step1; dispose before request6 FINISH. Exactly init1+audit4+finish1=6requests, plus one unsolicited READY. No constant/status/graph-complete request is added. Source physical completion is conveyed by the second Source audit reply and checked together with its local counters. Native imports that would evaluate candidate constants/World code are forbidden earlier. Native manifest/identity DATA inspection is allowed earlier only when its closed import graph does not evaluate candidate/world math.

The two observed graph initializations contain6 Math.pow calls total;27 weights are expanded once per graph, with actual native arithmetic counted separately from the216 fixed Newton/3x3 updates. Phase T's new process follows the same Source-first initialization order, compares against the authenticated M coefficient authority, and reads Native values only after Source T complete PASS. Its6 native constant calls remain declared; there is0 new algebraic-reference bisection/certification solve when the exact authority words match. All other request/phase budgets remain unchanged.

## 3. Fixed polynomial, universal interval defect and prior uncertainty

At a reference window start let Y0 be the full certified enclosure of the true initial state, including all prior-window uncertainty. For each fixed z in Y0, the exact polynomial ODE recurrence defines exact coefficients a_k(z), k=0..32, with a_0(z)=z. Directed interval recurrence yields C_k containing a_k(z) for every z. It does not define a path by differentiating a freely varying interval box.

For that fixed z define the single polynomial P_z(t)=sum a_k(z)*t^k. Construct interval coefficient bounds for the complete residual polynomial r_z=P'_z-F(P_z), degree at most64, by outward convolution of the C_k. The interval Cartesian over-approximation may include coefficients that cannot occur together; it still encloses every actual r_z. Keep all residual coefficients, including nonzero rounding/dependency enclosures below degree32. They may be replaced by exact zeros only with a separate proved recurrence identity; merely subtracting the same interval expression is insufficient.

Interval Horner evaluation over0<=t<=h gives a universal residual bound eta and a tube containing every P_z. Independently verify the true-solution Picard tube/existence/uniqueness and a Lipschitz bound L on a convex set containing P_z and the true solution. Initial interval width, h*M and all coefficient/remainder widening enter these checks. Neither a midpoint of Y0 nor a sampled polynomial represents the whole initial family.

For the true solution y_z starting at that same z, error e_z(0)=0 exactly. The integral identity gives sup|e_z| <=h*eta+h*L*sup|e_z|, hence sup|e_z|<=h*eta/(1-h*L) when h*L<1. Therefore P(Y0,h) plus this symmetric error ball encloses all y_z(h). The width of Y0 is already propagated in the interval coefficients and endpoint P(Y0,h); do not discard it or count it as zero. Do not add the same initial-width error again as though P_z(0) differed from z. The resulting full endpoint enclosure becomes the next Y0.

Every coefficient/convolution/Horner/comparison/remainder operation uses counted bounded arithmetic. Both80/120 paths carry their own Y0 and independently certify each window; intersection is checked only between fully proved final enclosures. This is an a-posteriori proof for fixed polynomials over an initial family, not a claim that an interval box is itself an ODE trajectory. No adaptive order/window/precision is introduced. Failed tube, residual, existence, initial-width or intersection proof remains UNRESOLVED/NO_GO.

## Author boundary

This addendum was prepared by reading/hash-checking saved JSON and source only. No Fraction/Decimal evaluation, coefficient conversion, Taylor/trig/ODE/root solve, candidate/module load, build or World call occurred. The actual G1a result is reused at its exact saved scope, not rerun. Original G1b proposal files and every G1a/G2 provider/evidence remain unchanged. READY and STOP for parent review before M authoring.
