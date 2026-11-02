---
work_id: physics-cloth-rigid-impulse-2276
artifact_type: private-operator-plant-and-reference-proposal
status: PROPOSAL_PARENT_REVIEW_REQUIRED_NO_IMPLEMENTATION_OR_RUN
owner_role: independent-physics-algorithm-work
source_request: define one contact-free finite-cloth-vertex/off-COM-rigid-anchor impulse precursor
last_updated: 2026-11-02
---

# Scope

This is a private instantaneous impulse operator proposal. It is not a new
World, public API/schema, P6a trajectory, cloth material model or contact solver.
It does not advance position, orientation or time. Existing P5 static profiles
still reject dynamic mixtures. No source, imports, fixture construction,
reference calculation, candidate call or World is executed by this authoring.

P5 must close its remaining declared consumer/document gates before execution.
Parent must review/freeze this contract, exact cases, source graph and all error
criteria before implementation and separately authorize a run. Literal fixtures
are private reduced plants, not the canonical289-vertex P5 mass/topology data.
All prior physical tolerances, first failures, HOLDs and recording restrictions
stay unchanged. P4 remains NO_GO; its third cache cost failure ends that cache
slice. There is no fourth cache trial, profiling prefix or trajectory replay.
Whole-required-roadmap integration remains pending.

# Plant and endpoint meaning

The plant has one finite point representing an unpinned cloth vertex, and one
finite rigid body. The point carries clothId and local vertexIndex. A separate
literal cloth context declares the owner, vertex count and pin indices; a pin
cannot be relabelled as a finite dynamic endpoint. The rigid endpoint carries
bodyId and an anchor in body-local metres. IDs are distinct bounded ASCII
identities; neither endpoint is a collider ID. Never put clothId in bodyId.

Input point state: positionM, velocityMps and positive massKg. Rigid state:
COM positionM, COM velocityMps, world angularVelocityRadps, positive massKg,
proper local-to-world rotation matrix and positive diagonal body-COM principal
inertia in kg m². Principal moments must obey the three triangle inequalities.
This is a declared generic rigid inertia, not a CAD or primitive-shape claim.
No principal-axis change, hidden parallel-axis term or degree/mm conversion
is permitted. World angular momentum uses R diag(I) R-transpose.

The initial point coincides with COM+R*anchorLocalM. The ideal bilateral
velocity constraint requires point velocity to equal COM velocity plus the
world angular-velocity cross world anchor arm. External forces, gravity,
damping, contacts and other cloth constraints are not advanced in this isolated
exchange. Their reactions/work belong to a later full plant, not this operator.

Choose the impulse that removes relative velocity with the smallest change
in the mass-metric kinetic norm. Equivalently it is the fully inelastic ideal
velocity projection for an initially incompatible velocity. The point receives
J in Ns; the rigid COM receives -J; rigid angular impulse is r cross (-J) in
N m s. Apply both candidate updates exactly once. There is no force J/dt and
no dt input. Existing XPBD lambda is not this impulse.

Return detached candidate point/rigid states and a separate report. Poses,
inertia, masses, endpoint data and all nonvelocity input fields are copied
bit-exact. Reports identify both endpoint kinds and contain point/rigid linear
impulses, rigid angular impulse, relative velocity before/after and kinetic
energy before/after/dissipated energy, with explicit SI field labels. Reference
audits compute momentum, angular momentum and work from actual returned states
independently; a balanced-looking reported impulse alone cannot pass.

Inputs are writable ordinary data/arrays in tests. The operator must never
mutate either input, including on preflight refusal or an injected unknown
throw. It retains no state, callback, accepted buffer or owner between calls.
Successful output arrays may not alias any input or each other. No simulation
clock, reset, solver object or cached-impulse state is introduced.

# Literal input domain and representations

CASES.json is the only finite population in this proposal. Rational strings
encode exact intended SI values; metadata indices/counts are ordinary integers.
The native fixture converts numerator/denominator to binary64 once and records
every resulting input bit. The exact oracle parses the rational strings directly.
Native input conversion is disclosed, including non-dyadic3/5 rotation entries;
it is not silently treated as exact rational native storage.

