---
work_id: D337
artifact_type: independent_geometry_source_review
status: done
owner_role: high_geometry_reviewer
source_request: Parent authorized source-only independent geometry review
last_updated: 2026-10-30
---

# D337 independent geometry review

Verdict: NO REQUIRED FINDINGS in the listed current source scope. Runtime/build/test/browser NOT_RUN by this reviewer. snapshot.json records the reviewed source hashes; ongoing workers may change test files later. This verdict is a source-review conclusion, not product qualification or a claim to have reproduced the owner's reported focused PASS.

## Findings

No actionable hard bug or required proof repair was found in the reviewed one-loop affine-plane profile. The exact L1 world-rounding bound is conservative and sufficient; replacing it with legacy chartRoundingBoundMM is not required. No exact-only UV restriction, tolerance increase, parent128-budget increase or new general B-rep engine was introduced.

## Evidence and reasoning

1. **Affine support and certified reflection.** `packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-axis-reversal.ts:135-151` requires degree1x1/four poles/equal positive weights, then uses ExactAffinePlane. `exact-affine-plane-internal.ts:19-31` proves the fourth stored pole equals O+U+V in exact represented arithmetic and support rank is two. Therefore the natural source and coefficient-reversed target represent affine charts, not an arbitrary bilinear patch.

   At `trimmed-surface-axis-reversal.ts:169-178`, selected world scale is exactly `(abs(Ux)+abs(Uy)+abs(Uz))/(b-a)` or its V counterpart. Reflection a+(b-t) is rational, rounded once by the existing nearest-even context, with endpoint copies. Delta is exact; upward(delta*scale) bounds the L1 lift error, hence also Euclidean error. With affine segment interpolation, every corresponding segment point has error bounded by the maximum endpoint bound. UV and world error are checked separately against their original1e-7 meanings. No rounding equality or integer restriction is imposed. `section-rational-internal.ts:124-140` supplies actual nearest-even and outward rounding.

2. **Native geometry check and report boundary.** `trimmed-surface-axis-reversal.ts:153-157,184` also checks native original/mapped point distances at each stored vertex. This is additional numeric evaluator evidence, while maximumWorldRoundingBound describes exact affine chart rounding rather than a global bound on native evaluator error. Both fields remain distinct. `:164,188-200` retains the parent result/report/provenance and adds a separate160-binding trim report. The parent128 native observations are unchanged. The helper correctly declines bitwise double-reversal certification and solid mass.

3. **Topology and practical160 work.** `:74-88` captures one dense plain3..160-point loop within actual finite domains; there is no world-mm cap incorrectly applied to UV. `:103-133` checks all duplicate vertex pairs, allows forward collinear samples, refuses backtracking, and detects nonadjacent contact/crossing/overlap with exact represented orientation. Exact rational signed area rejects zero area. The same check runs on the rounded output at `:186-187`, including the expected orientation flip. A selected reflection cannot silently collapse distinct points into one admitted result.

   The two160-point passes need25440 duplicate pair tests and25120 nonadjacent edge-pair tests. Their worst-case four orientation tests per nonadjacent pair plus320 local-turn tests is100800, below the explicit102400 ceiling. The code's caps match these bounded counts. The three existing rational contexts keep the existing200000-operation/8192-bit bound per context. No parent or shared rational budget was increased.

4. **Material flags and ownership.** `:180,200` copies the nonselected coordinate without numeric recomputation, preserves point order and keep, and returns new loop/point arrays. The input and output geometric orientation differ, but parity-based keep semantics do not require flipping inside/outside. `packages/barocss-cad-model/src/engine/direct.ts:98-104,170-196` captures/copies the accepted sidecar before publishing it, rejects ambiguous selected object IDs on the new trimmed path, hides the old object by immutable object spread and retains its original trim/source data. Native/transport failures occur before add() and cannot partially publish a direct source/object. The untrimmed branch still uses the old reverseSurfaceAxis call and add semantics.

5. **D336 boundaries remain meaningful.** The mapped result contains nonempty trim metadata, so unchanged Split/Region/Extend/Intersection/visible-IGES guards continue to see it. The actual DirectInspector thicken/sew checks continue to reject it. There is no new raw-surface path that strips context before these checks. Source pick/native refusal precedence is preserved; Model wraps the new transport error class with DIRECT_VALUE while existing parent-native errors remain parent errors.

## Test-source adequacy and remaining execution

The inspected Kernel test source covers an independent represented-value Fraction lift/material oracle; both axes/keep flags;160-point rectangle and concave loop; fractional rounding; endpoint copies/nonselected negative-zero bits; geometric double reversal; malformed/unsupported/collapsed/crossing profiles; actual large UV domains and original UV tolerance. Its concave oracle explicitly distinguishes sampled130.9590625 from ideal131. `packages/barocss-cad/test/trimmed-surface-axis-reversal.test.mjs:15-107,112-178` is source evidence of the cases, not this reviewer's test execution.

The Model test source covers actual public160 projection output, immutable source/sidecar ownership, names/IDs, native encode/read, unsupported profile refusal/retry, ambiguous selected ID, and continuing Split/IGES guards: `packages/barocss-cad-model/test/direct-trim-reverse.test.ts:53-145`. This reviewer ran none of these tests.

Actual Studio positive Reverse U/V, Undo/Redo, selection behavior, native file ownership, browser error/no-download behavior and material decoding remain assigned execution evidence. Keep sampled display-mesh area/centroid separate from world trim-polyline geometry, as planned. An accepted JSON native roundtrip is semantic stored-value proof for its actual fixture; do not extend it to bitwise signed-zero/source arithmetic involution claims. The nonselected negative-zero preservation test proves the returned operation sidecar only.

## Scope limits

One simple stored polyline/affine-plane profile only. No review acceptance for curved or multi-loop transport, clipped intersections, trimmed IGES, trimmed thickening/sewing, global surface regularity, manufacturing tolerance, whole08, remote CI or release. Source list hashes attest what was reviewed, not a full graph. No source edits or heavy work were performed.
