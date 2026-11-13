# D956 — retire a pinned face measurement when its Worker fails

2026-11-13 · SMALL · P1 rows 07 and 16 · [#2337](https://github.com/barocss/barocss/issues/2337)

- **PASS** Desktop Studio measured and pinned the 8 mm distance between native opposite caps. A controlled error event on the real document Worker terminated that Worker once. The pin and witness label disappeared, and Studio marked the result stale. The accepted document, dirty flag and Undo/Redo availability stayed equal.
- **PASS** The public Retry engine action started one new Worker and restored current geometry without reviving the old pin. The first Redo and Undo restored heights of 13.25 mm and 8 mm. Fresh reversed cap picks pinned 8 mm. Native geometry, Worker volume and the Studio readout agreed with the 20 × 12 × 8 mm reference.
- **PASS** Visual review, two focused Studio tests, driver syntax and diff check. No page errors, console errors or downloads. No production change was needed.
- **NOT_RUN** Natural Worker crash, simultaneous held reply and retry, wider topology cases, production build, full suites and mobile. The broader issue stays open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
