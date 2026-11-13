# D961 — restore an existing project file when a version write fails

2026-11-13 · SMALL · P0 rows 12 and 16 · [#2438](https://github.com/barocss/barocss/issues/2438)

- **FAIL on parent** After valid version input, a controlled denial at the native log write returned STORAGE_DENIED. The actual part had already changed from 2 mm to 3 mm and Studio marked it clean. The first harness run waited for the injected message instead of the adapter's public refusal text. The second run verified the changed bytes.
- **Change** Keep the original file bytes and the primary write receipt. If the version log fails, restore the original bytes using that receipt as the expected tag. A later write with a different tag prevents recovery. Mark the working document saved only after the version is kept. The existing valid preliminary Save behavior on superseding edits remains covered by the focused ownership checks.
- **PASS** Desktop Studio on the fixed path reported the version denial and restoration. The actual part and version log matched their pre-action bytes. The 72 mm³ working part stayed dirty. A valid retry saved the edited part and added exactly one version. Visual review confirmed the restored-file notice and dirty state.
- **PASS** 65 focused Studio checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Failed first version for an unsaved part, a newer write arriving during recovery, denial of the recovery write, process interruption, local folder, WebGL2, production build, full suites and mobile. The two-file operation has no atomic transaction. Keep #2438 open while new-file and competing-write cases remain unverified.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
