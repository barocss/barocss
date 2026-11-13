# D924 — verify straight-face inset re-link with the opposite normal

2026-11-13 · SMALL · P1 rows 07, 09 and 16 · [#2324](https://github.com/barocss/barocss/issues/2324)

The existing desktop command picked the Bottom of the 60 × 24 × 8 mm oblique stock. The source became `n3.bottom` and the separate application target stayed `n1`. The source plane origin was (0, 4.32, −5.76) mm, its normal was (0, 0.6, −0.8), and its X axis was (−1, 0, 0).

- **PASS** Preview preserved the accepted state until Apply. The ring extended 4 mm along the new normal, a world displacement of (0, 2.4, −3.2) mm. All 16 independent world corners and the local cap depth matched within 1e-8 mm.
- **PASS** Apply, Undo, Redo, Save, fresh File Open and source width edit from 60 to 64 mm preserved the new direction and the separate target. The native ring volumes were 1280.0000000000032 and 1344.0000000000027 mm³. The independent expectations were 1280 and 1344 mm³, with a 1e-8 mm³ tolerance.
- **PASS** The existing oblique Top path passed as a desktop regression. Both runs used WebGPU and reported zero page errors, console errors and downloads. The opposite-normal preview and reopened model were visually reviewed. The frozen source manifest matched through cleanup.
- **PASS** 22 Model and 145 Studio focused tests, driver syntax and diff checks. Independent review checked the face orientation and world corners.
- **NOT_RUN** Full suites, type checks, build, mobile, damaged-file repair and other profile or downstream feature families.

The evidence from D870 and D920–D924 qualifies research closure for #2324. The existing explicit re-link is adopted for the demonstrated healthy straight-face scope. D923 retains refusal on both Open paths and defers damaged-file repair. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**.

[Commands and receipt hashes](qualification.json).
