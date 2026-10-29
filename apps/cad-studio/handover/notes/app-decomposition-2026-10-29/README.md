# D327 — App decomposition

App.tsx decreases from 4,012 to 2,308 lines (385,325 to 214,011 bytes). Forty-two modules group file IO, export dialogs, route editing, sketch actions, preview/check controllers, viewport helpers and workspace panels. Central document adoption, work/Open/Save ownership, evaluation, Undo/Redo and Stop remain in App. No schema, dependency or public package API change.

See [source map](source-map.md), [qualification](qualification.json), and the frozen 45-path [runtime provenance](qualification-source/profile.json). Source hashes bind receipts to source; they are not product checksum assertions.

Build (including TypeScript), scoped lint and all Studio tests pass: 429/429, zero skipped. Six route ownership tests are included in 429. Existing 45 console warnings and bundler warnings remain in raw logs. The source-only High review checked the final App hash and ownership boundaries; it did not execute tests.

Actual Chrome/WebGPU selected UI cases: 11 distinct cases pass across preserved runs, plus starter smoke. Separate affected Open regression: 5/5 pass. Coverage includes Sketch reopen/edit, feature editor, holes, STL/3MF/STEP, mesh repair, assembly, URDF/MJCF and Stop. Exact run counts are in qualification.json; repeated starter and setup cases are not added to unique totals. The first combined run and two Sketch reruns failed on driver assumptions/locators; raw failures remain. Final Sketch succeeds after scoping its title. Runtime source is identical across these runs. Root viewed final Sketch, STL and current-model-after-held-Open screenshots.

D321 missing Render-history comparisons are excluded from history acceptance. Other-format/stage A05, A06, native route geometry, pending STL-generation cancellation, whole other-package/browser suites, remote CI and performance are not accepted by this refactor. Existing limitations remain queued. No PR or release.
