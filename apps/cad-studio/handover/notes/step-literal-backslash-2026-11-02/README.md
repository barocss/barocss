---
work_id: D441
artifact_type: step-literal-backslash
status: bounded-qualified
owner_role: executor
last_updated: 2026-11-02
---

# Preserve ASCII literal backslashes in STEP names

D441 fixes a reproduced literal face-name corruption in rows 13/12 at baseline 276d946facbd6621ee052d448a9f5fa70ae8e71e. Printable ASCII names from the existing writer now decode a literal backslash pair once and remain stable through repeated roundtrips. Overall progress remains about 43%; general exchange acceptance stays open. [qualification.json](qualification.json) contains exact commands, hashes, numbers and scope.

## Defect and bounded correction

Five locally written files use the retained ordinary near-origin 30×12×6 planar native solid. All first-export header/product/face raw tokens match predeclared bytes. All imports are strict-valid, but four decoded face names contain twice their original U+005C count: 1→2, 2→4, 1→2 and 4→8. Plain control is exact. Original files, code units and four corruptions remain retained.

The existing writer doubles backslashes. The reader handled doubled quotes but retained literal backslash pairs. The new private helper runs after unchanged quote decoding. It decodes once only when the completed value is printable ASCII and every backslash run is even. Any odd run, non-ASCII or control character returns the whole previous value unchanged, with no partial/recursive decoding. Thus opaque/mixed directives stay opaque. D439 section/comment extraction, numeric/entity geometry paths, refusals, limits, public API, schema and writer are unchanged.

The public [Part21 text](https://www.steptools.com/stds/step/IS_final_p21e3.html), clause 6.4.3.1, defines pair encoding for a literal reverse solidus. Clauses 6.4.3.2–3 separately define directives. A naive global pair-replacement draft was rejected before execution because adjacent opaque directive boundaries can also contain neighboring backslashes. That draft is NOT_EXECUTED. This item adds no Unicode/directive interpretation or full-standard certification. Header/product raw writer bytes are checked separately; importStep does not expose that metadata for readback.

## Validation

Tier is small; GPT-6.1 Sol Medium implements and runs the focused checks. No B-rep core or numerical policy changes.

- PASS: CAD build/types, CAD 11/11 (new3, quoted5, validation3), Model 6/6, scoped source/test and driver lint, code-shape, final Model types after the last test/driver edit.
- PASS: five retained-native whole first-export files are byte-identical; all six D421 historical whole-file hashes and source keys remain unchanged. No golden is regenerated. Import followed by export now uses the corrected literal value; old name corruption is not preserved as a compatibility promise.
- PASS: each of five literal labels remains exact across three writer/import cycles, with unchanged vertex geometry/counts and V/A/C/bbox properties. Shared mesh names also decode once. Adjacent directives, mixed odd escapes, non-ASCII and control-containing old opaque values stay whole. Opaque compatibility tests are not Unicode or valid-standard admission claims.
- PASS: an independent stdlib tokenizer verifies the exact five raw quoted producer tokens against predeclared constants. It does not implement a new backslash/directive decoder or evaluate geometry.
- Retained FAIL: four pre-fix decoded names have doubled backslashes, despite valid geometry and correct writer bytes. No candidate failure is hidden. The naive/preparation drafts never execute.

## Actual Studio and separate raw tokens

One unchanged case04 Open, early matched STEP read, public Escape/F, STEP Preview and Cancel pass. The actual read is request3/revision2. The worker’s native face value is exactly `n0.O'Brien` followed by one U+005C and `DATA; /*x*/ ENDSEC;`. The source file is 6665 bytes, SHA 2280de90a91e9dbcd769ba100e83b53877adf9c326ae67ce2948ed05ff7a50d2.

Real writer request/reply5, source47a11e55930e7f8a, produces 6833 bytes, SHA ce32f860a29ed1c1a62763a0cc691a9a1ad828779d3dc86c98bde95f76d674aa. A separate independent raw-token read confirms exactly two encoded backslashes in the first face token of both original and prepared files, with the source-derived n0 prefix only in the prepared name. Both AP214 graphs have one solid/six faces/12 edges/eight vertices, no dangling reference and V/A/C/bbox representations. The public decoded native value has exactly one literal backslash. This is raw syntax plus an independent expected literal; no duplicate product decoder is used.

The real panel and worker report no additional losses for this selected ASCII profile. Cancel retains the exact document, native arrays/IDs, seven property/basis fields, source and camera F64/F32 matrix bytes. Existing stepMeshes preference persistence is separate. Root rehashes 1057 frozen/after/cleanup entries; all 786 fixed inputs match. Errors/console/watched changes/downloads are zero; context/browser/server close and own wrapper93053 is absent. Root views all three original/preview/cancel PNGs and identifies the rectangular profile. The name proof comes from captured worker values, not words in the screenshot.

The first raw-audit resource preflight is NOT_RUN at load75.15, before lease acquisition or raw parsing. The same script runs in a new owned directory after idle/load admission and passes. No source/acceptance bound changes between attempts.

Full kernel, fresh physical oracle, Unicode/directive interpretation, output reopen, header/product metadata transfer, download/OCP/SDK/paid call, develop integration and release are NOT_RUN. Issue [#2263](https://github.com/barocss/barocss/issues/2263) stays OPEN: broad assembly, AP242 presentation/PMI/product metadata and remaining offset/topology goals are unmet. D440’s historical denominator cause remains unresolved; this text correction makes no causal claim about it.
