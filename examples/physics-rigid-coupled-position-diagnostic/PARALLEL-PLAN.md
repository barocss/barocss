# Read-only implementation split plan — proposed CONTACT-13

Planning only. Root adopted the diagnostic direction. Issue creation and actual #1264 adoption remain prerequisites. This file contains no implementation. Do not create/copy source or run a world, oracle or trial before root freezes the successor Issue and verifies actual adopted native paths.

## Immutable input and first question

Parent #1264 native d2e6f59aaa30164db4eb8ae971c1d03b5c2c86be; measured source ecc4dccc7a50a5753c236647be3b491a4fafd3fa; base201681689d398f8b2a9e3472579076c8f4fa43af. Manifest SHA327ab9e319b9d7e2e3d63309fef682216751fe8d88cc7208bb730e25606d473f. Full source pins356; emitted files504. Its frozen physical2mmNO-GOs remain ALIGNED5, OFFSET3, YAW4. Source/repeat/compiled raw and phase fields match.

Question: Does each first failed final-pose pair correspond to a solved row, a previously separated pair that was absent from the current problem, or a detector/reference disagreement? Identify the exact maximum pair and each above2mm pair independently. Do not change rows, cap8, tolerance, velocity/cache/contact law or any position phase.

## Existing reusable modules — unchanged imports, not copies

1. `examples/physics-rigid-feature-penetration-diagnostic/entry.ts` exports `inspectPair(a,b)` returning `{hit:detect(a,b),selection:selectBoxSATFeature(a,b)}`, plus original parseBody and PhysicsError. Re-export this accepted read-only adapter from the new entry. It imports original detector and adopted feature selector; no world constructor/solver.
2. The same folder's `compare.mjs` exports `DEPTH_TOLERANCE_M=1e-12` and `compareObservation(actual,reference,{requireNormalizedDepthAgreement=true})`. Keep default normalized agreement enabled for ALL actual archive pairs. Its checks preserve exact selector/detect bits, original separation tolerance1e-12, detector-versus-raw depth<=1e-12, Decimal precision<=1e-25 and raw/normalized depth<=1e-12. NO1e-9agreement gate.
3. The same folder's `geometry-reference.py` reads JSON lines `{a,b}`. Response has `ok`, raw/normalized SAT records, candidate axes/radii/signed-centre distances/margins, exact-zero/near-parallel/tie information and precision/raw-normalized difference fields. It independently decodes binary values and computes Decimal80/120. Reuse it unchanged for all per-frame pair observations and original analytic controls. Normalization is an observer convention, not modified engine input.
4. The same folder's `archive.mjs`: reuse `digest`, `ArchiveError(code ARCHIVE_INVALID)`, `restoreState(state,936byteSlice,ids,actualStep)` and `rawState(state)` unchanged. Its old `validateFiles/decodeReports/loadArchive` are NOT applicable: they assume the old flat38-entry1234manifest,609acceptedstates, old filenames and old counters. Do not call them against1264 or change them.
5. `examples/physics-rigid-feature-geometry/archive.mjs:restoreWorking(report,raw)` can restore each pre-coupled9-body936byte slice unchanged, through an owned DTO `{workingBodies:attempt.workingBodies,workingRawSha256:digest(verifiedSlice)}` AFTER the new loader validates the complete parent rawstream/hash/cursor linkage. This preserves raw signedzeros. Its old loadArchive is not used.
6. `examples/physics-rigid-coupled-position-reference/linear-reference.py` remains the independent exact Fraction JSON-line observer of the three copied first-failure row problems. Its `compare.mjs:compareSolutions` checks archived candidate versus exact result and certificates unchanged. Read recorded translations/certificates; do not import or call the JS solvePosition into the diagnostic runtime graph.
7. `examples/physics-rigid-contact-diagnostic/observer.mjs` supplies unchanged process/JSON-line transport. `examples/physics-rigid-contact-reference/fixtures.mjs:fixture(scene)` supplies original config identity. Parent1252reference-controls.json supplies existing literal geometry cases; new controls should select/import their data, not run1252old-archive driver.

## Exact1264manifest and stream adaptation

Manifest is an object `{base,measuredSource,verdict,sourceUnchanged,artifacts:[...]}`; artifacts63. Each row has `path` relative to `examples/physics-rigid-coupled-position-world`, `bytes`,`sha256`; gzip rows also have `decodedBytes`,`decodedSha256`. It is not a filename→hash dictionary. Listed paths include `RESULT.md` outside the nested evidence directory. Read through the owned example root, not only native-ecc4dccc. Validate complete declared path set, unique normalized relative paths, bytes/hash and decoded gzip bytes/hash before decoding. Validate top-level source/base/verdict/sourceUnchanged and parent provenance. No parent mutations.

