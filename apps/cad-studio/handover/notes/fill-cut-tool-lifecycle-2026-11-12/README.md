# D784 — Verify the upstream tool edit of a Fill cut pattern

P1, rows 08, 12 and 16. SMALL qualification of the existing behavior. The tracked rectangular Difference fixture supplies the 60 × 30 × 10 mm stock and its original through tool. The driver adds one prepared 3 × 3 Fill recipe with a rectangular region and one hole. The actual Studio proof starts with Open. D335 and D345 cover mask and snapshot editing. D534 covers the upstream tool edit for a linear pattern.

| Result | Check |
| --- | --- |
| PASS | Studio edits the original tool width from 4 to 6 mm. The same original and five repeated cuts grow. The original is outside the mask and still cuts. Cells (0,1), (1,1) and (0,2) stay uncut. The feature IDs, Difference operands, Fill body key, grid, anchor and mask stay fixed. The changed tool drops its stale Box command. |
| PASS | A zero-width tool is refused at sketch `n2`. The editor retains the previous document, body and history. First Undo restores 4 mm and first Redo restores 6 mm. Project Save and fresh Open recover the exact accepted document. A further tool edit to 8 mm works in the reopened project. |
| PASS | Six independent Python checks match all twelve through-cut cap rims, volume and centroid against the strict native body and current Studio measurements. The volume is 17,040, 16,560 and 16,080 mm³ at widths 4, 6 and 8 mm. Each native result has one closed shell of genus six. The absolute tolerance is 1e-8. Sol High reviewed the geometry and the distinction between the original cut and the masked grid. |
| PASS | Model focused tests 18/18, Model type check, driver syntax and diff checks. Visual review covers the refused edit, project Open and post-Open tool edit. Zero unexpected errors and downloads. |
| FAIL | None in this run. |
| NOT_RUN | Full suites, mobile, public creation of this exact Fill recipe, overlapping tool paths and nonrectangular tools. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The core parametric features epic remains open. [#534](https://github.com/barocss/barocss/issues/534).
