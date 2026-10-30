# D341 independent final production source review

## Scope and verdict

SOURCE REVIEW COMPLETE: no required production correctness finding. Reviewer runtime/build/test/browser/heavy status: NOT_RUN. This reviewer made no repository edits. Kernel author and root own execution/product qualification. Oracle/browser source review is separately recorded in `oracle-review.md`.

Fixed checkout `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`. Final six Kernel-owned source/test hashes match `/tmp/d341-kernel/owned-sha256.json` exactly. The nine listed native/exact/binding/math/policy parent files have no diff against baseline `91edfdfe72e866d1a3b4eb7b0595013a990ead90`. A final diff re-read confirms the only existing production changes are root exports, private `copyLoop` export with unchanged body, and optional326|484 private ring profile with default326.

## Final source findings

1. **Correct crop authority.** `trimmed-surface-region.ts:53-59` stages the existing native region once, uses its owned original/effective domains, admits original trim vertices against the original domain, and arranges only requested rectangle plus original trim. Outside crop input vertices are therefore ordinary, and the exact leaf's165-segment cap is not raised. Face selection at line65 implements crop AND inside/outside original loop.
2. **Contact and output bounds.** For one straight trim segment, rectangle-boundary intersection is at most two isolated points or one overlap interval with at most two endpoints. Total incidences C<=2n. New trim splits I<=C and new rectangle splits J<=C give E<=n+4+I+J<=5n+4=804. New vertices give V<=3n+4=484. Coincident merges reduce counts; original endpoint/corner contacts add no uncounted event. Each emitted cycle occurrence belongs to one half-edge, so <=1608; strict positive-area outers require3 vertices, so <=536 components. Runtime counters at line62/76 enforce this profile. No epsilon discards positive material.
3. **Area/empty semantics.** Exact selected component area is positive and <=original; full-domain copy additionally requires exact conservation. Zero selected material throws own DOMAIN at line75 before any final-support proof or publication. Native parent runs first at line53, so its existing admission/D1/binding failures retain precedence. The root empty policy applies after valid native parent staging; a parent-rejected tiny crop is not forced into DOMAIN.
4. **Whole final-support proof.** The reused unchanged binding leaf certifies actual final native coefficients against the original affine authority on the final effective rectangle. It does not require an exactly affine child or assume each of four operations spends a separate tolerance. Positive weights, nine positive projected Jacobian Bernstein coefficients and strict convex projected corners certify the admitted rational bilinear support. The residual coefficient/Wmin bound covers the entire final chart, including accumulated native insertion rounding.
5. **One shared world error budget.** Lines100-102 add actual final-child coefficient bound and affine original-chart UV rounding before outward comparison with old1e-7. UV uses the separate old1e-7 ceiling. Fixed request binding/material contexts are not reset per vertex or component. Native evaluator trim-vertex comparisons at104-105 remain supplementary and separate from coefficient proof.
6. **Rounded graph.** Original endpoints/crop corners are retained; exact boundary coordinates use effective native endpoint values, not approximate snapping. Shared exact keys produce one nearest-once mapping; reverse keys reject distinct exact vertices collapsing. Finite/effective-domain membership, simple rings, signed orientation, and all inter-ring contact/containment relations are checked before returning. Component order derives from exact canonical outer keys. All components retain an inside outer and outside holes.
7. **Error and ownership.** Shared internal Split-family failures are translated into the Region family with the same code and cause, avoiding a public Split-specific error leak. Other arrangement failures retain BUDGET/REPRESENTABILITY mapping. The native result/source/report is spread unchanged beside the new report. Each emitted mask receives new arrays. Model publishes all masks through one add operation after complete producer success and preserves the old untrimmed path.
8. **D340 and parent boundary.** D340 `copyLoop` body is byte-identical aside from its private module export. Both new private ring-profile defaults remain326, including identical rendered refusal text for D340. Existing D340 callers pass no new argument. Native Region/Split/knot insertion, exact arrangement, binding, common failure helper, numeric policy and math are unchanged. Native128 and D337160 ceilings are not widened.

## Test source and supplied execution evidence

The final Kernel test helper is an independent native-BigInt exact slab oracle with perpendicular crop switch levels, exact polynomial moments and positive-overlap union-find. It imports no product predicate/arrangement/rational code. The final match routine consumes each expected component uniquely using both area and centroid. Its exactly-affine-poles assertion uses independent exact binary64 fractions.

The owner logs were read as supplied execution evidence, not rerun:

- `focused-first.log`:9 PASS /1 FAIL. First failure is comb centroid pairing, `633.9999999999997 differs from -6`. The test matcher was corrected; production hashes stayed fixed.
- `focused-final.log`:10 PASS /0 FAIL. `related-first.log`:14 PASS /0 FAIL. The author reports full build/types/lint PASS; the build output is empty and lint output contains its code-shape inventory. Reviewer did not execute those commands.
- Captured comb:476 vertices,788 edges,1576 half-edges,1331 emitted boundary occurrences; inside78/outside79 components. Context maxima: arrangement85966 operations, material42875, binding149458; <=old200000 each. Maximum recorded binding bits1080<=8192. Topology orientations reach643848 and are reported separately; they are not misreported as D337102400-capped work.
- Ordinary public160 crop:164 segments/13366 pairs; material components1/2 on the primary inside/outside crop. Captured nonexact-affine native final poles include z=.3 and1.2999999999999998, and position bound1.942890293094024e-16. These are owner-run observations from the log.
- Captured translated tiny parent rejection: native `SurfaceRegionError`, code BINDING, reason `original/extracted native U/V partial observation exceeds local policy`; new adapter code NATIVE. This follows source native-first precedence and is separate from the valid-parent empty DOMAIN control.

A separate Model test expectation issue was sent to root/Model owner: its tiny translated control initially expected Jacobian/material text, while this native Region rejects first. The author corrected the test assertions only, preserving ordinary empty DOMAIN control and the original63PASS/1FAIL log. Final narrow source re-read closes the issue; supplied repaired Region log is18PASS/0FAIL. No production change occurred. Oracle/browser companion capsule records the failure and correction separately.

## Final Kernel-owned SHA256

```
85880c6f98c4193b9abc36209699f3210cdcea84e61d9cba94f91fab2b3cd976  src/index.ts
894de212eca8ff92d893d03ad426fc68aca4194878980adb22c54909f70dfb5f  src/nurbs/surfaces/trimmed-surface-region.ts
63a002c2c6287b2509e71988c853ac33b64837c63b3e733ed582093b705500e8  src/nurbs/surfaces/trimmed-surface-parameter-split.ts
705d5cc7aa012a26a40dc5d920f104e9c5dd6011b9679b88e3b2418044c5085c  src/nurbs/surfaces/trimmed-surface-split-topology.ts
fd3d06ee8cc374ea48aaf92a2b6d2f54342e41d741551cd1ffe31402d9c5b471  test/trimmed-surface-region.test.mjs
11943438f7e23d99ef2755864f9673787f8364f815cd9c9ad66935de4765cc56  test/helpers/trim-region-oracle.mjs
```

This source verdict does not certify actual Studio, native Save/fresh Open, screenshot quality, remote publication, whole08, arbitrary curved trims, repeated-operation closure or release.
