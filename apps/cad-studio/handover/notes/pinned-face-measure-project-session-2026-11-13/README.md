# D931 — keep pinned face measurements out of saved projects

2026-11-13 · SMALL · P1 rows 07, 12 and 16 · [#2337](https://github.com/barocss/barocss/issues/2337)

- **PASS** In desktop Studio, the 8 mm pin and overlay were hidden in Drawing and Render. Model restored the current value on each return.
- **PASS** Actual browser Project Save before and after pinning produced the same 465 bytes. The parsed file exactly matched the accepted model. Closing the project cleared the pin and overlay. After a fresh Studio reload and Project Open, the document was unchanged and had no pin. Fresh opposite-face picks pinned 8 mm again.
- **PASS** Visual review confirmed the recreated pin after Open. The passing WebGPU run recorded zero page errors, console errors and downloads. Twelve Model and 103 Studio focused checks, driver syntax and diff check passed.
- **NOT_RUN** Live Worker restart, wider topology support, build, type checks, full suites and mobile. The broader issue remains open.

The D927–D931 evidence adopts the session-only pin for the demonstrated opposite-cap pair on a positive default-XY rectangular Extrude. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
