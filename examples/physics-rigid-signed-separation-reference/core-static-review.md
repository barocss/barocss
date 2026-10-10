# #1344 core static audit

Status: READ-ONLY SOURCE AUDIT. Reviewed the full new CONTRACT and current owned core/query/input/result/row-builder/apply sources in `/Users/user/.codex/worktrees/physics-signed-separation-1344/barocss`. No module, solver, oracle, control, AST, type check, build or numerical calculation was executed. Only this document was written. Some harness and reference files remain in preparation; their absence is not an audit failure.

## Verified source scope

- `signed-linear-core.mjs` versus unchanged #1263 `linear-solver.mjs`: the actual text diff replaces old input validation with the strict signed wrapper, renames the private solve export, and replaces the two RHS/margin `depthM` reads with `boundM`. `solveSystem`, Gram/incidence assembly, masks, first-max pivot, original LIMIT8/EPS1e-12/PIVOT1e-14, ascending reductions, objective, certificate and first-objective-better-than1e-24 choice remain textually unchanged.
- Signed row convention is `n·(u_b-u_a)>=boundM`. The incidence uses `-n` for a and `+n` for b, RHS is the signed bound, and margins subtract that bound. Negative bound is available pre-pose separation, not penetration clamped to zero. Translation/bound/primal are metres; multiplier/stationarity are kg m; objective/complementarity are kg m². No force or impulse calibration is implied.
- The strict input wrapper preserves negative bound, ±0, and the frozen ±10 m endpoints. It checks finite unit normals, known distinct endpoints, unique body IDs, original inverse-mass bounds, dense arrays,9-body/8-row caps and exact keys. No implicit numeric coercion or clamp was found.
- `signed-sat.ts` retains original fresh box basis,15-axis order, cross-axis ordering, `length<1e-12` skip, normalized axis arithmetic, support threshold/reduction, signed-distance `<0` orientation, radius reductions and strict `<bestOverlap` first minimum. The physical changes are removing the negative-overlap early return and returning unclamped `boundM=bestOverlap`. Added candidate diagnostics and tie arrays report data and do not select the winner. No old normal, normalized quaternion or independent reference axis selects the query.
- Query output normal/point/candidate axes are fresh arrays. Support points and all15 diagnostics are derived from current raw admitted poses. Skipped fields are explicit nulls and are not interpreted as zero. No non-box fallback was found.
- Row-builder retains the6/6/7 original rows first and appends the2/2/1 fixed omitted-pair lists to exactly8 unique pair rows. It uses authenticated PRE bodies, fresh original pair inspection and fresh signed PRE query; failed POST is selection evidence only. Added rows require detector-null and independent raw/normalized separated classification, not detector-null alone. Existing archive joins and full36-pair count are checked.
- `apply.mjs` validates the result first, copies bodies, adds dynamic translations once, retains q/v/omega and reports nominal u, rounded final pose, decoded final-minus-pre difference and rounding residual. Original result bounds run before and after. It does not create or step a World or solve another row model.

## Concrete validator defects accepted by root

These locations refer to the source inspected before root's pending wrapper correction, not a claim that the final frozen source still has them.

1. `signed-linear-solver.mjs:8` returns an INFEASIBLE record before independently checking Gram. A finite forged Gram can pass the exported validator. Root selected recomputing Gram before either status branch.
2. `signed-linear-solver.mjs:7` checks singular mask range but permits duplicate/unordered masks and does not relate singular/infeasible exclusions to enumerated count. Root selected sorted unique masks and exclusion/counter consistency, outside the kernel.
3. `signed-linear-solver.mjs:10-20` permits valid translations/multipliers/certificate with a forged selected active set. For example, a valid one-row positive-bound solution can keep its nonzero multiplier while changing activeMask to0 and active to[]. KKT recomputation alone does not detect this mask metadata contradiction. Root selected inactive lambda EXACT0 and active margin<=originalEPS checks. No kernel arithmetic or active-set enumeration changes are required.

Relayed these findings to root and harness owner A. Root explicitly accepted the bounded fixes before freeze. A will add matching pure certificate tamper receipts once the wrappers are fixed. No extra physical scenes or sweeps are requested.

## Touch clamp and historic zero conventions

Original detector rows can contain penetration0 when the fresh signed minimum lies in `[-1e-12,0)`. The original row MUST retain its rehydrated archived depth and normal. Correspondence must compare `Math.max(0,fresh.boundM)` to that old clamped depth, not raw `fresh.boundM===depth`.

Current row-builder already contains this positive-clamp comparison. A subsequently reported root's further decision: compare historic JSON row values with `===`, not `Object.is`, and record component/negative-zero bit differences. JSON rows are not raw-bit proof. Retain rehydrated row values exactly; fresh raw SAT vectors can contain -0 where historic JSON has0. Do not report equality of lost historic sign bits.

For newly appended rows, raw signed bound and chosen current normal remain the actual fresh query values. Their ±0/negative zero provenance is distinct from historic JSON row provenance. Strictly negative added bounds remain required by the selected first-flow contract.

## One remaining apply signed-zero edge

Inspected `apply.mjs:13` unconditionally computes every position as `before+u`, including static bodies. A static position component `-0` plus kernel u `+0` becomes `+0`; `same(body,before)` at15 then refuses even though correction is exactly zero.

Root and A received this source-derived edge. The small fix consistent with static bit preservation is to retain the copied static position when u components are zero, while dynamic positions still get exactly one addition. Alternatively root can explicitly retain and label a static signed-zero refusal, but must not claim those admitted inputs retain all static bits. This is not evidence that named archived floor inputs fail; no frame or numeric evaluation was performed here.

## Completion boundary

The reviewed kernel/SAT arithmetic differences match the selected contract. The three exported result-validator holes require the accepted wrapper fixes before freeze. The static position-zero policy needs the explicit decision above. Fresh harness/reference/full source difference ledgers, actual emitted graph provenance and the one physical flow remain root gates. No retrospective detached GO, live closure, World, public solver or release result is inferred from this audit.
