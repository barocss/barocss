# D299 cone and pair-wrapper independent read-only review

Reviewed the frozen `packages/barocss-cad/src/features/cylindrical-wrap-chart-cone.ts` and `cylindrical-wrap-chart-pair.ts` in `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`. No source edit, probe, build or test was performed. Root's running targeted checks are not evidence produced by this review. A separate child review covered the wrapper ownership/options boundary; it also found no actionable defect.

## Material defects

None found in the requested cone math and wrapper boundaries.

- Cone lines49-67 compute `[YW,ZX,XW]` with the correct common positive scale `60*D^2`. Each projected denominator coefficient is checked strictly positive.
- Lines146-149 require bit-identical stored Cartesian endpoints with `Object.is`, then independently check exact projective equality. Different endpoint weights and homogeneous denominator scales are handled by exact cross multiplication.
- Lines72-84 form the exact difference numerator `F=pC*(A,B)-(pA,pB)*C`, require an exactly zero endpoint coefficient, and store60 times the exact degree5 quotient: `360*F_(i+1)/(i+1)` for t, or `360*F_i/(6-i)` for1-t. The removed factor and `pC*C(t)` are strictly positive everywhere except the prescribed endpoint.
- Lines99-118 use floating directions or a supplied finite hint only to choose a normal. The normal is then decoded as an exact represented dyadic and checked nonzero. Lines120-153 require strict opposite signs for all six exact functional Bernstein coefficients. These signs put both complete open projected images in opposite open half-planes through their common point; no other inter-image intersection or second visit to that point can be accepted.
- The endpoint1 tangent candidate has the correct away-from-endpoint direction: the factored value there is proportional to `-gamma'(1)`. No missing sign reversal was found.
- Wrapper lines80-95 copy the whole input, prepare both curves and invoke the consumer on one shared context. `!==undefined` branches preserve explicit maxDepth0 and witnesses:false; endpoint0 is handled explicitly. Same source identifiers are refused. Lines98-103 return independent frozen snapshots/receipts and final shared-budget counts.

## Limits that must remain explicit

1. The proof is about the two **stored projected curve images**. It does not certify original carrier binding, source history, actual radial-side construction, a whole loop, loop orientation/containment, B-rep closure, represented volume, a solid or text support. The cone and wrapper false flags match that boundary.
2. Per-edge injectivity and regularity rely on the owned chart's separate progress admission. The half-plane cone certificate does not replace that admission or certify a larger graph's vertex degree/cycle ownership.
3. A poor floating hint, overlapping coefficient cones, zero factored coefficient, same outgoing ray, cusp or higher-order tangency can refuse even when the two geometric open curves are disjoint. This is conservative and does not weaken correctness. Candidate tangent samples are not approval evidence.
4. The low-level cone accepts finite represented hints; the raw-curve wrapper additionally restricts hints to the native coordinate bound and rejects zero hints as input. That narrower wrapper contract is consistent. Positive scaling of a normal does not affect the exact sign argument.
5. All arithmetic still depends on the shared core enforcing its ownership, positive X/W, immutable cubic coefficients and request-wide integer/rational/work limits. This review did not re-audit the separate core or nonadjacent-separation implementation. No standalone cone certificate can authorize resetting the context for each pair in a future whole-loop operation.
6. Source reading cannot establish runtime PASS, performance, full-matrix results or product integration. Those remain Root's separate checks. No new runtime or source artifact was created by this review.
