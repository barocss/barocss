# D929 — keep a pinned face measurement current during evaluation

2026-11-13 · SMALL · P1 rows 07 and 16 · [#2337](https://github.com/barocss/barocss/issues/2337)

Desktop Studio held four genuine Worker replies without changing their contents. The observer resolves the existing per-Worker wire node IDs to identify the requested Extrude height.

- **PASS** While the zero-height candidate was held and after its native refusal, the accepted 8 mm pin and its overlay stayed visible. The document, bodies, history controls and dirty state stayed equal. The actual editor showed the positive-size refusal.
- **PASS** A valid 13.25 mm candidate left the original 8 mm pin visible until the edit was accepted. After acceptance but before the held current-model result arrived, Studio displayed Measurement unavailable and removed the overlay. It displayed 13.25 mm only after the current model settled. Volume matched 3180 mm³ within 1e-8 mm³.
- **PASS** A held valid 17.5 mm candidate arrived after same-ID File Open. The replacement stayed at 8 mm and had no inherited pin or overlay. Fresh manual Measure reported 8 mm. The passing WebGPU run had zero page errors, console errors or downloads. Visual review confirmed the refusal and pending states.
- **PASS** 12 Model and 14 Studio focused checks, driver syntax and diff check. No product change was needed.
- **FAIL** The first observer expected inline wire nodes. The second located the status as an alert. The final observer resolves wire IDs and the driver reads the actual status.
- **NOT_RUN** Project Close, live Worker restart, suppressed/deleted target lifecycle, native Save, type checks, build, full suites and mobile. The broader issue stays open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
