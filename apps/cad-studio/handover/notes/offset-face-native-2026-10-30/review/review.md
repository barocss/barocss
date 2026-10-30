# D342 independent High review

Status: PRIOR FROZEN HELPER SOURCE REVIEW COMPLETE at the hashes below. A later actual near-full invalid-success boundary reopened qualification; see `nearfull-review.md` for the required correction/current pending freeze. The production helper did not exist at initial inspection; historical questions/findings below are retained with their resolutions. Command/integration runtime and actual Studio/browser qualification belong to root/Medium.

Reviewer scope: fixed checkout `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`; source and supplied evidence reads only. No repository edits, candidate/build/test/browser/heavy execution, commit or remote write. This reviewer writes only `/tmp/d342-review` artifacts.

Read supplied `/tmp/d342-probe/receipt.md`: the author/root baseline reports fractional footprint loss, translated separated solid, drafted-side continuation mismatch, and preserved integer-cylinder cap success at published8adbbbfa. These are supplied baseline runtime evidence, not reviewer-reproduced results. The identified planeOfFace1e-3 rounding reinforces the need to avoid both old display-derived helpers.

Early design challenges sent to Kernel/Model authors:

1. Bind the selected semantic native face to the current body key/ref/revision. Reject stale/merged/ambiguous references; do not choose the first geometric match.
2. Use a native cardinal coordinate frame and owned native boundary. No r4, display centroid, mesh reconstruction or planeOfFace fallback.
3. Prove right-prism geometry and support-plane continuation, including a deliberate treatment of coplanar Boolean partitions on repeat edits. A cap outline alone does not prove valid adjacent geometry.
4. Preserve the successful circle control through actual native/source circular authority. Matching sampled points/endpoints or arbitrary rational coefficients to a circle is insufficient.
5. Include cap sense in outward/inward sign. Compare exact original normal coordinate plus signed requested distance with its single represented result under old1e-7; refuse no-move, inward collapse/crossing or overflow atomically.
6. Cache only against current immutable source/revision/geometry identity; avoid retaining mutable arrays or using stale body display records as authority.
7. Wiring must pass the native profile into the actual Extrude/Boolean recipe. An unchanged extrudeProfile(ctx) call would re-read the legacy mesh path.
8. Independent checks must cover expected support planes, one native closed solid and no exposed old cap/ledge, in addition to volume/centroid. Preserve baseline source/ownership/file evidence and integer cylinder compatibility.

## Implementation review in progress

Read initial `nativeOffsetFace.ts`, Offset-only command diff and the two new helper/integration test sources. Generic Extrude/faceSketch/faceProfile/planeOfFace source is unchanged. The command appends the factory-owned native sketch, selects its exact newly appended index with all prior face/body/direct selections cleared, and then invokes the existing Extrude composition. This avoids falling back into the old mesh profile or an unrelated newer sketch.

Required early findings sent directly to authors/root:

- Initial references to nonexistent `CadNumericPolicy.linearToleranceMM` were corrected to the existing `linearTolerance`. Exact binary64 decoding now rejects nonfinite input, so NaN/undefined cannot become an integer proof threshold. Author states the property typo was corrected before its first actual helper run.
- Circle footprint reconstruction and normal-coordinate rounding initially spent the old tolerance independently. A private bound now carries the exact whole-curve footprint bound into one joint old1e-7 comparison with the exact coordinate-addition residual.
- Affine side supports initially permitted repeated control corners. The final in-progress source requires four distinct native side poles equal to its four boundary corners, excluding a collapsed ruled side.
- Cached display records are now deeply owned, preventing aliases in shared face metadata from validating themselves after mutation.
- Native coordinate checks now explicitly use `CadNumericPolicy.coordinateAbs`; requested distance uses `CadPartLimits.length`. Accumulated translations outside the selected coordinate profile can still refuse; this is not a claim about global translated-Part admission.
- Returned mutable profiles require proof binding beyond object identity. Canonical full-profile snapshots now reject ordinary coordinate/sketch mutations and untracked structured clones. An accessor replacement can make canonicalization read old values then expose different values later; a factory freeze/descriptor-safe solution was requested and remains pending final source review.
- Offset availability rejects mixed body/vertex/direct selections, while the current helper/build initially checked only faces/edges/sketches. An authoritative full-context guard and negative tests were requested from the Model owner; pending source recheck.

## Circle bound mathematical check

The in-progress `curveBound` uses exact fixed2^-1074 integer coordinates and weights. On a rational quadratic span, `H_a W_b-H_b W_a` is degree4. For coefficient k, product weights are `C(2,i)C(2,j)/C(4,k)`, i+j=k. Multiplication by12 clears every denominator exactly: factors12,3,2,3,12. Sum of absolute coordinate residuals bounds L1 error by the Bernstein convex hull. Dividing by12*min(w_a)*min(w_b), with positive weights, gives the whole-quotient bound. Integer numerator units are length*weight², so division returns length units; upward integer ceiling is conservative. Both orientations are checked with the same fixed normalized knot basis.

Two C0 quadratic spans with knots[0,0,0,.5,.5,1,1,1] split directly at control indices0..2 and2..4 into clamped normalized quadratic spans without knot insertion or geometric alteration. The source now matches all four actual quarter spans bijectively to all four actual signed-frame producer quarters at both selected and opposite cap levels. This covers cardinal rotations/seam shifts and negative-cap reflection; no span subset or point samples supply the certificate. Side-base quotient bound0 plus equal positive row weights, consistent axial levels, exact tangent-coordinate equality and straight axial seam edges bind the full cylinder support to its actual cap curves.

