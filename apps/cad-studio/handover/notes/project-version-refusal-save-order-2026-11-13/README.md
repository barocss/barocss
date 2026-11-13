# D959 — validate a proposed project version before saving

2026-11-13 · SMALL · P0 rows 12 and 16 · [#2438](https://github.com/barocss/barocss/issues/2438)

- **FAIL on parent** The project had a version named Reference A. Submitting that same name after editing the extrusion from 2 to 3 mm reported refusal but wrote the edited part bytes and cleared the dirty flag. The first harness run targeted the unavailable Open action on the active row. The second run reproduced the actual write.
- **Change** Read and validate the destination log and build the proposed version before starting Save. Retain the log tag from that validation for the version write. A stale request cannot start Save after the validation read. The existing preliminary Save still applies to a valid request before its version log commit.
- **PASS** Desktop Studio duplicate-name refusal kept the actual 463-byte part, actual version log, active path, and dirty 72 mm³ working geometry. A unique name then saved the same edit and added a second version. Visual review confirmed the refusal and dirty state.
- **PASS** 65 focused Studio checks, including superseded and conflicting version operations, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** A browser storage failure after a valid preflight, other refusal inputs in Studio, STEP and detached Open, New part and same-name collision, build, full suites and mobile. The part and version log still have separate writes. A storage failure after the valid preliminary Save can leave the document saved without a new version. Keep #2438 open for the remaining cases.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
