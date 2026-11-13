# D962 — recover a failed first version and retain newer file bytes

2026-11-13 · SMALL · P0 rows 12 and 16 · [#2438](https://github.com/barocss/barocss/issues/2438)

- **FAIL on parent** A denied first version left A.bcad active in the project. The first repair removed the new part but left a zero-byte version log. The next attempt refused that empty log as invalid JSON.
- **Change** First-version recovery removes the new part only if its write tag still matches. A refused create also removes its unchanged empty placeholder. Per-path serialization covers both writes and removes in one adapter.
- **PASS** Desktop Studio left the edited 72 mm³ working part dirty and detached after a denied first version. The actual new part was absent. Retry under the same name saved the exact part and created the first version.
- **PASS** A controlled external overwrite committed new primary bytes before the existing version write denial. Recovery reported it could not restore the file and kept the newer bytes and original log. Working geometry and dirty state were retained. Visual review confirmed both browser cases.
- **PASS** 77 focused Studio checks, Studio type-check, driver syntax and diff check. An initial runner invocation from the worktree root had one relative fixture lookup failure. The package-scoped invocation resolved it. No page errors, console errors or downloads in either passing desktop run.
- **NOT_RUN** Simultaneous storage writers inside the native check/write window, process interruption, denied cleanup, local folder projects, WebGL2, full build, full suites and mobile. Desktop Chrome browser-project acceptance for #2438 is complete with D958–D962.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
