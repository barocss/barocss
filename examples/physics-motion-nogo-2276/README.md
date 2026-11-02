---
work_id: physics-motion-nogo-2276
artifact_type: diagnostic-implementation-and-result
status: done
owner_role: independent-algorithm-work
source_request: analyze and advance public two-hinge and eight-box NO_GO while preserving HOLDs and original gates
last_updated: 2026-11-01
---

# Public hinge and eight-box NO_GO: next verified step

The new diagnostics establish two bounded facts. The archived hinge scalar
agrees with an exact rounding certificate on the reconstructed historical
inputs. The original eight-box solver leaves a normal-contact residual in
its first saved frame even though that same contact patch has an exact
zero-velocity fixed point. Neither result activates a public feature or
proves the cause of the complete trajectory failure.

Branch: `codex/physics-motion-nogo-2276`.
Base: `031f66c3ea572c3a496cfa319a4c542e7b19fc3a`.
Worktree: `/Users/user/Documents/ChatGPT/barocss-physics-motion-2276`.
The previous foundation branch remains at its recorded checkpoint.
Remote develop and active CAD heads were checked again and remain
`12411c89b9a0f9de7e5066a5ea8f3d292c9476a8` and
`8350c8e245ca2c35a71460c01e4be8772576661d` respectively.

Only this new example directory changes. Existing Physics/Studio/manufacturing
workers remain on HOLD. Original source, thresholds, fixtures, receipts and
the prior 53-test foundation are preserved. There is no World replay,
native solver call, body-cap increase, iteration increase, friction change,
dependency install, external download, security-setting change or remote write.

## Analysis: distinguish the failures