Normal input bounds are point/rigid masses[1/1024,1]kg, principal moments
[1/4096,1]kg m², positions within±1m, anchor components within±1/2m, and initial
linear/angular velocity components within±1 in their respective SI units.
Rotations are literal proper matrices, not normalized after input. These limits
bound the finite proposed test plant, not arbitrary coupled-world support.
One deliberate nonfinite refusal uses the exact positive-infinity F64LE tag;
it never enters Fraction conversion or a linear solve.

Exact oracle admission requires exact rotation orthogonality/determinant+1 and
exact point/anchor coincidence. Native admission permits only authored rounding:
orthogonality and determinant residual at most64*2^-52; coincidence residual
at most64*2^-52m times max(1,maximum absolute input position/arm component).
Do not repair the matrix, move a point or add a pivot epsilon. All other
schema, owner/pin, range and physical-inertia checks are exact. Reference
condition number of the independent Schur matrix in infinity norm must be
at most4096; exceeding it is a plant/conditioning NO_GO, not a new tolerance.
Freeze refusal precedence: exact schema/kinds; nonfinite state; owner/index/pin;
mass/inertia and component ranges; physical moment inequalities; proper
rotation; then point/anchor coincidence. No invalid case enters a linear solve.

The '-0' rational spelling has exact physical value0 but converts to native
negative zero. Preserve input/unchanged-field raw bits. Fraction has no signed
zero and cannot certify a computed zero's sign. Physics comparisons explicitly
use its numerical zero; source/native candidate outputs must separately match
ALL raw bits, including computed zero signs. No normalization or invented
historical signed-zero authority is allowed. The two zero-sign fixtures must
give the same numerical physical solution while retaining their different
authored input/unchanged-field bits.

# Independent exact and Decimal reference

Use Python standard-library Fraction. Construct nine unknown velocities
(point3, rigid COM3, rigid world angular3) and three Lagrange multipliers.
Independently build the physical9×9 mass matrix M, the three coincidence-
velocity equations A and the full12×12 KKT system:

    M*(v_after-v_before) + A-transpose*lambda = 0
    A*v_after = 0

Derive coefficients from the stated velocities, COM inertia, lever arm and
cross-product definitions. Use a fresh explicit full matrix builder and exact
Gaussian elimination with first nonzero pivot. Do not import production code,
its condensed3×3 effective matrix, expected reactions, solver or coefficient
assembler. Derive reference impulses from M*(v_after-v_before), not a copied
candidate impulse formula.

For conditioning only, form the Schur matrix independently as A*M-inverse*
A-transpose from those full physical blocks and obtain its exact infinity-norm
condition number. This separate reference3×3 inversion must be counted; it is
not the expected-solution oracle. No threshold substitution or approximate
rank test is allowed in Fraction arithmetic.

Independently solve the full KKT equations with Decimal at precision80 and120,
using exact rational input conversion and deterministic maximum-absolute pivot
selection, first row on a tie. No production or Fraction elimination function
is reused. Decimal context, traps/flags, rounding and returned residuals are
recorded; use ROUND_HALF_EVEN and standard finite-exponent bounds. Check all
values and physical invariants, not only the multiplier vector. This is an
implementation cross-check; shared physical equations are disclosed.
Use a new owned Decimal context per solve: Emin=-999999, Emax=999999,
capitals1, clamp0; traps InvalidOperation/DivisionByZero/Overflow/FloatOperation
true, all other traps false; incoming flags all false. Restore the caller
context afterward. Do not change precision or retry after a reference failure.

Exact Fraction gates: KKT equations and final relative velocity are exactly0;
linear/angular momentum changes are exactly0; kinetic change equals its
independently computed impulse work; dissipated energy is nonnegative. Use one
declared world origin `[0,0,0]` and include both COM orbital and rigid spin
angular momentum. Decimal80-vs120 discrepancy is at most1e-60 times max(1 SI
unit, absolute reference component). Decimal120-vs exact Fraction converted at
precision120 is at most1e-100 on the same scale. No extra precision escalation.

