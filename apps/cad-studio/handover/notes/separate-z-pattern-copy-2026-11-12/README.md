# D822 — Edit one independent output of a partial Z pattern

P1, rows 08, 12 and 16. SMALL verification of existing behavior. The same source as D821 is a 4 × 6 × 8 mm rectangle extrusion. Actual desktop Studio selects Separate bodies for Count 4, spread 120°, axis Z through (12, 4, 0) mm.

| Result | Check |
| --- | --- |
| PASS | The command creates four native single-solid outputs b1, b4, b7 and b10 at 0°, 40°, 80° and 120°. Each starts at 192 mm³. Each copy has its own sketch, extrusion and Rotate feature. |
| PASS | Editing only n6 from 8 to 10 mm changes b7 to 240 mm³. The other three outputs retain their exact authored chains, angles and dimensions. |
| PASS | Distance 0 is refused with `height must not be zero`. It retains the accepted document and four current solids. First Undo restores 8 mm on b7, and first Redo restores 10 mm. |
| PASS | Actual project Save, Close and fresh Open restore the exact 2,123-byte document. A reopened edit to 12 mm changes b7 alone to 288 mm³. |
| PASS | An independent rotation oracle matches all 32 native corners at each measured state within 1e-9 mm. Native and current Worker volumes and centroids agree within 1e-7 mm³ and 1e-9 mm. |
| PASS | 16 focused Model tests, driver syntax, diff check and root visual review. Desktop has zero page errors, console errors and downloads. |
| NOT_RUN | Invalid creation counts, other inputs, full suites, mobile and other browsers. |

[Commands and receipt digest](qualification.json). [#2354](https://github.com/barocss/barocss/issues/2354) is already closed for its X/Y count scope. [#551](https://github.com/barocss/barocss/issues/551) remains open for general mixed graphs, cache invalidation, reordering and persistent references. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
