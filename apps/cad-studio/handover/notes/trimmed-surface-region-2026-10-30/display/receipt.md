# D341 display domain correction

Source and tests frozen. No commit or push. Browser run02 is NOT_RUN by this worker.

## Confirmed cause
Actual run01 saved outside-hole.bcad and retained-rectangle.bcad load through Model directDisplay. Before correction their result surface entries are absent, rather than NaN meshes. Mesh/isos generated closed-domain endpoints by arithmetic that overshoots: hole v=6.200000000000001 exceeds native vMax6.2; retained rectangle iso u=1.6000000000000005 exceeds native uMax1.6. Native evaluator correctly throws Parameter is outside the knot domain. Existing displayOf catches this and returns []; controls of selected support can still be drawn elsewhere.

## Minimal change
Two module-private displayParameter helpers preserve exact lower/upper endpoints and bound generated display coordinates to the existing closed domain. Used in trim mesh field/grid and direct isocurve sampling. No authored UV change, no sidecar/source/native geometry/tolerance/API change, no generic cleanup, no performance claim.

## Evidence
- before.log: actual saved four-case public directDisplay probe; hole/rectangle result surfaces absent, inside/pocket present.
- isolate.log: mesh/iso evaluator exceptions and exact out-of-domain values.
- after.log: same saved four documents. Hole result:10044 position scalars,18390 indices; rectangle:12675/24576. All positions/normals/isos finite. Hole sampled mesh area552.1118096508944 (separate from ideal eight-point guide552; actual stored material has its own exact oracle); rectangle area24,centroid[25,10,3]. Existing inside/pocket counts, area and centroid equal before values. Probe serialization was overwritten after repair; immutable before.log remains.
- regression-before.log: first baseline harness setup ERR_MODULE_NOT_FOUND esbuild; NOT a product result. Preserved.
- regression-before-retry.log: immutable ecab49052 direct.ts/trim.ts with new public160→nativeRegion→directDisplay tests:2PASS2FAIL. Both failures are missing target surface, controls pass.
- regression-after.log:4PASS0FAIL. Nonempty finite target surface mesh/normals/indices/isos, native-domain endpoints/corners, source unchanged, repeated cache read checked.
- focused-first.log: existing direct/Region/Split/Reverse57PASS0FAIL; initial command ran before new test file existed. New4 cases are separately reported above.
- types-final.log: Model full types PASS.
- lint-final.log: narrow3-file lint PASS.

All Node runtime work used22.19.0 with serial heavy gate and EXIT release. Final holder none. Source hashes in owned-sha256.json. Root owns Studio rebuild and actual run02 visual qualification.

Correction: run01/18-outside-hole-material.json was read directly. Its actualStoredComponents areaWorld is exact fraction89567120809725791629670217469133475/162259276829213363391578010288128, displayed552.0000000000001, not552.0409375. This is the actual saved160-loop component oracle for run01, separate from the sampled display mesh552.1118096508944 and ideal guide552.
