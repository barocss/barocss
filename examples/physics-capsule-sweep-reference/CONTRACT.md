## Frozen independent upright capsule sweep reference

Continue existing #830 discovery after [raw character NO-GO](https://github.com/barocss/barocss/issues/830#issuecomment-6083990501). #1062/#1064/#1065 remain PLANNED. Question: can a copied, static-only capsule query supply independently correct pre-movement TOI and normals for the already observed wall/step/slope gap? This is private geometric research, not implementation of a public query or controller.

**Ownership and exact parent:** `e2965acb5af01383e0f9441f6f7c41f0449358d7` → new isolated codex/physics-character-sweep-830 in reused Physics worktree. ONLY NEW `examples/physics-capsule-sweep-reference/**`. Original character files/receipts unchanged. No package/root/lock/CAD/GPU/Viewer/Integration edit, dynamic sentinel, runtime world or borrowed external kernel. Plain ESM research has no affected product package build. Integration still lacks Viewer980 and Physics827/1022; these are not geometric reference dependencies.

### Fixed geometry, scene, input and output

Right-handed XYZ metres; upright world-Y capsule radius0.15m, half centreline length0.35m (total1m). Translates by displacement without rotating. Copied static OBB fixtures `{id,centerM,halfExtentsM,orientationXYZW}`; scene `{revision,boxes}`. IDs unique qualified ASCII1..64, opaque revision1..64; 0..32 boxes; finite positions/components within10m, half extents0.0001..5m, normalized XYZW within1e-12. No CAD/mesh/dynamic obstacle authority. Query exact `{revision,centerM,displacementM,excludeId}`; centre components within5m, displacement norm≤2m; excludeId null or known ID. Own plain data fields only, reject extra fields/accessors before evaluation; array copies. Revision mismatch/nonfinite/wrongdimension/cap/unknownexclude refuse without changing the accepted scene. Reset/clock/rigid mutation not provided. Disposal idempotent and later queries refuse.

Private result: null for proven clear travel, otherwise `{bodyId,fraction,normalM,pointM,segmentM,iterations}` with fraction0..1 and copied world tuples. Normal points from box toward capsule. Box point and centreline witness have distance≈radius; point may be nonunique on a face, so generic point checks verify membership/witness rather than claiming a unique point. Initial overlap gap<−1e-12m refuses the complete query (including inside-box zero-normal ambiguity). Initial touching |gap|≤1e-12 returns hit0, including zero/away movement; later controller chooses separating-motion policy explicitly. No penetration depth/depenetration/stair/pushing policy inferred.

### Candidate and independent oracle

Candidate transforms upright segment endpoints to OBB local frame via its own quaternion matrix. Minimum squared segment-to-AABB distance uses fixed100 ternary iterations plus both endpoints; clamp gives witness/normal. Iterative separating-plane advancement uses gap/(−normal·displacement) when closing; a separating plane with nonpositive closing proves no future hit. Monotone t, no overshoot/hidden clipping. Contact gap tolerance1e-12m, fixed64 advancement iterations per box; exhaustion or nonfinite/ambiguous normal refuses, no partial candidate. This tighter geometric stop is frozen BEFORE any measurements to support tangent TOI checks; the earlier card's1e-6m was only a proposal. Earliest hit wins; fractions within1e-9 are ties, resolved by lexicographic ID independent of input order. Internal cap1 refusal control is diagnostic only, not a public knob.

Independent reference imports no candidate/Physics collision/math code. Transform vectors by Hamilton quaternion products rather than candidate matrix. Exact segment minimum enumerates breakpoints where coordinates cross each box face and minimizes each active quadratic interval. Separately minimize convex distance over translation fraction with120 golden/ternary passes and endpoints, then80 bisection passes to earliest contact. Reference classification tolerance1e-13m. Compare analytic face/corner/tangent cases as independent controls; do not call numerical grazing tolerance an exact CCD theorem.

### Frozen primary cases

Floor box centre[0,-.05,0], half[3,.05,1], identity. Wall centre[.5,.6,0], half[.05,1,1]. Step centre[.5,.05,0], half[.25,.05,.75]. All lengths in metres.

