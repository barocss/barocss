# D880 — Filter the current sketch constraint list

P1, rows 09 and 16. FEATURE. The current closed outline lists every constraint kind by its exact producer label. Picked only matches any current picked entity through the existing identity comparison. The two filters apply together. The count shows displayed rows over all available rows. A matching ellipse still has one read-only summary for its 192 arcs. Its selected-entity match uses the arcs it represents.

The filters live in the list. Opening another sketch or replacing the document restores the default list. Current row IDs still drive individual removal. A hidden row releases its inspection. The existing dimension and status views keep their data.

| Result | Check |
| --- | --- |
| FAIL | On the earlier implementation, the active dimension text survived focus, filtering and Escape. Chrome native Meta+Z while the filter owned focus then restored that editor's text from 42 to 40 mm. The filter now consumes native Undo and Redo while its controls own focus. |
| PASS | Studio changed kind with native keyboard type-ahead and used Space on Picked only. The rectangle showed 5/5, Horizontal 2/5, selected edge 1 at 1/5, and its point with the same index at Anchor 1/5. Pure filtering retained the document, selection, history, solver status and Worker and storage counts. |
| PASS | Filtering retained the uncommitted 42 mm value through focus, Escape and Meta+Z. Explicit confirmation made one dimension step. Undo and Redo kept the Vertical filter and updated its denominator. A refused zero-length edit kept its alert visible while the filter showed 0/6. |
| PASS | Parallel matched either of two picked edges once. Horizontal distance had its own kind. Hiding an inspected row cleared the viewport highlight. After removing Equal length, the Fixed rule shifted to the earlier ID. Its removal, Undo and Redo used the current row, and Finish kept only the intended removal. |
| PASS | A real arc pick matched the read-only ellipse summary at 1/2. No arc rows expanded. A fresh File Open returned the default filters. The exact 79,050-byte OPFS project document kept the accepted rule list. The independent native stock read stayed 1,600 mm³ at centroid (20, 10, 1) mm within 1e-8 in the respective units. |
| PASS | Independent source audit, 41 focused Studio tests, Model and Studio type checks, scoped lint, Vite build, driver syntax and diff check. D856 inspection and D861 comparison regressions passed. The final desktop run held 837 source inputs through cleanup and recorded 12 states. |
| FAIL | Early driver runs addressed a hidden Anchor removal button by its accessible role, assumed ArrowDown selected a native menu option before activation, or used feature-row selectors for standalone sketches. The final driver uses the actual controls and history labels. |
| NOT_RUN | Full suites and mobile. |

The desktop and focused matrix covers [#2329](https://github.com/barocss/barocss/issues/2329). Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
