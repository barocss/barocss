# D692 — Reopen the assembly's root-only STL in Studio

P2 B07, rows 10 and 13. Parent `94eb24717ec8cf69718884f2e56eca6e45f339d4`. SMALL verification-only change. [D689](../stl-assembly-loss-2026-11-11/README.md) captured an Automatic STL and its source record while the Cube was visible in the assembly. It also verified the warning that Automatic omits visible placed parts. D692 opens that exact STL. The writer, reader and geometry code stay the same.

## Actual desktop Studio

**PASS.** Validate the retained D689 receipt, its independent-reader input and both Blob hashes. The accepted D689 snapshot shows the visible Cube at [0, 0, 0] and the omission notice. The new Chrome WebGPU context at 1440 × 900 receives the original STL alone through the public Open control. The source record is used for evidence custody.

Studio reports that STL carries no unit. Change the selector to centimetres and confirm the preview is 1,600 × 600 × 40 mm, with the current document still unchanged. Select millimetres and confirm the preview is 160 × 60 × 4 mm. Open the file. Studio reports one mesh solid with six regions and 12 triangles. The accepted document has one faceted mesh node, mm units, and no original feature history, parameters, colours, instances or mates. The name comes from the STL file name. Studio accepts the mesh without a repair step.

The independent Python reader reconstructs the indexed mesh from the original bytes. Both the positions and indices hashes match the accepted mesh blob references. The file has eight corners and bounds from [-20, -20, -4] to [140, 40, 0] mm, so it contains only the plate. The Cube would extend above Z=0. Studio's volume of 38,400 mm³ and centroid [60, 10, -2] mm match the analytic plate at 1e-12 relative volume and 1e-9 mm absolute centroid tolerance. The physical comparison uses Studio's accepted result and the analytic dimensions.

## Verification

Use Node 22.19.0 and the existing `PW_DIR` and `CHROME`. Run one heavy job at a time through `gate.sh acquire heavy 180 <label>`.

- **PASS.** From Studio run `D692_SOURCE_FROZEN=1 node test/stl-variant-roundtrip-browser.mjs "$EVIDENCE" "$D689_EVIDENCE" --assembly-root`. Final receipt SHA-256 `9033f76449db15658b881314212214fec250a4584f85e33314f87fe29c2c8bca`. D689 receipt SHA-256 `f16d05846ba4a295565955497230b73525fa20269ee9ce974f36657213a2ed40`. The STL SHA-256 at export and Open is `73be31de78fb91c064af7eb8d1e150074360dfb40a5d2a66d40f392411cae841`. Reviewed all three screenshots.
- **PASS.** The same driver with `D680_SOURCE_FROZEN=1`, the original D679 evidence and no mode argument retains the previous unit preview, Cancel and mm/cm Open behavior. Receipt SHA-256 `cbe2b7c6fb966f440c97ec8896003b6b3950c5d0909634c6b8a2b44fccbef6cb`. All 326 frozen paths matched through cleanup in each run. Browser downloads, page errors, console errors and watched source changes were zero.
- **PASS.** `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test mesh-import-ownership project-open-ownership imported-file-ownership` passed 67/67. `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test mesh-import.test stl-export-quality.test o9-source.test` passed 9/9. Driver syntax, scoped ESLint, Studio and final Model type checks, and Git whitespace passed.
- **FAIL.** None in this scope. **NOT_RUN.** Browser-managed download, centimetre acceptance for this plate, external slicer and whole B07 acceptance.

D692 supplies the assembly-derived STL Open missing from the D689 matrix. Next D693 checks for an eligible genuine kernel-unavailable STL fixture for [#2425](https://github.com/barocss/barocss/issues/2425). Use the real Worker and distinguish its native unavailable result from Float32 refusal. The controlled null in D682 is retained as controlled evidence. [#539](https://github.com/barocss/barocss/issues/539) and #2425 remain open.