| Finding | Evidence and confidence |
| --- | --- |
| Current public 2-hinge and 9-body persistent stack stop at construction | High: `joints.ts` dynamic-pair guard and `world.ts` four-body persistent cap. These are admission limits, not new trajectories. |
| Removing those guards alone would change the selected model | High: public World projects joints inside each contact pass. The qualified private hinge projects once after contact. Original #1399 uses one global velocity island and a separate full-pair position phase. |
| The historical hinge discrepancy is in two reported angle fields | High: [#1489 first failure](https://github.com/barocss/barocss/issues/1489#issuecomment-6111755791), with final body bytes equal. Actual candidate preprojection operands were not observed. |
| Original eight-box position and impulse ledgers passed while physical quality failed | High: original `physics-rigid-full-pair-position-world/RESULT.md` and authenticated archives. Position feasibility does not establish contact velocity convergence. |
| An insufficient first-frame contact solve is now measured | High for the stated residual and feasible fixed point. Its causal contribution to later collapse remains unknown. |
| Warm-start energy alone explains the instability, or a Node version alone explains the hinge | Not established. Prior studies and these new measurements do not support those broad claims. |

The read-only analysis ended before implementation. The scope and new
diagnostic gates were frozen in [CONTRACT.md](CONTRACT.md) and the three
study contracts. Sol High handled the difficult mathematical work. The
parent reviewed source and ran every test and diagnostic.

## Implemented and executed

| Files | Algorithm and actual execution |
| --- | --- |
| `hinge-study.py`, `hinge-runtime.mjs`, `hinge-unit.test.py` | Authenticated step77 extraction; signed binary64 reconstruction; exact Fraction atan interval; two installed runtimes. 11 synthetic tests PASS; archive study exit0. |
| `stack-study.py`, `stack-unit.test.py` | Decimal80/120 contact-law residuals at a fixed saved pose; first-violation stop; independent OBB corners and line/slab witness. 15 synthetic tests PASS; archive study exit0 with diagnostic NO_GO. |
| `stack-equilibrium.py`, `stack-equilibrium-unit.test.py` | Graph-derived supported loads and exact Fraction equilibrium at all32 actual first-frame points; independent geometry for all32 points. 11 synthetic tests PASS; certificate exit0/PASS. |
| `run.mjs` | Fresh output directories, source hashes, raw stdout/stderr, command/exit/signal/time records. Prior attempts are never overwritten. |

There are **37 new synthetic unit tests**, not 37 new physical-world cases.
All six unit/study process exits are0. The stack diagnostic's exit0 means
the observer completed; its result is explicitly
`DIAGNOSTIC_NORMAL_CONTACT_NO_GO`. JavaScript syntax/ESLint and Python AST
checks passed. No production source changed, so old green World campaigns
were not repeated. This is mathematical diagnostic code in examples, not
public API integration or full-engine qualification.

Runtime: installed Python3.13.5 standard libraries; Node22.19.0 and24.22.1
on Darwin ARM64. No mpmath or other new library was installed.

## Hinge: historical bank is consistent at the reconstructed operands

Inputs are authenticated original f401 SOURCE cursor76 ->77. The selected
native record, separate outcome locator and both416-byte raw frames match
their archived byte counts and SHA256. Required historical provider source
bytes match the frozen math/angle/diagnostic/report/adapter providers.
Private and transferred angle-expression bytes also match.

Both pairs reconstruct the same atan2 operands, F64LE:

| Value | Bits |
| --- | --- |
| y | `805bff408442c33f` |
| x | `b96625dbbba2ef3f` |
| Independently correctly rounded atan2 | `a3ddc9485055c33f` |
| Doubled report value | `a3ddc9485055d33f` = `0.3020821295571869` |
| Recorded failed candidate report | `a4ddc9485055d33f` = `0.30208212955718694` |

The independent oracle uses exact positive rational y/x and the alternating
64/65-term atan bounds. Both bounds round to the same binary64 result.
The bound does not call a native atan implementation. Reconstructed basic
operations are rounded independently with exact Fractions.

Node22.19.0 and24.22.1 each evaluated the two archived pairs once. All four
atan2 evaluations match the correctly rounded historical value on this
host. Complete executable hashes and runtime versions are in the receipt.
This is one scalar case; it is not general atan2 or cross-platform replay
qualification.

**Unknown:** candidate7178434a is still absent, and its actual intermediate
operand bytes remain unavailable. Equal final body bytes do not establish
equal preprojection operands. The earlier Linux scalar observations remain
their own historical evidence. These results do not prove an architecture
or libm defect and do not close the original exact-bit failure.

Contract: [hinge-contract.md](hinge-contract.md).
Actual result: [hinge-study-01/result.json](evidence/hinge-study-01/result.json).

## Eight boxes: first saved contact is not at a normal fixed point

The original SOURCE ALIGNED archives were authenticated before arithmetic:
whole compressed hashes, then the entire decoded raw stream. The JSON
stream was decoded and hashed once. Arithmetic stopped at the first
violation, but byte-only hashing continued to the authenticated end.
Actual counts:961 records/420695755 decoded JSON bytes authenticated;
two records parsed; one saved step and one point examined.

The first violating constraint is step1, point0,
`face:b0:1:1:b1:1:-1:0`, between b0 and b1. It uses the saved free-pose
positions and final velocity-phase velocities, before position correction.

| Quantity | Decimal120 result | Frozen new diagnostic gate |
| --- | --- | --- |
| Final normal impulse | `0.132236577734664712 N s` | Negative impulse<=`1e-10 N s` |
| Final normal speed | `-0.00406391195361771742 m/s` | Closing speed<=`1e-10 m/s` |
| Absolute lambda-normal × normal-speed | `0.000537397808961402423 J` | <=`1e-10 J` |
| Independent support-plane gap | `2.77555756156289135e-17 m` | Geometry tolerance `1e-9 m` |
| Contact-point distance from line-witness midpoint | `1.38777878078144568e-17 m` | Geometry tolerance `1e-9 m` |

Decimal80 and120 agree. Independent corners/slabs place this point on the
appropriate support within the fixed tolerance. The point and normal
stored by the solver define the constraint being audited; source collision
code is not used as the independent geometry oracle.

These **new diagnostic gates do not replace original physical gates**.
The original first independent World-quality failure remains ALIGNED960,
OFFSET315 and YAW243. Step1 is a new contact-law diagnostic finding, not a
rewrite of those original first physical failures.

Contract: [stack-contract.md](stack-contract.md).
Actual result: [stack-study-01/result.json](evidence/stack-study-01/result.json).

## Same first frame: all32 constraints admit an exact equilibrium

The follow-up parses only original initial+step1, with selected JSON/raw
hashes checked before arithmetic. It reauthenticates compressed archives
and explicitly reuses the previous full decoded authentication. It does
not claim a second full decoded scan.

The actual patch has eight interfaces and32 symmetric corner points.
All32 independent geometry checks pass. The signed floor gap
`-0.00068125 m` is retained as free-fall penetration, not clamped away.
The largest positive interface gap is `2.77556e-17 m`.

Starting at the unique static root, the reference derives the chain and
supported mass from connectivity and height. It does not assign loads
from body ID suffixes. For a contact interface supporting k one-kilogram
cubes, each of its four actual corners receives `k*s/4` normal impulse,
where `s=-savedFreeVy` is an exact binary64 Fraction. Tangent impulse is0.

All per-body impulse and lever-arm torque balances are exact. Predicted
velocities and angular velocities are exactly0. All32 normal constraints,
nonnegative impulses, complementarity and zero-tangent Coulomb feasibility
pass with exact rational residual0. The chosen corner distribution need
not be unique.

The saved stopping speed differs from the exact product of the represented
gravity and dt by `2.0932329943453478e-19 m/s`. Both values and their rational
difference are recorded. They are not silently equated.

**Supported conclusion:** this actual first-frame patch has a feasible
contact-law fixed point; the recorded64-sweep output has not reached it.
The source returns after the fixed sweep count without a global normal
residual qualification. That narrows the next solver question. It does not
prove asymptotic convergence, later patch sufficiency, the cause of the
entire collapse, or a stable-stack repair.

Contract: [stack-equilibrium-contract.md](stack-equilibrium-contract.md).
Actual result: [equilibrium-study-01/result.json](evidence/equilibrium-study-01/result.json).

## Preserved errors and execution boundaries

- Historical hinge step77, eight-box physical failures, three-box drift,
  previous nonfinite-input failures and the prior commit-orchestration error
  retain their original bytes and status. The preservation audit pins them.
- Read-only preparation had a wrong `output.joints` schema assumption and
  a nonexistent assumed archive path. A separate DATA audit initially used
  an incorrect error-message literal while reconstructing source changes.
  These probes changed no model or source and are recorded, not called PASS.
- After the11 hinge helper tests, two guard-only changes bounded output and
  rechecked remaining process time. Exact in-memory reversal reproduced both
  prior unit source hashes. Arithmetic bytes stayed unchanged. The actual
  study's source hashes match final study sources; no edit occurred during it.
  Parent contract metadata changes are recorded separately. See
  [source-version-audit.json](evidence/source-version-audit.json).
- There are zero World, motor, integration, projection, native solver or
  original reference-derive calls in this work. New Fraction/Decimal and
  independently authored geometry computations did run, as stated above.

## Next dependencies

1. Hinge: recover the exact existing7178434a failure archive/source. The
   known185095-byte archive SHA is
   `db609515b1e041ce5f68b3900d36c59fdb54b92d0c3cc750e2b673c2d328645d`.
   Inspect saved preprojection operands if present. If absent, a future
   separately frozen candidate must record exact raw qA/qB, intermediate
   quaternion/dot operands, provider hashes, cursor and runtime metadata.
   Do not fabricate those values from final poses or admit a World just
   because the scalar runtime probe matches.
   A targeted check found only marker files in the old hinge-world,
   multi-hinge and engine worktree directories. This is a scoped route check,
   not an exhaustive disk search. See
   [candidate-route-check.json](evidence/preread/candidate-route-check.json).
2. Stack: select a bounded velocity-law intervention against this frozen
   32-row problem, with independent residual certificates and unchanged
   work/tolerance policy. The present result justifies studying solver
   convergence and contact coupling; it does not choose a general replacement
   law. Only a separately qualified candidate may proceed to original
   ALIGNED/OFFSET/YAW1200-step physical gates and public admission.

Public2-hinge and public9-body activation remain **NO_GO**. Current public
three-box OFFSET/YAW drift and original eight-box `NUMERICAL_NO_GO_WORLD`
remain. #1490, Studio, hardware, manufacturing, Integration and release are
not executed or qualified by these diagnostics.

## Reproduce one bounded stage

Use the already installed runtimes and a new run ID for every attempt.
Acquire/release the existing heavy gate in the same shell. Exact absolute
commands and exits are in `evidence/<run>/command.json`.

```sh
node examples/physics-motion-nogo-2276/run.mjs hinge-unit hinge-unit-new
node examples/physics-motion-nogo-2276/run.mjs hinge hinge-study-new
node examples/physics-motion-nogo-2276/run.mjs stack-unit stack-unit-new
node examples/physics-motion-nogo-2276/run.mjs stack stack-study-new
node examples/physics-motion-nogo-2276/run.mjs stack-equilibrium-unit equilibrium-unit-new
node examples/physics-motion-nogo-2276/run.mjs stack-equilibrium equilibrium-study-new
```

The equilibrium study intentionally requires the pinned bytes of the first
stack receipt at its declared default path. An optional `--diagnostic` path
must contain those same bytes. Re-running a diagnostic with a new elapsed
time creates a different receipt; do not substitute it without a new freeze.
