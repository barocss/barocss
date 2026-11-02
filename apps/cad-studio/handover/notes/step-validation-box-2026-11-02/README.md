---
work_id: D438
artifact_type: step-validation-box
status: bounded-qualified
owner_role: executor
last_updated: 2026-11-02
---

# STEP validation box — omit unsupported declarations

D438 fixes a reproduced non-enclosure defect in rows 13/16 at baseline 3895c7bd55726513c187250e8ff04c58b40efbaf. A STEP validation box made from trimmed-mesh samples could exclude an actual point of its native face. The writer now omits that box and Studio reports its absence in the existing loss list. Legacy numerical bounds, geometry, units, uncertainty and volume/area/centroid declarations retain their old arithmetic. Overall progress remains about 43%; neither row closes. [qualification.json](qualification.json) contains the numbers, commands, hashes and evidence boundaries.

## Physical witness and selected scope

The unchanged D436 ordinary R5 native input SHA is 079b3fba…; D437 STEP SHA is f0fba92b…. Its mm box has minY=-4.994061996270625. All four native coedges lack pcurves, so a chart midpoint alone cannot establish membership of the trimmed face. The independent exact certificate uses the unique z=0 section, two boundary crossing bands near u=0.0003331/0.9996669, original edge tolerance 1e-7 mm, and actual coedge/face orientation. Under continuous original-T boundary attachment semantics, winding1 admits q(0.5,0.5) near [0,-5,0]. Native and raw-decimal candidates lie outside the box by about 0.005938003729375 mm. Matching squared error is at most 1.115e-23 versus T²=1e-14; parameter clearance exceeds 0.4996668. Author challenge accepts this selected proof. This is not a universal trim/pcurve theorem. File uncertainty 1e-6 mm is separate from native tolerance and is not an invented bbox error reserve.

Only the actual `rest.size>0` trimmed-mesh branch makes the private STEP bbox unavailable, even when its samples do not grow the estimate. `brepBounds` retains the exact old numeric body. A private leaf companion carries writer eligibility; any contributing unqualified solid suppresses the global bbox. No conservative hull is represented as a tight box. Other numerical extrema paths retain their prior scope; this record does not certify arbitrary boxes.

Model checks the fixed writer's complete standalone bbox representation record. Writer `text()` escapes quotes and replaces all label newlines, so a user name cannot forge that record. A proposed generic self-parse was rejected before execution: the existing DATA parser can truncate a valid quoted `ENDSEC;` name. No generic parser or public API is changed. Dedicated section-token and fake-record name controls pass.

## Validation and original failures

Validation tier is small: bounded omission/bookkeeping, no new public API, geometry algorithm or tolerance. Sol Medium implemented and ran focused checks; Sol High reviewed the physical proof, numerical-body preservation and writer/report policy. Independent static audit recovers the exact old numerical source and confirms the byte change. Optional scratch mutations and the full kernel suite are NOT_RUN. D433 remains the latest full-kernel checkpoint; later bounded passes do not explain the historical D423 fuzz failure.

- PASS: stable CAD build; CAD 8 unique and Model 9 unique tests; owned six-file and driver lint; code-shape; driver syntax; final Model type check after the last test/driver edit.
- PASS: six historical D421 complete-file hashes and source keys unchanged. OrdinaryR5 full bytes are exactly the old file minus final bbox entities 135–139, SHA 816838f297b4ea1f982d0b9183a57f373c87c7181ad20140dac146d6237c4e3a. All earlier header/entities/geometry/units/uncertainty/V/A/C bytes stay exact.
- Retained FAIL 01: first CAD batch 7 PASS / 1 FAIL. D151 wheel used the same trimmed-mesh branch and its old test dereferenced the intentionally absent box. The original “D151 unchanged” objective was not met. Explicit High-reviewed contract adjustment preserves the 724-face fixture, export<12000ms, original q4 containment and six fixed extrema at 1e-9 against legacy `brepBounds`, while asserting exported bbox absence. The entire bicubic test is byte-identical. No production code or numerical target changed after this failure; only the failed wheel case was rerun.
- Retained FAIL 02: Model 8 PASS / 1 FAIL. The new newline-name test omitted the existing name-sanitization loss from its expected list. Its exact per-case list now retains that existing loss plus bbox loss. Only the failed hostile-name case was rerun; the eight unchanged passes were reused.

Independent source-audit preparation assertion errors are retained separately as metadata/oracle preparation history; they are not product or numerical failures. No original failure was deleted or converted into a broader PASS.

## Actual Studio and remaining boundary

One ordinary offset STEP Open → public STEP prepare/preview → Cancel passes. The real request/reply 5 has source 4fcb40ead35449b3 and produces 11575 B, SHA a24139187b24a1aef7fb6bf7b23ad86ca36606e4af78e4c15f9d09c38655e265. Worker omissions and visible dock text both contain exactly “Bounding-box validation is not included in this STEP file.” The panel shows no bbox numbers; declaration values require the separate raw-data audit.

Cancel preserves the exact document, native arrays/IDs, seven quantities, accepted source, public camera and F64/F32 camera bytes. Root rehashed 1044 frozen/after/cleanup entries; 741 fixed inputs also match. Errors/console/watched changes/downloads are 0; context/browser/server close and own wrapper 75850 is absent. Root viewed the original and preview PNGs. There are exactly two screenshots; Cancel is proved by strict state JSON equality. No output reopen, Save, download, new physical accuracy run, OCP, paid call, develop integration or release occurs.

Independent Part21 metadata audit passes on these exact actual bytes: millimetres, uncertainty 1e-6 mm, same shape/context, volume/area mm³/mm² units, finite centroid, and complete absence of bbox or orphan extrema records. The two decoded surfaces and two curves have zero numeric-field differences versus retained qualified R5 under explicit source-prefix aliases. This is decoded metadata equality, not a new physical accuracy theorem. The audit verifies 1126 input pins and 70 captured runtime module bodies; the Node-side flow helper is not expected as a browser response. Issue[#2263](https://github.com/barocss/barocss/issues/2263) remains OPEN: assembly instances, AP242 presentation/PMI/sheets and remaining offset/topology profiles are unmet. The intentional R5 five-record correction is not a claim that every historical export remains byte-identical. Named-frame/fitter/NURBS and manufacturing/Physics HOLDs remain. Deferred owner workspace/menu/view-icon/alert discussion stays in [row 15](../../roadmap-rows/15.md); this change does not redesign that UI.

Follow-up: the existing generic reader’s quoted section-token/comment handling requires its own bounded reproduction. It is not silently fixed here. Navigation passes for 34 rows and 2457 local links with no new broken link; the one pre-existing missing archived evidence path remains.
