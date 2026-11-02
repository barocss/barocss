---
work_id: D447
artifact_type: core-part-workflow-defect-qualification
status: done
owner_role: executor
source_request: "Resume C1-1, reuse retained evidence, and fix the first reproduced everyday CAD blocker"
last_updated: 2026-11-03
---

# Retain authored rectangle driving dimensions through Finish and reopen

C1-1 begins with the first unproved linked everyday-part action, rather than rebuilding existing tools or continuing uncommon STEP variants. The baseline is `a9f6a48faa7d046838c9b8404b1b59d70ca01bfc`; fetch confirms both remote refs and the allowed worktree agree. This item addresses the first actual product failure found: a newly authored rectangle loses its two driving length constraints when Finish compacts it to the rectangle representation.

## Retained evidence and selected profile

D349 and D380 preserve historical sketch/edit/native-file proofs, but neither has a complete matching current source capsule. Initial source subsets match2/drift10 for D349,1/drift5 for D377,6/drift2 for D380. Their three retained saved-file hashes match. D377's old timing is not current performance acceptance. No old complete suite is replayed. These seeds do not prove fresh linked authoring, true measurement, geometry-refusal retention or local-project OPFS Save/reopen for this combined workflow.

The bounded target is a plate of width80→60, depth40 and height10; a revolved radius10 boss centered at0,0 fromz9 to25; union, radius3 through-bore and four radius2 outer vertical fillets. To author this through existing sketch-plane controls, the initially proposed entire part was translated by[-20,-20,0] before the definitive native probe. There is no shape/tolerance change: final volume is `400W - 160 + 1315pi`; centroid and bounds are translated consistently. The original-position plate proof is retained separately and not counted as the new position.

Sol High's translated native probe passes10/10 prefixes (both widths, plate/revolve/union/hole/fillet), strict native B-rep validity, actual named references and independent closed-form volume/centroid/bounds. Maximum volume-relative error4.0319e-15, centroid absolute2.66454e-14mm, box coordinate absolute7.10543e-15mm. Frozen acceptance is relative1e-9 for volume and absolute1e-9mm for centroid/bounds; no after-failure relaxation. This is native Model-to-CAD proof, not actual UI authoring or complete C1 acceptance.

## Actual first product failure

Run02 creates a fresh rectangle with real pointer events, anchors it at[-20,-20], types80 and40 through the viewport Dimension editor, and reaches **Fully defined, rank8,0DOF**. Both driving fields are locked, and the constraint list includes Length edge1=80 and edge2=40. Finish accepts a compact rectangle with min[-20,-20], max[60,20], stable sideTags e1–e4 and idn0, but no authored outline.

A narrow continuation opens exactly those accepted bytes, clicks the actual standalone sketch history button and Edit sketch, and enters Dimension mode. It completes its harness and preserves exact geometry/document identity on no-op Finish, but reports **Under-defined, rank6,2DOF**. Both displayed lengths still read80/40 while their locks and authored Length records are absent. Product status is `AUTHORED_DRIVING_DIMENSIONS_LOST_ON_PUBLIC_REOPEN`. There are zero page errors, console errors or watcher changes;1177 source pins remain equal through cleanup. Root reviewed the before/after screenshots. The failure is design-intent loss, not a wrong native solid result.

Mechanism: `sketch/loops.ts` compact rectangle serialization intentionally omits the length records because width/depth carry the geometry. `sketch/reopen.ts` restores a plain rectangle; its later polygon conversion retains axis constraints but cannot recover which dimensions the person authored. Do not infer locks for all old rectangles, switch the native profile to polygon, change the solver or alter tolerances to hide this loss.

## Repair and verification boundary

The qualified narrow repair retains authored constraint metadata in the existing optional outline while preserving the compact rectangle profile, ids, sideTags and native geometry. Reopening must keep that profile on subsequent Finish. Existing Width/Depth/Corner editing and parameter binding must synchronize the retained metadata; otherwise a later edit could reopen stale geometry. Independent source review identified these coupled consumers before implementation. No schema, solver, public-export or B-rep core extension was made.

