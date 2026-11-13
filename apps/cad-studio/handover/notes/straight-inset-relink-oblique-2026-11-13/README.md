# D922 — verify straight-face inset re-link on an oblique plane

2026-11-13 · SMALL · P1 rows 07, 09 and 16 · [#2324](https://github.com/barocss/barocss/issues/2324) remains open.

The replacement stock uses a 60 × 24 mm rectangle and an 8 mm Extrude on a plane with origin (100, 20, 6) mm, normal (0, −0.6, 0.8) and X axis (1, 0, 0). Its top face has the same native name `n3.top`. The world map for stock coordinates is (100 + u, 20 + 0.8v − 0.6h, 6 + 0.6v + 0.8h). The linked ring extends from h=8 to h=12. The face plane has canonical origin (0, −0.48, 0.64) mm.

- **PASS** Desktop Studio picked the oblique top. Preview showed its normal, ring and separate application target `n1`. The accepted document, selection, bodies, title, dirty state and history stayed equal until Apply.
- **PASS** Apply, first Undo and Redo, Save, fresh File Open and a second edit of the source width from 60 to 64 mm passed. Independent geometry matched the plane and all 16 ring vertices within 1e-8 mm. Native volumes were 1280.000000000003 and 1343.9999999999977 mm³, within 1e-8 mm³ of the independent values. The exact saved document was 2817 bytes.
- **PASS** 22 Model and 44 Studio focused tests, driver syntax and diff checks. Independent geometry review covered the native face and the world projection.
- **NOT_RUN** Damaged-file repair, other oblique profiles or downstream features, whole suites and mobile.

[Commands and receipt hashes](qualification.json).
