# D308 family-only direct fixed128 arithmetic design

Status: read-only design only. No code, patch, repository change, test, probe, build, benchmark, commit, or subagent was produced. Parent reports D307 formal mass33095 operations, source11544/local21551, and native binding179831. Their optimistic sum after subtracting one duplicate source cost is201382, still1382 above200000. This arithmetic is a planning target, not an implemented combined proof or permission to erase an unshared source prefix.

## Recommended minimal change

Use a separate private FamilyContext subclass only in certifyNativeD0Family. Override add/mul/div. Leave the existing Context body, standalone entrypoints, their selected-five complete receipts, inherited lowerDifference/atMost/rho, source admission, and finishFamily conversion unchanged. Inherited rho must dynamically dispatch through the overrides so the unit and eta path benefits too.

Each new operation computes the exact positive rational numerator/denominator directly, quantizes once, and still calls the existing q.rat for its final canonical result. Remove only the generic intermediate q.add/q.mul/q.div normalization. Do not store unreduced R outputs, change rounding locations, fuse several recurrence operations, or prequantize input operands.

Let S=2^128, a=an/ad, b=bn/bd. For admitted nonnegative inputs and positive denominators:

| Operation | Exact numerator N | Exact positive denominator D |
| --- | --- | --- |
| add | an*bd + bn*ad | ad*bd |
| mul | an*bn | ad*bd |
| div, with bn>0 | an*bd | ad*bn |

A shared private quantizer computes exact integers:

    T = S*N
    k = T/D
    r = T%D
    if r !=0: k = k+1
    result = q.rat(k,S).

All divisions above are integer floor divisions of nonnegative integers. The result is exactly ceil(S*operation(a,b))/S, hence the same rational and normalized numerator/denominator fields as the existing upper(q.operation(...)). q.rat(k,S) remains the only final normalization. There is no new IEEE conversion in these overrides.

## Non-grid inputs are mandatory

Do not assume every operand already has denominator dividing S. Actual inherited inputs include exact unit2^-53, eta2^-1074, and binary64 coordinate maxima which can be subnormal. The raw formulas accept these directly, as well as grid results. lowerDifference continues to return its current exact rational value without upward rounding.

Premature operand quantization changes the recurrence. For example, ceil(S*(2*eta))=1, whereas multiplying the separately quantized eta by2 yields2 grid units. The new method must preserve the former result1. Similarly, never approximate a positive denominator upward before division; that can reduce the resulting error bound.

No operator fusion is allowed in the first slice. rho remains upper(upper(unit*x)+eta) at exactly the existing two rounding points. The exact constants, source min/max weights, coordinate envelopes, denominator lower differences, recurrence order, and requested-budget comparisons stay unchanged.

## Bit limits and accounting

Every operand sign/denominator guard, direct multiplication/addition/division/remainder/ceil increment, and direct comparison must be explicitly charged in the same family Context. Size each input/intermediate through the existing8192-bit check. Do not hide guard comparisons as in the earlier converter omission. All work feeds the unchanged200k exact/direct and1,048,576-work checks. The final q.rat contributes its actual q operations and GCD steps; do not replace its cost with a predicted count. No extra allowance, reset context, or retry is allowed.

Generic q.mul cross-cancels before multiplication. Raw products can therefore use more bits than that implementation. This must be addressed, not ignored. In this specific closed family graph, constants/source values are dyadic, generated results have denominators dividing S, eta has denominator2^1074, and exact lowerDifference remains dyadic. A raw operation sees at most two such denominators; even the simple uncancelled denominator product is at most2^2148, far below8192. Coordinate input numerators come from bounded binary64 values; generated grid magnitudes remain bounded by the unchanged recurrence guards. Prove a conservative intermediate bound for that actual call graph before implementation acceptance, and retain runtime sizing checks regardless.

The direct formulas also work for non-dyadic positive R operands, but do not claim unchanged admission for arbitrary8192-bit rational operands that might benefit from generic cross-cancellation. Those are not external inputs to this private family recurrence. If any current family operand or numerator-growth path falls outside the derived bound, preserve a typed refusal or use a separately justified bounded cancellation step; do not silently raise8192.

The subclass needs no additional state and must not override check/counts. Base constructor initialization keeps its present q constants and costs. No constructor virtual-call hazard is needed: add/mul/div are used after construction, and check remains the base method. New direct work and the final q.rat naturally appear in the current family counts, which the native wrapper already imports cumulatively with remaining reservations.

## Verification boundary for a later implementation

1. Preserve D307 baseline receipts and build before source changes. Standalone selected-five receipts must remain byte/Number-bit/count identical.
2. Compare full family semantic receipts on actual63-slot native input, repeated geometry IDs, zero/tiny/near-limit coordinate envelopes, both actual two-span wall weight variants, and single-span curves/Surfaces. Exact axis/L1 fractions, their least-upper Number bits, all source slots/basis/domain/envelope fields and false flags must match. Only counters change.
3. Add independent exact fraction operator checks for zero, exact integers, exact unit, eta, a subnormal coordinate operand, grid and non-grid operands, division by an admitted exact lower difference, and quotient values immediately below/on/above a grid boundary. Include the2*eta counterexample, denominator/sign rejection,8192-bit refusal, and direct guard accounting. The old generic arithmetic is an oracle for operator equivalence, not the optimized runtime implementation.
4. Check source invariance, tight total/total-1 reservations, operation/GCD/work/max-bit counts, full native-binding bound/slot preservation, and unchanged formal mass semantic receipts. A lower counter alone does not approve source changes or a combined feature.
5. The root must use the existing perf-bench before/after and frozen-source matrix. No particular saving, timing, combined-cap fit, mass precision, or physical-solid acceptance is promised by this design.

The common200k requirement remains. Even if measured saving exceeds1382, a combined source-sharing path needs authentic coefficient/ownership binding and one counted prefix, not a numerical subtraction of equal-looking source counts.

## Secondary option: exact dyadic distance, not selected for this slice

The formal helper's distance() can align returned finite Number n/d and fixed128 endpoints to D=max(d,S), because both denominators are powers of two. Compute exact integers A=n*(D/d), L=lo*(D/S), U=hi*(D/S), then q.rat(max(abs(A-L),abs(A-U)),D) once. This preserves the existing exact max-distance result and canonical fraction while avoiding two generic q.sub/abs paths and a rational compare.

Keep q.from(returnedNumber) and its finite check; retain signed arithmetic, zero behavior, and all budgets. A subnormal returned Number can have denominator2^1074, so D must not be assumed equal to S. Every scale/division/sign/absolute/maximum comparison and intermediate bit size needs its own direct ledger charge. All raw/output interval fields, returned Number bits, error fractions, and refusals require a preserved full-receipt differential. This is only a later comparison candidate; no distance code or new scope is proposed here.
