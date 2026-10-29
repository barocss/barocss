# D323 project-version normal UI regression

The unchanged existing `CG6 project:` selected flow passed on its first actual run: **1 selected case, 0 failures, 0 skips**, plus **1 starter smoke**, exit 0. Chrome WebGPU/DPR1 used the current worktree with changed `project.ts` hash `a927fd79a0db9be5d5b60f5380f2ad2ac114e4b5c33c0c9f5240da8772a815ad` over baseline `27500e219febc591845cd5e4c53341a24ca9d39b`. Source hashes were rechecked unchanged after execution.

Public UI made First, added a second Box, saved and made Second, compared/restored First, completed native project autosave, reloaded, reopened the project/part and both versions, and restored the offered autosave. Existing assertions checked native part/index/snapshot presence and the actual one/two-body transitions. Direct inspection of the compare PNG confirmed two Boxes with the added Box highlighted; the reopened version-panel PNG showed First and Second with their controls.

This is a normal consumer positive regression for canonical snapshot storage integration. UI-authored documents normally include nextId. It does **not** directly reproduce the rare omitted-nextId API input; that evidence belongs to the separate focused Model/storage API tests.

The existing headless folder picker returns a real native OPFS directory handle. Actual native I/O and project/version App UI run unchanged. This does not test the OS folder dialog or an external folder. Reload uses the same browser context. The existing harness does not export raw native bytes; this record does not claim retained raw-byte equality.

See [raw first-run log](first-run.txt), [receipt](receipt.json), [source profile](actual/source-profile.json), [display](actual/display.json) and actual PNGs under `actual/`. No new harness or runtime source edit was made. The selected flow awaited removal of its own unique OPFS folder; browser/server finally closed and the process exited. Target processes were absent and gate had no holder. No whole suite, additional case, commit or push was performed by this consumer.
