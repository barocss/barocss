# Package-owned bounded stack engine

Status: SOURCE_AUTHORING_ONLY. Root alone executes imports, arithmetic,
compilation, independent checks and trajectories. Existing failures, cost
NO_GOs, original inputs, tolerances, HOLDs and public admission remain unchanged.
The runtime implementation is owned ONLY under packages/barocss-physics/src/stack.
It imports no examples at runtime. This contract is not1200-step evidence.

Internal entry: `stack/prepare-step.ts` exports
`prepareStackStep(bodies: readonly Body[], dt: number, gravity: Vec3)`.
It returns detached `candidateBodies` and explicit `diagnostics` containing
`beforeBodies`, `freeBodies`, `velocityBodies`, `geometryPatches`, `pointLedger`,
`normalProblem`, `normalResult`, `positionAttempt`, `positionStats`. It has no
global observer, callback, prior cache, warm seed, oracle input or fixture name.
The caller retains accepted state; refusal changes no caller body or cache.
There is no World integration, public export, new profile or body-cap increase.
This is the CURRENT provider, with fresh Source/native qualification required.
Historical16-step receipts are provenance only and are NOT inherited.
Typed phase failures expose detached reached diagnostics without callbacks.

Bounded profile: exactly8 dynamic unit-mass half-.25m cubes with inverse
inertia24I and one fixed half-extents[2,.1,2] floor at[0,-.1,0], identity floor
orientation; restitution0, static/dynamic friction1/.7; no sensors, CCD,
kinematic bodies or collision filters. Fixed dt is1/120s. Actual bounded input
positions/orientations/velocities and gravity are used. IDs are opaque.
No orientation, support-chain rank, expected equilibrium or ALIGNED/OFFSET/YAW
name is a solve seed. Invalid/unsupported inputs refuse before caller mutation.

Phases are separated: copy accepted state; perform unforced original gravity
and pose integration; freeze all actual velocity patches and point operands;
ONE cold global normal solve; validate loaded zero-tangent feasibility; build
ALL36 signed pair-position constraints from the velocity-ready pose; ONE
full-pair position QP and one represented translation application; fresh final
all-pair closure validation; return detached data. Geometry and position
correction never interleave with velocity rows. Point IDs/order/normal/point
Float64 operands are retained. No new point merge/drop/snap rule, axis pruning, warm
reuse or fallback into the old sequential solver is permitted.

Port the qualified private DIRECT native feature/strict-line mathematics and
cold normal/position runtime into package-local modules, with source provenance.
No old World staging, legacy API wrapper or example callback becomes a shipping
dependency. The normal solver retains <=32 original rows,<=48 dynamic velocity
DOF and ALL-row checks, including dependent rows. Its existing QR/outer limits64
are separate algorithm budgets, not extra8x8 point sweeps or an equal-cost claim.
Original8x8 constants stay untouched. Zero tangent is accepted only when every
strictly loaded row has actual tangent speed<=1e-10m/s. General friction is not
claimed; failure returns a typed refusal rather than silently dropping friction.

Position retains <=36 rows/24 translation DOF, signed gaps and original raw and
normalized SAT/selection behavior, existing full-pair work/bit caps, all-row
KKT1e-12 and final HYP closure1e-12. Strict geometry keeps its original
1e-9/1e-12 distance and side-line conditions,80/120 agreement in the INDEPENDENT
observer. Normal/contact/work gates remain1e-10. Native runtime does not execute
Decimal or receive reference N/D/S, expected impulses, translations or basis.
Public2mm quality does not substitute for strict HYP closure.

Qualification is fail-first: original32-point equilibrium/one-step, then fresh
ALIGNED/OFFSET/YAW16 Source and actual emitted-module prefixes with independent
normal KKT/strict native geometry/36-row position/phase ledger/quality; only
passed scope may proceed to original1200 at unchanged scene budgets. Reference
checker micro-cost is separate from runtime solver behavior. The historical
308-step resource stop is not relabeled a friction failure. Old signed-zero,
geometry, warm, cost and original960/315/243 failures remain preserved. No broad
public stack, general Coulomb/warm, API admission, desktop or full1200 PASS can
be inferred from source or one-step tests. No mobile, deploy or new dependency.

The first library harness is PHYSICS_ONLY. Its owned wire/scratch/output checks
do not yet establish the complete-path CPU/output/explicit-memory budget.
RESOURCE_NOT_QUALIFIED and FULL1200_BLOCKED remain explicit even if the fixed
physics prefixes pass. No full-duration or performance claim follows from
these first Source/native calls.
