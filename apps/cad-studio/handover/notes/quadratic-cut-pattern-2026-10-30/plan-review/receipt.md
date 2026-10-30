# D346 independent plan and mathematical review

Verdict: **MATH_DIRECTION_PASS — IMPLEMENTATION_MAY_START_WITH_THESE_REQUIRED_CONSTRAINTS**.

This is a source/design review. It permits implementation of the bounded approved design. It does not certify an implementation, measured work, test acceptance, product behavior, or all polynomial quadratics. No product source was edited. No runtime, tests, build, browser, or benchmark was run by this reviewer.

## Required implementation contract

1. Decode the original finite binary64 poles before subtraction. Coefficients, relative positions, minimum speed, interval comparisons, Simpson bounds, and final conversion must describe those exact represented inputs. Plain Math.sqrt/log and Number estimates may propose work but cannot certify it.
2. One checked work owner covers one complete planner query and all its placements, including admission, discarded work, coefficients, panel splits, inverse iterations, final coordinate evaluation, and Number conversion. Final dyadic conversion uses the same checked increment. An independently budgeted context followed by after-the-fact charging is insufficient. Stop before a disallowed operation or allocation. Check predicted integer growth before allocation.
3. The 200000 checked-operation ceiling is per single planner query. Model eligibility/admission and Core evaluation can issue separate queries. It is not an aggregate ceiling for a whole Studio action. Preserve the separate 16384 speed evaluations, 512 integration splits, integration depth 16, and 8192-bit ceilings. Inverse depth is not integration depth; every inverse iteration must be charged even for cached work.
4. Endpoint admission and inverse bracket changes use genuine enclosures. Prove a requested distance fits from the total lower bound. A distance above the upper bound is too long. Refine an unresolved endpoint or refuse certification under the existing CAPABILITY mapping; do not clamp or label uncertainty as proven too long.
5. Accept a returned offset only when the certified arc/bracket positional error plus the exact L1 error of its final binary64 conversion is at most the existing 1e-7 world policy. Preserve zero, subnormal, normal carry, signed values and ties-to-even behavior. Use relative Bernstein coordinates directly; do not add world P0 and subtract it again.
6. Keep the old straight leaf, offsets, represented-Number endpoint admission, errors, source validation and count-one behavior unchanged. A new public query must return truthful directed legacy length bounds, enlarged to contain the unchanged old cumulative Math.hypot estimate. The old rounded sum is not a zero-width certificate. Existing Core straight calls need not pay the new diagnostic cost.
7. The curved Model path uses the shared Core query as its authority. Do not duplicate Simpson/inversion in Model. Keep the approved one constant-Z, three-pole polynomial quadratic XY profile, fixed orientation, existing limits and stable @k naming. No generic curves, rational extension, frame engine, new public budget error, or widened tolerance is approved here.

The current scalar-work revision explicitly records requirements 2 and 3. The prior before/after-only Section context proposal is superseded. The choices are now fixed constraints, not unresolved algorithm choices. Implementation may start without waiting for a postimplementation source audit.

## Mathematical direction

For v = 2(P1-P0), d = 2(P2-2P1+P0), A = d·d, B = v·d, C = v·v, Delta = AC-B² > 0, define f(t) = sqrt(At²+2Bt+C) and q(t) = At+B. Exact noncollinearity gives positive minimum speed on the compact interval.

Direct differentiation gives f'' = Delta/f³ and f = 3 Delta (4q²-Delta)/f⁷. Since Delta+q² = A f², the proposed |f| <= 15 A²/m³ is a valid conservative bound whenever 0 < m <= f over the panel. Thus the three-node Simpson panel remainder bound (b-a)^5 M4/2880 is valid. Panel-local exact minima and a certified positive lower bound are required; a rounded minimum or an underflowed Number is not sufficient.

