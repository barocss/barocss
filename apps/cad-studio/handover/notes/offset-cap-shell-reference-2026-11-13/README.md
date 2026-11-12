# D896 — retain the Offset cap reference through Shell

2026-11-13 · SMALL · P1 rows 08 and 16 · [#2285](https://github.com/barocss/barocss/issues/2285) remains open.

Desktop Studio WebGPU repeated the supported D895 20 × 10 × 5 mm Extrude and +2 mm cap Offset. A real click selected the generated `n3.top` at Z7. Shell accepted a 1 mm wall and stored `open: ["n3.top"]`, parent node 4, and the cap's planar signature. Editing the source Extrude from 5 to 6 mm kept the saved Offset plane at Z5, the native parent cap at Z7, and the same Shell reference without rematch or suppression. The first Undo and Redo returned the exact prior documents.

A fresh Open read the 2026-byte OPFS project and retained the reference. Editing the reopened Shell from a 1 to 2 mm wall rebuilt the same opening and passed a second exact Undo and Redo. The strict native solid retained the `n3.top` name on the rim. Its outer and inner rectangular loops prove the opening at Z7. At 1 mm the inner opening is 18 × 8 mm, the floor is Z1 and volume is 536 mm³. At 2 mm the opening is 16 × 6 mm, the floor is Z2 and volume is 920 mm³. Independent stock-minus-cavity volume and centroid matched the native and Studio results within 1e-7 mm³ and 1e-7 mm.

The first driver incorrectly required the named face to disappear. The retake checked native loops and kept the product unchanged. The passing run had zero page errors, console errors or downloads. Model 63/63, Studio 12/12, driver syntax and diff checks passed. Commands and hashes are in [qualification.json](qualification.json).

Missing or ambiguous cap rematch, concurrent source replacement during Offset preview, handle and field equality, general direct edits, full suites and mobile were NOT_RUN. Next, check that same-name document replacement discards an in-flight Offset preview and keeps the new document current.
