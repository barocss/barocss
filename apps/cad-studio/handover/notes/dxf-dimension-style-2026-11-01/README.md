---
work_id: D414
artifact_type: qualification
status: done
owner_role: executor
source_request: Registered D396/D397 DXF-header follow-up
last_updated: 2026-11-01
---

# D414 — Explicit DXF dimension-style defaults

Bounded-qualified, full tier for additive public fields. GPT-6.1 Sol Medium implementation and independent design/source/mutation review. [Commands/counts](qualification.json).

## Reproduction and contract

The existing cached ezdxf reader loaded 18 current-source files (plain/ISO/ASME × mm/inch/dual × AutoCAD 2000/R12), 36 dimensions, with zero audit errors or fixes. Six ASME files kept DIMSTYLE text height 3.5 while their anonymous display blocks already used 3 mm. This is a default-style mismatch for editing/regeneration; the current displayed text was not wrong.

`DxfDocument.dimensionStyle` is optional. When supplied, all three fields are required: finite positive `textHeight` in drawing units, `textPlacement` above/center and `textOrientation` aligned/horizontal. Invalid input uses the existing typed BAD_ENTITY refusal. Both writers map height/placement/orientation to groups 140/77/73/74. These mappings and orientation flags follow [Autodesk DIMSTYLE](https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-DXF/files/GUID-F2FAD36F-0CE3-4943-9DAD-A9BCD2AE81DA.htm) and [text controls](https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-38DAEEF0-AB44-4C58-8D0E-955BFCFF71A7.htm). Flags do not guarantee an external reader's regenerated layout.

`Sheet.standard` carries the existing source preset as transient metadata. Only ASME adds custom defaults: 3 paper mm, center, horizontal (3/0/1/1). Plain/ISO/default calls retain previous bytes and omit the new orientation flags. No anonymous display blocks, labels, entities, reports, geometry, tolerance arithmetic or dimension-entity formatting change. Inch/dual labels remain explicit overrides; sheet coordinates stay mm. Editable unit/precision regeneration remains open.

## PASS

- 22 unique focused tests: kernel 4 new + 11 existing writer; model 3 new + 3 existing DXF + 1 golden. Fresh kernel build, Kernel/Model types after final test edit, Studio consumer types, scoped lint/JS syntax/Python AST/diff.
- Intentional golden update changes only `asme.dxf` and `coarse-asme.dxf`; 16 entries, including every SVG and resolved-dimension result, stay unchanged. The subsequent normal golden check passes.
- Fresh independent reader: 18 files/36 dimensions, zero style mismatches/audit errors/fixes. Twelve plain/ISO files are byte-identical to the actual pre-change producer; six ASME files change only the four DIMSTYLE fields.
- Two independent review rounds accept the explicit contract and final source. Mutation baseline 7/7; all 14 targeted mutants killed by assertions, zero survivors/crash/unmatched kills.
- API inventory: zero names added/removed; two intentional optional shape changes. One unrelated compiler union-order representation changes for ConstraintKind, with the same nine literals and unchanged source. Exact delta reviewed. Docs: 68 pages, 55 shots, 939 labels.
- Actual run01: ASME/ISO settings, exact Undo/Redo, inch and dual display, geometry unchanged. Six exact accepted document snapshots pass through the frozen Model producer and independent reader: 12 DXFs/24 dimensions; labels match the actual DOM. 751 frozen files unchanged, zero page/console errors/source changes/downloads; all owned resources closed and gate released. Root reviewed both overview images.

## FAIL / NOT_RUN

The six pre-fix metadata mismatches are retained. No unexpected product, harness or actual-run failures occurred. No planned golden update is presented as an earlier failed test.

Actual Export DXF/download/Save, an external CAD's regeneration/roundtrip, editable inch/dual/precision regeneration, short-arrow clearance, broad ASME/R12 certification, full baseline suites, CI and release are NOT_RUN. No B-rep core changes require a full kernel suite. Existing fontless generic glyph words remain the U3 limit.

No dependencies were installed or downloaded. The existing Python3.12.9/ezdxf1.4.5 cache was used with `-I -B` and bytecode disabled; it is preserved. OCP/source/native build remain absent. Raw files, logs, readers' results and screenshots stay in `/tmp/barocss-d414-{baseline,final,audit,browser-run01,capsule}`; none is committed.

#540 stays an incomplete backlog epic. A bounded DXF-title search found no dedicated closable issue. Next D415 is U3 Lucide 1.52.0: the owner has explicitly approved its download/install; that approval is still unused. Production/motion/external-SDK holds remain.
