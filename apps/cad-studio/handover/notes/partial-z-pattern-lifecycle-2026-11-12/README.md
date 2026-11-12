# D821 — Keep the pivot and spread when editing a partial Z pattern

P1, rows 08, 12 and 16. SMALL verification of existing behavior. The source is one 4 × 6 × 8 mm rectangle extrusion from (50, 10, 0) mm. Actual Studio creates one pattern output with disjoint native solids, spread 120°, axis Z through (12, 4, 0) mm.

| Result | Check |
| --- | --- |
| PASS | Actual Count 4 creates native angles 0°, 40°, 80° and 120° within one authored output b2. The feature editor changes Count to 3 and keeps the exact pivot and spread, with angles 0°, 60° and 120°. |
| PASS | The current editor refuses Count 0 and retains the exact Count 3 document and solids. First Undo restores Count 4, and first Redo restores Count 3. |
| PASS | Actual project Save, Close and fresh Open restore the exact 735-byte Count 3 document. The reopened editor changes Count to 5 and retains the pivot and spread, with angles 0°, 30°, 60°, 90° and 120°. |
| PASS | The independent rotation oracle verifies all 32, 24 and 40 native corners within 1e-9 mm and corresponding volumes 768, 576 and 960 mm³ within 1e-7 mm³. Current Worker centroids and native validity agree across creation, edit, refusal, Open and re-edit. |
| PASS | 16 focused Model tests, driver syntax, diff check and root visual review. Actual desktop has zero page errors, console errors and downloads. |
| NOT_RUN | Separate-body Z result, other spread profiles, full suites, mobile and other browsers. |

[Commands and receipt digest](qualification.json). This result adds the current positive partial-Z one-output lifecycle alongside D740's X/Y scope. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
