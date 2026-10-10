# Private SAT feature geometry contract (#1233)

Status: specification and source drafting; actual geometry result UNMEASURED. Exactsourcebase5a4d02f6fe0062473cbf1dccd1dc7f54420b66d0, isolatedcodex/physics-rigid-feature-geometry-1233. Original1219failure retained;1226nativee35c9d76 input manifests/hashes are immutable external data. No PhysicsWorld is created or stepped. This contract grants only geometry discovery, not publicAPI/cap/solver/physicalGO.

## Modules and detached data

- sat-feature.ts: original Float64 box SAT arithmetic/order, originalHit plus actual winning candidate metadata. Return null on original separation; no face alignment approximation or tie preference.
- face-contact.ts: use selected A or B face exactly; incident opposite face, reference-plane clipping, paired surface witnesses and up-to-four deterministic retained points.
- edge-contact.ts: selected supported finite box edges, bounded closest-segment witnesses; one midpoint, explicit degeneracy/endpoint handling.
- geometry.ts: validated private orchestration, copied result/refusals and deterministic local labels.
- archive/consumer/reference/controls/evidence: independent source and emitted helper qualification. These modules do not alter the original detector/manifold/world or prior archives.

`SatSelection` contains copied `hit:{normal,penetration,pointM}`, selected candidate index/label and `feature:{kind:'face-a',axisA} | {kind:'face-b',axisB} | {kind:'edge-cross',axisA,axisB}`. Original15-axis order, <1e-12 cross-length skip, strict minimum and support-point order remain exact. An actual Float64 winner is an algorithm selection, not a unique physical-feature certificate.

`ContactGeometry` contains copied selection; family face/edge; exact reference plane normal oriented A→B; `points` with `{key,witnessAM,witnessBM,midpointM,normalGapM,pointPenetrationM}`; and explicit conditioning/tie observations. `midpointM=(witnessAM+witnessBM)/2`. `normalGapM=dot(witnessBM-witnessAM,planeNormalAtoB)`; `pointPenetrationM=max(0,-normalGapM)`. The original SAT hit depth is separate and is not assigned as every face point's depth. No impulse/force or body reference escapes.

Witness A/B lie on the named original feature and within its finite bounds. A face point pairs the clipped incident point with its projection onto the selected reference plane. For B reference, reorder witnesses/signs to A→B. An edge point pairs the bounded closest points on the two supported finite edges. A zero-length/invalid feature or inability to obtain valid witnesses is a private refusal, not a fallback corner average or tolerance increase.

Point keys are deterministic local feature/order labels. The same input must reproduce them exactly. They do not certify cross-step physical feature persistence. Before a world consumer uses face keys for warm starts, it must explicitly freeze that interpretation. Edge points remain cold each step in planned1234.

## Admission, errors and units

SI metres/right-handed XYZ/Y-up. Caller pairs originate from original body admission; archive raw position/velocity/quaternion/angular fields overwrite copied parser fields without renormalization. Require boxes, finite admitted extents/poses/quaternions and distinct IDs. Preserve original collision bounds. Runtime invalid profiles use original PhysicsError INVALID_CONFIG / `private feature geometry requires two admitted boxes`. Validated geometry with no valid qualified witnesses uses NUMERIC_LIMIT / `private feature contact requires valid box witnesses`. All caller data and archive bytes are unchanged on success/refusal. Freeze complete numeric degeneracy guards and source hashes before trials; no untested fallback.

## Actual first inputs and gates

Input manifest SHA256: 43d4a40b8c168e79047aa8d7d7805771aae15a361955228454afca474ee83967. The immutable native1226 archive has27files/26hashed artifacts. Its source/repeat/compiled reconstructed inputs and actual encounter order are the first consumer; all66non-null instances must be revalidated. Input working bodies are reconstructed and unaccepted, not exposed failed world states.

Original hit normal/depth/point bits must match unchanged originaldetect. Contact result/key/copy/error and independent reference agree across source/repeat/genuinecompiled originalhelpers, private geometry SOURCE. Decimal80/120 precision<=1e-25; independently proved witness membership and signed-gap identities<=1e-12m, normalorientation<=1e-12, midpoint identity<=1e-12m. Retain all nonzero referenceSAT axes and report near/tied selection ambiguity. Freeze exact reference expectations before trial.

Required controls include referenceB face, rotatedface, skew/interior/endpoint-clamped/parallel edges, containment, swapping/sign, duplicates, invalid input and copy isolation. Parent diagnostic11+10controls are retained separately. Build originalaffectedpackages/private types and execute one real archive consumer. A geometric rejection or mismatch is retained, no retune. Planned1234 does not start until geometryGO and exact adopted interface. No model/refinement/cost/Chrome/Viewer/productpush/PR/release here.
