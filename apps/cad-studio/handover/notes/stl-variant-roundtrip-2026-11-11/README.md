# D680 — Reopen the STL generated from an unsaved variant

P2 B07, rows 13 and 16. This run uses the exact [D679](../stl-variant-source-2026-11-11/README.md) 9 mm STL. The driver pins the original receipt, oracle input, STL and companion source record hashes before launching Studio. The retained STL SHA-256 is `34bc8e0a7055567b8e793475a08ba62055494c9bc4458919b0056ea58b49fad1`.

## Actual Studio result

**PASS.** Chrome WebGPU at 1440 × 900 opened the original native Master and showed an unsaved 8 mm height. The unit dialog said the STL carries no unit. It previewed 30 × 12 × 9 mm in millimetres and 300 × 120 × 90 mm in centimetres. Cancel kept the exact prior document, its visible 8 mm draft and volume, file name, selection, dirty flag and Undo/Redo state.

The same original bytes were then opened twice through the public file chooser.

| Unit selected | Displayed dimensions | Volume | Centroid |
| --- | --- | --- | --- |
| mm | 30 × 12 × 9 mm | 3240 mm³ | [15, 6, 4.5] mm |
| cm | 300 × 120 × 90 mm | 3240000 mm³ | [150, 60, 45] mm |

Both accepted documents contain one faceted mesh named after the incoming file, with the selected unit. Studio reports 12 triangles, one mesh solid and six regions. Neither unit required a repair. Both reads lose the original native sketch/extrude history, parameter, variant, body label and colour. The companion record was used to establish evidence custody. The importer received the STL bytes alone.

An independent Python reader extracted each triangle, scaled its corners and produced the expected indexed arrays. Both accepted mesh blob hashes matched. The volume and centroid checks used 1e-12 relative and 1e-9 mm absolute tolerances, respectively. The unit preview and millimetre result screenshots were reviewed. The 325-file source capsule matched through cleanup. Zero page errors, console errors, downloads or watched changes. Product source stayed unchanged.

## Reproduction and limits

Use Node 22.19.0 and one heavy job at a time through `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`.

- From Studio, set local `PW_DIR` and `CHROME`. Run `D680_SOURCE_FROZEN=1 node test/stl-variant-roundtrip-browser.mjs "$EVIDENCE" "$D679_EVIDENCE"` with external evidence directories. D680 receipt SHA-256 `c83dc0fa0f84e2c7f2005e1e7507d9badb03c32e56e63a3a3f65bf6c2f5f97e5`. D679 input receipt SHA-256 `061d079afcdd89e6905ec721fc433ef1f8a694020eb0d1773b0339943c81a28a`.
- `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test mesh-import-ownership project-open-ownership variant-document-draft` passed 49/49. `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test mesh-import.test stl-export-quality.test o9-source.test` passed 8/8.
- Studio and Model type checks, `node --check apps/cad-studio/test/stl-variant-roundtrip-browser.mjs` and `git diff --check` passed.

**FAIL.** Zero in this scope. **NOT_RUN.** Native Save and reopen after STL import, other unit and mesh profiles, full suites and whole B07. D681 starts with the current serializer and native/Studio reproduction for the Float32 collapse reported in [#2425](https://github.com/barocss/barocss/issues/2425). The issue is open.
