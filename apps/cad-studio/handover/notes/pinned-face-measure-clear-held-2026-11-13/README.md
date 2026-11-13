# D957 — keep a measurement pin cleared after a held reply

2026-11-13 · SMALL · P1 rows 07 and 16 · [#2337](https://github.com/barocss/barocss/issues/2337)

- **PASS** Desktop Studio pinned the original 8 mm native cap pair. A delivery shim held the genuine 13.25 mm candidate and then the accepted-model reply. While the second reply was held, the pin showed unavailable and the witness label was absent. Clearing the pin preserved the accepted document, pending body state, dirty flag and history.
- **PASS** Delivering current geometry did not revive the pin or witness. First Undo and Redo retained the clear state. Fresh public picks measured 13.25 mm. The native reader found a valid solid with volume 3180 mm³ within 1e-8 mm³. Visual review confirmed the cleared and ordinary measurement states.
- **FAIL** Two harness runs timed out on deferred mass readiness after the instrumented reply. The geometry was current and the pin absent. Final pin verification uses geometry freshness and an independent native volume read at delivery, followed by the ordinary Studio measure after uninstrumented history replay. Deferred mass was still unavailable immediately after delivery.
- **PASS** Driver syntax and diff check. No page errors, console errors or downloads. No production change was needed.
- **NOT_RUN** Natural message delay and mass recovery under the held-reply instrumentation, broader topology, production build, full suites and mobile. The broader issue stays open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
