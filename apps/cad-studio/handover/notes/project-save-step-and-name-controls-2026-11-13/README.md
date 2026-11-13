# D960 — verify STEP, New part and same-name Save controls

2026-11-13 · SMALL · P0 rows 12 and 16 · [#2438](https://github.com/barocss/barocss/issues/2438)

- **PASS** Actual desktop Studio opened the retained STEP block with a bore as one solid. The native Worker volume was 11497.345175425628 mm³, within 1e-7 mm³ of the analytic box minus cylindrical bore. Undo restored clean B at 128 mm³ and active B.bcad. Redo restored the dirty imported STEP document with its own title and no project path.
- **PASS** New part detached the Save destination. Renaming it B and saving reported the name conflict. The new empty document, dirty flag, and original A and B file bytes stayed intact. First Undo and Redo restored the original and new working documents with the existing detached-path policy. Renaming the empty document to a unique name and saving created a third file without changing A or B.
- **PASS** Outside the project, Undo of native File Open restored Detached A. Actual Save produced the Detached A.bcad name and exact A content at the browser delivery boundary. Redo restored Detached B. Visual review, driver syntax and diff check passed. No page errors, console errors or downloads.
- **NOT_RUN** Actual local folder project, WebGL2, build, full suites and mobile. D959 covered a semantic Make version refusal. A storage failure after a valid preliminary Save still requires separate acceptance, so #2438 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
