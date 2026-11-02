---
work_id: D454
artifact_type: drawing-parameter-revision
status: qualified
owner_role: executor
source_request: "Continue the core CAD roadmap autonomously, one bounded category at a time"
last_updated: 2026-11-03
---

# C3-1 parameter-driven drawing revision

Studio now marks a parameterized part drawing out of date when a parameter changes its model. One retained plate workflow qualifies eight action groups through revision update and project Open/re-edit. Baseline is `4abf963812ad20f027f0a3170b464dcddcd80221`. Commands, hashes, first failures and limits are in [qualification.json](qualification.json).

## Reproduced defect and bounded fix

The existing D356 fixture is a W60 by 40 by 10 plate. Public Drawing Auto-dimension creates three linked dimensions; Next revision stamps A. Editing W60 to W70 changes the same resolved width dimension d2 from 60 to 70, while the two source nodes remain exact. The printed SRC changes from ab9d8eeedc2168b0 to c4c74a53d3c6d0f1. Yet revision A's old marker ec3ed842 remains and the expected out-of-date warning is absent (0 instead of 1). The original product FAIL receipt is `bcf81f6d69f092b79b36e3d2e2f35e9505f2024fad0267766b4cb28b4f2712bd`.

SheetSettings used only modelPrint(doc.nodes). A private Studio helper now includes {nodes,parameters} when parameters exist. Empty parameters still use the exact legacy node-only fingerprint. Drawing settings, revision letters and dimension reference caches are not inputs, so stamping a new issue does not immediately invalidate itself. The public Model helper, file schema, geometry and printed SRC provider are unchanged. SRC already uses the separate parameter-sensitive revisionOf path; the two marker algorithms are not equated and neither hash proves geometric correctness.

Old node-only markers on parameterized files cannot establish the parameter values at the old issue. They remain outdated until the user stamps again; no saved issue is automatically restamped. Existing JSON dictionary ordering remains unchanged, with no semantic key-order equivalence claim.

## Actual Studio acceptance

The eight groups are: public Auto-dimension/revision A; W60 to W70 with the same dimension IDs and warning; authored Undo to W60 and no warning; Redo to W70 and warning; Next revision B clears it without changing model inputs; empty numeric parameter input refuses with exact accepted document/history; own project Save, Close, same-context reload and Open retains B/W70; post-Open W80 updates the same dimension and warns against B. Depth 40 and height 10 remain constant. UI volume observations are 24000, 28000 and 32000, not an independent physical qualification.

Parameter commits legitimately enrich the six dimension a/b reference signatures. The driver validates their exact current-width line signatures, then compares every other authored reference, ID, placement, setting and top-level field. It does not remove unknown metadata or claim raw byte equality across cache enrichment. Readonly current DOM SVG and resolved dimension values are captured before retention assertions. All three dimensions stay resolved and keep d1/d2/d3 identities.

The initial repro run failed an overstrict whole-drawing assertion before reaching the candidate warning. Repro02 permitted only the observed cache enrichment and reproduced the product defect. The first fixed workflow had the same premature equality mistake at one early helper call; its passing Auto/revision A group is retained. The corrected continuation publicly Opens that exact actual accepted A file, then runs only the seven remaining groups and necessary antecedents. Original receipts stay immutable. No new product/test change was needed for the driver correction.

## Verification and exclusions

PASS: five new behavioral groups and two existing drawing round-trip groups, 7/7 with zero FAIL/SKIP; lint for three changed files; Studio types and final Model types after the last test edit. The fixed Studio continuation has 15 screenshots and seven passing remaining groups, plus the retained A-creation group. Root viewed six final and two original images. All 2374/2393 post-fix source capsules match at cleanup/current; the own project namespace is absent, runtime closed, wrapper PIDs absent and gate leases released. All runs have zero downloads and page/console errors.

FAIL: the original product warning omission and the two external-driver equality failures remain recorded. NOT_RUN: independent audit (small tier), full kernel (no B-rep change), native physical accuracy, section/detail breadth, standards and export/download acceptance. DOM SVG is a preview, not an exported-file proof. The existing SRC provider and Model public APIs remain unchanged; no new dependency, schema, manufacturing or UI-redesign scope starts.

Routine implementation, tests and driver work used GPT-6.1 Sol Medium; root owned execution, source freeze, cleanup and visible review. Core readiness remains NOT_MEASURED and legacy 43% stays frozen. #540 remains open; #2057 is an already closed design target, not runtime proof. Next is a bounded ordinary section/detail/model-update inventory within C3, preserving all existing HOLDs.
