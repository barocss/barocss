# Source findings and the next bounded stage

Current source stores the first pair normal and overwrites the pair point on
later passes. It stores the maximum penetration over passes. In the persistent
branch it replaces the report with the last active point-cache sum. The cache
holds a normal scalar and world tangent vector, but no producing normal or
applied moment. These are sufficient only under additional fixed-frame and
fixed-population conditions. The current source does not certify those
conditions. The old public failures remain authoritative.

The B receipt establishes native geometry and a represented normal line for
its finite bank. It does not establish the law that applies impulses at those
points, cache transport, the semantics of an aggregate report, or a coupled
solver trajectory. This design separates those claims.

## Private stage boundary

Copy the actual physics Source closure to an owned staging directory. Pin the
exact checkout, dirty-input hashes and every copied module before patching.
The current unrelated ccd-box sign fix and manifest change remain owned by
root. Do not adopt or overwrite them through this stage.

Use the existing World factory, commands, transaction boundary and recorder.
Replace only the staged box geometry query with the pinned B constructor.
Use the explicitly approved private dispatcher to treat each B native point
list as a persistent constraint list, for FACE and EDGE. Keep the original
eight outer passes, eight inner iterations, point-order alternation, restitution
targets and normal/friction equations. No edge path calls scalar solve().
Refusal is a typed known failure. No point, pair or native boundary is omitted.

Freeze a new private provider identity for these staged module hashes and the
dispatcher. Keep recording and restore entirely in this graph. Private trace
and fault controls live outside the package public exports. Build/instrument
only after root reviews a separate implementation snapshot. This task creates
no staging directory and executes nothing.

## Event records and ownership

Use one atomic pair event for each actual call that applies a vector J to B
and -J to A. Pair order is the actual lexical body order. An event contains:

- World, step attempt, accepted cursor, outer pass, inner iteration and order.
- Pair key, point/cache key, B feature and exact native witness identity.
- Event kind: warm start, normal increment or tangent increment; actual J.
- Actual normal words and the cache producing/current frame identities.
- Common quantized solver anchor p, both exact native endpoints and query ID.
- Each body's COM x, XYZW pose, linear/angular velocity before and after.
- Cache scalar/vector before and after, and the actual source branch taken.

Snapshot raw words before/after the actual primitive. Do not infer J from the
final cache. Conversely, independently compare the observed velocity changes
with the recorded applied J. Emit zero-vector calls too. Their sequence and
ownership must not disappear from instrumentation counts.

The existing law uses the SAME solver anchor for both bodies. Keep that lever
policy. Native paired endpoints certify geometry; they do not replace either
lever. Applying tangential forces at two separated endpoints would introduce
a new couple and a different law. That is outside this stage.

Record one immutable geometry query per outer pass. Its points/normals/COMs
are frozen through that pass's eight velocity iterations. Record each actual
post-iteration position correction with poses before/after. A fresh final B
query on accepted candidate poses is separate. Its representative point must
never be substituted into an earlier event's torque or work calculation.

An append-only attempt trace can retain a rejected attempt for diagnosis.
An accepted-trace pointer and cache sidecar commit only with the World state.
Prepare allocations before the assignment-only commit block. No callbacks or
allocations enter that block. On failure, accepted trace/cache/log stay fixed.

## Independent momentum and angular momentum

For body b in one impulse event, use its actual PRE pose and arm r=p-x_b.
The independent expected changes are:

```
Delta P_b = J_b
Delta L_spin,b = r cross J_b
J_A = -J; J_B = J
```

Use physical native mass and inertia, not producer inverse-mass results as the
oracle. The first case is a uniform unit-mass cube with half extents .5, so its
physical inertia is exactly I=(1/6) Identity. Observe the producer inertia
words separately. No anisotropic free-rotation qualification is inferred.

At each application, q and x must remain fixed. Therefore the measured spin
change is I_world(q)*(omega_after-omega_before). Check it and the measured
linear change against the expected event values, componentwise at1e-10 SI.
For the whole step, include the independently computed gravity kick:

```
m*(v_final-v_initial) = sum(J_contact) + m*g*dt
L_spin,final-L_spin,initial = sum((p_e-x_e) cross J_e)
```

No external torque, joint or command exists in this case. Static floor impulse
and moment are external reactions. Record their equal/opposite values, but do
not assign a fictitious finite mass or kinetic-energy change to the floor.

Also retain the complete wrench about a fixed world origin O:

```
J_pair = sum(J_e)
M_O,pair = sum((p_e-O) cross J_e)
```

Here the pair wrench is ON B. The floor/A reaction has the opposite vector and
moment. The combined two-body world-origin moment of each common-anchor event
is zero; it is not the nonzero on-B moment used to test the public report.

The per-event arms use their own COMs. Do not combine a final COM with every
historical impulse. Transport from COM spin moments to a fixed-origin wrench
requires each event's x_e cross J_e term. Position correction changes orbital
angular momentum by Delta x cross m*v without a physical impulse; report this
geometric transport separately from spin dynamics and contact moment.

## Work and projection accounting

For an instantaneous impulse with fixed p, x and q, independent midpoint work
is the sum over dynamic bodies:

```
W_e = J_b dot (v_before+v_after)/2
    + (r_b cross J_b) dot (omega_before+omega_after)/2
Delta K_e = W_e
```

Equivalently use relative midpoint contact velocity for the pair. Check both
forms and measured kinetic-energy change at1e-10J. Do not use end velocity
alone as work. Individual warm/delta events may add energy while an iterative
guess is removed later. The physical passive check is NET contact work for the
whole step, <=1e-10J for this fixed floor, zero restitution and no commands.
No transient positive event is hidden or renamed dissipation.

