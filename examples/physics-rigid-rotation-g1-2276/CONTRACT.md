---
work_id: physics-rigid-rotation-g1a-2276
artifact_type: baseline-and-bounded-axisymmetric-rotation-proposal
status: PROPOSAL_PARENT_REVIEW_REQUIRED_NO_IMPLEMENTATION_OR_EXECUTION
owner_role: independent-physics-algorithm-work
source_request: characterize current anisotropic free rotation before a separately frozen G1a repair
last_updated: 2026-11-02
---

# Scope and authority

G1a first measures the current actual public World, then may qualify a bounded
axisymmetric free-rotation repair under a separate source/execution freeze.
This proposal authorizes no implementation, module evaluation, fixture
conversion, reference arithmetic, build or World call. CONTRACT and CASES must
be reviewed/frozen before harness authoring; actual execution needs a later
explicit parent token and fresh IDs. No baseline result is assumed.

The first execution scope is BASELINE_CHARACTERIZATION only. The future repair
population/error/reference section below remains a next-phase proposal and
requires its own parent-reviewed source/method/ledger freeze. It cannot be
started with a baseline token or added to its2World/2step budget.

The source baseline is357caa03fe3db1d1fe4939c979c9429314f6fa5f. Public box
admission already accepts general angular velocity and primitive-COM inertia.
The current free phase changes omega through external torque/impulse and
advances orientation, with no torque-free gyroscopic evolution. This motivates
the experiment; it is a source finding, not a measured numerical failure.

Keep the existing cubic-box P4 and spherical P3 laws, arithmetic/gates and all
historical first failures unchanged. Current capsule inertia is its explicitly
isotropic proxy and gains no inferred gyro defect. The completed private P6
instantaneous impulse PASS advances no orientation/time and is unchanged.
P4 NO_GO/cache-slice termination, P6 public-coupling limits, P7 prerequisites,
HOLDs and whole-roadmap integration pending all remain. There is no public
activation, second World, runtime mode/compatibility engine or release here.

# Literal plant and frames

Baseline: one homogeneous1kg box with half extents[1/10,1/10,1/5]m, centered
COM/position[0,0,0], local collider identity, XYZW local-to-world quaternion
[0,0,0,1], world omega[1,0,1]rad/s and zero linear velocity/gravity. No other
bodies, contacts, joints, domain entities, sensors or CCD. Empty commands.
Actual public profile is rigid-discrete-v1, direct broad phase, dt1/120s.
Restitution/friction are explicit zero. CASES fixes all model/options fields.

SI is m/kg/s/rad in the declared right-handed frame. Body axes1,2 are the equal
moment axes; body axis3 is the symmetry axis. Omega is a world vector. Pose is
about COM; no parallel-axis term or unmeasured CAD tensor is involved.

Rational strings define intended literals. The future harness converts a
unique literal model/options pair to native binary64 once, records every raw
word, and makes detached copies. No old-config translator or private World is
permitted. Reference geometry, initial omega/quaternion and dt use the exact
rational values of those recorded native words. Intended decimal/rational
inputs remain separately recorded, including their native rounding error.

# Baseline acquisition and first-failure rule

Parent explicitly selected paired BASELINE_CHARACTERIZATION acquisition:

1. Build/authenticate actual public source and genuine emitted package roots
   from the immutable baseline. No candidate module substitutes for World.
2. Source: construct1World, getState once for before state, step([]) once and
   retain the returned after state, then dispose once.
3. Native: the same1constructor/1getState/1step/1dispose sequence on a detached
   identical input. No getModel/query/extra read or recovery call.
4. Close capture and both disposal paths. Only now run independent physical
   invariant classification from the saved input/before/after bytes.

Full successful acquisition counts:2 constructors,2getState calls,2steps,
2disposals;0queries/getModel/recorders. Finite/schema/input-copy/alias/API
guard failures stop capture immediately, so the later graph may be NOT_RUN.
Disposal is in owned finally paths. Actual attempted/completed calls and
unknown disposal outcomes are separately recorded. No World API, including
dispose, is called after physical classification starts.

Both observed states must be finite and have the expected one body/no-contact/
no-joint schema. Preserve original model/options raw bits and detached output
ownership. Source/native before/after public fields including identity must match all raw bits;
graph-specific external provenance stays separate; no public field is normalized out.
These capture guards do not compute an angular-momentum law early.

Classification evaluates source first and preserves its first physical NO_GO.
The native assessment then uses already saved data; it advances no World and
does not waive the source failure. This is a paired baseline observation,
not a SourcePASS-to-Native qualification sequence. Whole baseline physics is
never labelled PASS: use CHARACTERIZED_PHYSICAL_NO_GO if a physical gate fails,
or CHARACTERIZED_NO_FAILURE_OBSERVED if this finite experiment finds none.
In the latter case reassess before proposing a repair. A reference/unknown/
resource error stops classification; no further comparison is invented.

