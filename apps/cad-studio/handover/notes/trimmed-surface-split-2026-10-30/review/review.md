# D340 independent High review

## Scope and evidence boundary

Initial scope: source review only. Fixed checkout: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, branch `local/cad-dev`; published baseline `477d76eae2d7401388755fcb625a64a0fd86c508` plus D340 WIP. This reviewer made no repository edits, candidate calls, build, test, browser, commit or remote operation. The only reviewer writes are this capsule under `/tmp/d340-review`.

Read `/tmp/d340-plan/plan.md`, `oracle.json`, and captured parent/certificate artifacts under `child-probe/`. The public-parent collapse probe is prior evidence supplied by the author/root. This reviewer did not reproduce it. A memory search had no relevant hit and supplied no review fact.

Final production-source re-read followed the Kernel author's ready notification. The following is a source review verdict, not runtime qualification.

## Verdict

No required implementation correctness finding on the reviewed production source. One required acceptance coverage gap was sent directly to root and Kernel author: generated-intersection storage-rounding collapse needed its own atomic-refusal witness. The existing used-child world collapse test covers a different guard. The author added the exact proposed witness. Final test-source re-read confirms it asserts typed TOPOLOGY/collapse refusal, unchanged original support and mask, and an ordinary valid retry with two components and a regularity certificate. The seven production hashes below were re-read after the final freeze notification and are unchanged. The source coverage gap is closed.

The author reports focused 13 PASS / 0 FAIL in `/tmp/d340-kernel/focused-final.log`. That is author-supplied runtime evidence. This reviewer did not run the tests and does not promote the source review to a product/browser verdict.

## Mathematical checks

1. Exact topology and legacy behavior: `planar-arrangement.ts` retains the old default `arrangeSegments(..., false)` bbox/Number decisions and old `facesWithWindings` behavior for all legacy callers. The new exact leaf alone disables the Number bbox and provides rational signed-area and absolute-area comparisons. Half-edge orientation, line intersections and angle order remain exact homogeneous predicates. No new Number conversion supplies an exact-route topology decision.
2. Structural bounds: an admitted simple n-point loop lies within the convex rectangle. Only the full axis cut can create proper trim-edge intersections; each noncoincident trim edge has at most one. Thus the conservative `2n+6` vertex cap is sound. Trim fragments, domain-boundary contacts and cut fragments fit `4n+11` edges. Every emitted boundary occurrence belongs to one half-edge, hence at most `2E`. A strict positive-area outer ring has at least 3 vertices, hence at most `floor(2E/3)` components. For n=160 this supports 326/651/1302/434, without an epsilon or arbitrary output vertex cap of 160.
3. Child coefficient proof: the Cartesian control-point order is 00,01,10,11 and matches the polynomial `3*u+v` indexing. Exact cancellation makes `H_u W-H W_u` degree 0x2 and the V numerator degree 2x0. Their cross product dotted with the original rank-two normal is degree 2x2. The power-to-Bernstein coefficients use `choose(k,i)/choose(2,i)` in each axis. Nine strictly positive coefficients certify the projected Jacobian throughout the child chart. Strict positive turns of the 00,10,11,01 projected Cartesian corners give a positively oriented convex Jordan boundary. Positive rational edge weights trace each edge monotonically. Together these establish the admitted projected rational bilinear patch as injective. This is a bounded family certificate; it does not certify arbitrary surfaces or floating evaluators.
4. Position proof: the residual `H-W*A` is represented exactly at degree 2x2. Its maximum Bernstein coefficient L1 norm divided by the minimum positive weight bounds the whole child against the original affine restriction. Adding the affine UV displacement before one outward rounding spends the old 1e-7 world tolerance once. Along a corresponding stored edge, affine UV displacement is a convex interpolation of endpoint displacements, while the child residual bound covers the whole rectangle.
5. Storage graph: one canonical exact vertex key supplies shared rounded values, while reverse keys reject distinct exact vertices that collapse. Each rounded ring must remain simple and retain signed orientation. Every inter-ring edge-pair relation and every vertex containment relation is compared with its exact counterpart. Existing shared endpoints remain identical through the shared map; new crossing/overlap/touch/nesting changes refuse. Exact area conservation is checked before storage rounding; output world-area accuracy still needs the independent runtime oracle.
6. Work scope: the arrangement, material area, and binding contexts are allocated once per request, not per vertex or component. Existing SectionRationalContext 200000 operation/GCD and 8192-bit guards remain unchanged. Raw topology predicates have separate structural bounds and counters; they are not claimed as D337's old capped predicate work. Native parent 128 and D337 160 source/report code is unchanged.
7. Ownership and publication: helper native parent snapshots own the support; input trim descriptors are copied without invoking ordinary accessors. Each component receives fresh loop/UV arrays. Model copies the component sidecars before one `add` publication and creates no object for an unused child. All nonempty components retain at least the inside outer trim, so downstream whole-surface guards still apply. Hidden originals and source text are preserved. The untrimmed route retains its prior behavior. No shared validation extraction changed D337.
8. Error family: the production top-level wrapper now converts nonfamily arrangement failures into the new declared family, preserving the cause. Model maps that family to existing DIRECT_VALUE. The earlier raw PLANAR_ARRANGEMENT escape concern is resolved in the reviewed source.

## Required rounding-collapse witness

Use an exactly affine plane with chart U=[0,1], V=[0,3], inside loop `[[0,1],[1,2],[1,2+2**-51]]`, U cut `.1`.

The two exact cut intersections have nonselected coordinates `1+p` and `1+p*(1+2**-51)` for exact represented binary64 p=.1. Their difference is about 4.44e-17, smaller than the binary64 spacing near 1.1. Both nearest-once values are 1.1. The exact lower component has positive area, so silent omission or output of a collapsed loop is forbidden. Expected result: atomic TOPOLOGY refusal with unchanged inputs; a separate ordinary retry must work. A comparable representable positive sliver should be retained, not removed by area epsilon.

The final test source contains this exact witness. No candidate was executed by this reviewer to establish its runtime result.

## Reviewed production SHA256

```
ee8b67447c7aa412519b575f1a4afcd2b4d44ea2dd4eb19fb5edbdac2fd048e7  trimmed-surface-parameter-split.ts
aa83ec0b799f73969ddc7d2ba6e2ffaa5d4bc7581112e5ea3df0fca2ab95bb25  trimmed-surface-split-binding.ts
9f818c18869c638de6adf9a6f7f49cbc5d6d7d23f34bc33d3947e018b84ea657  trimmed-surface-split-topology.ts
45758063bbe0d132cdcc2428a5d0b836084053d6b108b18f635451d359a678db  trimmed-surface-split-common.ts
7e985f7e9d3b8c0cb17e9828d5ffc5cd83d0bca2ad40ccaf8862dde49bda07fb  brep/planar-arrangement.ts
00bdf76eca5c6132afe82bc284c16ee42226f85ac946167a5a2b0606764a6024  index.ts
799da53c2807df661ac094b1794b897421f21d97d2cba8052296d722d5c27fe8  Model engine/direct.ts
```

Tests/build/browser/remote qualification by this reviewer: NOT_RUN.