Record gravity kick, drift and pose correction separately. Define U=-m*g dot x.
A correction changes positions while preserving v/omega/q. Its kinetic change
must be zero; its potential change is -m*g dot Delta x. This is algorithmic
projection energy, not force work. Semi-implicit gravity kick then drift has
the known energy defect -m*|g|^2*dt^2/2 in this case. Verify the whole-step
energy identity using the recorded kick/drift/projection phases, with that
defect visible. Do not demand energy conservation from the integrator or cancel
a contact defect with an unreported projection term.

## Frames, cache and aggregate reports

Trace prior-step cache, first-use copy and current-pass accumulator separately.
Record producing normal, current normal, native feature/point correspondence,
and whether a warm application actually happened. The current warm start applies
new_normal*old_scalar + old_world_tangent. It does not project that old tangent
onto the new plane. The current solver's tangent-speed projection also assumes
unit normal. Preserve those equations in the first instrumented stage.

Check the actual cached and applied tangent against its stated CURRENT normal
at1e-12Ns. A FACE-to-EDGE miss or a changed point ID is a genuine cold branch.
Mark warm normal-frame reuse NOT_COVERED if there is no real hit. Never fabricate
cache contents, equate row ordinals across different native features, or reset
the cache to hide an error. Native feature identities and active slab/edge sets
must accompany each ID so an accidental ordinal alias can be detected.

The final scalar/vector cache is an iterative guess, not automatically the
sum of all world vectors applied in the step. Changed frames and disappearing
points break a simple scalar telescoping argument. An entry can remain in
nextPersistentPoints although absent from the last manifold. Observe this
lifecycle; do not silently prune it in the first audit.

Keep three views separate: actual per-event force history; final accepted native
geometry; and the existing public aggregate. Independently compare the public
vector n_report*lambda_report+T_report with sum(J_e) at1e-10Ns. Check T_report
dot n_report at1e-12Ns. Compare p_report cross J_pair with M_O,pair at1e-10Nms
before calling that point a resultant force point. The final geometry normal
is not assumed to be a common force frame.

A wrench may contain a free couple and may have no single representative point.
Even when a point exists, an unweighted point average need not be that point.
Do not project sum(J_e) onto a final normal, replace the historical points with
a final query, or synthesize a centre of pressure to make these checks pass.
If the existing public fields cannot represent the measured wrench, record
REPORT_NO_GO and block promotion. No public wrench/API expansion is authorized.

## Transaction plan and stop rule

The fixed three-World/eight-attempt plan is in CONTRACT.md. Capture the one-frame
recording prefix immediately after A step1. Inject a tagged known geometry
refusal and then an unknown marker Error on attempted A step2. The unknown
fault occurs after actual staged candidate/cache mutation. Require the exact
same unknown Error object; require correct accepted metadata for the known
PhysicsError. Both attempts leave accepted state/cache/trace/log byte-identical.

Retry step2, then compare the clean two-step control and the real restored
one-frame continuation. Count restore's hidden factory and replay step. Do not
serialize/deserialize a recording through helpers that secretly create more
Worlds. Prove hidden-cache rollback through its private observational snapshot
and deterministic retry, not only public state equality.

Save each returned state and event prefix before independent gates. A physical
gate failure after a returned step is an observed accepted-state NO_GO. Do not
convert it into a synthetic precommit refusal. Stop immediately and leave later
fault/control/replay rows NOT_RUN. This rule also applies if the first step's
public aggregate already fails because earlier active points disappeared.

## Dependency order and minimal later promotion

1. Freeze this source audit. Implement the staged observer and B dispatcher only.
2. Build and run the bounded Source-private case. Preserve its first actual
   phase/wrench/report failure. Native/public/desktop rows remain NOT_RUN.
3. If a cache/frame defect is observed, freeze a SEPARATE repair contract. Across
   steps a cache is a new-step initial guess; within a step its vectors/moments
   are already applied. These require different transport rules. Do not undo a
   previous step's physical impulse or rotate an applied within-step wrench by
   changing only its scalar/vector fields.
4. Reuse root's separate static equilibrium receipt for all32 original rows.
   Each interface uses analytic cumulative mass above it and4symmetric quarter
   loads. Its exact-zero force/moment residuals and nonnegative loads apply to
   that fixed geometry only. Its original32raw points are unchanged. No World,
   QP, gap-complementarity or dynamic claim follows. The receipt satisfies this
   prerequisite but does not authorize an eight-box dynamic rerun in this task.
5. Only after the private geometry, force, work, frame, report and transaction
   gates pass, propose exact package deltas for review. Expected private paths
   are a native box feature/witness module, collision.ts feature provenance,
   contact-manifold.ts dispatch, world.ts phase/report/cache commit wiring and
   persistent-box-contact.ts only for an independently qualified frame policy.
   Private internal-types.ts additions may describe features; public types.ts,
   profiles, body limits and solver caps stay fixed. Package code must not import
   an examples module. Keep the qualified algorithm and its provenance intact.
6. A canonical strict Native/public World/recorder/replay build needs its own
   affected checks and provider identity. A Source-private result cannot replace
   it. A public representation that cannot carry the true wrench remains blocked.

The coupled solver may remain NO_GO at the existing iteration counts. No new
eight-box trajectory, convergence claim, global geometry claim or stability
claim follows from this design or the earlier finite-cell PASS.
