# Original P4: next dependency

Status: READ_ONLY_DESIGN. No candidate, helper, reference, World, compiler, auditor or browser ran. Only this file and CONTRACT-DRAFT.md are owned. No ended candidate or held worker is resumed.

**The earliest observed blocker for the original long-stack path is complete reference/runtime cost. A new warm or multipoint friction failure has not been observed on that path.** This does not predict that all1200 steps will be physically valid once the cost blocker is removed.

## Evidence boundaries

| Evidence | Actual boundary | What it does not establish |
|---|---|---|
| `physics-stack-solver-2276/README.md`, first-source-02/result.json and first-emitted-03/result.json | The same32-point ALIGNED velocity problem passes independent normal/KKT, balance and loaded tangent-speed checks. Its cold QR normal solve retains dependent rows. | General Coulomb friction, a future warm frame or long stacking. |
| `physics-box-quantized-witness-2276/RESULTS.md` and run-01/independent-cell-geometry.json |20 saved cases/62 points per graph; all original32 ALIGNED1 points retained with identical words and zero movement. | A new8-box World or all historical trajectories. Its27-member finite-cell proof is separate from the older16-step geometry path. |
| `physics-box-quantized-equilibrium-2276/evidence/equilibrium-01/result.json` | Exact zero force/moment residual on the same32 PRE points,8 interfaces/8 bodies, nonnegative quarter cumulative loads. | Gaps, complementarity, position work or a dynamic solution. PRE penetration is not snapped to zero. |
| `physics-persistent-friction-plane-2276/RESULTS.md` and baseline-01 independent audits | Public aggregate step2 tangent residual7.191714115138252e-9Ns; paired gaps about8.50867818e-6m/5.69159811e-5m exceed their1e-12 gates. `physics-real-warm-frame-2276/RESULTS.md` separately preserves genuine changed-frame warm residual9.141407414550243e-5Ns. | Neither is a failure of the distinct already-verified cold-normal P4 prefix; neither is erased by later one-point geometry/transport proofs. |
| `physics-contact-boundary-2276/README.md:65–92` and its source/emitted World receipts | Strict repaired192-row geometry and matched16-step ALIGNED/OFFSET/YAW prefixes pass. Separate ALIGNED source02 independently accepts308 steps, then hits180s before attempted309. | Original1200-step/8–10s acceptance. The timeout and runner defect/prefix records remain preserved. |
| `physics-world-p4-2276/evidence/position-profile-01/summary.json` | Two saved profiled position calls attribute about55% to72 compact-pair calls and37–38% to exact QP. | A full-run forecast; profiling adds overhead. |
| `physics-p4-position-v2-2276/evidence/position-01/summary.json` | Six saved full cold-position replies match all retained physical payload. Per-frame compact48.456–105.838ms and cold QP35.865–48.701ms remain measured nested costs. | Full32-line/ledger/quality cost or total trajectory readiness. |

The call graph confirms the separation. `physics-contact-boundary-2276/world-consumer.mjs:14–15,68–95` calls strict32-point contacts, full-pair position, step ledger and quality independently. `physics-stack-solver-2276/world-adapter.ts:43–65,103–128` replaces the entire old velocity/warm region with one cold coupled normal solve and refuses loaded tangent speed above1e-10m/s. Its8 half-.25m cubes use inverse inertia24I and gravity. The new successful G2 dynamic path uses one half-.5m cube, inverse inertia6I, g0, one cold point and one interval. Extending that path to warm/multibody contact is a separate engine dependency; it is not a demonstrated explanation of the historical308-step resource stop.

The historical persistent plane/gap/report failures remain failures of their actual providers. Later native feature/finite-cell geometry, producer wrench and one-point warm/dynamic proofs do not overwrite them. Conversely, those failures must not erase the independently verified original cold-normal16-step prefix. No public body-cap increase or new9-body public admission follows.

## Ended work stays ended

Support-radius caches v1/v2/v3 preserve selected raw replies but fail cost; v3 explicitly ends that approach, with no fourth iteration (`physics-world-p4-2276/README.md:193–303`). Node SAT delegation fails its frozen cost criterion (`physics-p4-node-sat-2276/RESULTS.md`). Primitive-axis reduction also ends at cost NO_GO:798363000ns versus saved773147000ns, no retune or remeasurement (`physics-p4-primitive-axis-2276/CONTRACT.md`, RESULTS.md). Compact/position V2 PASS does not convert any of these into cost GO. None is resumed by this proposal.

## One proposed new algorithm

Propose a **new exact active-basis KKT witness checker for the full position QP**, before any runtime expansion. It is a new reference-proof protocol, not another support/SAT cache, IPC relocation or primitive-axis adjustment. Target the measured cold LP/active-set work while retaining the already qualified compact V2 geometry and every physical gate.

For the original36 inequalities and24 translation DOF, treat the native `basisRows` only as an UNTRUSTED certificate index set S. Independently decode A,b,masses from represented inputs. Solve the equality Gram system `A_S W^-1 A_S^T lambda_S=b_S` once using exact bounded fraction-free elimination; reconstruct `u=W^-1 A_S^T lambda_S`, set other multipliers to zero, and verify ALL36 primal inequalities, every multiplier, exact stationarity and complementarity. W is the positive dynamic mass matrix. Singular/incomplete/invalid witness returns UNRESOLVED; do not search another basis or invoke the old cold solver.

Exact KKT and positive-definite W certify the unique primal optimum. A producer basis cannot make a wrong answer pass those global checks. This is certificate verification, however, not a second cold optimizer independent of all producer metadata: the changed authority must be explicit. Do not claim that the old “reference never reads native basis” contract still applies. A nonunique dual or a different basis may fail full saved-payload qualification; preserve that result rather than silently choose another witness.

First freeze ALIGNED1's same32 native force rows and its DISTINCT36-row position problem, then the other five saved ALIGNED/OFFSET/YAW1/16 requests. Use the saved independent cold-QP replies as oracle, plus an independent exact matrix-product/KKT checker that does not copy the factorization. Compare every physical reply field and word; old search/pivot counters are algorithm metadata and must be replaced by honestly named proof counters under a new protocol, never fabricated. Original sources and replies stay unchanged.

This may remove one measured expensive component; it has no established speedup or1200-step fit. Require numeric/proof qualification first, then ONE frozen same-boundary cost comparison. A cost failure ends this candidate. Only a separately reviewed complete contact+position+ledger+quality cost/representation gate could authorize any fresh trajectory. Warm/multibody constitutive development becomes the earliest physical dependency only if its actual old-path feasibility gate fails; it is not skipped or declared solved here.
