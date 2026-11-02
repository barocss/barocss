# Unreleased breaking contact and wrench contract

Status: design only, before implementation/build/execution. Date: 2026-11-03.
This task writes four new files only. Existing source, prototypes, freezes,
archives and first-failure protocols remain immutable.

## Actual reason for the break

The Source-private phase01 run executed1World/1attempt/1accepted step. It
recorded168actual applications,9geometry queries,20query points and8corrections.
The checked momentum/spin/work/geometry prefix passed. The first public-report
vector check failed in X by0.06810993686254845Ns against1e-10Ns. Later report
moment, fault/retry/replay and second-step checks were NOT_RUN. Warm frame reuse
was NOT_COVERED. The raw A_step1 control label NOT_RUN means validation did not
complete; it does not mean that the step was unexecuted. Record EXECUTED_NO_GO.

The final active cache sum is not the step-integrated applied impulse. A final
geometry point is not a historical force lever. This contract removes that
ambiguity. It does not repair cache dynamics or claim a full phase PASS.

## One new authority per quantity

Replace the canonical PhysicsState with schemaVersion2. Contact is accepted
geometry only. Remove its old pair-level pointM, normalAtoB, penetrationM,
normalImpulseNs and tangentImpulseOnBNs fields. Do not retain aliases, deprecated
copies or an old/new reporting mode.

Contact.points contains each validated accepted-pose B anchor, paired native
surface witnesses, its normal and signed native gap. There is no unvalidated
average point. Each point passes surface1e-9m and represented native line/
midpoint1e-12m gates. The initial finite profile also keeps accepted absolute
paired gap1e-12m. A negative signed gap is penetration; never clamp it for
presentation. Point IDs identify geometry in that accepted snapshot, not a
promise of persistent cache correspondence or a per-point impulse authority.
For the represented line anchor+t*normal, signedGapM is
(native_B_entry_t-native_A_exit_t)*length(normal). It is a per-point native gap,
not a historical maximum depth or a claim of minimum translation over all axes.

PhysicsState.pairWrenches is a mandatory array on EVERY state. It is the contact
impulse integrated over the most recently accepted step, in state-frame world
coordinates, with moments about O=[0,0,0]m. It contains actual onA and onB body
contributions. These allow reciprocity to be checked without inventing a
negative moment for a path that used a different actual body anchor.

For every actual body application at anchor p with impulse J, producer code
accumulates J and p cross J into that body's pair bucket. The producer owns the
bucket. It is not reconstructed from observer records, final cache values,
accepted geometry, averaged points or projection onto a final normal. Negative
solver increments and warm applications count exactly once. Removed points do
not erase earlier contributions. Position correction, gravity, user commands,
joints and visual-domain constraints are not contact pair impulses.

Initial step0 has pairWrenches[]. Each next candidate step starts a fresh bucket.
Keep a pair if any actual contact application was nonzero, even if its final
vector cancels to zero. Zero-only calls do not create a pair record. Repeated
getState returns the last accepted interval, not a new accumulation. A rejected
step leaves the previous accepted geometry, wrenches, events, cache and log fixed.

PhysicsState.events retain begin/stay/end vocabulary but are derived from contact or
sensor geometry at successive ACCEPTED end poses. A transient step impulse
does not invent an accepted contact. Wrenches may exist with no final contact;
final contacts may exist without a wrench. A transient sensor with no accepted
overlap produces no end-pose event. Sensors never create contact wrenches.

All pair arrays use deterministic lexical body order and correct collider
owners. Wrenches are unique per pair and sorted. Their moments can contain a
free couple; the API does not promise a representative force point. Conversion
to a FIXED reference R uses M_R=M_O-R cross J. This does not replace moving-COM
spin accounting, which needs actual event COMs or the full orbital/projection
transport. Do not compute spin change from the final COM alone.

