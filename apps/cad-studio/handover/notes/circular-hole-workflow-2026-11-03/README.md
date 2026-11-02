---
work_id: D451
artifact_type: circular-hole-workflow
status: done
owner_role: executor
source_request: "Continue the core CAD roadmap autonomously, one bounded category at a time"
last_updated: 2026-11-03
---

# C2-3 ordinary circular Hole workflow

This item measures existing Hole circle placement; it adds no tool or new geometric admission. Baseline `b29b3fe5a544735f474b8b5c41331844a326b29f` includes D450's accepted selection handoff. D448's single bore and D373's repeated cut feature are distinct profiles, not this circle-placement acceptance. Existing source and old tests are inventoried first; historical selection-setter examples are not fresh pointer proof.

## Declared current-representation case

Use the exact D447 saved80x40x10 plate[-20,-20,0]..[60,20,10], SHA256 `0c602dc99f33ab44ec37fd84a5fd70adb4ee6b23c9e2d61fd71eebde6ffffd0d`. Select its actual top face, create Through Hole Diameter4 with first center[28,0], CopiesCircle Count4, circle center[20,0]. The count includes the seed; there is no central bore. Edit Copies4→6, check exact Undo/Redo and unchanged references, refuse existing-editor Diameter0 retaining accepted document/history/native body, then project Save/Close/page reload/Open and Copies6→4 geometry re-edit. Copies0 is clamped to1 and is not used as a refusal.

The implementation rounds generated centers to1e-6mm. D451 measures that source-derived representation; it does not approve a global precision policy or assert ideal-circle1e-9 placement. Four centers are[28,0],[20,8],[12,0],[20,-8]. Six centers are[28,0],[24,6.928203],[16,6.928203],[12,0],[16,-6.928203],[24,-6.928203]. Independent native cylinder-axis/radius comparisons use these declared finite coordinates, not a fit to output geometry. Ideal unrounded center/radial deviations are reported separately. No tolerance is relaxed to hide a failed ideal-circle assertion.

Closed forms are V=32000-count*40pi, C=[20,0,5], original box[-20,-20,0]..[60,20,10]. Native strict validity, one closed solid, genus=count, all cavity cylinder supports/locations and the expanded target chain are checked separately. The declared targets remain1e-9 relative volume and1e-9 absolute native coordinates/support. The display mesh only maps actual pick names/ordinals.

## Preflight and limits

The gated current-source preflight passes exactly two native evaluations and two independent oracles, count4/6. Both are strict valid, genus4/6; native top display indices are9/11 and the persistent name is n1.top. Maximum volume-relative error is2.311e-15, centroid error6.751e-14mm and axis-location error3.997e-15mm. Six-hole ideal-center displacement is2.302755e-7mm and radial displacement1.994245e-7mm, within the source rounding bound but outside an ideal1e-9 target. Ideal-circle precision remains NOT_QUALIFIED_TO_1e-9_IDEAL. Four current Model hole-types tests pass. No product changes or new build/type/lint/full-kernel campaign is claimed.

The actual workflow acceptance passes for the declared current representation. Routine UI/driver work uses GPT-6.1 Sol Medium; native/independent planning uses GPT-6.1 Sol High. Root owns gate/Studio/source freeze through cleanup and visible review. Core CAD readiness stays NOT_MEASURED and legacy43% is frozen. This one workflow does not qualify arbitrary patterns, blind/countersink/tapped/other axes, overlapping bores or circular repeated cut features. Preserve all kernel/fitter, UI, manufacturing, Motion/Physics, browser CI, schema, download and release HOLDs.

## Actual Studio qualification

All seven declared links pass in one actual campaign: real top-face pick and Hole4 creation, Copies6 edit, exact Undo4/Redo6, existing-editor Diameter0 Apply refusal with exact accepted document/history/native retention, own-project Save/Close/page reload/Open, and geometry-changing Copies6→4 after Open restoring the exact original four-hole recipe. Native/source references n0/n1/n2, parentn1 and face n1.top remain; selected top follows its current ordinal until public Open intentionally clears selection.

Receipt SHA256 `6e821844466881c967bb194b427aa040523422dfc90672d6cfd9795ff767d5f2` records10 snapshots,8 native reads,7 independent physical checks and1193 source/input pins equal before/after/cleanup/current. All current rounded-coordinate physical checks pass. Page/console/watcher errors/downloads are0. The own OPFS namespace is removed and verified absent; context/browser/server close, wrapperPID75085 is absent and the gate releases. Root viewed the four/six-hole results, actual zero-diameter refusal and persisted four-hole re-edit. The separate High read-only evidence review ACKs this bounded scope; raw logs/images/native arrays stay in `/tmp`.

One of one declared workflow cases and7/7 links are qualified. No product implementation is added. The current Model hole-types test file passes4/4; unchanged D449/D450 types/build/lint are retained rather than replayed. New full kernel/build/type/lint campaigns are NOT_RUN. The six-hole ideal-position comparison numerically FAILS a1e-9 ideal criterion (diagnostic only); D451 does not certify that stronger ideal-circle accuracy or change the existing rounding representation. No general precision approval follows.

#536 remains OPEN for its broader operation family. Next C2 category audits ordinary Subtract/Intersect operand order and editable dependency/refusal/project behavior; it does not start kernel widening. Current status remains in the roadmap, and qualification.json holds commands and exact numeric boundaries.
