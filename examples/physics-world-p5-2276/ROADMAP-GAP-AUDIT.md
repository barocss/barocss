---
work_id: physics-roadmap-gap-audit-2276
artifact_type: bounded-source-only-roadmap-gap-audit
status: READY_PROPOSAL_NO_IMPLEMENTATION_OR_EXECUTION
owner_role: independent-physics-algorithm-review
source_request: identify necessary missing prerequisites without turning optional features into merge gates
last_updated: 2026-11-02
---

# Recommendation

Add precise support/verification prerequisites under the existing P1/P3/P4,
P6 and validation sections. Keep P0–P8 IDs, old acceptance and current statuses.
The strongest new current-core item is anisotropic free-rotation qualification:
the public model already admits anisotropic boxes with general angular
velocity, while the free update has no gyroscopic evolution. A second bounded
item is an evidence map for actual admitted contact-law branches, reusing the
existing independent sphere receipts and adding only uncovered required cases.

Typed mixed endpoints, coupled phase ownership and a future domain-recording
contract are profile prerequisites. Arbitrary CAD tensors, general rotating
CCD, new soft-body features and hardware/product work are not blanket current
requirements. This audit proposes no new numerical tolerance or execution.

During this audit, the parent reported the frozen private impulse campaign
actually PASSed in20.36s:50 candidate attempts/30 condensed solves/26 immediate
physical audits and0World calls, with no first failure. Its accepted scope is
the private instantaneous leaf, with no position/orientation/time advance.
G1 and later coupling prerequisites apply to free-rotation/trajectory/public
claims. They do not change that completed contract or require its rerun. The
parent owns the detailed actual metric receipt and ROADMAP status update.

Source checkpoint:105769198f2ee6ddfb09cd0384f322aed5778054 plus the separately
frozen private impulse campaign files. Read ROADMAP SHA256:
3a05d48b44795528573d174c699ec371682942c9d0b7cd11936e3502818424e0.
The parent owns ROADMAP edits. Only this new audit is authored here. Module
evaluation, fixture conversion, build, reference, candidate and World calls0.

# Necessary additions and their boundaries

## G1 — already admitted anisotropic free rotation

**CURRENT_CORE_REQUIRED.** Scope is the existing public rotational freedom,
not an arbitrary imported inertia feature.

Source facts: `src/model-admission.ts:71–78` accepts bounded initial angular
velocity and primitive-COM inertia. `src/validation.ts:120–136` computes
non-isotropic rectangular-box principal inertias and accepts angular velocity.
Its capsule inertia is an explicitly isotropic proxy (three equal values),
which has no gyroscopic term under that declared approximation. This finding
does not infer a missing capsule gyro term or silently replace its mass model.
`src/math.ts:35–43` transforms local inertia to the current world frame.
`src/world.ts:210–243` changes world omega through external angular
impulse/torque, then advances orientation; there is no free gyroscopic update.
The existing independent spin test is a uniform sphere
(`examples/physics-motion-foundations-2276/world.test.ts`).

Physical inference, not an executed failure: constant world omega with a
rotating anisotropic inertia generally fails torque-free world angular-momentum
conservation away from a principal axis. Quaternion normalization and an
isotropic sphere-spin PASS cannot establish general Euler-top dynamics. Energy
alone is insufficient to detect this particular omission.

Existing overlap: ROADMAP physical inputs define COM/frame/SI; P1 preserves
old math; P7 requires a verified plant; validation requires conservation and
dt refinement. None names an anisotropic torque-free prerequisite despite that
freedom already entering the public discrete profile.

Dependency and exit: first identify the declared supported free-rotation
subset. Use a finite isotropic control, off-axis axisymmetric box and
triaxial box case, with independent analytic/Euler-equation reference,
world angular momentum, rotational energy, quaternion/rotation error and
matched-time refinement. Freeze reference error, duration, dt population and
cost before execution. Either qualify the admitted subset or explicitly limit
unsupported freedom through a separately reviewed admission change. Do not
silently insert a gyro correction into P3/P4 historical replay math. This
requirement applies before claiming the current anisotropic box dynamics are
physically qualified; the private instantaneous impulse operator advances no
orientation and its frozen contract/call population stays unchanged.
The original cubic-box stack and spherical P3 hinges have isotropic inertia;
their existing exact contracts gain no new gyro condition from this item.

## G2 — exact coverage of current contact-law and CCD branches

**CURRENT_CORE_REQUIRED** as a finite existing-support coverage gate. It does
not require a universal collision engine.

Source facts: `src/collision.ts:174–224` uses contact-point velocities and
rotational effective mass, a restitution speed switch at0.5m/s, minimum
restitution mixing, geometric-mean friction mixing, static/dynamic threshold
and zero-impulse/zero-tangent paths. `src/ccd.ts:13–39` admits only selected
sphere/static-box, sphere-pair and axis-aligned box/static-box cases.
`src/ccd-box.ts:10–25` excludes rotating-box CCD. `src/ccd-slab.ts:7–30`
has distinct initial-overlap, zero-travel/parallel, entry-equality and endpoint
branches. No absence of a test in another directory is asserted by this audit.

