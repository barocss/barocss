---
work_id: D439
artifact_type: step-quoted-section-tokens
status: bounded-qualified
owner_role: executor
last_updated: 2026-11-02
---

# Preserve quoted STEP section tokens and comment markers

D439 corrects a bounded STEP lexical defect in rows 13/12 at baseline 2c14361ebeb8830eca9ecf164aba7a475a1acecb. A supported face name can now contain `DATA;`, `ENDSEC;`, literal `/*x*/` and doubled quotes without being refused or changed. Overall progress remains about 43%; general exchange/file acceptance stays open. [qualification.json](qualification.json) records numbers, commands, hashes and proof limits.

## Defect and correction

Eight original files were generated from a retained ordinary near-origin 30×12×6 planar solid. Before correction, `ENDSEC;`, `DATA;` and a combined label were refused by both importStep and stepValidationProperties. A literal `/*x*/` face name disappeared on an otherwise strict-valid import. Ordinary, doubled-quote and two real-comment controls passed. Original files/errors are retained in /tmp; three refusals and one corruption remain recorded.

The old extractor first removed comments globally, including inside strings, and then selected DATA/ENDSEC with an unquoted regular expression. The new private lexical helper preserves strings/doubled quotes, replaces only real comments with whitespace and selects complete unquoted section statements. It reads the first DATA section. The existing value/entity parser through EOF is byte-identical; geometry, supported entities, tolerances, limits, fitter, public API and schema do not change. This is not a general Part21 grammar certification or product/body-name preservation feature.

## Checks and original failure

Validation tier is small. GPT-6.1 Sol Medium implemented the correction and focused checks. An independent stdlib token/statement reader with no kernel code reads all eight exact original files and confirms their expected literal face strings.

PASS: CAD build, 18 current unique affected tests (five new and 13 existing), independent raw-string reads of eight files, test/driver syntax, three-file and driver lint, code-shape, and final Model type check after the last test/driver edit. New cases cover native and tessellated reader paths, quoted tokens/comments, doubled quotes, genuine comments, first-DATA selection and typed malformed-input refusals. The no-token-joining control uses `DA/* separator */TA;`, so no downstream unknown-entity grammar is added.

Preserve the first candidate 17 PASS / 1 FAIL. D436 changed the unsupported-offset fixture from SPHERICAL to CONICAL but left this older integrated test expecting the SPHERICAL refusal. Source/history prove that stale expectation; no baseline SUT replay is claimed. Only its predicate changes to the same CAPABILITY code and exact existing CONICAL reason. The failed test is rerun; 17 unchanged passes are reused. No production code or numerical budget changes after that failure. The full kernel suite is NOT_RUN because no B-rep core changed. D433 remains the latest full run, and this item does not explain the older D423 fuzz failure.

## Actual Studio and separate raw read

One public Open of the retained combined-label file, STEP prepare/preview and Cancel passes. The 6728-byte input SHA is e41842c74a340ec3ef190e959232ffcc6d1019ca18aa79952828c06bdba64947. Accepted native data contains exactly `n0.DATA; /* literal */ O'Brien ENDSEC;`. Real worker request/reply 5, source f04db87ae85ccf90, produces 6840 bytes, SHA a57a7501cc294c229a7b0009836d95239b006e6a13585a1dd3b99188d4145a90. The literal escaped face name, planar bbox, V/A/C and mm remain; no additional loss is reported.

A separate stdlib read of both exact files confirms the literal face strings and source-derived n0 alias, AP214, one solid/six faces/12 edges/eight vertices, no dangling graph reference and V/A/C/bbox representation presence. This is string/graph evidence; it does not repeat geometry evaluation, mass accuracy, arbitrary grammar validation or output reimport.

Cancel retains the exact document, native arrays/IDs, seven fields, accepted source and public camera/matrix bytes. Root rehashes 1056 frozen/after/cleanup entries; all 750 fixed inputs also match. Seventy passive module bodies are recorded. Errors/console/watched changes/downloads are zero. Context/browser/server close; own wrapper PID 30693 is absent and the gate is free. Root views three PNGs as UI-presence evidence, not new raster/physical acceptance.

The first actual preflight is NOT_RUN: a foreign g1b job held the gate, so no lease/browser started. That attempt remains preserved. After the foreign job ended, the unchanged command ran once in a new wrapper. No foreign process was touched. No download, OCP, paid call, Save, output reopen, new physical target, develop integration or release occurs.

Issue [#2263](https://github.com/barocss/barocss/issues/2263) remains OPEN. Assembly trees, AP242 presentation/PMI/sheets, product/body names and remaining offsets/topology still need their own acceptance. Deferred owner menu/view-icon/alert discussion remains in [row 15](../../roadmap-rows/15.md).