Cloth/fluid states emit pairWrenches[] and contacts[] because their current
visual-domain constraints are not rigid pair-impulse reports. Other unmodified
state fields remain. Empty is explicit, never a decoder default for missing data.

At creation, classify the initial accepted rigid geometry too. Step0 can have
Contact.points but has events[] and pairWrenches[]. Initialize membership from
that geometry: an initially touching pair that persists has stay on step1,
not a fabricated begin. Record this breaking initial-state rule in tests.
Initial geometry queries count toward the same resource caps. The fixed plan
uses at most65queries including3initial queries and the partial unknown fault,
so the existing72query/288point/7776anchor caps need no increase.

## Producer and transaction boundary

The actual application primitive returns a producer wrench contribution.
warmStartPoint returns its actual application contribution. Each point solve
returns the sum of its actual normal/tangent applications, not the final cache.
World adds these deltas once to the step-local pair map. The independent trace
still captures actual arguments/poses/velocities and recomputes its own sums.
It must not use the producer contribution as its expected answer.

After all fixed solver passes/corrections, query accepted geometry independently.
Prepare copied Contact.points, copied pair wrenches, accepted event membership,
cache and recording before the assignment-only shared commit. A B refusal,
nonfinite contribution, output allocation error or recorder failure discards
all candidate changes. No legacy detector/report fallback is allowed.

## Recording and first prototype

Recording.version becomes2 and finalState requires schemaVersion2 and
pairWrenches. The wire magic becomes BCPHREC2. Reject old version1, old magic,
old contact keys and missing new keys with INVALID_SNAPSHOT before creating a
World. No converter, dual decoder, default empty wrench array or replay fallback.
Keep current resource limits, signed-zero encoding and provider identity checks.

First implement this contract in a NEW private Source stage only. Use the same
two-body persistent baseline, B geometry/dispatcher, sampled-depth definition
and independent fixed-direction depth gate. Keep actual force/cache equations,
8outer/8inner iterations and admission limits. Do not repair a cache failure by
changing reports. Repeat the frozen3World/8TOTAL-attempt plan including the two
refusals, clean retry and hidden one-frame restore. Stop at the first real NO_GO.

Compare producer pair vectors/moments with an independent sum of actual apply
events at1e-10SI. Keep momentum/spin/midpoint-work/passivity1e-10SI,
tangent-plane1e-12Ns and native1e-9/1e-12m gates. Recheck accepted geometry and
accepted-event transitions. Preserve exact new-state/log rollback, mutation
isolation, repeat and restore equality. New validation labels distinguish
NOT_RUN, EXECUTED_PASS and EXECUTED_NO_GO. The same trace/resource caps apply.

Warm changed-frame reuse needs a real prior-cache hit and native correspondence.
If the run has none, it remains NOT_COVERED. A separate frozen real branch case
can follow only after this baseline qualifies; no invented cache is allowed.

## Promotion gates

This is a breaking unreleased contract, not permission to patch production now.
First private qualification is only the named persistent cube/floor profile.
Before public promotion, all current rigid impulse application paths must
produce actual wrenches and all admitted contact families need valid accepted
geometry. No unconverted rigid path may emit an empty placeholder wrench array.
All visual-domain constructors/mocks emit the required empty array explicitly.

Then migrate canonical root types/World, replay/wire validation and active
consumers together. Require strict Native/root/replay parity and actual public
World/recorder tests. Reuse the separate32-row static equilibrium receipt at its
scope; it is not dynamics or complementarity evidence. OriginalP4 remains NO_GO.

B promotion also requires a separate frozen uninstrumented performance run on
declared hardware/profile: p50/p95/max step time, allocations and peak memory.
Required p95 step latency must fit that profile's fixedStepSeconds budget.
Freeze its finite population and memory/resource limits before measuring.
An unfrozen or unrun performance gate blocks promotion. A180s research guard
or trace-enabled timing is not shipping latency proof. No performance run is
authorized by this design task.
