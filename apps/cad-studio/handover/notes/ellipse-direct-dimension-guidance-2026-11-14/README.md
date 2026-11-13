# D1085 — guide direct ellipse dimensions to the authored axes

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

A matching ellipse is authored by its axis lengths. When Dimension picks a generated arc of the matching active ellipse, use the existing Sketch alert to point to Rx and Ry. Keep the draft and close any inline dimension editor. The existing axis controls and generic sketch dimension logic keep their current roles.

- **FAIL** Parent desktop Studio opens Radius of arc 145 after an actual canvas click on the reopened 192-arc ellipse and displays no axis guidance. The replay stops at the opened editor.
- **PASS** Desktop WebGPU reopens the actual 10 mm Extrude document in a fresh context, clicks the same arc, shows the Rx and Ry guidance and leaves the inline editor closed. The document and ellipse definition stay exact until the explicit Rx edit. Changing Rx from 50 to 54 mm clears the guidance. Finish keeps the 192 side IDs and the Extrude node, and exact document Undo and Redo pass.
- **PASS** The independent Python oracle verifies the stored ellipse points and arc outline. It computes 33929.21174347907 mm³ from that outline. Studio reports 33929.21174341433 mm³. Both type checks, Studio 32/32, Model 17/17, scoped lint, driver syntax, diff checks and visual review pass.
- **NOT_RUN** Full ellipse driver including Make curves, rim Fillet or Chamfer, additional arc picks and point-pair dimensions, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