Existing overlap: the independently checked sphere/floor3000-step support,
240-step sliding-to-rolling, unequal-mass elastic spheres and narrower legacy
consumers already exist in physics-motion-foundations-2276. P4 already owns
strict box geometry, all32 patch points/192 rows and original full settling.
These receipts must be reused at their exact scope. Generic boundary policy
does not show which admitted material/TOI branch each receipt covers.

Dependency and exit: add one evidence table keyed by admitted pair/profile,
normal/contact law, friction/restitution branch and CCD condition. Mark existing
PASS/NO_GO/unknown rows exactly. For uncovered branches used by the chosen
current profile, freeze a small independent bank: threshold before/at/after,
resting/separating/closing, zero and reversed tangent, static-to-dynamic limit,
initial touch/overlap, parallel/grazing/edge-corner/tied TOI and finite-boundary
escape as applicable to that pair. Check geometry/TOI, actual equal/opposite
impulse/torque and work/dissipation, including projection and external-support
effects. Preserve the existing law and its switches; do not substitute a more
convenient restitution/friction model. Close only those missing required rows,
with their own frozen error/cost/call limits. Keep unsupported rotating CCD
refused and keep the original eight-box exit unchanged.

## G3 — COM/principal-frame/tensor admission for a selected extension

**PROFILE_PREREQUISITE.** This becomes required only when the selected new
plant needs non-primitive inertia, an offset COM or a nonidentity collider frame.

Source facts: `src/types.ts:16–22` exposes primitive-COM or sphere-isotropic
inertia; `src/model-admission.ts:86–87` requires identity-local colliders.
Current box inertia is shape-derived; capsule inertia is a shape-derived
isotropic approximation. Contact lever arms and the private
off-COM anchor operator do not create a public arbitrary-CAD inertia contract.

Existing overlap: ROADMAP already names COM, frame and parallel-axis conversion;
P2 tests MMGS/off-origin adapter behavior. The missing precision is when a
general inertia extension may enter admission and how its geometric meaning
is independently qualified.

Dependency and exit: before that extension, declare COM location, principal
axes/body-to-world map, tensor units/symmetry, positive definiteness and
physical principal-moment inequalities, plus the exact parallel-axis/adaptor
conversion. Use finite off-COM impulse/torque and translated/rotated controls
with independent mass/inertia data and wrong-frame/nonphysical refusals.
Source/emit acceptance and complete failure retention follow the existing P0/
P1 rules. No general full-tensor export is needed for a profile whose primitive
COM model suffices; no silent inertia override or normalization is allowed.

## G4 — rank, conditioning and lawful frame/scale controls per expanded plant

**PROFILE_PREREQUISITE.** Attach it to the next coupled/connected constraint
profile, with a bounded admitted-domain control where existing support permits.

Source facts: `src/dynamic-anchor-pair.ts:14–15` uses a fixed pivot refusal;
`src/disjoint-hinge/linear-solver.ts:58,85` has its own conditioning/certificate
limits. The frozen private impulse contract has an independent condition4096
gate and an exact KKT reference. These limits belong to different systems and
must not be transferred as universal tolerances. Model frame convention is
explicit, while visual domain gravity/geometry remains fixed by admission.

Existing overlap: validation already asks for impossible inputs, units and
step refinement; P3 has qualified identity/order mappings. It does not yet
specify redundant/inconsistent constraints, rank loss, the metric behind a
condition number or coordinate/scale controls for a connected plant.

Dependency and exit: declare independent constraint rank, supported redundant
rows, inconsistent/rank-deficient refusal and a unit-aware conditioning metric
before choosing a solver. Use exact small rank controls, near-boundary cases
and full accepted-state/cache/log retention on refusal. Test common rigid
translation/proper rotation of positions, orientations, gravity, normals,
anchors, impulses and inertia when that transform remains admitted. A lawful
dimensional similarity control must transform every relevant M/L/T quantity
and remain inside declared model/dt/material bounds; it is not arbitrary
numeric rescaling or an excuse to widen a fixed visual profile. Freeze the
finite transformations and physical error before calls. Do not add a fallback
solver, hidden regularization or a copied P3 threshold to pass. The present
13-case impulse campaign already fixes its own rank/condition boundary and
must run unchanged.

## G5 — public mixed-endpoint model/state and once-only coupled schedule

**PROFILE_PREREQUISITE** for public P6a/P6b integration.

Source facts: `src/types.ts:40–51,112–116,150–157` gives joints/commands/
JointState rigid body IDs. Cloth/fluid reference only staticColliderIds.
`src/domain/types.ts` has separate cloth or fluid candidate branches;
`src/world.ts:178–199` commits one selected visual domain branch, not a dynamic
mixture. `src/cloth/profile.ts` has8 physical substeps. Solver iterations are
not automatically physical substeps or host time boundaries.

Existing overlap: ROADMAP already requires a shared commit, explicit exchange
phase/units/substep ratios and exactly-once reaction. The missing concrete
dependency is typed public endpoint/state/report meaning before activating
those words in the common API.

