# D689 — Disclose omitted assembly parts in STL export

P2 B07, rows 10 and 13. Parent `3cd329cc9db8dee51f8abf62bdcf17a0c8882375`. SMALL repair to the existing STL export dialog and notice. The export and source record formats stay the same.

## Actual desktop Studio

**FAIL before repair.** Open the existing base-plate assembly in Chrome WebGPU at 1440 × 900. The Cube is visible and its Instance panel reports one body. Automatic writes one STL for the root plate and one provenance JSON. The STL dialog and completion notice omit the fact that the placed Cube is absent from the file. The independent reader finds 12 triangles, plate bounds `[-20,-20,-4]` to `[140,40,0]` mm and volume 38,400 mm³. The Cube extends above Z=0 and is absent from those bytes.

**PASS after repair.** Automatic reports the omitted visible placed parts before and after export. Both messages distinguish millimetre coordinates from the unit setting that STL omits. They state the loss of colours, body names and editable CAD data. The exported STL and source record both equal their baseline bytes. The STL SHA-256 is `73be31de78fb91c064af7eb8d1e150074360dfb40a5d2a66d40f392411cae841`.

Fine shows its visible-placement restriction before Export and refuses the same assembly without a new STL or source record. Use Hide on the Cube. Fine now writes the same 12-triangle plate with no visible-part omission notice. The source revision changes from `8ca9218d814feeca` to `62feee63ee15acd1` after Hide. Each export retains the exact accepted document. The independent Python reader checks the original Blob bytes, the triangle records and the companion file list.

## B07 exchange cases

Freeze the supported ordinary part and static-assembly cases below. Earlier results apply to their recorded inputs and tested consumers. The independent measurements use file geometry at the precision of the selected fixture. Fresh Studio Open is a separate product check.

| Case | Expected file and user-visible boundary | Evidence and outstanding checks |
| --- | --- | --- |
| STEP part | AP214 B-rep in mm. Preserve nominal dimensions; disclose the loss of native history, parameters, semantic PMI and named datums. | [D404](../exchange-profile-2026-11-01/README.md) independently reads the 80 × 50 × 10 mm box. [D531](../public-step-loss-report-2026-11-05/README.md) binds the public report and exact box bytes to retained independent native readback. Current Studio Export and fresh Open of that standalone fixture are **NOT_RUN**. |
| STEP static assembly | Two solids in the selected Tall profile. Preserve world placements in mm; disclose flattening and loss of names and appearance. | **PASS** on the exact [D683](../step-variant-roundtrip-2026-11-11/README.md) export and fresh Open. Independent Part 21 checks verify all 16 corners at 1e-6 mm and the file's units and structure. Its actual loss list and Open notice cover the selected fixture. [D677](../step-preview-late-reply-2026-11-11/README.md) verifies late-reply isolation in two delivery orders. |
| STL part | Binary triangle mesh with mm coordinates and no stored unit, labels, colours or CAD history. Use the explicit unit choice on Open. The source JSON identifies the revision and files. | **PASS** for the [D679](../stl-variant-source-2026-11-11/README.md) 30 × 12 × 9 mm mesh and provenance, and [D680](../stl-variant-roundtrip-2026-11-11/README.md) fresh mm/cm Open and Cancel. [D681](../stl-float32-collapse-2026-11-11/README.md) and [D682](../stl-late-reply-2026-11-11/README.md) cover Float32 refusal and late replies. A genuine kernel-unavailable family remains **NOT_RUN** for [#2425](https://github.com/barocss/barocss/issues/2425). |
| STL static assembly | Automatic writes root bodies only and discloses visible placed parts omitted. Fine refuses visible placed parts. | **PASS** for D689's plate and placed Cube at the actual export boundary. The independent reader sees just the plate. [D680](../stl-variant-roundtrip-2026-11-11/README.md) establishes the selected STL unit import contract on its own part bytes. Fresh Open of D689's exact plate is **NOT_RUN**. |
| 3MF part | Build mesh in mm with its appearance. State loss of editable CAD data. | The existing [writer test](../../../../../packages/barocss-cad-model/test/threemf.test.ts) verifies one box archive through the Model writer. Actual standalone Studio export and a slicer check are **NOT_RUN**. Studio has no supported 3MF Open. |
| 3MF static assembly | Placed mesh objects in mm, names, materials and colours. State loss of editable CAD data, assembly hierarchy, mates and variant definitions. Refuse stale placement. | **PASS** for [D523](../three-mf-current-assembly-2026-11-05/README.md) and [D688](../three-mf-shown-variant-2026-11-11/README.md) geometry, appearance and currentness within their fixtures. **FAIL** for explicit editable/assembly loss disclosure. The retained D688 Tall archive has two mesh objects, two build items, one material table and only title, application and source revision metadata. Its actual notice describes mesh, units and appearance but leaves the editable and assembly omissions implicit. |

B07 remains open. Next D690 addresses the measured 3MF loss disclosure on the shown assembly. Whole-format and external slicer acceptance remain open. [#539](https://github.com/barocss/barocss/issues/539) and [#2425](https://github.com/barocss/barocss/issues/2425) stay open.

## Verification

Node 22.19.0. Use the existing `PW_DIR` and `CHROME`. Run one heavy job at a time through `gate.sh acquire heavy 180 <label>`.

- From Studio run `D689_SOURCE_FROZEN=1 node test/stl-assembly-loss-browser.mjs "$EVIDENCE"`. Original **FAIL** receipt SHA-256 `e524d3c5b0f658335787e48bc29d9365562c54db5a2f9af1c28041c15ac4045f`. Final **PASS** receipt SHA-256 `f16d05846ba4a295565955497230b73525fa20269ee9ce974f36657213a2ed40`. Reviewed the original completion screenshot and all four final screenshots. All 324 frozen paths matched through cleanup. Zero browser downloads, page errors, console errors and source changes.
- **PASS.** `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test three-mf-export-ownership step-export-preparation step-metadata mesh-import-ownership` passed 44/44. `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test stl-export-quality o9-source` passed 6/6. Driver syntax, scoped ESLint, Studio and final Model type checks, and Git whitespace passed.
- **NOT_RUN.** Whole suites, browser-managed download, mobile, external slicer and whole B07 acceptance.
