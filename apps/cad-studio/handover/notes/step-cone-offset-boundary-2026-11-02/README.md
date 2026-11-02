---
work_id: D443
artifact_type: step-cone-offset-boundary
status: bounded-measurement-qualified
owner_role: executor
last_updated: 2026-11-02
---

# Measure the current direct cone STEP offset boundary

D443 continues row 13 after `4ac391cfd1c0dbfca537cf44d4e6ab8c389a51ae`. Overall progress remains about 43%. **PASS:** one native control/refusal test and one actual Studio control/refusal-retention flow. **FAIL retained:** an independent tool assertion dereferenced `None` before any fixture read or product call; its intended negative check is corrected in a separate passing attempt. **NOT_RUN:** new cone admission, nonzero offsets and new physical accuracy. [qualification.json](qualification.json) holds exact commands, hashes, inventories and limits.

## Selected input and independent proof

The existing `frustumStep(10,6,30)` constructor means bottom radius 10, height 6 and semi-angle 30 degrees. Its STEP control is 2,261 bytes. A second 2,296-byte file replaces its cone entity with one direct `OFFSET_SURFACE` of distance 0 and appends the original four-attribute cone unchanged. Reversing those two textual edits recovers every original control byte. The old intentionally malformed three-attribute refusal fixture is not used or changed.

The [STEP geometric representation definitions](https://steptools.com/stds/smrl/data/resource_docs/geometric_and_topological_representation/sys/4_schema.htm), sections 4.5.61/4.5.86, provide the regular cone/offset convention. Zero displacement preserves every regular support point. The selected positive-radius frustum stays away from its apex. No nonzero normal or transcendental reduction allowance is needed for this identity measurement.

A separate stdlib reader verifies both graphs, all references and shape reachability, unchanged boundaries/frame/header/mm context and exact reversal. Both raw files contain one solid, three faces, three edges and two vertices. The retained lexer lacked digits in the existing `.PCURVE_S1.` token; a scratch copy changes only that enum token rule, following [Part21 Table 2/6.4.5](https://www.steptools.com/stds/step/IS_final_p21e3.html). Exact inverse comparison protects the rest of the reader. The first tool attempt mishandled a correctly unmatched malformed-enum negative control. Its failure is preserved; only the `None` guard is corrected for attempt 02. Neither attempt calls product code. This is selected graph/support reasoning, not full schema or solid integration qualification.

## Current native and Studio outcomes

One gated native test makes exactly two `importStep` calls and one strict `checkBrep` on the accepted control. It passes 1/0/0 with 1,094 fixed inputs unchanged. The native control has one body, one shell, four faces, six edges and four vertices after existing periodic splitting. All six edge and four vertex tolerances remain `1e-7`; raw and native inventories are kept separate. The zero-offset wrapper gives raw `BrepError INPUT` with the named `CONICAL_SURFACE` capability message. No source, build, standalone physics or baseline retry is involved.

Driver syntax/lint and final Model types pass after the last driver edit. One actual public control Open/Fit then one attempted zero-offset Open passes. Real worker read request 6/revision 4 returns `CAPABILITY`; the UI shows the named reason and says the part is unchanged. The control document, adopted/native data, seven quantity fields, source IDs, camera/matrix bytes, meshes and effects remain exactly equal. Root views both PNGs and sees the frustum and its readable refusal.

All 768 fixed inputs and 1,038 frozen paths match through cleanup/current root verification. Root rehashes 70 passive runtime bodies; missing direct Camera.ts/flow-helper responses remain explicit. Errors, console errors, source changes and downloads are zero. Context, browser and server close, own PID 77882 is absent and the lease is released. The worktree stays frozen through cleanup. Geometry review/native work uses Sol High; actual driver/checks use Sol Medium.

## Next capability boundary

This checkpoint measures the existing guard. Cone offset support remains open in [#2263](https://github.com/barocss/barocss/issues/2263), together with the wider assembly/presentation/PMI/topology criteria. New admission would require the full geometry tier: signed normals, nappe/apex limits, raw-angle/frame/reduction error, complete boundary certificates against original tolerances, independent audits/mutations and actual execution. #2258 fitter/public-thicken, #2266 widening and manufacturing/Physics/Motion HOLDs stay in force. No download, OCP use, paid call, release or develop integration occurs.
