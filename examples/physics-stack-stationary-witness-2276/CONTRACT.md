# Exact stationary chain witness, frozen source contract v1

SOURCE_ONLY. Root alone imports, compiles, tests, checks codecs or runs solvers.
This new private candidate does not change/adopt the existing QR solver, bridge,
strict-line, common World, public API, physical tolerances or historical failure.
Production entry solveStationaryNormal requires9 bodies:1 static+8 dynamic,
32 original directed points,8 interfaces with4 points each, one connected
floor-to-top chain inferred from signed vertical impulse direction. Opaque IDs
and original point/body order remain. No scene/pose/expected-load lookup.

All dynamic inverse masses1 and world inverse inertia24I; static inverse
mass/inertia/motion0. Dynamic free motion is [0,vy,0], all spin0, vy<=0; each
stopping load<=1. The narrower unforced/zero-BEFORE-motion/original gravity and
dt policy belongs to a later bridge: this candidate receives only the actual
NormalProblem and does not infer commands or before-state it cannot observe.
Point normals must be exactly[0,+/-1,0], contact arm components<=10. No epsilon
verticalization, snap, friction solve, impact/restitution, force/joint/CCD or
general graph support. Unsupported input is not general infeasibility.

Freeze actual unscaled coefficient words: Float subtraction point-COM, then
the original Float cross(arm,normal), then endpoint sign(-A,+B). Do not use
Cholesky/sqrt-scaled A or exact subtraction of original coordinates instead.
Decode THESE finite coefficient words and actual free velocities as exact
dyadic ratios. At each body top-down, target=-M*vFree-incoming EXACT wrench;
enumerate the4 original-index ordered3-of4 subsets of its lower support.
Exact nonzero determinant and3 nonnegative exact ratios give a candidate;
fourth ratio0 stays in the32-row output. Propagate the chosen impulses to the
lower body's OWN coefficient words, without a COM-translation shortcut.
No backtracking; <=4 triangles/interface,<=32 total. Greedy miss returns
NO_WITNESS, even when another global witness might exist. Zero target may use
all-zero ratios. Singular/negative triangles are skipped, never epsilon-fixed.

Before zero velocity output, independently recompute all dynamic6-DOF balances
from ALL original points/ratios, all32 primal zero-velocity rows, nonnegative
ratios and complementarity. The exact nonnegative dual certificate proves the
unique zero primal optimum of min1/2(v-vFree)^T M(v-vFree), Jv>=0. Zero being
feasible alone does not prove it. Static reaction is reported, not balanced to0.
Preserve fixed body metadata/pose. Canonical+0 velocity is the certified exact
result; it is not a tolerance-based rest snap. Impulses can differ from old QR.

Exact limits per call:200000 rational results,2000000 integer operations,
16384 bits for checked integers,32 triangle trials,8 interfaces,32 points.
Every exact integer arithmetic operation is counted/checked; fixed IEEE64
bit decoding, BigInt comparisons and data validation are dimension bounded.
Use reduced positive-denominator n/d;0/1 is canonical. No global cache. Actual
exhaustion is RESOURCE_LIMIT; malformed data INVALID_INPUT; physical shape
outside this profile UNSUPPORTED_PROFILE; arithmetic/certificate failure
NUMERIC_LIMIT; greedy miss NO_WITNESS. Only SOLVED_STATIONARY_WITNESS is success.
No fake QR/rank64 counters. Unknown thrown exceptions propagate.

On success expose all32 rounded nonnegative RNE binary64 lambdas AND separate
exact applied reduced decimal-string n/d ratios keyed to original row IDs.
Record both endpoint6-coefficient float words and values, actual free input,
global exact residual ratios and finite rounded reconstruction diagnostic.
Do not put new fields into old PointLedger: its old schema remains unchanged.
This candidate uses a new sidecar; no bridge consumes it yet. Returned0 state
uses exact applied ratios, not a claim of exact balance from rounded Numbers.
Original Float KKT and Decimal true-lever ledger must later pass unchanged;
their small measured residuals must not be overwritten with invented0.

Separate test seam: solveCore is private; production wrapper always count8.
An example-only exact source copy relocates the type import and appends ONE
export of solveCore plus exact test primitives. Only this copied harness can
request1/2 dynamics or directly exercise bounded arithmetic. Runner asserts
whole-copy identity. This does not admit tiny production worlds or export a
test hook from the package/root. Test primitives call actual arithmetic/core.

First paid target is the identical authenticated ALIGNED original32-point
fixture at examples/physics-stack-solver-2276/evidence/fixture-01/fixture.json.
No fixture is read by the candidate. Runner binds its SHA, immutable verifier,
all source/tools, genuine Native and Source. Independent Python Fraction
checker imports NO candidate and performs only full global matvec/normal-row/
momentum checks from the actual problem+ratios, not triangle selection/solve.
It checks coefficient IEEE words, ratio reduction, rounded-lambda words,
metadata/zero output and all dynamic balances. Its exact geometric-lever
residual is separate from the frozen Float-J exact residual.

Fixed tests freeze literal triangle weights, edge/vertex zeros, negative and
singular rejection, endpoint-rounding transfer, greedy trap (not INFEASIBLE),
unsupported graph/normals/motion, RNE/subnormal and actual work/bit exhaustion.
No execution by source author. Root runs new banks then same actual32 in
Source and genuine Native, unchanged first-patch Float verifier/oracle, and
candidate-free Fraction checker. New result determinism is required; old
individual-lambda/trajectory hashes remain historical, not an equality oracle.
No new trajectory/fullP4/API/recorder/HOLD/deployment PASS follows. Later bridge,
sidecar transport, all4 reference operations and fresh full population remain
separate authorized work. No performance claim before actual measurement.