# Proposed binary64 gates, to approve before code

These are new numerical gates for this reduced operator only. They do not
alter or inherit the old replay/contact/cloth tolerances. They are not PASS
results or material-accuracy claims. Parent may review them before freeze;
once frozen, a failure stops rather than widening a bound.

Compare each returned velocity/angular velocity and each impulse/report field
to the exact ideal reference with absolute1e-12 in that field's SI unit plus
relative1e-12 times its reference magnitude. Independently recomputed native
relative velocity, linear momentum change, angular momentum change, work and
kinetic-energy change use the same1e-12 absolute+relative rule, scaled by the
largest corresponding before/after reference magnitude and one SI unit.
Check actual state-derived impulses against reports under that same rule.
The small-inertia case is a deliberate conditioning boundary and may fail;
there is no permitted tolerance/iteration adjustment afterward.

All values must be finite. Exact endpoint/pose/input preservation and detached
ownership are bit/structure gates with no tolerance. Unknown errors are not
physical refusals. Every declared refusal must occur before a candidate linear
solve or side update and have private INVALID_INPUT plus the exact reason in
CASES.json. This is not a new package failure code or exported API.

# Finite execution and resource ledger

Execution remains NOT_AUTHORIZED. A future single frozen campaign may contain:

-13 accepted ideal cases, exact KKT solve once each; reference Schur inversion
  once each. Exact factorizations26 total (13 size12,13 size3 with three RHS).
-Decimal full KKT solves13 at80 and13 at120:26 total, no retries.
-10 invalid-case reference classifications,0 invalid-case linear solves.
  Reference requests23 total; injected-failure references reuse accepted case03.
-One source and one genuinely emitted candidate graph, each13 accepted calls,
  10 refused calls and2 injected unknown throws:25 attempts per graph,50 total.
  Successful candidate calls26; preflight refusals20; injected throws4.
  Each accepted/fault call performs exactly one condensed3×3 solve with one
  RHS, including zero-relative-velocity cases:15 per graph,30 total. Both fault
  sites occur after that solve. Refused calls perform0 candidate solves.

The two injected points are after the first candidate side is prepared, and
after both sides/report are prepared before returning the pair. A marker Error
must propagate by object identity. Both original inputs must remain byte-exact
after each fault; no half-pair output escapes. No extra successful recovery call
is needed: the operator is stateless, and every subsequent listed case uses
fresh inputs. Output-copy/alias checks add no operator/reference call.

Max matrix dimensions12×13 augmented KKT and3×6 reference inverse; each stored
Fraction numerator/denominator at most4096bits, with prechecked intermediate
products at most8192bits. Record actual factorization/candidate/refusal/fault
counts separately. No warmup, calibration, benchmark loop, repeated source
attempt or extra graph is allowed. Stop the whole prefix at first input,
oracle, physical, raw-bit, ownership, unknown or resource mismatch. Do not start
emitted calls after source failure. No fallback solver or regularization.

One campaign has170s internal,180s external owned-process-group deadline and
at most4s cleanup. Total task-owned working data plus emitted sources/evidence
is at most64MiB: reference work8MiB, candidate work8MiB, source/build16MiB,
evidence8MiB and remaining24MiB reserve. This is an owned-data budget, not an
unmeasured interpreter/code-page RSS claim. Fresh IDs, bounded stdin/stdout and
immutable source/input/output hashes are required before any mathematical call.
Use installed tools and Python stdlib only; no dependency download/service.
World/CAD/recording/trajectory calls are0 throughout this precursor.

# Deferred acceptance

An operator PASS would not enable any current public dynamic-cloth mixture.
Full P6a still needs its explicit coupling schema/profile, full sheet/pin
external reactions, position/contact residuals, substep timing, once-only
exchange, compliance/work/dissipation and dt-refinement validation. P6b needs
its own fluid mass/pressure plant; P7 needs connected nonlinear dynamics and
actuator/control gates. No merge, release, hardware or deployment permission
follows from this proposal.
