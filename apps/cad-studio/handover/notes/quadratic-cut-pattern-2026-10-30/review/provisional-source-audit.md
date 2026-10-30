# D346 provisional source audit

Status: PROVISIONAL_SOURCE_AUDIT; NOT a final PASS. Read-only review during active implementation. No runtime, tests, build, browser, benchmark, commit or product edits were run by this reviewer. Owned artifacts are confined to /tmp/d346-review. Earlier plan-review receipt is unchanged.

## Findings communicated to High and root

1. Initial arithmetic source 8427a8aa7f2a950a12b2e65c5b3e1afd7c095caaba3fc77767bf0a4a6e3b3031, line 75 omitted the sign bit when a negative nonzero dyadic rounded to zero. That yields +0 instead of IEEE -0. A subsequent read shows `if (negative)` and thus repairs this specific conversion defect. Conversion boundary tests and final freeze review remain required.
2. The first Core adapter curveCutOffsets dispatch read `path.degree` and `path.controlPoints` before the owned snapshot. High changed it to descriptor dispatch in the saved snapshot. However, an accessor descriptor currently makes that dispatch condition false and falls through to legacy spread/validation, which can still invoke the getter. The new public query itself snapshots first and is safe against ordinary accessor reads. If Core adapter getter-zero is part of acceptance, reject accessor descriptors before legacy fallback. High was notified of this residual path. Valid legacy numerical behavior need not preserve caller getter invocation.
3. The approved one-query combined counter includes admission. Initially the public query snapshots/validates/classifies before QuadraticPlanner creates QuadraticCutWork, and legacy diagnostics create it after old offsets. High revised the saved snapshot to create one owner, pre-reserve 8192 steps before admission, and pass that same owner into the quadratic planner. This is the permitted pre-reservation approach. Its stated finite upper bound still needs an explicit source cost audit; a fixed reserve label alone is not that proof. No separate context may be charged only after it finishes. This is a contract/work-proof issue, not a finding that accepted geometry is wrong.
4. Initial planner 2f7595d5611b7d40a680d1b22017cc868809f8d86be1e20b310f4728f8e30f0f returned t=0 for target <= tolerance/4. Its arc error could certify a close point, but endpoint snapping needed explicit contract clarification. A subsequent read removes that shortcut. This question is closed for the saved snapshot; ordinary inverse behavior still needs qualification.

## Source directions found coherent so far

Original binary64 poles are decoded before differences and aligned to a common exact dyadic exponent. The orientation and A/B/C/Delta are exact. Noncollinearity implies a regular quadratic derivative. Panel-local critical-point tests use exact comparisons. The minimum-speed construction and Simpson exponent accounting match the approved M4 bound and normalized parameter domain. Positive speed intervals and upward remainder are propagated outward; quantized panel sums are integer bounds.

The seed-to-end chord lower bound and control polygon upper bound permit request-aware admission. An uncertain total is refined or refused instead of admitted from an estimate. Every inverse starts with its own [0,1] bracket, so an approximate previous placement is not silently reused as an exact lower bracket. Updates use prefix interval comparisons. The derivative L1 hull bounds world displacement over a parameter bracket. Relative Bernstein evaluation and exact decoded Number-rounding L1 join the positional tolerance. The current revised overlap-refinement loop retains its proposed parameter for the next refined prefix query.

The arithmetic owner checks its step ceiling before each checked primitive, checks predicted shift/product sizes before allocation, and uses the same owner for dyadic Number conversion. Integer Newton sqrt performs exact final square checks. The reviewed converter handles normal significand carry, subnormal magnitude, and ties by exact quotient/remainder. The negative-zero correction is visible. No separate rational context was introduced.

The legacy numerical leaf in curve-cut-pattern.ts appears unchanged apart from its private rename. The public diagnostic path separately computes directed exact-segment norm bounds, enlarges them to contain the unchanged cumulative Math.hypot estimate, and retains the legacy leaf for offsets/admission. No zero-width certificate is inferred from the old Number sum.

## Remaining implementation gate

The preliminary 128-step speed/helper bounds in the plan have not been proved against every actual helper path. They are a design target, not a measured count. Audit final helper costs, all checked growth/operation paths, raw admission ownership, endpoint/fixed-precision refusal behavior and Model query counts at freeze. Single-query caps must not be advertised as a complete Studio-action cap. The fixed quantum may honestly refuse an unresolved near-endpoint request under the cap; do not claim generic all-quadratic or all-63-target acceptance. Preserve actual endpoint-refusal versus too-long error distinction.

Required source and executed controls include signed/reflected/cardinal layouts, exact conversion/tie/subnormal/zero boundaries, count one, normal supported multi-placement queries, endpoint uncertainty, malformed/accessor inputs, current live Model ownership, legacy byte/differential behavior, and shared public query errors. API wrappers and Model source are outside this initial two-module verdict and need final integrated review. Geometry/Boolean/product proof remains separate.

## Saved read hashes

- `quadratic-cut-arithmetic.ts`: `d13ccc37c48574dbbd812282c365da178f08a6bc6e0438f9e7cb3aa1d5d2cc94`
- `quadratic-cut-plan.ts`: `c856cbeb869f021b2597a7dad93f313704a20d8e74a4336b9a69879a51e388ec`
- `curve-cut-pattern.ts`: `d633e2f3860e4cf4b3bf04b764342c3dfc17e9255c83b76559d0ea6f14e930c2`

These are an intermediate read, not a source freeze. Paired files may change while the owner completes implementation. Saved provisional copies record only this audit boundary.
