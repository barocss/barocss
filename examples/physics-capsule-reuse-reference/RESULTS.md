# Exact geometry reuse: bounded native reference GO

Frozen [#830 successor](https://github.com/barocss/barocss/issues/830#issuecomment-6086709289). Parent `1817567e02432916295f3d517849a5947f3108d0`; clean measured source `69de9359d220699287fa77d3fe832bca09eb40bb`, branch codex/physics-capsule-reuse-830. Final child adds evidence only. Baseline sweep and original character files are unchanged; the original first-trial 3.506584 ms failure stays preserved.

## What changed and what the result covers

At snapshot construction, identical original 10 binary64 geometry values share a scalar sweep. The key is explicit 80-byte LE/160-hex; it distinguishes negative zero and different original near-unit q. All boxes, original order, IDs, revision, geometry bytes and exclusion remain in copied source storage. Each eligible group uses the unchanged baseline sweepBox once. All groups are visited before return, initial-overlap refusals abort the complete query, and minimum fraction anchors ID ties. No formula, shape, tolerance, cap, input fixture, output field or query warmup target changed.

All 22 frozen  cases pass numerical/reference/refusal gates with EXACT original input/output bits, IDs, errors and full sidecar fields, in Node 22.22.0 and actual Chrome 155.0.8059.39. Two full repeats per environment match; both environments match the immutable original baseline. Independent Hamilton/piecewise/analytic references and original decoder pass. This is bounded query-reference GO, not a universal CCD or physics/controller claim.

Work-count controls:32 identical source boxes→1 scalar evaluation;32 distinct geometries→32 evaluations; excluded singleton→0. Original negative zero/near-unit keys stay distinct; representative exclusion, all-box overlap, near-tie permutations, source/output/diagnostic copies and 19 actual refusals pass with getters 0. The callback counts actual calls in controls and is absent from measured query paths.

## Actual serial cost

Clean 69de9359, sourceTreeDirty false, Node 22.22.0, invoked from /tmp. Helpers stopped numerical work. One full warmup then THREE serial 100-query trials for each 20 accepted case. Full snapshot.query validation/group loop/scalar geometry/returned copies included; construction, independent oracle, hash and writes excluded.

| Environment | CAP32_GRAZE trial1 p95ms | trial2 | trial3 | Median | Min–max |
|---|---:|---:|---:|---:|---|
| Node |0.205792|0.043709|0.034125|0.043709|0.034125–0.205792|
| Actual Chrome |0.100000009|0.199999988|0.100000009|0.100000009|0.100000009–0.199999988|

All per-case/trial p95 ≤2 ms. Node overall maximum 0.263875 ms is STEP_GRAZE trial1. Browser overall maximum 0.200000003 ms. Minimum observed positive browser clock increment 0.099999994 ms; small browser numbers are quantized observations, not precise subresolution timings or GPU/FPS. Node and browser measurements are separate. No speedup factor is inferred from the previous session.

Construction is separately observed AFTER query timing: CAP32 source32/group1 takes0.193875 ms in one observation; maximum across 22 constructions 0.346459 ms. Serialized retained geometry key count 80 bytes/group is not heap usage. No constructor budget, phase breakdown or actual allocation/GC cause is claimed.

## Actual browser and raw proof

The driver serves only the two Physics-owned reference folders and launches its own Chrome process. The inspected screenshot is a labelled numerical table of 22 pass results with explicit no-Viewer/no-world text. Errors/warnings 0. Browser output, input bytes and complete IDs/error/metadata match Node and immutable baseline. Its own browser and server close in finally; process exits 0. No existing user tabs changed. No WebGL/GPU/world motion was tested.

Original F64 input 5552 bytes SHA `198ab5023230c8ab84ffc65aa48ec3064a507489fce9641c10d4854a880806db`; output 1496 bytes SHA `63e359a7386ff9b1b83d2b79a9f97cf8786efe85c1134b6b527c7ea062c29b8f`. Total 7048 bytes. The same portable layout and unchanged independent decoder verify all 22 responses, reference/membership/normals/TOI and exact rawSHA. Captured primary buffers contain 0 negative-zero values; separate signed-zero source controls pass. First dirty, clean, browser and original baseline bytes agree. First controls/campaign had no failure; read-only review corrected browser finalgate composition/clock reporting before actual browser run, without changing numeric behavior.

## Limits and next public gate

The measured32 fixture cost case has exact coincident worldgeometry. Different poses do not share a key. A 32 DISTINCT geometry control proves 32 scalar calls and copy semantics, but its cost is UNMEASURED. These results do not prove generic 32 distinct query latency or asset-instance reuse across poses. Public #1062 must freeze its actual geometry capacity and cost envelope from demonstrated consumers, or qualify a broader one before claiming it. Grouping counts are not a measured cause of the earlier cold failure.

#830 remains OPEN for exact adoption and remaining controller/actual-display discovery. #1062 stays PLANNED until exact reference adoption and public API/profile/error/module/source+compiled contract freeze; #1064/#1065 remain later gates. This private plain ESM delta changes no product package, so no affected product build/compiled package parity is claimed. Existing typed PhysicsError identity #1022 adoption remains separate for a compiled public consumer.

Sole Integration may adopt original bc38→e296, sweep e296→1817, reuse 1817→child once, or one aggregate if prerequisites unadopted; never both. Actual merge with native proof enables code availability under latest674, while current Integration UI/Save/Open/recovery is tracked as merged; integration validation pending. No product push/PR/pack/deploy/publish/release.
