# D954 — cancel a drawing drag before pointer release

2026-11-13 · SMALL · P2 rows 11 and 16 · [#2367](https://github.com/barocss/barocss/issues/2367)

- **FAIL on parent** A real drag preview moved removed Section A. Escape followed by mouse release still saved (314.4, 81.9) instead of retaining (295, 95) paper mm.
- **Change** Escape clears the active drawing drag preview before the next pointer-up. The existing selection and placement cancellation paths remain in use.
- **PASS** On the fixed Studio, ordinary drag committed only the removed Section paper position, from (295, 95) to (314.4, 81.9), and only the Detail B paper position, from (302, 165) to (321.4, 151.9), in separate runs within the same sheet. First Undo and Redo restored each exact document. The unmoved view, 20 mm width dimension and cutting trace retained their markup.
- **PASS** Escape during each visible preview left the accepted document, Undo and Redo availability, viewBox and emitted SVG unchanged after release. Visual review confirmed the moved and canceled states. Desktop WebGPU reported no page errors, console errors or downloads.
- **PASS** Four focused Studio tests, Studio type-check, driver syntax and diff check.
- **NOT_RUN** Browser-level pointer cancellation, sheet and document switch, build, full suites and mobile. Issue closure still needs sheet and document ownership checks.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
