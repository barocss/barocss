# D787 — Wait for a viewport renderer before picking a model

P0 R05, rows 06, 20 and 32. SMALL repair. Renderer-dependent model clicks and context menu picks now require an attached renderer. The check occurs at the pick, after existing renderer-independent left-click handling.

| Result | Check |
| --- | --- |
| FAIL, parent product | Desktop Studio opens a native part while a real WebGPU pipeline result is held. The left click throws a null `pickDirect` error. The right click throws a null `pickFace` error. The baseline driver captures both page errors and verifies the unchanged document and history. |
| PASS | The same public clicks during startup produce zero page or console errors. The document, selection, dirty state and history remain exact. No viewport context menu opens before the renderer attaches. The test then returns the original native pipeline without changing it. |
| PASS | After attachment, a left click selects the visible top face. A right click on the same point selects the same face and opens its menu. The model remains clean. The independent rectangular subtraction agrees with the unchanged 17,840 mm³ Worker volume. |
| PASS | The current D786 fallback flow still opens a WebGL2 context on its own canvas after a startup failure, then edits, saves and opens the same project under healthy WebGPU. Both type checks, Studio focused tests 33/33, driver syntax and diff checks pass. The current Studio captures were visually reviewed. |
| NOT_RUN | Startup in other browsers, organic hardware failure, interactions with every renderer-independent tool before startup, full suites and mobile. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [#541](https://github.com/barocss/barocss/issues/541) remains open.
