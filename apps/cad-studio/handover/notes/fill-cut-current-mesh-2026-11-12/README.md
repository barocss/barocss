# D785 — Verify current GPU buffers after a native cache signature collision

P0 R04, rows 06, 20 and 32. SMALL qualification of the existing cache repair. Desktop Studio opens the exact D784 Fill cut input. The stock remains 60 × 30 × 10 mm with body key `b6`. The original rectangular cut tool changes from 4 mm to 4.000030517578125 mm through the public feature editor. Its six placements remain fixed.

| Result | Check |
| --- | --- |
| PASS | The small edit produces different native position, index and edge-coordinate arrays. The historical signature from the D524 parent is identical for both inputs. The observed arrays have 504 position scalars, 396 indices and 504 edge-coordinate scalars. Bounds, counts and body key are unchanged. |
| PASS | Current Studio creates new surface and edge geometries. The observer binds the current geometries to their real WebGPU position, normal, index and line buffers. It checks the full position and normal writes, index bytes with alignment padding, and all packed line coordinates. The changed buffers match the current inputs. Native Worker volume agrees with stock minus six cuts at each width. |
| PASS | A coarse edit to 6 mm moves the original top rim from X12 to X14. In Edges selection, public pointer clicks hit the current 4 mm rim and miss the other location before and after the edit. Both positive picks resolve to the exact expected endpoints. Undo and Redo restore the matching input arrays and upload the matching geometry. |
| PASS | Actual desktop has nine snapshots, five checked upload states, and 34 observed vertex/index writes through Redo. Source pins remain equal through cleanup. The focused Studio tests pass 47/47, both type checks pass, and the driver, observer syntax and diff checks pass. Three original images were reviewed. |
| FAIL | None in the current run. The signature collision is an observed input condition of the historical decision function. |
| NOT_RUN | Old renderer execution on this fixture, native normal-only or edge-only edits under an equal signature, GPU memory readback, placed instances, full suites and mobile. D524 retains the separate controlled buffer-change and unchanged-input reuse checks. |

[Commands and receipt digests](qualification.json). No product source changed. This establishes the historical signature collision for one native Studio operation. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
