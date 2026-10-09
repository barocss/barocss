## Frozen successor: exact copied-geometry reuse

Continue existing #830 after [numeric pass/canonical cost NO-GO](https://github.com/barocss/barocss/issues/830#issuecomment-6086588593). Question: can exact-bit copied static geometry reuse preserve every source ID and query result while satisfying the SAME single-warmup/2ms gates? This is private discovery, not public #1062 implementation. No duplicate Issue.

### Parent, ownership and immutable baseline

Exact parent `1817567e02432916295f3d517849a5947f3108d0`; new isolated branch codex/physics-capsule-reuse-830 in reused Physics checkout. Only NEW `examples/physics-capsule-reuse-reference/**`. Baseline physics-capsule-sweep-reference and original character files remain byte-identical. No package/root/lock/CAD/GPU/Viewer/Integration change. Plain ESM research: no affected product build or public API implied. Shared develop remains sole Integration-owned.

### Fixed inputs, semantics and minimal change

Use the previous EXACT22scene/query fixtures, same input bits, source IDs/revision/exclusion, dimensions r0.15m/half0.35m, units, limits, cap64, contact/initial tolerances, quaternion evaluation, reference and analytic gates. No new geometry, movement/controller policy, clipping, source-ID deletion, relaxed warmup or parameter/quality retuning.

Build a private copied snapshot through unchanged baseline admission. At construction, group boxes ONLY when all10original centre/halfExtent/XYZW values have identical binary64 bits. Explicit LE80-byte/160-hex key retains negative zero; never normalize or round the key. Original boxes/IDs/order and their byte values remain stored, copied and externally inspectable. Different original q/negative-zero bits stay separate even when geometry happens to represent the same rotation.

Per query, validate through unchanged baseline queryInput. For each group with at least one nonexcluded ID, call unchanged baseline sweepBox exactly once against the group's copied representative geometry, then select its smallest eligible original ID. The representative ID may be excluded, but no result may return it. All nonexcluded groups must be visited before returning; any initial-overlap/numeric/cap refusal aborts complete query. Select minimum fraction across group hits, then lexicographic eligible ID within1e-9ofglobalminimum. Preserve exact existing output fields/fractions/normals/points/segment/iteration bits and errors. No persistent query-result cache, dynamic geometry or stale revision reuse. Disposal idempotent; later query/getSnapshot refuse.

Private diagnostics expose copied group/source counts and group member IDs for controls, not query result fields or a public ABI. Optional per-call research hook counts actual sweep evaluations; hook absent in every measured query. Do not let instrumentation change timed flow or claim phases/heap from counts. Group construction cost measured separately, outside query p95, with no invented constructor budget; report serialized key bytes/geometry counts as counts, not measured heap.

### Independent/copy/refusal proof before canonical timing

Worker implements ONLY groups/snapshot/reuse-controls; root runner/campaign/raw/browser; read-only helper reviews equality/identity/exclusion/state contracts. No simultaneous benchmark campaigns.

- All22accepted/refused queries must exact-match original snapshot output numeric bits, ID/error and retained snapshot. Also match saved baseline rawinput/output SHA7048-byte payload and unchanged independent Hamilton/piecewise/analytic references.
- Repeat all outputs and original bits; copied source/getSnapshot/output/diagnostics, query unchanged, stale/invalid/accessor/cap/disposed and complete error retention under new snapshot.
- Prove exact grouping via identical geometry/different IDs; negative-zero and different near-unit q keys do NOT group. Preserve original bits in returned snapshot.
- Exclude the representative while another identical member remains; exclude one of tied IDs; reject unknown exclude; no geometry retained from a prior revision/query.
- Hit0plusanotheroverlap refuses entire query; unique-geometry alloverlap and duplicate-overlap behavior exactly match original. Three near-tie permutations retain global-minimum ID choice.
- Actual callback control verifies32identical grazing fixtures triggerONEunchanged scalar sweep,32distinct copied shapes trigger32sweeps, excluding all members of a singleton triggerszero, and no callbacks in timing. These prove work counts, not measured cause of prior cold p95.

### SAME numerical/cost and actual browser gates

Numerical targets from prior contract unchanged: hit/clear/ID, TOI/normal/point error≤1e-6, normal uniterror≤1e-10, membership/witness gap≤1e-6m, finite/bounded fraction/iteration, initial refusals. Keep firstdirty/firstfailure reports.

Node22 clean provenance from module repo before writes. One complete untimed22-query campaign warmup, then THREE serial100-repetition trials for each20acceptednamedcases; EACHcase/trial p95≤2ms. Full new snapshot.query validation/group iteration/unchanged geometry/returnedcopies included; construction/reference/hash/report excluded. Record three p95, median/min–max. Preserve prior3.506584msfailure rather than remeasure/replace it. No new baseline speedup claim across sessions. If comparison necessary, baseline is independently measured in same session, not inferred from old timing.

Only if all Node numeric/refusal/repeat/cost gates pass, execute actual Chromium same-input numeric repeat and THREE single-warmup100-query cost trials, EACHcase/trial≤2ms, console/warnings0, exact originalinput/output bits/IDs/errors equal Node and immutable baseline. Browser clock resolution must be stated; this is numerical browser flow, NOT Viewer/GPU display/playback/FPS. Prepared browser tooling is not evidence of a run.

Portable explicitLEF64 originalinput/output files and metadata use the SAME layout and independent decoder from immutable baseline (no new candidate imports). Store exact hashes, retainedIDs/errors and source/dirty/runtime metadata. Named browser Screenshot only shows labelled numeric table, not a physically rendered scene. No compiled public parity/package build because product paths unchanged.

If GO, it is only bounded native geometric-query-reference GO for these fixed inputs/limits; #1062 still needs actual code merge and frozen public fields/modules/errors plus its own package/build/actual source+compiled consumer. #1064controller/#1065actualViewer remain separate. Parent#830 staysOPEN for exact adoption and remaining controller/display discovery. Latest674 actualmerge+nativeproof enables code availability, with current Integration UI/Save/Open/recovery explicitly `merged; integration validation pending`; it never supplies missing model/API GO. No productpush/PR/pack/deploy/publish/release. Planner receives only newIssue numbers/titles; no newIssue here.
