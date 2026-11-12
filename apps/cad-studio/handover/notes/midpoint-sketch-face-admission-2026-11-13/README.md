# D888 — Verify native midpoint face admission in Studio

P1, rows 09, 15 and 16. SMALL qualification for [#2371](https://github.com/barocss/barocss/issues/2371). This decision adds regression coverage. The existing product path passes the selected cases.

Desktop Studio opened two native rectangular extrusions and one stored faceted tetrahedron. The driver used physical viewport picks and checked the actual selection before each attempt.

| Result | Check |
| --- | --- |
| PASS | Shift-clicking the same face toggled it off. Three faces on one solid, two faces on different native solids, two mesh faces and a native/mesh pair each refused. Every refusal retained the document, selected entities, evaluated bodies and history. Focused tests also cover an explicit duplicate face token and a merged display face. |
| PASS | A fresh pair on the first native stock then adopted the frame at Z = 6.0004 mm. Rectangle corners (44, 4) and (50, 8) mm and a +3 mm Extrude produced 72.00000000000004 mm³. The eight corners matched within 1e-9 mm. Both original native bodies and the faceted body stayed exact. Undo and Redo restored the exact documents. |
| PASS | Focused actual Model evaluation of one 7 mm radius, 8 mm high cylinder used 4 and 16 segments per quarter. Triangle counts differed. Fresh picks on both cap meshes resolved to the same native face names and Z = 4 mm frame. |
| PASS | Independent review, 98 focused Model tests, 39 focused Studio tests, scoped lint, driver syntax and diff checks. The actual desktop run recorded 12 states and held 840 inputs through cleanup. |
| FAIL | The first driver run timed out at initial browser navigation under host load before any product assertion. The retry used a 30 s navigation timeout and passed. |
| NOT_RUN | Direct raw mesh import, physical face and edge selection, curved/hidden/assembly admission, display body reorder, build, full suites and mobile. |

[#2371](https://github.com/barocss/barocss/issues/2371) remains open. D889 will check the remaining practical selection boundaries in desktop Studio and the exact body-index binding in a focused test. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
