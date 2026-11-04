# One transition, no compatibility layer

This is a proposed unreleased breaking change. The four files here are a design
handoff. Do not edit old freezes, saved source protocols, archives or first-fail
outputs. No existing package/consumer file changes in this task.

## First private producer prototype

Stage the actual Source closure, its root entry and recorder together. Pin all
inputs and use a distinct staged provider identity. Replace canonical contact
state/recording definitions in that copy; do not export parallel old/new APIs.
Keep the frozen persistent cube/floor input and B geometry/dispatcher. There is
no new public profile and no force/cache equation or iteration increase.

The actual impulse primitive returns a small producer contribution: actual
onA/onB J and moment about the world origin, from the actual application anchor
and PRE pose. warmStartPoint forwards its contribution. solvePersistentPoint
sums only the applications it performed and returns that delta. World adds each
returned delta once to a fresh step pair map. A cancellation or disappearing
point cannot remove an earlier application. Keep the independent trace hook
separate; it computes no report and supplies no expected producer totals.

The first supported path applies opposite vectors at one common B anchor.
Later scalar/discrete paths can have different actual normal/friction/body
anchors. Their wrappers must capture those actual anchors or actual PRE COM
plus used arm; never reuse a stale public point to fabricate a moment. Record
both sides truthfully and independently test linear/moment reciprocity. A
nonreciprocal existing law remains NO_GO; do not conceal it by setting onA=-onB.

After all fixed passes and corrections, build Contact.points from a fresh
accepted-pose query. Remove old found-cache report aggregation. No public
average point, historical maximum penetration or final-cache impulse survives.
Build accepted contact/sensor membership and begin/stay/end from those end poses.
Keep the step wrench even when that pair has no final contact.
Also classify initial accepted geometry at World creation, with empty initial
events/wrenches and an initialized membership set. A persistent initial touch
then emits stay on step1. Include constructor geometry queries in the unchanged
resource counters, owned by creation rather than an earlier world's step trace.
Per-point signedGapM comes from the represented line's
native entry/exit parameters and normal length; it is not a sampled pair depth.

Prepare all output copies, pair buckets, active pairs, cache and recorder before
the shared commit. Failed steps keep the previous interval's wrenches and
accepted geometry. Check client mutation isolation for every nested vector.

The existing3World/8TOTAL-attempt plan is unchanged. Producer-vs-independent
event-vector/moment checks replace the failed legacy report comparison. All
other geometry, physical work/momentum, frame, refusal, retry, restore and
resource gates remain. Save the first actual failing state/trace before gates.
Use EXECUTED_NO_GO for an executed failed validation, not NOT_RUN. Later checks
stay NOT_RUN. A report fix cannot turn unexercised warm transport into COVERED.

## Canonical package and replay edits after private qualification

| Surface | Required transition |
| --- | --- |
| types.ts and root index | Replace Contact/PhysicsState/Recording canonically. Export ContactPoint, PairWrench and BodyContactWrench. No legacy aliases. |
| internal-types.ts | Keep numerical cache state private. Introduce producer contribution/bucket types; do not expose final cache as reporting authority. |
| persistent-box-contact.ts | Return actual warm/normal/tangent application contributions. Keep law separate from reporting. |
| collision.ts and other rigid application paths | Capture actual vectors and body anchors for every normal/friction application, including non-box families and large/discrete paths. |
| world.ts publicState | Copy accepted Contact.points and step pairWrenches. No old impulse fields or averaged contact point. |
| world.ts domain constructors/mocks | Add schemaVersion2 and mandatory pairWrenches[]. Current cloth/fluid contact arrays stay empty. |
| active pair/event state | Derive contact/sensor transitions from accepted membership. Transient force history belongs in pairWrenches. |
| replay.ts / replay-validation.ts | Emit/version-check2; exact new state/contact/wrench keys; validate ordering, uniqueness, collider owners and finite vectors. Wrench pairs need not occur in contacts. |
| replay-json.ts | Write/read only BCPHREC2. Reject old wire magic before reconstruction. Keep current resource and signed-zero rules. |
| replay-compare and recording ownership | Compare all new fields exactly; retain provider identity and atomic rollback. Reject missing/extra old fields. |
| provider manifest, root/replay builds | Pin actual changed modules and validate one coherent graph. Do not import examples into production. |

No decoder fills missing pairWrenches with[]. Recording1, old Contact impulse
keys or old BCPHREC1 bytes produce INVALID_SNAPSHOT with zero World creations.
Unknown provider identity remains a separate STALE_SNAPSHOT error after shape
validation. Keep malformed/new-state refusal and same-error rollback tests.

## Active consumers and evidence

The current inventory found active impulse readers in contact.test,
material/tangent/discrete-restitution and box-slab tests, persistent-impact/warm
tests and probe scenes. Update them to read actual pair wrench contributions.
For fixed-floor or fixed-normal analytic cases, tests may decompose J in the
INDEPENDENT fixed physical frame. They must not project a changing-frame J onto
the final accepted normal and call that the historical friction impulse.

Contact rendering reads Contact.points anchors/normals. Force/moment overlays
read pairWrenches, with their world-origin label. A fixed-reference transform is
explicit. Moving-COM spin tests retain per-event trace or orbital/projection
bookkeeping. A one-point display must not become a new force-report authority.

Update current examples, mock states, root/replay tests and public docs in the
same source transition. Derive new expectations from physical references, not
by copying an obsolete report golden. Preserve old result/source archives as
historical failures and narrower receipts. New recording fixtures use version2.

The read-only consumer inventory found no held Studio/CAD Viewer,
manufacturing/device contact readers. This is a local inventory boundary, not
proof that external consumers do not exist. Do not edit held surfaces or claim
external compatibility. The release note must identify the unreleased break.

## Public promotion remains gated

Private qualification covers the frozen two-body persistent case only. All
current rigid profile paths must be migrated and tested before a public root
can emit this contract for them. Visual profiles explicitly emit empty rigid
wrenches. No supported rigid path may silently omit an applied contribution.

Require strict Native/root/replay parity, actual public recorder restore/retry,
old-version rejection before factory calls, copying, accepted-event transitions
and affected analytic consumer checks. Preserve the same32 raw static geometry
and equilibrium receipt. Neither it nor one successful step proves dynamics,
cache coverage or the original eight-box exit.

Before adopting B into the public hot path, freeze a separate finite producer
performance contract and hardware target. Measure uninstrumented end-state
geometry plus wrench production, including8passes and the final query. Required
p95 step latency fits the selected fixed-step budget. Freeze memory/population
bounds before the run; report allocation/retention too. Missing or failed
performance evidence blocks promotion. Do not use research180s completion or
omit end geometry from the timing. No such run or production edit is authorized
by this design handoff.