Final focused tests are63/63 PASS,0FAIL/0SKIP; five changed-file lint and final Model tsc pass after the last edits. Tests cover0/1/2 authored locks and2/1/0DOF through codec/read/reopen/no-op Finish, native-input/mesh equality, Width/Depth/Corner edits, later parameter values, authored edge order/ids, exact typed decimals and fractional endpoint bounds. Independent source review fixed three additional consistency traps: remeasuring an unchanged typed10.1, a stale parameter-driven Length getter, and affine endpoint drift from1.1 to60.1. The final five source/test hashes match review and actual execution. No tolerance was widened.

Actual repaired run03 PASS has13 snapshots: fresh constrained80x40 sketch, Finish, Extrude10, actual unique browser-project Save, public Close/reload/reopen in the same browser context, reopen via the consuming Extrude editor, width80→60, Finish, exact Undo/Redo. Reopened80/40 and edited60/40 both retain locked fields and **Fully defined, rank8,0DOF**. The saved native OPFS document is1089bytes and exactly equals the accepted document. Independent Python oracles (zero product imports) compare volume32000 vs31999.999999999985 and24000 vs23999.999999999996 under the unchanged absolute1e-6 budget.

Root checked1176 frozen files before/after/after cleanup/current, zero page/console/watcher errors, zero downloads, removed-and-absent owned project namespace and closed context/browser/server. WrapperPID18440 is absent and its gate lease is released. Root viewed the two fully-defined states and the accepted plate. Actual receipt SHA256 `a8e65ca081d12034e48f1f9e492a5c11811106c305e14a24c8d205ae929efd98`; raw artifacts stay under `/tmp/barocss-d447-stage1-run03`.

Read [qualification.json](qualification.json) for exact commands, numeric results and source hashes. The complete combined bracket UI sequence is NOT_RUN: public revolve/union/hole/fillet authoring, final downstream references, real Measure and invalid-fillet refusal remain for D448. Generic editor/parameter/fractional controls are focused-test scope, not additional actual UI acceptance. The earlier10-prefix native probe is retained baseline scope, supported by unchanged core/conversion and the exact metadata-versus-plain native-input/mesh control; it is not ten new repaired UI runs. No full-kernel rerun is needed for this Model metadata change. C1-1 and general CAD readiness are not closed.

## Preserved failures and operating authority

The original native probe assumed a single live output before union; the legitimate plate+boss outputs caused a harness assertion. Output selection was corrected by id, with all live outputs still captured. One pre-execution resource refusal ran no SUT. Studio run01's canvas-corner focus hit the chat column; the click was corrected to a verified unobstructed canvas center. The first public-reopen diagnostic assumed the ordinary feature data-node-index selector existed on a standalone sketch; source and actual DOM showed its separate sketch button. Only that selector was corrected. These harness/admission failures remain separate from the completed public product-loss reproduction.

The owner's later instruction says to run our Studio tests even when independent other validation is active. For this and subsequent CAD work, use an available gate slot, keep load below40 and at most one heavy execution owned by this CAD lane at a time. Foreign holders alone do not block the CAD run; never stop their processes. All writers in this worktree still freeze through actual Studio cleanup. This explicitly replaces the former global-idle precondition; it does not remove gate capacity or source-freeze controls.

UI redesign, nonzero cone expansion, new CAD Physics/Motion, manufacturing, fitter/thicken, kernel widening, downloads, paid runs, release and develop integration retain their existing gates. Related sketch epic#532 remains open; its complete acceptance is not satisfied by one rectangle fix. Already closed research#2210/#2215 and feature#549 are not reopened or relabelled. General CAD readiness remains NOT_MEASURED; legacy43% stays frozen. Remaining combined C1 actions stay explicit until separately proved.