1. Empty scene; zero and moving queries return clear.
2. Floor: centre[0,.8,0], displacement[0,-.6,0], analytic TOI.5/normal+Y.
3. Parallel flat walk centre[-1,.505,0], displacement[2,0,0], clear.
4. Wall centre[-.5,.6,0], displacement[2,0,0], analytic TOI.4/normal−X.
5. Touching wall centre[.3,.6,0] with zero and separating[-.2,0,0] displacement: hit0 by declared initial policy.
6. Contact-free wall travel centre[-.5,.6,0], displacement[-1,0,0]: clear.
7. Step corner centre[-.5,.505,0], displacement[1.5,0,0]. Lower cap centreY.155, cornerY.1; analytic firstX=.25−sqrt(.15²−.055²), TOI=(firstX+.5)/1.5. Exact unique box point[.25,.1,0].
8. Step top grazing centre[-.5,.6,0], displacement[1.5,0,0], first TOI.5 at corner; grazing+1µm centreY.600001 is clear.
9. Step three-axis corner centre[-.5,.505,.83], same displacement; analytic firstX=.25−sqrt(.15²−.055²−.08²), point[.25,.1,.75]. Z1.0 variant clear.
10. Z-rotated15° finite floor centre=−.05n, n=[−sin15,cos15,0], half[3,.05,1]. CentreX−.75,Y=tan15*X+.35+(.15+.2)/cos15,Z0; displacement[1,0,0], TOI.2/sin15 and normaln. This measures slope geometry, not10° controller rejection.
11. Y-rotated30° wall same centre/half; centre[-.5,.6,0], displacement[1.5,0,0], TOI=(1−.2/cos30)/1.5; normal[−cos30,0,sin30].
12. Identical wall ties wall-a/wall-z in both input orders choosewall-a. Two differently located walls choose physically earliest regardless ID sorting. Explicit exclusion of the only wall is clear.
13. 32 identical grazing step fixtures with IDsbox00..31: correctearliestbox00/cap64, full worst selected query cost. 33 fixtures refuse.
14. Initial wall overlap centres[.4,.6,0] and[.5,.6,0] refuse; no fabricated hitnormal or depth.

These are authored developer cases, not arbitrary terrain/stair/engineering demand. Store all original scene/query inputs and returned fields, witness gap and independently computed reference/analytic discrepancies; queries are pure and do not move a body. Two full campaign repeats exactly match output bits. Original raw rigid character tilt/slope failure remains unchanged.

### Numerical, refusal, cost and actual browser gate

Each non-overlap primary case matches independent hit/clear/ID, fraction≤1e-6 absolute error, normalized worldnormal Euclidean error≤1e-6 and uniterror≤1e-10. Returned segment witness lies on the translated upright centreline, point lies on the OBB boundary and separation gapabs≤1e-6m. Unique step/corner points compare≤1e-6m; nonunique face contacts check membership only. Grazing firstTOI compared against analytic. All fractions/travel bounded and finite. Independent point/segment/distance and analytical translation controls run before primary measurement. Actual invalid/stale/source/output copies, initialoverlap, cap diagnostic, dispose and complete scene retention controls are recorded. Do not repair a failed primary algorithm/profile by tuning limits or excluding an inconvenient case.

After helpers finish numerical work, one full untimed campaign warmup then3SERIAL trials of100 repetitions of all accepted primary queries. Report p95 per namedcase/trial plus three-trial median/min–max, including whole snapshot.query validation/geometry/outputcopy but excluding sceneconstruction/independent oracle/hash/report. EACHcase EACHtrial p95≤2ms. No GPU/FPS or broader physics benchmark. Clean Node22source provenance pinned before reports. Plain ESM syntax/load and actual private query flow; no product package build claim. Portable binary F64 original geometry/query/output fields and raw manifest with explicitLE/SHA, independent decoder verifies chosen outputs and originalbits. Preserve firstdirty/full failures then repeat at clean source.

Only if all Node numeric/refusal/repeat/cost gates pass, run actual Chromium same-query numeric repeat plus three warm100-repeat CPU trials and console0, same outputs/hashes/gates. This browser numerical flow is NOT Viewer/GPU display/playback. Failure leaves queryapproachNO-GO and #1062PLANNED. Success qualifies only bounded native query-reference GO, not a controller/public API. Actual code merge with retainednativeproof permits#1062to freeze its public contract underlatest674; unrunIntegrationUI/Save/Open/recovery are separately tracked pending. Parent#830staysOPEN for exactadoption and remaining controller/actualdisplay decisions. No productpush/PR/pack/deploy/publish/release; PlanneronlynewIssue numbers/titles, no newIssue needed here.
