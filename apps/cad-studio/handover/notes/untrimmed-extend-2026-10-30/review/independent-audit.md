# D347 independent audit (Opus sub-agent) — first verdict CHANGES_REQUIRED

Reviewed the uncommitted round-1 repair (before tangent/domain/zero-tangent fixes). Read-only; probes in [../audit](../audit/). Summary of the returned findings, preserved as received:

1. Numerical loss >1e-7 still admitted: 160 random parallelograms (degree1–3, nonuniform knots/spacing, separable rational weights, oblique, 1e-3..5e3 mm, offsets ≤3e5): accepts1312/refusals608/uncoded0, worstAcceptedDev 4.216e-7; 16 accepted >1e-7, all offsets ≥1e5 (e.g. trial141 u-min D=180). Not serialization/solve (unrounded fit residual ≈6e-11). Cause: finite-difference tangent `p−q`, h=1e-3·span, cancellation at 1e5 coordinates (trial79: tangent direction error 4.92e-6 → far-row node error 1.48e-7), amplified up to κ between nodes; the grid check compares against the already-wrong grid. Fix: exact first derivative; add grid error × κuκv.
2. Curved inputs: success with mm-scale loss while the message implied a 1e-7 guarantee (R=1000 D=10 arc-part 4.61e-1; far edge 7.07e-4·D truncation). Fix: exact tangent, honest wording, measured off-node deviation in the name.
3. Uncoded `Parameter is outside the knot domain` on ~3–4% of ordinary domains (sample `a0+(a1−a0)·i/n` overshoot). Fix: exact last sample.
4. Conditioning estimate sound in form, never below actual (ratio 86..3.4e4), but an estimate (Gauss–Jordan constant can exceed γ16); costs reach (15 mm plane refused at D≥1000, actual 5e-10).
5. Fit parameter reconstruction bit-identical; end clamp justified (≤5e-10).
6. Knot scaling to mm is reparameterization only; no downstream `[0,1]` assumption found.
7. `num()`: no change for previously exponent-free values (2e6 samples); still wrong for |v|≥1e21 and >1.8e299 (pre-existing); `surfaceIntersection` has its own exponent-writing `num` (report only).
8. All-coincident poles succeeded without extending. Fix: refuse zero tangent.
9. Import order; `inverseRowSum` duplicates private fit-plain helpers (acceptable).
10. Test file genuine but missed 1–3; reach refusal assertions encoded the over-estimate. Suggested offset plane and odd domain cases.

Root disposition: 1, 2 (tangent + wording + label), 3, 8, 9 (import order) and 10 adopted; 4 kept as documented estimate; 7 side note recorded, not changed. Post-fix audit probes: accepts1182/refusals738/uncoded0, worst 5.609e-9.
