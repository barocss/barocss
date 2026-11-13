# D930 — retain the pinned target identity through removal

2026-11-13 · SMALL · P1 rows 07 and 16 · [#2337](https://github.com/barocss/barocss/issues/2337)

- **PASS** In desktop Studio WebGPU, an 8 mm pin on `b1` became unavailable when that feature was suppressed or deleted. The overlay cleared. The other Extrude, `b3`, occupied the original array index and retained its own 19 mm height and 4560 mm³ volume. The pin never adopted that body.
- **PASS** Unsuppress and Undo restored the original owner and 8 mm. Redo removed the owner and the overlay again. Explicit Clear while the pin was unavailable prevented it from reappearing after Undo. A new manual measurement reported 8 mm.
- **PASS** Visual review confirmed both bodies after Undo and only the unpinned witness after deletion. The final desktop run had zero page errors, console errors or downloads. 52 Model and 14 Studio focused checks, driver syntax and diff check passed. No product change was needed.
- **NOT_RUN** Project Save/Close, cross-workspace pin visibility, Worker restart, other topology families, full suites, type checks, build and mobile. The wider issue stays open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
