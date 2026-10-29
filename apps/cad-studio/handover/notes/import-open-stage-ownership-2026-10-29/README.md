# D329 — Imported Open and mesh-stage ownership

Late STEP/STL/OBJ/IGES/barocad/DWG work must not replace a newer document, reopen an old question, clear a newer stage or report old success/error. Every asynchronous boundary now checks its captured Open intent, document dispatch and worker session. Direct import success/fit follows successful central admission.

A private mesh controller owns question/task generations. React uses its immutable external-store snapshot. Cancel, unit/step changes, newer questions and Stop revoke old continuations. Stop invalidates work before worker restart, explicitly hands surviving questions to the new owner, and re-evaluates the current document through a stage-only trigger. It preserves Undo/Redo and the existing central D321 Stop path. Accepted fit and unmount boundaries are guarded.

## Verification

Implementation: GPT-6.1 Sol Medium. Source-only ownership review: GPT-6.1 Sol High, including restored Git/source equality. Build/types and scoped production/new-test lint pass. Full Studio: **460 PASS / 0 FAIL / 0 SKIP**, including the31 new tests. Initial real-function regression baseline: **0 PASS / 5 FAIL**. Intermediate23/26 focused passes overlap the final suite. Controller tests defer worker/blob transport; they do not certify geometry or native lifecycle.

Actual Chrome/WebGPU: seven ownership cases pass, each in sequence with its browser/context/server closed before the next. STEP text, STL bytes and barocad text held after native fulfillment cannot overwrite new C. Held actual STEP worker reply cannot overwrite C; Stop restores current readiness and public Undo/Redo. Unit dialogs close on New; diagnosis Stop keeps the original question retryable. Six existing normal flow cases plus separate starter pass in one sequential browser: units, recorded repair, mesh STEP/size controls, unsupported units, solid STEP and direct source tools. This is13 selected cases plus starter, not a whole-browser PASS.

## Preserved first native failure and source drift

The first seven-case batch returned5 PASS / 2 FAIL (Stop readiness timeouts). After the frozen build/test checkpoint, App alone changed to an earlier WIP version with the latest recovery/owner guards missing. Its hash differs from the frozen profile; the writer/cause is UNKNOWN. Root did not edit App during the run. The implementation and reviewer reported no outstanding write command; no other process was modified. Both source versions and the exact diff are retained. First native acceptance is withheld, not merged with the final PASS.

After all first-run browsers closed, root restored only the owned missing App guards from the reviewed capsule and committed the source as a7264f0e5. Other three production files stayed identical. High independently compared all four current files with frozen hashes and Git bytes. The second seven-case batch and normal flow passed with an external source-metadata watcher and final hash checks; no source change was observed. Source hashes bind provenance, not product checksum tests. Existing build/types/460 receipts apply to those exact restored source bytes.

Raw initial type/lint diagnostics, original native failures, source drift and final receipts remain unchanged in this folder. [Qualification](qualification.json) gives precise counts and exclusions. Full other-package/browser suites, remote CI, performance/heap, native IGES/accepted-fit/project negatives and wider A05 paths remain outside this gate. A06 disposal follows. No PR or release.
