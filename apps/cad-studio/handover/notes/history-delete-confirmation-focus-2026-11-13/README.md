# D976 — focus Cancel and restore the History Delete opener

2026-11-13 · SMALL · P0 rows 15 and 21 · [#2440](https://github.com/barocss/barocss/issues/2440)

- **FAIL on parent** The Delete confirmation for an extrude and its Hole kept focus on the initiating button. Escape left the confirmation open. The first fixed run exposed the dynamic Radix title as the accessible name. The final run retained the existing dialog name.
- **Change** Use the existing modal Dialog with focus on Cancel. Capture the actual editor button or History chip and return focus when the dialog closes. Bind the pending delete to the document it describes.
- **PASS** Desktop WebGPU Studio named Hole Ø8 as a dependent feature. Escape restored focus to the editor Delete button and to the History chip on the two routes. Canceling preserved the document, body, selection, history and dirty state. Explicit Delete removed the extrude and Hole. Undo restored the exact drilled plate.
- **PASS** Visual review, 45 focused Studio checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Native select popup navigation, WebGL2, fresh project reopen, production build, full suites and mobile. D972–D976 cover the reported desktop #2440 acceptance within their recorded limits.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
