# D958 — restore the correct project Save destination across Open history

2026-11-13 · SMALL · P0 rows 12 and 16 · [#2438](https://github.com/barocss/barocss/issues/2438) · [#2492](https://github.com/barocss/barocss/issues/2492)

- **FAIL on parent** Open A, edit its extrusion from 2 to 3 mm, Open B, then Undo. The 72 mm³ geometry of A returned, but the title and active path were B. Save overwrote the real 128 mm³ B file in browser project storage. The first run observed the wrong title and path but sampled the asynchronous write too soon. The second run waited for the bytes to change and reproduced the overwrite.
- **Change** Accept the replacement document before publishing the incoming project path. History keeps the title, dirty flag and the prior binding, including its file and version tags. Undo and Redo restore the binding only within the same project store. A later Save still checks the captured file tag. External file Open uses the same history boundary. New part retains its existing detached behavior.
- **PASS** Desktop Studio Undo restored dirty A at 72 mm³ with A active. Redo restored clean B at 128 mm³ with B active. The next Undo and Save changed only A. B remained byte-identical at 463 bytes. Visual review confirmed the title, body and active path in each state.
- **PASS** 78 focused Studio checks, Studio type-check, driver syntax and diff check. Desktop WebGPU reported no page errors, console errors or downloads.
- **NOT_RUN** Make version rejection, STEP and detached Save filename, same-name collision, actual New part regression on this revision, folder projects, WebGL2, build, full suites and mobile. #2438 remains open pending the remaining acceptance checks.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
