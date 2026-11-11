# D694 — Verify a two-axis occurrence rotation in Studio 3MF

P2 B07, rows 10 and 13. Parent `fd1f6ca99fe3a351c25219260aace015ff973fe1`. SMALL verification-only change. [D688](../three-mf-shown-variant-2026-11-11/README.md) covers variant geometry and translation. This case uses the public Instance rotation fields and a 4 × 3 × 2 mm cap with a nonzero translation. The writer and placement code stay the same.

## Actual desktop Studio

**PASS.** Open the static assembly in Chrome WebGPU at 1440 × 900. Select Cap in the Browser. The base is 30 × 12 × 6 mm. Cap starts at [10, 2, 8] mm. Export the initial assembly through the toolbar. Enter X=90° and Z=30° in the Instance panel. Studio applies the turns in X–Y–Z order before translating the result.

Hold the genuine placed reply after the Z edit. The accepted source already shows both rotations. Export 3MF while the placed mesh is pending. Studio displays “Not written yet” and creates zero new Blobs. Release the original Worker message and export again. Use the first Undo and Redo of the Z edit. Export each result. Every export retains the exact accepted document.

| State | Cap world bounds in mm | Signed mesh volume in mm³ | Source revision |
| --- | --- | ---: | --- |
| Initial | [10, 2, 8] to [14, 5, 10] | 24 | `876a1eb5d183020a` |
| X=90°, Z=30° | [10, 0.2679492, 8] to [14.464102, 4, 11] | 24.0000026603754 | `2552d22d713d318d` |
| Undo Z | [10, 0, 8] to [14, 2, 11] | 24 | `ee0d58604b4666ac` |
| Redo Z | [10, 0.2679492, 8] to [14.464102, 4, 11] | 24.0000026603754 | `2552d22d713d318d` |

The independent Python ZIP/XML reader verifies eight unique cap corners from the analytic map `(x,y,z) → (10 + √3·x/2 + z/2, 2 + x/2 − √3·z/2, 8 + y)` for the two-axis state. The corner tolerance is 1e-6 mm. Its rotated cap signed volume differs from 24 mm³ by less than 1e-5 mm³. Each file has two objects and build items, 24 triangles with paired directed edges, world coordinates in mm and no build transforms. The base stays unchanged. The hidden decoy is absent, and the cap retains the Steel (mild) and `#D08036` occurrence overrides. Each success notice states the editable and assembly losses. Redo matches the rotated export in canonical package content after excluding per-export UUIDs and ZIP timestamps.

## Verification

Use Node 22.19.0 and the existing `PW_DIR` and `CHROME`. Run one heavy job at a time through `gate.sh acquire heavy 180 <label>`.

- **PASS.** From Studio run `D694_SOURCE_FROZEN=1 node test/three-mf-variant-browser.mjs "$EVIDENCE" --rotated-occurrence`. Receipt SHA-256 `5726c60c95de8e2e1d00dbcb5b396dfd996166763b3848ddc03ccb6ba6f333e5`. Reviewed all five screenshots. All 327 frozen paths matched through cleanup.
- **PASS.** `D690_SOURCE_FROZEN=1 node test/three-mf-variant-browser.mjs "$REGRESSION" --loss-report` covers Master, Tall, restoration, pending-placement refusal and the standalone part. Receipt SHA-256 `283a4605db47438a0839c57a95bf18ab66e84e0caa9c39815ab38da9dbb6233a`. All 326 frozen paths matched through cleanup. Browser downloads, page errors, console errors and watched source changes were zero in both runs.
- **PASS.** `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test three-mf-export-ownership assembly-linked-faces` passed 23/23. `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test threemf instance-looks o11-variability` passed 36/36. Driver syntax, scoped ESLint, Studio and final Model type checks, and Git whitespace passed.
- **FAIL.** None in the selected checks. **NOT_RUN.** Browser-managed download, third-party slicer, other placement profiles, full suites and whole B07 acceptance. Studio has no supported 3MF Open.

Next D695 verifies that 3MF compression completing after a document switch cannot publish the old file or an old notice. Use that result with the [D689 matrix](../stl-assembly-loss-2026-11-11/README.md) to adjudicate B07. [#539](https://github.com/barocss/barocss/issues/539) and [#2425](https://github.com/barocss/barocss/issues/2425) stay open.