The proposed integer-square-root enclosure is sound: for exact q >= 0, a dyadic quantum h > 0, z = floor(q/h²), and k = floor(sqrt(z)), [kh,(k+1)h] encloses sqrt(q). Exact final square checks and outward propagation cover non-square and tiny values. Dyadic accumulation avoids growing odd denominators. All root, panel, sum and conversion errors must still be included; the small panel quantization allowance alone is not the complete error budget.

Arc length bounds Euclidean displacement along the same curve. Therefore an arc residual can bound position without division by small speed. The inverse must retain the established parameter bracket and use interval comparisons. Untrusted secant/Newton proposals are acceptable when they do not decide admission or acceptance. A nonadvancing parameter must terminate with a proved bound or refusal.

The preliminary 175744-operation arithmetic in scalar-work is a design target for the three two-target examples, contingent on the stated per-helper bounds. It is not an executed count or proof that the future implementation meets those helper bounds. Audit those costs after source exists. It does not prove ordinary 63-target or all-quadratic acceptance. Bounded certification refusal is permitted; ordinary workload qualification remains required before a wider claim.

## Independent oracle and provenance

The reviewed oracle has no CAD imports. It uses integer fixtures, exact BigInt arithmetic, fixed dyadic sqrt and parameter grids, 128 Simpson panels, and exact assertions for its supplied minimum-speed and derivative bounds. Its Number analytic sqrt/asinh calculation is only a crosscheck. It is independent of a future product atlas/inverse implementation, while sharing the reviewed mathematical theorem.

Two v1 proof gaps were corrected in the current oracle: nextDown(+0) now returns -Number.MIN_VALUE, and the claimed final world residual now includes exact decoded output-coordinate conversion error. The v1 source and first output are preserved. Use oracle-final.json for the corrected claims, not oracle-first.json. Earlier nonzero example results do not make the old zero helper correct.

The final examples have totals near 32.4645048, 32.9518491 and 30.8097786. Their two requested offsets have world residual bounds below the old 1e-7 policy. These are three finite fixture certificates. The stock-minus-three-cuts rational volume/centroid guide is valid only where those fixtures also establish tool separation and containment. It does not prove arbitrary overlapping cutter geometry. Fixed oracle precision is not a new product minimum or universal accuracy bound.

## Follow-up review and proof boundaries

After source freeze, audit checked operations, bit-growth guards, interval direction, exact conversion, shared ownership, admission ordering, and Model wiring. Required controls include signed/reflected/cardinal layouts, nonzero constant Z, ordinary straight and fractional straight preservation, endpoint uncertainty, count one, malformed/unsupported profiles, subnormal and rounding boundaries, finite-work refusal, and normal supported multi-placement requests. Product geometry, names, Save/Open, refusal/Cancel and selection ownership need their own executed evidence.

The existing Apply selection-clear path may need observation for curve-feature-pattern after a witness seed. This is a source risk, not a confirmed D346 runtime failure and not approval for an unsolicited App edit. Keep the actual product check separate.

No runtime/product/performance/global accuracy PASS is issued by this receipt.

## Reviewed SHA-256 snapshot

- `plan.md`: `7f9c2360d789beb0e0a23fbe7eb14ee42c8515a713c5f835082672835ef565ac`
- `scalar-work.md`: `de61c47ad725de3e844464cd0d0b0195425b291f68f2aca3a1d417292ffd4253`
- `oracle.mjs`: `3f0dcfdbd2252a7cf064cedb6a34894e1ef6de1eb999da0aaae18de620b6fbd5`
- `oracle-final.json`: `ad12d0f8256de8eee448c277baf8d14b4f66701ea887939673210221d2fb4359`
- `oracle-v1.mjs`: `46fffdeaba7b1801719d7f96b219ff673d6f4853a8f2917d1b1742c94256dae9`
- `oracle-first.json`: `8735effab9de34207e3b02abbde96bfda7a9512f0e4a961e9cc4cf4771c94599`

Input plans are owned by High and may receive wording updates. The fixed constraints above govern this conditional start verdict; any semantic change needs review. This receipt is owned only by the independent reviewer.