Per graph/scene records:
- `${graph}-${scene}-report.json.gz`: fields config,ids,rawLayout,states,attempts,attemptOutcomes,observations,stats,linearReferences,acceptedSnapshots,attemptedSteps; accepted/working/attemptedAccepted raw lengths/hashes and first independent-quality failure.
- `${graph}-${scene}-accepted.f64le.gz`: states0..firstFailure, one936byte frame =9bodies×13Float64LE values.
- `${graph}-${scene}-working.f64le.gz`: one936byte pre-coupled frame per reached attempt.
- `${graph}-${scene}-attempted-accepted.f64le.gz`: final accepted frame per attempted step; typed failed steps would contain retained prior accepted frame. These actual first-failure scenes have no typed campaign refusal and every attempted step was accepted before quality observation.

Fixed ID order b0,b1,b2,b3,b4,b5,b6,b7,floor. Field order positionM3,velocityMps3,orientation4,angularVelocityRadps3. JSON equality permits signzero loss, so restore from raw and use Object.is/raw bytes for preservation. Verify original shape/kind/inverse-mass/material/static-floor values separately against config and actual parsed bodies. Never infer current velocity/quaternion from previous state.

Frame selection/cursors (offsets in uncompressed streams):

| Scene | Last accepted pass | First failed accepted step | Previous accepted offset | Failure pre-coupled offset | Failure final accepted offset |
|---|---:|---:|---:|---:|---:|
|ALIGNED|4|5|3744|3744|4680|
|OFFSET|2|3|1872|1872|2808|
|YAW|3|4|2808|2808|3744|

Accepted offset is step×936; working offset is (attemptedStep−1)×936 for THESE VERIFIED all-reached attempts. Do not hard-code this mapping for arbitrary archives. Require exact attemptOutcomes[k].attemptedStep,acceptedStep,outcome,phaseReached and report.attempts[k] linkage before slicing. States use exact time `step*(1/120)`. Pre-coupled Body[] has no PhysicsState cursor; derive an explicit frame DTO cursor from its validated attempted-step mapping and label it `pre-coupled-working`, not accepted state.

Counts pergraph: ALIGNED6accepted/5working, OFFSET4/3, YAW5/4. Chosen3frames×3scenes=9frames;36pairs each=324pair-frame observations pergraph,972over allthreegraphs. First-failure pre→final coverage gives36pair transitions/scene=108pergraph,324overall. The immediate previous accepted frame is context only; no unrecorded earlier phase is reconstructed.

## New module boundaries and lead ownership

ONLY NEW `examples/physics-rigid-coupled-position-diagnostic/**` after Issue/adoption start gates.

- `archive.mjs` (lead): adapts the63-entry1264manifest, full file/decoded hashes, report/raw layout/cursors and cloned frame DTOs. Pure restoration and validation. Reuse above archive primitives. Return `{graph,scene,frames:{previous,preCoupled,final},problem,archivedSolution,rawSlices,provenance}` with detached data. Errors original ArchiveError with separately frozen exact new messages for manifest shape/path/decoded length/hash/cursor/attempt linkage/identity/pose/result mismatch.
- `frames.mjs` (lead): original config→parseBody metadata restoration; stable pair order; confirms pre/final orientation/velocity/angular/mass/material/staticfloor exact preservation and final position = recorded working position + archived translation within original1e-12m rounding gate. No integration/solver.
- `entry.ts` (lead): re-export accepted1252inspectPair/parseBody/PhysicsError. No privateworld imports.
- `coverage.mjs` (lead): accepts original per-frame pair observations, independent pair SAT replies and copied row problem/solution. Builds stable pair-ID join. Checks tests36; each present problem row corresponds to original pre-phase non-null detect INCLUDING0depth; omitted pairs correspond to null. Records included/omitted, prior-row membership, original-threshold class and independent separated/touching/overlap class without merging near-touch semantics. Joins exact first-failure maximum/above2mm pairs to that coverage. Recompute row residual n·(u_b−u_a)−depth and compare recorded margins/certificates; keep this separate from post-SAT depth.
- `compare.mjs` (lead): invokes unchanged1252compareObservation; requires detector/raw AND raw/normalized depth agreement<=1e-12m, precision<=1e-25, finite numeric representation and exact source parity. Compares coverage candidate results to separate independent coverage replies using frozen1e-12 scalar gates. A resolved known physical penetration is diagnostic evidence; unresolved references or mismatched data are not a world-quality repair.
- `controls.mjs` (lead): new manifest/cursor/row-join/raw/result/hash/error/copy controls; existing per-pair analytic data/negative precision/selector comparisons reused. No old1252fullarchive/worlddriver call. Include missing/extra/duplicate files, truncated/nonfinite raw, false cursor/attempt map, ID/order change, JSON/raw mismatch, row endpoint/presence/depth/normal mismatch, copied normal/static/velocity mutations, null/nonfinite oracle output and deliberate source drift. Retain unknown-exception propagation.
- `bundle.mjs` (lead): current full own/reused source pin validation, source/repeat/genuine emitted-original-helper graphs. Require accepted1252adapter +selector in allgraphs; forbid physics/world and private reference-world/global-island/position-relaxation/solvePosition runtime. Independent Fraction process is separately allowed; declaration types are not a solver run.
- `runner.mjs`, docs/freezes/evidence (lead): archive read,9frames/36pairs each,3graphs; Fraction check once per first-failure problem pergraph; coverageworker protocol calls; complete reports/raw/copy/error parity. One frozen comparison flow only. Root owns Issue/Wiki/remote/fullfreeze and final serial adoption.

