# D786 — Start WebGL2 on a fresh canvas after WebGPU startup fails

P0 R05, rows 06, 20 and 32. SMALL repair of Studio's existing fallback. The viewport chooses its startup backend once. If the current WebGPU attempt fails, React replaces its canvas before WebGL2 starts. The viewport and document owners stay mounted. The startup effect disposes only the renderer it attached and ignores late failure after its cleanup.

| Result | Check |
| --- | --- |
| FAIL, parent product | A real WebGPU context configures on canvas 1 and a native pipeline resolves. The test holds that result while Studio opens the native part, then deliberately rejects its return. The original code releases the device and tries WebGL2 on canvas 1. The browser returns no WebGL2 context. Studio retains the open part and shows a viewport error. The baseline driver passes its expected reproduction assertions. |
| PASS | The same startup interruption releases the WebGPU device and unconfigures canvas 1. WebGL2 acquires canvas 2. There is one viewport canvas in the UI. The already opened part remains clean and displays. |
| PASS | With WebGL2 active, the original cut tool width changes from 4 to 6 mm. Worker volume agrees with the independent rectangular subtraction at 17,840 and 17,760 mm³. A public pointer click selects the current top face. Project Save writes the edited native document. Reload starts healthy WebGPU and project Open restores the exact edited document. The explicit WebGL2 option acquires only WebGL2. |
| PASS | The existing D525 actual recovery flow still replaces a deliberately lost running device, preserves the document and selection through Undo/Redo and retains a newer Open error on a later recovery. Both type checks, Studio focused tests 71/71, driver syntax and diff checks pass. The baseline and final captures were visually reviewed. All desktop flows have zero unexpected console errors and downloads. |
| NOT_RUN | Organic hardware failure, other browsers, startup with both backends unavailable, full suites and mobile. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [#541](https://github.com/barocss/barocss/issues/541) remains open.