For polygons, exact cap convexity, paired vertex sets, straight axial edges, native affine supports/four distinct side corners and bounded closed native topology establish the admitted right prism. The canonical frame uses native coordinate selection/sign, not display geometry. Axis/sign plus native face sense supplies outward direction; the exact intended/new coordinate must remain strictly beyond the opposite cap. Repeated Boolean partitions remain an explicit unpartitioned-profile limit; author-run outcomes must be reported separately from editing the created extrusion.

Source test coverage includes independent actual native endpoint box mass/centroid, all intended native support planes, absence of exposed old cap and one native closed solid; integer cylinder closed-form control; exact source prefix and sidecars; ownership/refusal/retry/file/reedit; malformed/current-source/cache mutation and repeated-operation classification. Test presence is not runtime proof.

## Source findings closed before final hash freeze

The latest source re-read closes all required items above:

- Factory profiles are recursively frozen after a structured clone, including nested coordinates, plane and on-reference. The private WeakMap also records their complete canonical snapshot and exact footprint bound. Ordinary mutation/accessor replacement cannot change that object; untracked clones refuse. Each cache return gets its own frozen owned profile and proof record.
- The authoritative helper now rejects mixed edges/bodies/sketches/vertices/direct selections and invalid/non-safe-integer pick indices. Direct build tests exercise mixed body/vertex/direct contexts, so UI availability is not the only guard.
- Cache display records are structured clones. New source-content snapshots invalidate the per-document profile map; current display equality is a consistency check, explicitly not an epoch/authenticity certificate. Native profile geometry still comes from current partBreps body+native face id/name, never display coordinates.
- Model clones the frozen factory sketch before withNode. New regression mutates the authored plane/on/loop storage and a separately opened file's sketch, checking independent ownership/editability. The bound factory object is not stored in the document.
- The circle source now checks all four actual quadratic quarter spans bijectively against all four emitted signed-frame spans at both original levels, plus straight axial seams and exact support/cap quotient identity. A new imported noncircular coefficient control retains endpoints and cap bounds but changes an interior tangent pole; the test requires full-quotient refusal rather than endpoint/bbox fitting.

## Final helper freeze and work boundary

Both final helper-owned hashes exactly match `/tmp/d342-helper/owned-sha256.json`:

```
a9196575ec1b7c928af33799c2c7f4195d111a3c851189917090d86b06e83cab  Model src/app/nativeOffsetFace.ts
69860ec2e322f7f52234386defacc9db99eb53c704dd254e8dc9d8ebfd83c593  Model test/native-offset-face.test.ts
```

A direct diff against baseline8adbbbfa5515b76769f6adc9412f65c017b7ec38 is empty for the seven parent files: generic faceProfile, planeOfFace, Kernel part-model/prismatic-solid/brep-core/math/numeric-policy. No generic Extrude change appears in the Offset-only command diff.

The admitted prism cap n<=16 bounds native inventory to32V/48E/18F; the cylinder is4V/6E/4F. The full native checker runs only after those coarse inventory checks. Polygon predicates use exact finite dyadic integers; circle arithmetic has fixed one/two-span quadratic inputs, two orientations and five degree4 coefficients. The two four-quarter cap bijections require at most20 candidate curve comparisons; two side-to-four-cap exact bindings require at most8. These are source-derived fixed work bounds, not measured runtime counters. No per-vertex context reset or enlarged public numeric tolerance exists.

Finite binary64 weights occupy at most2098 bits in the fixed2^-1074 integer representation; coordinates bounded by10000 occupy at most1088 bits. Product residuals contain two weight integers and one coordinate difference with only fixed small binomial factors/sums, so a conservative intermediate bound below5300 bits follows. This is not a SectionRationalContext operation-budget claim: the helper uses a separate fixed-size exact calculation and reports no performance acceptance.

Read supplied author receipts/logs, without rerunning:

- First harness path mistake had no product test result.
- First actual helper run5PASS/1FAIL was strict +0/-0 expectation on bottom circle. Generated projected zeros now canonicalize; no native/source raw-bit identity is claimed.
- Rotated-circle7PASS/1FAIL exposed quarter seam phase refusal; full all-quarter bijection corrected that boundary.
- Test-only TypeScript narrowing errors were retained and fixed before final types.
- Final focused11PASS/0FAIL, Model types and narrow lint PASS. Imported altered-coefficient same-endpoint/bounds control reaches typed VALUE/full-quotient refusal. These are owner-run evidence, not reviewer execution.

Current command source additionally contains structuredClone(profile.sketch) before authoring and mixed-context negative tests. Its latest inspected hashes were `ccfdd164ce069545ed0e2de47b8701974e720a09634acbc43415dd290ce53281` for profileCommands and `985f4be469ac25ef677aa63095fd1a9bc91ac719431712da59898deffa2ecb7f` for offset-face-native.test. They require the Medium's final manifest/runtime recheck separately; this helper verdict does not label those pending tests as passed.

Final helper source verdict: no open required correctness finding. Reviewer candidate/build/test/browser/heavy execution: NOT_RUN. Actual native-output mass/support-plane/one-solid/no-old-cap, file/reedit/repeat classification, API inventory, actual Studio and visual/publication acceptance remain separate root/Medium gates. No generic curved editor, repeated-partition closure, performance or whole08 claim follows.