## Exclusive independent worker ownership

Worker owns ONLY NEW `coverage-reference.py` and `reference-controls.mjs`. Lead must not edit these files. Worker is not alone and must preserve all parent/lead files. Both agents agree the exact JSON request/reply and literal gates before root freezes any source. Importing controls runs no trial.

Proposed request `{before:{a,b},after:{a,b},translations:{aM,bM},row:null|{aId,bId,normal,depthM},candidate?:{...}}`; all bodies are detached restored original scalar box poses, IDs and dimensions. Worker may import the unchanged1252Python module's scalar decode/SAT functions through a fixed local file path, with no JS producer or original detector import. It re-evaluates independent Decimal80/120 before/after geometry and directional relationship. Treat recorded `u` versus decoded final−before roundoff explicitly; never compute an alternate accepted pose.

Independent response `{ok,resolved,metrics,violations,reference}` includes raw/normalized pre/post minimum margins/depths, candidate/tied axis labels, pair classification, fixed-orientation checks, recorded-translation and actual-centre-change relationship, included-row residual if row exists, and for each usable fixed axis:
`marginAfter−marginBefore = −abs(projectionBefore+projectedActualCentreDelta)+abs(projectionBefore)`.
This formula handles centre sign changes; `−n·du` alone is not used blindly. Support radii/orientations must be unchanged. Keep per-axis changes and minimizing-axis/tie changes separate from scalar minimum-margin change. Worker must not select an arbitrary unique witness or drop nearly parallel nonzero axes.

Literal independent controls: unchanged no motion/separated/touching/overlap, separated gap consumed by translation, included-row clearing while another pair is omitted, centre-projection sign change/normal ambiguity, multiple tied axes, tiny nonzero edge axis, original/norm quaternion convention distinction, altered orientation/shape, malformed/nonfinite/raw pose and detached reply/input mutations. No world or alternate solve. Proposed exact messages/gates must be agreed and root-pinned before implementation/execution.

Worker algorithm fields cannot decide the original detector's own null threshold; lead compares independent margins against the frozen original1e-12 threshold separately. Do not weaken normalized agreement for actual archive pairs. A deliberate legacy analytic normalization-distinction control may retain its explicitly named parent exception ONLY inside that control, never in actual recorded-frame acceptance.

## Execution sequence and gates

1. Root creates successor Issue, confirms no duplicate and verifies exact1264adoption/owned blobs at chosen new base. Then create new isolated lane and assign file ownership above. No source edit/copy before this.
2. Lead and independent worker implement disjoint files with agreed copied protocol; root static review. Pin own files, original Physics/CAD/source/build/Node22.22.0, accepted1252adapter/oracle/archive/compare/control data,1264manifest+all63artifacts, Fractionreference and selected actual source/emitted imports.
3. Root posts full source/input/error/control/import freeze. Run original affected CAD/Physics build and strict types. Freeze/publish actual emitted dependencies before the ONE archived comparison flow.
4. Gates: Decimal80/120<=1e-25m; detector/raw depth<=1e-12m; raw/normalized depth<=1e-12m; original selector/detect fields exact bits; scalar reconstructed row/directional relationships<=1e-12 in stated units; Fraction displacement/objective/certificates original1e-12 and exact certificates0. Known archived>2mm failure is retained, not a diagnostic refusal. No1e-9depth policy.
5. Save per-pair/pre-post rows, signed gaps, allminima/ties, recorded row residuals, actual/independent disagreement categories, parent aggregate linkage and raw frame hashes. All3graphs exact. DiagnosticGO only for authentic resolved archived relationships. No worldGO/cause claim from unarchived history.
6. No new PhysicsWorld/step, cache replay, alternate solve/row set, cap expansion, repeated campaign, browser/cost, tolerance tuning, package/root edits, product push, PR, deploy or release. Parent1264NO-GO/1263detachedGO remain intact.
