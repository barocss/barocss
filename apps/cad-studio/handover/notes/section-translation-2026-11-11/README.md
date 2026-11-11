# D699 — Preserve drawing sections under translation

P2 B06, row 11. [#2418](https://github.com/barocss/barocss/issues/2418). Parent `e7eedb85a537b414509afa27835f18065cfecc79`. FULL numerical review for the private drawing geometry boundary. Sol High owns the geometry analysis, implementation and Model tests. The root runs the actual desktop Studio and independent SVG checks.

## Baseline

**FAIL.** Studio accepts the 10 × 1/64 × 10 mm planar box and its translated copies at Y = 0, +8192 and −8192 mm. The section field accepts the exact midpoint, relative depth 1/128 mm. The original Worker returns one ring at the origin and incorrectly reports no material behind the plane at both translated midpoints. Actual SVG gives the origin's 10 × 10 mm outline and five hatch lines. Both translated files lack the section group. The true miss at relative depth 1/32 mm stays a separate control. Baseline receipt SHA-256 `758274e364f9715dfe7a732ed72d178fb84537e107a5db23eadba8e96e055d85`. The first runner compared a closed ring as four entries. Its corrected witness requires four distinct corners and the closing point. Initial receipt SHA-256 `188c6a17e08a40db5f503ec7824ccb5252bd054cbc80bed9178e0ab4aac8c5b9`.

**PASS, independent native witness.** The exact same three native inputs each have a strict original solid, Float64 depth coordinates and two strict halves. The literal expected original volume is 1.5625 mm³, with 0.78125 mm³ and one 100 mm² cap for each half. Evaluating the original cap and face-only helpers against the valid kept native half reveals two rings and eight candidate edges at both translations. The extra four edges lie on the original parallel face. The origin gives one ring and four edges. The native source-bundled baseline receipt SHA-256 is `b1b0b5caa58e8b0d6cc1fbb2bf0876ce3f25fe64afe3b619a291a6f0cd06537e`.

## Decision and native verification

Use signed depth for culling. Axis tests use the exact coordinate sign, and oblique dot products allow a binary64 evaluation bound. The existing native provider decides whether a crossing can split. Both expected outputs must exist. Cap faces and edges use the shared 1e-7 mm physical floor plus the binary64 bound. A retained body contributes rings and face-only geometry when it crossed the plane or touched it from the retained side. Full section projection still includes wholly behind bodies. Body order, persistent output names and the selected native side are preserved.

**PASS.** The three positions and both viewing directions pass the strict native closed-solid, exact cap and volume checks. Both sides of cuts 2^-23 mm inside the boundary pass. Cuts 2^-24 mm inside yield one native output and surface an explicit Model failure. Exact contacts and true misses keep their respective outcomes. In a three-body part the crossing box alone supplies the cap, including when a separate retained box is 2^-24 mm behind the plane. The thick-box control and an oblique diagonal cut also pass. The Model geometry lane records 11/11, SHA-256 `b934e16366765825d08cd1ce35769674b151ea467de4f8702dabe66d75189e7a`. The initial test subset at the parent records 2 PASS and 8 FAIL, SHA-256 `e693753a5d14a267817c1b1df38c117a487e07c7fbf6529526d1c91b047dae49`.

## Actual desktop Studio

**PASS.** Chrome WebGPU at 1440 × 1000. Open the three native files and edit the real Drawing section field. All three midpoints give one ring, body index 0, four 10 × 10 mm corners and the closing point. Each true miss remains a refusal. The same source-backed 10 mm width dimension resolves throughout. The only authored change is the section depth. At +8192 the first Undo restores the exact miss state and the first Redo restores the exact midpoint state. Capture native Save and reopen the bytes in a fresh context. The source feature list, section depth and dimension references match the accepted document.

Hold the actual original Worker reply for another valid −8192 cut at −8191.98828125 mm. Open the +8192 document at its miss depth in the same context. Deliver the held original successful reply to the real client. The replacement Doc, depth, refusal and SVG remain current.

**PASS.** ElementTree reads six actual SVGs. Four crossing files, including the fresh Open, have the exact four 10 mm boundary segments and five hatch lines within the square. Two miss files have no section outline or hatch. The authored 10 mm width is present in all six.

## Verification

- **PASS.** Run with Node 22.19.0 and existing Playwright and Chrome under `gate.sh`. From Studio run `D699_SOURCE_FROZEN=1 node test/section-translation-browser.mjs "$EVIDENCE" --fixed`. The fixed receipt SHA-256 is `a595bacfc152f98a51d5e2591d05969e2fed96cf374edfbe43f37be0cd720964`. All 329 frozen paths match through cleanup. Zero browser downloads, page errors, console errors and watched source changes. The `--baseline` run intentionally reports the product failure after recording both translated omissions.
- **PASS.** `TEST_CONCURRENCY=2 pnpm --filter @barocss/cad-model test drawing-section-translation sections.test drawing-section-forms drawing-section-kinds section-dimensions drawing-current-contract drawing-detail` passed 57/57. The affected suite covers ordinary, half, offset, removed and revolved sections, frame sections, section dimensions, detail hatches and drawing ownership. `pnpm --filter @barocss/cad-studio-app test drawing-commit-roundtrip` passed 4/4. Model and Studio type checks, scoped ESLint, driver syntax and Git whitespace passed.
- **PASS.** All four out-of-tree mutations were rejected by the relevant new tests. These restored world-relative culling, restored world-relative cap membership, let a retained behind body supply a cap, or accepted only one native split output. Mutation log SHA-256 `9711eca995eee211778229a399da128a2ab140e6e96e01d283fa951a8bfb3c4c`.
- **NOT_RUN.** Full suites, new Studio DXF/PDF qualification and general curved-body extrema certification. The covered numerical boundary is the supported planar case and the named regression controls. Whole B06 remains unadjudicated. Initial scenarios remain 5/10 accepted. Whole CAD and core readiness remain NOT_MEASURED.

Next D700 checks fully occluded axial cosmetic thread marks with Hidden lines off and on and a visible control. [#2421](https://github.com/barocss/barocss/issues/2421)
