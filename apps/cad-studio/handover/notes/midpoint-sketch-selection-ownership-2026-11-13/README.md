# D889 — Verify midpoint selection ownership and refusal

P1, rows 09, 15 and 16. SMALL qualification for [#2371](https://github.com/barocss/barocss/issues/2371). This decision adds desktop and focused regression coverage. The existing product passes the selected cases.

| Result | Check |
| --- | --- |
| PASS | Physical picks refused a planar cylinder cap with its curved side. A face click followed by a Shift-edge click on the other body selected both bodies and refused. The earlier focused check also rejects explicit mixed face and edge tokens. |
| PASS | Hiding the stock cleared its selected pair. Clicking the old surface position acquired no face, and the command refused. Undo restored the stock. The command also refused a selected placed occurrence and a root face pair in its assembly document. |
| PASS | Studio opened 424 bytes of authored STL through the unit dialog and produced a faceted tetrahedron. Two physical facet picks refused. Each refusal kept the document, selection, bodies and history at its captured input. |
| PASS | A current native pair recovered. The mouse wheel hit the canvas and reduced the projected length of a fixed 10 mm span from 128.66 to 89.09 CSS px. Different cap click locations returned the same midpoint Z = 6.0004 mm and normal +Z. Starting and canceling the sketch kept the native source exact. |
| PASS | A focused body reorder rejects picks from the prior index and admits fresh picks on the original solid at its new index. The exact frame remains Z = 2 mm for the 4 mm stock. Independent review, 98 focused Model tests, 40 focused Studio tests, lint, syntax and diff check passed. |
| FAIL | The first driver run clicked a live cylinder edit handle during the second pick. The second run used a checkbox action that waited for a control that unmounted on a successful hide. The final run picked off the handle and observed the accepted visibility change after a normal click. |
| NOT_RUN | Mobile, full suites and production build. Merged identity, raw malformed numerical inputs and varied tessellation are controlled or Model proofs. |

[D862](../two-face-midpoint-sketch-2026-11-13/README.md), [D887](../oblique-midpoint-sketch-2026-11-13/README.md), [D888](../midpoint-sketch-face-admission-2026-11-13/README.md) and D889 satisfy the first [#2371](https://github.com/barocss/barocss/issues/2371) acceptance. The command starts an independent sketch from two exact parallel native faces of one visible solid. It preserves the midpoint frame across ordinary display changes and saves it as an existing DocPlane snapshot. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