The original raw snapshots, complete first failure, exact residual/bound and
graph/provider hashes remain immutable. A later repair has a separate WorkID/
freeze and never overwrites or reruns this baseline. No repair World call is
automatically authorized by acquiring/classifying the baseline.

# Independent exact geometry and observed-state oracle

Use stdlib Fraction with exact native-word decoding. Derive homogeneous cuboid
mass/COM/inertia by volume integration, not by importing/copying the production
principal-inertia shortcut. For each axis, form the nine monomial moments
integral(-h_i..h_i,x^n dx), n=0,1,2. Density is m divided by the product of the
three zeroth moments. Independently integrate tensor entries
rho*integral((r dot r)*delta_ij-r_i*r_j dV) and COM first moments. Check
integrated mass=m, COM=0, symmetry/off-diagonals0 and the intended equal axes.
Retain all moment/density/tensor rationals. The native and intended geometries
must be distinguished; neither producer inertia nor contact/report data is
an oracle input.

For each observed F64 quaternion q=(x,y,z,w), let s=x²+y²+z²+w². Require s>0
and the quaternion norm gate below. Use the exact proper rotation represented
by q: diagonal entries1-2*(sum of the other two vector squares)/s, and the
usual signed2*(xy±zw),2*(xz±yw),2*(yz±xw) off-diagonals divided by s.
This constructs R(q/|q|) using only rational arithmetic; no sqrt/trig is needed.
Check R-transpose*R=I and detR=+1 exactly. This is an explicitly declared
physical interpretation of the saved quaternion, not a mutation/repair of
producer state. Also retain s-1 and all original words. q and -q represent
the same physical R; native output signs remain separate raw evidence.

Compute I_world=R*I_integral*R-transpose, L_world=I_world*omega, and
T_rot=omega dot L_world/2. Linear momentum/COM stay zero in this plant. Compare
each after state to its own observed initial state. Energy alone cannot close
the gyro finding. Report every vector residual rather than only its norm.

Baseline reference ledger after capture:1body integral certificate,
4observed-state audits/4rational proper-R constructions,0trig/sqrt/ODE/linear
solves and0additional World calls. Native/integral arithmetic may differ from
production inertia rounding; it is part of the measured error, never hidden.

# Frozen proposed physical gates

These are new G1a gates for this plant. They do not replace any old gate.
Let e=1/10^12 as an exact rational. Per component of angular momentum and for
rotational energy require abs(after-before)<=e+e*max(1,abs(before),abs(after)),
in kg m²/s and J respectively. The1 has that field's SI unit. Require
abs(s-1)<=1e-12 for each quaternion; preserve the package's existing finite/
movement guards. Linear momentum and nonmoving COM use1e-12 SI absolute
bounds. Source/native raw equality and input/ownership/state schema use no
tolerance. Exact rational reference-operation error is0; bit/resource limits
are separate refusals. Do not widen gates after observing the baseline.

# Future G1a repair reference: independent axisymmetric solution

Future scope is torque-free isolated boxes with I_body=diag(A,A,C), including
the isotropic C=A limit. Triaxial G1b, successful torque/contact/joint dynamics
and generic nonlinear accuracy remain outside. No gyro algorithm is selected
or implemented by this proposal.

For independently integrated inertia, initial R0 and body omega u0=R0^T*w0,
let fixed world L=R0*diag(A,A,C)*u0, k=(A-C)*u0_3/A, and n=L/|L|. An analytic
orientation is q(t)=q_about_world_L(|L|*t/A) * q0 * q_about_body_z(k*t), in
XYZW multiplication order. Its world omega is L/A+k*R(t)*e3. Equivalently
body u3 is constant and (u1,u2) rotates at (C-A)*u0_3/A. Derive/check both
representations and the analytic derivatives Rdot=[omega]x*R and Euler's
equations independently; no candidate coefficient/update helper is reused.
Zero L uses the exact constant state, without dividing by |L|. Principal-axis
and isotropic limits must agree with uniform spin. q/-q controls use the same
physical rotation, with the separately declared initial quaternion sign.

Use separate Decimal80/120 interval evaluations from original native rational
inputs. Contexts use directed FLOOR/CEILING endpoint rounding, Emin=-999999,
Emax=999999, capitals1, clamp0; trap invalid/division-by-zero/overflow/float
conversion. Restore caller contexts. Enclose square roots with neighboring
rounded values and verify endpoint squares. Freeze128 Taylor terms per sin/
cos with exact alternating remainder bounds; every half-angle must remain
within[-2,2]. No pi/argument reduction is needed for these literals/duration.
The exact remainder majorants at2 are retained. No adaptive terms, precision,
reference integrator or finest-run-as-truth fallback is allowed.

Every reported physical reference component must have interval width<=1e-65
at80digits and<=1e-105 at120digits, in its SI unit (dimensionless for R/q).
The120 enclosure must be contained in the80 enclosure; analytic residual
intervals must contain0 and have the corresponding width bound. Candidate
errors use the worst endpoint distance, so reference uncertainty is charged,
not discarded. Failure of an enclosure stops before candidate calls.

