---
work_id: physics-motion-nogo-2276
artifact_type: frozen-next-step-contract
status: ready_for_build
owner_role: independent-algorithm-work
source_request: analyze and advance public two-hinge and eight-box NO_GO; preserve HOLDs and original gates
last_updated: 2026-11-01
---

# Next NO_GO diagnostics

This is a new user-authorized independent branch, based on
`031f66c3ea572c3a496cfa319a4c542e7b19fc3a`:
`codex/physics-motion-nogo-2276`. The previous branch and evidence stay intact.
Remote develop remains `12411c89b9a0f9de7e5066a5ea8f3d292c9476a8` and the
active CAD branch remains `8350c8e245ca2c35a71460c01e4be8772576661d`.
Their heads were checked again before this work. Existing workers stay on HOLD.

The read-only analysis is complete. This contract starts the requested
implementation and execution phase. Only new files under this directory are
owned. No existing package solver, historical fixture, receipt, tolerance,
iteration count, body cap, root manifest or lockfile is changed. No public
activation, Studio/Viewer work, integration, push, publication or machine use.
Use installed Node 22.19.0 and 24.22.1 and Python 3.13 standard libraries.
There are no new dependencies or downloads. Shared @barocss links must stay
inside this worktree. Heavy execution uses the existing gate in the same shell.

## Evidence and hypotheses before execution

1. **Evidence, high confidence:** current public disjoint hinge and 9-body
   persistent-box inputs are rejected at construction. No dynamics runs.
2. **Evidence, high confidence:** lifting those guards would not reproduce
   either qualified private solver. The public joint projection occurs per
   contact pass. The private hinge projects once after contact. Original
   #1399 eight-box uses one global velocity island then one full-pair position
   solve; current public persistent boxes use interleaved pair corrections.
3. **Evidence, high confidence:** original #1489 candidate step77 differed
   only in two reported angles by one ULP, while final body bytes matched.
   The report uses a preprojection measurement. Candidate preprojection
   operand bytes and historical runtime math provenance remain unknown.
4. **Inference, medium confidence:** scalar rounding may explain the hinge
   report discrepancy. Earlier Linux Node22.22/22.23 probes already showed
   that a minor Node version switch alone did not resolve it.
5. **Evidence, high confidence:** original #1399 position certificates and
   impulse ledgers qualified reached states, but ALIGNED drift/tilt failed
   at960, OFFSET escaped at315 and YAW at243. Final velocity normal
   complementarity was not independently certified by those ledgers.
6. **Unknown:** the original eight-box instability's causal law defect.
   Current public three-box drift or warm-start energy alone cannot identify it.

## Hinge scalar diagnostic

Authenticate the archived original f401 SOURCE step77 native JSON, its
independent outcome locator and POSTCONTACT/projected raw416-byte frames.
Keep raw F64 signed zeros. Extract only cursor76 ->77 and the two disjoint
pairs. Restore scalar operands from historical POSTCONTACT quaternions and
the exact existing multiply/dot operation order. These are reconstructed
historical operands, not observations of absent candidate7178434a.

Use an independent exact Fraction alternating atan series for positive
binary64 x,y with `0 < y/x < 1/4`. The 64/65-term lower/upper rational
bounds must both round to the same binary64 result; otherwise UNRESOLVED
and stop. Compare certified atan2 followed by exact ×2 with unchanged
historical bits `a3ddc9485055d33f` and recorded candidate bits
`a4ddc9485055d33f`. Do not normalize either value or change raw-bit gates.
Check both pairs on at most the two installed Node runtimes, at most four
atan2 evaluations total. Record executable SHA256, process.versions,
architecture and OS facts. This is a scalar study; World, projection,
motor, contact, optimization and reference-derive calls are all zero.

Bounds: compressed native<=8MiB, decoded native prefix<=20MiB,
selected native record<=256KiB, outcome record<=4KiB, raw slices<=832B,
output<=1MiB,90s per diagnostic process. One attempt. Authentication,
schema, domain or rounding uncertainty stops execution. Logic repairs may
use a new run ID; preserve the first attempt and do not change the gates.

## Original eight-box contact-law diagnostic

Use original #1399 SOURCE ALIGNED saved initial state and accepted steps
1..960 only. Authenticate original manifest, compressed sources and
selected raw frames before consuming them. No World replay or new solver
calls. Existing phase impulse/momentum/energy certification is reused;
do not reproduce that campaign or infer contact correctness from its success.

Independently calculate final point relative normal velocity using the
saved fixed free-pose positions and final velocity-phase linear/angular
velocities. Test normal nonnegativity, nonnegative separating velocity,
and complementarity at the same pose and at each saved constraint.
New diagnostic gates, fixed here before execution:

| Quantity | Absolute diagnostic gate |
| --- | --- |
| Negative normal impulse | <=1e-10 N s |
| Closing final normal speed | <=1e-10 m/s |
| Absolute lambda-normal × normal-speed | <=1e-10 J |

Calculate independently at Decimal80 and120 precision. Classification
must agree; unresolved precision is an execution failure. These gates
do not replace #1399/#1572's original physical gates. The stored point and
normal define a constraint under examination, not an independent collision
geometry oracle. If a violation is found, retain the first violation and
independently examine OBB support witnesses at that same saved pose before
attributing it to solver convergence. Do not silently move to another pose.

Budget: one stream pass; <=961 records,9 bodies,144 points per step,
<=138240 point checks. The diagnostic can stop at the first resolved
violation and must report the actual reached prefix. Bounded derived output
<=16MiB; selected snapshots<=2MiB. The archive/decoded-byte and process-time
bounds are frozen in the stack-specific contract after exact manifest
sizes are read, before arithmetic runs. No repeat/compiled campaign.

## Outcomes and stop conditions

An authenticated diagnostic violation is a new NO_GO receipt, not an
execution error and not proof of the entire instability's cause. A clean
residual cannot establish physically sufficient contact geometry. Preserve
all original failures, previous 53-test qualification, the earlier input
repair and final orchestration-failure audit. No old receipt is rewritten.

Any law intervention follows a measured defect, independent geometry and
a new frozen comparison. Neither a private diagnostic nor a cap-only change
activates the public feature. Original physical gates remain 1200 steps,
penetration<=2mm, late vertical drift<=5mm, horizontal<=1cm,
linear/angular speed<=0.02m/s and rad/s, tilt<=1degree, no floor escape.
Original issue definitions and raw exactness remain authoritative.

## Measured next dependency: first-frame equilibrium certificate

The first saved-data diagnostic found a resolved normal-contact violation at
ALIGNED step1/point0. Its independent support and slab witnesses passed the
fixed geometry tolerance. A separately frozen follow-up now examines only
that same saved first-frame island. It does not repeat a World trajectory.
See `stack-equilibrium-contract.md` for exact pins before its execution.

Require eight interfaces and all32 symmetric actual contact points. Derive
the supported chain from geometry/connectivity. Use exact rational stopping
impulses based on the saved binary64 free downward speed, with zero tangent
impulses. Check per-body linear/angular balance, final zero velocity,
normal complementarity and Coulomb feasibility. Report the ideal `g*dt`
rounding difference separately. Do not edit contact points or normal directions
to force symmetry. Geometry mismatch refuses this restricted certificate.
Budget: initial+step1 only,32 geometry checks,32 certificate rows,0 World or
solver calls. Original archive byte/time caps and physical gates remain.
Passing proves a feasible fixed point for this frozen patch. It does not
establish a general solver repair or later stable-stack behavior.
