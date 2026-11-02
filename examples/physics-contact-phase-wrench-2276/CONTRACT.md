# Private contact phase and wrench audit

Status: design frozen before instrumentation, build or physics execution.
Date: 2026-11-03. This task authors three files only: CONTRACT.md, design.md
and source-audit.json. No engine, B prototype, manifest or old receipt edits.

The finite-cell B geometry receipt qualifies20cases/62points/1674anchors per
Source/strict graph. All32 original rows have identical words and zero movement.
It qualifies finite geometry only. The original public changing-plane tangent
and paired-point failures, old single-rounded-line failure, originalP4 exit,
HOLDs, body limits and solver iteration counts remain unchanged.

The NEXT implementation is a private staged Source copy of the actual physics
modules. It uses the existing createPhysicsWorld and recorder/replay functions,
with a distinct hash-derived staged provider identity. It adds no public API,
profile or alternate World implementation. It must not import a live product
provider or mix its recording-owner WeakMap with the staged graph.

Freeze TWO explicit deltas in that copy: B native geometry replaces the box
query, and a new private dispatcher feeds BOTH B FACE and EDGE point lists to
the existing persistent point law. Mark the dispatcher change separately from
geometry. Keep8outer passes and8inner point iterations, including alternating
point order. Keep force/cache equations unchanged in the FIRST audit. There is
no scalar-solve fallback. B MISS stays MISS; B refusal throws before commit.

Run the original two-step input: a-floor half[.2,.1,2],centre[0,-.1,0]; z-cube
half[.5,.5,.5],mass1,centre[0,.5,0],identity XYZW,velocity[.5,0,0],omega[0,0,.01];
gravity[0,-9.81,0],dt1/120,both restitution0,static friction1,dynamic friction.7,
rigid-persistent-box-v1/direct,CCD false,no joints/commands. New trajectories
come from this staged World. Do not substitute saved old poses or caches.

Events must record every actual impulse application, its common solver anchor,
its normal/frame/feature/cache provenance, body COM/pose and velocities before
and after. Record every pose correction separately. The accepted-pose B query
is a later geometry observation, not a force event or replacement lever arm.
No aggregate impulse projection or invented centre of pressure is allowed.

Independent references use exact Fractions of captured words, physical mass
and native uniform-cube inertia, Hamilton quaternion geometry and elementary
momentum/work identities. They import no solver, cache update or B candidate.
Per event and per step, require momentum, spin-angular momentum and midpoint
impulse-work residuals <=1e-10 SI. Require net passive contact work <=1e-10J.
Require actual current-frame tangent impulse dot normal <=1e-12Ns. Keep native
surface1e-9m/paired-line1e-12m gates. Do not replace any existing tighter gate.
Projection potential change and semi-implicit gravity energy defect are
separate bookkeeping terms, never hidden friction work or compensating impulse.

Compare the existing public aggregate with the actual event vector and moment
sum. A false aggregate report is its own NO_GO even if the event identities
pass. Final native geometry and historical force geometry have separate rows.
No one final point/normal is assumed to represent a changing-frame wrench.

Cache coverage requires actual prior/pass point-ID hits with their native
feature correspondence. A real FACE-to-EDGE cache miss is NOT_COVERED for warm
normal-frame reuse. It is not permission to inject an invented cache or remap
indices to force a hit. Store old/current normals observationally in a private
sidecar; do not repair or reinterpret their applied vectors in this audit.

Hard per-graph cap:4World creations and8TOTAL step attempts, including failures,
restore replay and successful retry. Frozen plan uses3Worlds/8attempts if no
physical gate stops it: A recorder step1; A known-refused step2; A unknown-refused
step2; A retry step2; clean B steps1/2; C restore the ONE-frame prefix (one hidden
World/step1); C continue step2. This is6accepted steps and2failed attempts.
Do not call serialize/deserialize helpers that secretly create/replay more
Worlds. Snapshot raw saveRecording data instead. Stop at the first physical,
geometry, report, resource or unexpected failure; unexecuted controls stay NOT_RUN.

Known refusal is an explicitly tagged private B refusal before application.
Unknown refusal is the same marker Error after a real staged impulse has
mutated candidate state. Accepted state, clock, active pairs, cache, sleep state,
accepted trace cursor and complete recorder log must remain byte-identical.
Retry and restored continuation must match the clean control in raw physics
words, with only explicitly listed world/attempt trace metadata excluded.

Derived fixed maxima:256point solves/step;512normal/tangent applications plus
at most32warm applications/step;4352applications across8attempts. At most72B
queries including final accepted queries,288query points and7776anchor checks.
These are this new phase population, not a claim that the old96-point corpus
budget covers repeated queries. The B kernel itself retains its27-member cell,
16384-bit guard and no expansion. Freeze8192trace records and16MiB output,
including64KiB terminal receipt reserve, with the existing180s outer guard.
Resource exhaustion preserves a NO_GO prefix; no caps or iterations are raised.

The initial graph is SOURCE_PRIVATE only. Native/public/desktop/trajectory and
stability qualification are NOT_RUN. Any later source/cached-frame repair needs
a new frozen delta after the first actual failure. Geometry PASS alone cannot
authorize production promotion or native-only witness authority.

Root separately completed the required zero-World static equilibrium recheck:
`../physics-box-quantized-equilibrium-2276/evidence/equilibrium-01/result.json`.
It rechecks ALL32 raw rows with analytic cumulative masses/gravity and exact
nonnegative quarter loads. Its force/moment PASS is a prerequisite only. It
does not prove gap complementarity, dynamics or the original dynamic P4 GO.
This phase task authors no overlapping equilibrium code or new eight-box run.