# Future finite qualification population and error

CASES defines two1s trajectories: an isotropic cube control and the off-axis
axisymmetric box, each dt1/60,1/120,1/240. Accepted step counts60/120/240 give
the same exact elapsed sum n*dt_native across grids; prove that raw power-of-two
relation as DATA before math. The displayed World time n*dt is rounded output
and must match the public clock rule. Reference time is the exact n*dt_native,
with intended1s separately disclosed. Matched observations are0,1/4,1/2,3/4,1
of that common duration. Do not call public step with an alternate dt.

Conservation/norm/COM gates above apply at every initial/accepted state.
At matched observations, compare world omega component error and physical R
entry error with absolute limits1e-3,5e-4,2.5e-4 for the three grids plus
e*abs(reference), in rad/s and dimensionless units. Report q(t) too; R gives
the sign-independent rotation gate. These are proposal error limits to approve
before a candidate is authored; no prediction of method order or PASS follows.
For each trajectory/observable, maximum matched-time error must reduce by at
least1.8 on each halving when the preceding error exceeds1e-11; use the bound
next<=max(previous/1.8,1e-11). If all three lie below1e-11, classify ROUNDING_FLOOR
and make no measured-order claim. All absolute and conservation gates still
apply. A failed grid stops; no tuning or skipped coarse case.

Four one-step controls cover principal-axis spin, positive zero, negative-zero/
negative-quaternion input, and q0=-identity with off-axis spin. Physical zero/
q-sign relations and all raw inputs remain distinct. No computed zero sign is
invented by Fraction. One source and one true emitted graph must match every
returned numerical word after each required physical audit PASS.

On the existing axisymmetric dt1/120 World at step0, test4 declared command
refusals and3 unknown precommit faults before the scheduled trajectory. After
each, getState once and require complete accepted state/clock/cache identity.
The first ordinary scheduled accepted step is the recovery check against its
original analytic time; it is not an extra call. Markers propagate by identity.
No half orientation/omega state may commit. Internal stage sites/call bounds
and any proposed fixed update must be source-frozen before execution; adaptive
substeps/iterations, fallback and hidden conditioning tolerances are excluded.

Future qualification requires complete source PASS before native constructors.
It stops on the first input/reference/raw/physical/ownership/resource/unknown
failure before any later World call. This differs explicitly from paired
baseline characterization. Public activation and any affected P2/P3/P4/P5
retention work need a separately reviewed bounded integration contract after
this leaf; this contract authorizes neither adoption nor replay of old passes.

# Finite ledgers and resources

Baseline and future repair are separate fresh campaigns, each170s internal,
180s external owned-process-group limit and<=4s cleanup, with no retries.
Installed stdlib/tools only. Task-owned logical data envelope64MiB partitions:
reference work8MiB, World/harness work8MiB, source/build16MiB, evidence16MiB,
reserve16MiB. Baseline evidence has an additional2MiB cap. This does not claim
compiler/interpreter/tool heap or process RSS<=64MiB. Preflight simultaneous
roots/encoding, actual artifact bytes and counter/provenance limits before
math/calls; use no unexplained reserve as measured memory.

Future per graph:10World constructors,844 accepted steps (840trajectory+4
control),4refused attempts,3fault attempts;851step attempts,17getState calls
(10initial+7after refusals/faults),10disposals. Across graphs:20constructors,
1688accepted/8refused/6fault=1702attempts,34getState,20disposals. Queries,
getModel, recorders, CAD and external loads accepted as dynamics are0. Rotation
stage-entry ceiling847per graph/1694total covers accepted+fault calls; the
numeric-limit guard refusal precedes it. The actual update/helper ledger must
be specified in its source freeze before any execution; no solver is selected
by this proposal.

One future reference process can precompute9 unique nonzero analytic sample
times at80/120 (18evaluations, at most72 sin/cos evaluations of128terms each),
and at most18 square-root evaluations, then serve at most1708initial/accepted
state invariant audits. Time0 and zero
states are exact; q-sign controls reuse the declared physical reference with
an exact quaternion sign map. No extra reference call is needed after a
byte-identical refused state.2geometry certificates (cube/axisymmetric body),
0ODE/numerical linear solves,<=10000000 Fraction scalar operations and the
fixed transcendental counts. Reuse saved reference values across source/native;
never regenerate a bank to hide a failure. Baseline audits use<=10000 Fraction
scalar operations. Stored Fraction numerator/denominator<=4096bits; products
prechecked<=8192bits, addition bound8193bits; maximum serialized rational
field1300characters. A bound failure stops; it never raises the bound.

Parent freezes exact source/emit/tool/helper manifest and process/IPC starts
before any run. Preserve raw input/states, exact residual/bounds, reference
enclosures, counts and all first failures. On timeout, retain original durable
progress as a lower bound with in-flight actual work UNKNOWN. No silent0,
unfinished prefix PASS or cross-runtime bit claim is permitted.