Dependency and exit: freeze tagged rigid-anchor/cloth-vertex or rigid/fluid
endpoints, owner/local-index checks, input bindings and SI exchange reports.
Do not put clothId into bodyId, report a pin as a finite reaction or reinterpret
XPBD lambda as Ns. Declare force integration interval, impulse application,
integer substep order, cache/lambda lifecycle and host reaction accumulation.
Prove equal/opposite action exactly once on each side and common failure
atomicity with faults after the first side, after both sides and before shared
recording commit. Then qualify the finite coupled trajectory's position/
contact/work/refinement gates. Existing P1/P2 transaction policy is reused;
the private instantaneous operator remains a separate precursor and supplies
neither a public coupling schema nor full-sheet/contact/dt proof.

## G6 — domain recording capability, payload and reconstruction

**PROFILE_PREREQUISITE** only if domain or coupled recording is enabled.

Source facts: `src/replay.ts:12,31–36` refuses current domain recording; the
cloth model exceeds the128KiB model budget and the fluid attach path explicitly
refuses. `src/replay-validation.ts:41,88` rejects domain restore. Rigid log
limits remain512 frames/4096 commands. P5 verified these public refusal paths.

Existing overlap: P2 already requires ownership/preflight/shared commit and
distinguishes log reconstruction from checkpoints. P5 completion does not
promise domain recording; this is not a missing P5 exit to reopen.

Dependency and exit: maintain an explicit capability row for current refusal.
Before adding support, specify typed-array encoding, domain/constraint/cache
history required for the chosen reconstruction mode, supported duration and
logical working/evidence/byte caps. Test below/at/over each declared cap before
candidate execution, matching accepted state/log/time after refusals, and
source/native record–restore–continue at the same host boundary. Keep existing
rigid caps and errors unchanged unless a separately reviewed contract replaces
them. No cap increase or new domain codec is required by the current work.

## G7 — evidence-provider and failed-prefix trust

**CURRENT_CORE_REQUIRED** as a named acceptance prerequisite. Much of this is
already implemented in the current frozen campaign; reuse that work.

Evidence: CAMPAIGN-STATIC-REVIEW found unproved retained memory, wrong gate
scales and loss of an interrupted oracle's reference prefix. REPAIR02 and
CAMPAIGN-REVIEW-02 resolve those source defects before execution. P4's old raw
reply zero-sign unknown and P3's unavailable historical failed operands remain
different authority limits, even when new current-runtime results agree.

Existing overlap: ROADMAP validation already freezes source/errors/cost and
separates execution/evidence classes. The missing explicit requirement is a
complete actual provider/tool/reference chain and honest interrupted-call
accounting, rather than accepting a producer PASS label or missing count0.

Dependency and exit: pin actual loaded source/native and independent reference
providers, exact input/wire/raw-number authority, compiler/native-entry and
actual declaration closure, and the approved gate/budget definition before
calls. Preserve the first source/physical/harness/resource failure separately.
A final original summary is authoritative only with its authenticated inputs;
durable progress gives lower bounds and in-flight totals remain UNKNOWN.
Distinguish owned-payload charges from unmeasured tool/process heap or RSS.
Test only newly changed trust logic with bounded DATA checks where useful;
never repeat a failed numerical prefix to repair its receipt. The approved
finite campaign keeps its current sources, calls, thresholds and stop rules.

# Items that must not become blanket completion gates

**FUTURE_OPTIONAL:** arbitrary compound/mesh collision, general rotating-body
CCD, arbitrary CAD inertia imports when no selected plant needs them, fluid–
cloth coupling, self-contact, fracture, new material models and generic solver
plugins. Current source either rejects these or has no public contract for
them. ROADMAP interaction matrix and bounded-profile policy already cover
their deferral. Concrete exit is a separately chosen product/profile need and
a frozen independent plant; their mere availability elsewhere is not a reason
to add a current task or merge condition.

**OUTSIDE_HOLD:** Studio/live product work under another owner, hardware,
manufacturing acceptance and calibrated engineering stress/CFD claims. Existing
P8, owner authority, uncertainty and intended-use gates remain authoritative.
The exit requires the relevant owner/HOLD resolution and separately controlled
validation; this audit authorizes none of it.

# Suggested edit boundary

Add G1 and the finite G2 coverage requirement to existing rigid/validation
sections; name G7 as evidence acceptance. Add G3/G4/G5/G6 only as explicit
conditional profile dependencies. Do not create new P IDs or an all-features
checklist. Generic conservation, rollback, units, source/native proof and
boundary testing already present in ROADMAP need no duplicate workstream.

P4 keeps all original eight boxes,32 points/192 rows,1200 steps,180s and old
settling/geometry/residual gates; its third failed cache slice stays ended.
P3 keeps the two-disjoint-hinge historical step77 raw failure/unknown operands.
The frozen instantaneous impulse campaign remains unchanged and separate.
P5 stays its actual bounded completion; public dynamic mixtures, trajectories,
connected mechanisms and whole-required-roadmap integration remain unqualified
until their own required exits. No gate, tolerance, iteration or evidence class
has been changed by this audit.
