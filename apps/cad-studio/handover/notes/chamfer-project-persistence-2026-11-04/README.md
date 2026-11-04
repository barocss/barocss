# D508 — Retained Chamfer project persistence

The five-group public Studio workflow passes for the exact D449 front-top straight-edge Chamfer. This closes only its missing project Save/Open and post-Open edit checks. No product source or geometry algorithm changed.

The 607-byte accepted D449 capture is opened at distance 3 mm. The workflow saves it in a new owned project, closes the project, reloads the same context and opens it. The public Distance field then changes 3 to 2 mm. FIRST Undo restores the exact distance-3 document; Redo restores the exact distance-2 document. No creation, edge repick or refusal workflow is repeated. The retained capture is not claimed as a historical public project Save.

All five groups pass, with two native captures, three exact whole-Doc reuses and five fresh current Worker/physical bindings. Only n2.distance changes. The original nodes, profile constraints, outline, side tags, parent, edge reference/signature, output b2 and nextId remain exact. Distance 3 has volume 31640 mm³ and centroid [20, 171/791, 3919/791] mm. Distance 2 has volume 31840 mm³ and centroid [20, 58/597, 2972/597] mm. Relative volume and absolute centroid/boundary budgets remain 1e-9.

One existing named finishing-limit test passes, with zero failures and skips. Seven storage tests and the D494 semantic build, lint and final Studio/Model types are reused through exact unchanged source closures of 1841 and 1853 pins. These are separate from the public workflow. Full kernel tests are not rerun.

Root reviewed seven original desktop images. The project Open image is cropped. Full viewport fit and raster precision are NOT_MEASURED; no camera cause is assigned. Cleanup confirms current source equality, the owned project removed, PID 8347 absent, all resources closed, and zero errors, console errors or downloads.

High final saved-evidence review passes 185 saved predicates, separate from product tests, without replay. Maximum native/Worker relative volume error is 1.142581283634332e-16 and absolute centroid error is 3.885780586188048e-16 mm. Both physical classes have zero observed optional pcurves; none is synthesized. Root actual PASS does not imply a full Chamfer family, full C2, manufacturing, PDF, mobile or release certificate. D501/D505 custody failures, all HOLDs, overall NOT_MEASURED and frozen legacy43 remain unchanged.

The driver02 observer correction was made before execution: after the same semantic expected-document check, f.same receives the captured actual Doc. There was no failed SUT attempt or workflow replay.

## Evidence and commands

- input: `/tmp/barocss-d449-category-run01/chamfer-edited.bcad` — SHA256 `bff9ee71ea46e2432a186016c8e74d639c15b08803fe388f6a9dd5980059b7bb`.
- originalReceipt: `/tmp/barocss-d449-category-run01/receipt.json` — SHA256 `84ecfb8daf291964a2ef1048be1e461a0521789a30d6d0ff8d3d9ac432c958c2`.
- actual: `/tmp/barocss-d508-chamfer-workflow-run02/receipt.json` — SHA256 `e30975a01742da452c8fb73016383bc8b636d6f2d8f6abcb4228920c0163bd3e`.
- rootReview: `/tmp/barocss-d508-chamfer-root-review01/review.json` — SHA256 `1478a472987d6e88559b534441c3caf9629b8c1ca629a21ed5e56d7e83733104`.
- checks: `/tmp/barocss-d508-chamfer-checks02/receipt.json` — SHA256 `b50b078315bc31e6aecf9517657c335c7b7e0ba69ab2bae6c2da1adb5ee7b6b1`.
- reuse: `/tmp/barocss-d508-chamfer-root-prep02/reuse-checks01.json` — SHA256 `699f7fe94a1cf50a491720d9be1ae46d0ca101b3c08d79aaab93f66531311852`.
- geometryManifest: `/tmp/barocss-d508-chamfer-geometry01/manifest.json` — SHA256 `b697a001325516bd5f0c5d84ccb95b11a6550e29172751a0d0249e16ac15cbeb`.
- config: `/tmp/barocss-d508-chamfer-driver02/config.json` — SHA256 `a342fa06cb706f0572490b2d78f01599983a72593f9601281d5c69c0ceb435c9`.

Root executed:

```sh
python3 /tmp/barocss-d508-chamfer-root-prep02/prepare-checks.py
bash /tmp/barocss-d508-chamfer-root-prep02/run-checks01.sh
python3 /tmp/barocss-d508-chamfer-root-prep02/seal-actual01.py
bash /tmp/barocss-d508-chamfer-root-prep02/run-studio01.sh
```

Raw evidence stays outside Git. Parallel D509 has an unadopted six-component source candidate; its expected 76 tests and future GUI/native/Studio flow are NOT_RUN. The C3 leader Note proposal remains parked and NOT_RUN.

Read-only issue review leaves #536 and the wider fillet/shell/draft issues #2259/#2260/#2261 open. This bounded persistence result meets none of their remaining whole-family completion conditions; no comment or closure was sent. Exact issue-review and High receipt hashes are in qualification.json.
