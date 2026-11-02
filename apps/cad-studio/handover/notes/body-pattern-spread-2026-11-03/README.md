---
work_id: D453
artifact_type: ordinary-body-pattern-spread
status: qualified
owner_role: executor
source_request: "Continue the core CAD roadmap autonomously, one bounded category at a time"
last_updated: 2026-11-03
---

# C2-5 ordinary body patterns and retained circular spread

New Z-axis circular body patterns retain their authored spread through Count edits and Model Save/Open. Two ordinary body-pattern workflows pass all eight declared links each. A separate full-circle create/edit control passes. Baseline is `b2bd3d9dd956f83a2d55b8fa130f5b1220a1e0ca`. Exact commands, hashes, numbers and exclusions are in [qualification.json](qualification.json).

## First actual failure and correction

Public Studio creation at pivot [-100,0,0], Count 4, Spread over 270 degrees and Result one stores step 90. Editing Count to 2 previously committed step 180, losing the authored partial span; the existing endpoint-inclusive rule requires step 270. Root captured the public HUD, accepted nodes and wrong result before the assertion failed. The immutable receipt is `ceefe1c27670a4bd0bd7d4a21b039d2ef6e290a966f4fd7d717bf5a4be1b974d`; command `bash /tmp/barocss-d453-root/run-repro.sh`. This is a product failure, separate from D452's external-helper failure. Its 1185 frozen/current paths match; all owned runtime resources and gate lease were cleaned up. Physical qualification was NOT_RUN in that minimal reproduction.

Full 360 degrees and partial 270 degrees at Count 4 both had step 90 and Count 4. Old data cannot reveal which was authored. New Z-axis, Result-one Model nodes therefore store optional `span`, while retaining the native `angle` step. Full spans use 360/count; partial spans use span/(count-1). Creation geometry and its existing six-decimal step rounding stay unchanged. Values at or above 360 retain the old full-circle behavior; finite signed partial spans receive no new positive/range restriction.

The Count editor uses explicit metadata when present. Count 1 retains the metadata and the existing finite step 360; increasing Count restores the intended distribution. Partial Count 1 creation keeps its old invalid division/refusal and is not newly admitted. Metadata-absent legacy nodes keep exact old Count arithmetic and serialization; no intent is inferred. X/Y quarter turns and separate-copy construction are unchanged.

New metadata must be finite, on axis Z and coherent with count/angle. Existing native count admission still handles invalid counts. Model read and direct compile reject contradictory metadata, including nested/suppressed source nodes. The existing whole-feature API checker now accepts optional `span` and the already supported Model `pivot`; coherent replacement retains intent and identity, while stale combinations retain accepted state. Explicit replacement without `span` supplies a legacy recipe. No new public tool, Model schema version, CAD schema, kernel geometry rule, dependency or tolerance is introduced.

## Declared workflows and independent geometry

Both branches Open D447's exact two-node locked plate: [-20,-20,0] to [60,20,10], volume 32000. This reuses the accepted input; it is not another sketch-authoring claim. Public body-row selection and HUD Apply create one Model output n2/b2. Nonoverlapping copies remain multiple closed native solid components inside that one output; Result one does not weld gaps.

| Branch | Initial and edited placement | Independent native expectations |
| --- | --- | --- |
| Linear X | spacing 100; Count 2 to 3 | V = count × 3200 × height; C = [20+50(count-1),0,height/2]; max X = 60+100(count-1) |
| Partial circular Z | pivot [-100,0,0], span 270; Count 4 to 2 | At height 10: V128000 to 64000; C[-100,0,5] to [-40,-60,5]; bounds [-260,-160,0]..[60,160,10] to [-120,-160,0]..[60,20,10] |
| Full-circle control | span 360; Count 4 to 2 | At Count 2/height 10: V64000, C[-100,0,5], bounds [-260,-20,0]..[60,20,10]; create/edit only |

Each main branch then edits original Extrude Distance 10 to 12, performs exact Undo/Redo, refuses pattern Spacing 0 or Count 0 through the existing editor, and retains exact accepted document, accessible history labels and native geometry. Each branch has its own project Save, Close, same-context reload, Open and post-Open Count re-edit (Linear to 2; partial circular to 4). Height 12 and all source locks/IDs/references remain exact. Public F frames the accepted results.

Independent Python uses integer quarter-turn transforms and native B-rep connectivity, corners, support planes, volume, centroid and bounds. Each component is strict valid, closed and genus zero; matching does not assume native array order or names. Targets remain 1e-9 relative volume and 1e-9 mm absolute centroid/bounds/corners/planes. Maximum executed relative volume error is 6.316e-16 and centroid error 5.685e-14 mm; bounds/corner/plane/normal errors are zero. A negative control with correct volume/count but the wrong full-circle positions fails specifically at centroid, so volume alone cannot qualify the fix. Display geometry only maps real native output/face IDs to Studio rows.

## Verification and limits

PASS: 43 retained existing test groups plus 9 final focused groups, 52 unique groups; lint for nine changed files; Studio types and final Model types after the last test edit. The official Model test runner bundles live TypeScript; this package has no separate build script. Eight native/eight positive independent preflight checks and one expected physical-refusal control pass. Actual Studio passes 8/8 links for each branch plus the two-link full-circle control: 33 screenshots, 21 native and 21 independent reads. Root viewed nine final images and two original-failure images. All 2347 actual source capsules match before/frozen/after/cleanup/current. Both own project namespaces were removed; context, browser and server closed; owned wrapper PID absent and gate released. Zero downloads and page/console errors.

FAIL records remain immutable: the original product reproduction; checks01 (50 PASS/2 FAIL) had invalid schema4 test antecedents; checks02 (8 PASS/1 FAIL) corrupted nonfinite values before constructing the valid schema4 antecedent. Only the test fixture and setup order changed. Checks03 passes 9/9 and all previously unrun lint/type stages; the 43 existing groups were not repeated. Schema4 uses the existing canonical one-route-bundle fixture solely as a codec antecedent, with no manufacturing acceptance claim.

NOT_RUN: full kernel (no B-rep core change; D433 remains authority), ideal noncardinal placement, general/separate/feature patterns, actual X/Y circular workflows and older-app metadata editing. Existing six-decimal step rounding is retained, not promoted to ideal-circle accuracy. Some left copies are partly behind the existing palette in Fit views; no UI layout/pixel-quality certification is claimed. UI redesign and all prior HOLDs remain deferred. Issues #534, #2011 and #2016 were checked: the broad epic stays open; the already closed older Editor contracts are unchanged.

Routine implementation, tests and driver work used GPT-6.1 Sol Medium. Difficult geometry and independent review used GPT-6.1 Sol High. Root owned execution, source freeze, cleanup and visible review. Core CAD readiness remains NOT_MEASURED; legacy 43% stays frozen. Next work follows C3's ordinary part-drawing/model-update workflow after inventorying retained proof, not a general C2 completion claim.
