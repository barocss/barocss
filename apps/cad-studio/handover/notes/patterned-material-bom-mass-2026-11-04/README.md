---
work_id: D511
artifact_type: existing-workflow-qualification
status: done
last_updated: 2026-11-04
---

# D511 — Patterned material and BOM mass

The first integrated public Studio run passes all five declared groups: retained D490 H14 availability; seed Material changed to steel and propagated to all four instances; FIRST Undo and Redo; own project Save/Close/reload/Open; and post-Open Reset material to the definition. Six accepted Docs use two whole-Doc native captures and four exact reuses. No product or test source changes, construction, source revision replay or geometry admission.

Each binding freshly closes/opens BOM and retains actual public controls before checks. Cube Qty 4 and base b1 Qty 1 remain separate; total placed-part count is 4. Default mass is 118.8 g. Steel copies plus the unchanged base total 147.64 g, displayed 147.6 g. Public rounding has a separate 0.05 g envelope. Native volume/material-mass/centroid/bounds proof retains 1e-9 budgets. Existing default al6061 and steel densities 2.7/7.85 g/cm³ are library estimates, not material-standard certification.

The three driven material controls are disabled and follow the seed. Their settled public Volume 1400 mm³ is rounded UI evidence. The existing Worker hook exposes root V/C only. Raw placed Worker V/C, BOM per-row mass/centroid and a raw BOM Worker payload remain unavailable/NOT_MEASURED; no field or hook was added.

Three selected existing material/pattern/freshness tests pass with zero failures/skips. Seven storage tests and D494 semantic build, lint and final Studio/Model types are reused at exact source closure. Root reviewed nine original PNGs and confirmed 44 unique generic labels / 132 JSON/HTML/PNG paths, 1943 wrapper / 1944 frozen helper pins, owned cleanup and zero errors/downloads. All 33 inherited D509 paths remain unchanged.

All four cubes are visible in reviewed BOM views. The tool palette covers part of the base. The seed Material row is below the screenshot viewport, while its public action and exact DOM controls are retained. Full fit and raster precision remain NOT_MEASURED.

High final saved-only review passes 247,494 hash/geometry/exact-arithmetic predicates with zero failures. These are saved-data checks, separate from the three product tests. Maximum native mass error is 1.78e-15 g and centroid error 1.43e-14 mm. Exact original-loop Fraction volume/centroid residuals are zero. The original audit sidecar-reader stop is retained; corrected audit02 changes only the saved observer, without SUT/native/oracle replay. A post-run summary reader's integer/list TypeError was corrected without product/native/oracle replay; the actual workflow itself passed first try. D501/D505 custody failures, core NOT_MEASURED, frozen legacy43 and all HOLDs stay unchanged.

## Evidence and commands

- actual: `/tmp/barocss-d511-material-workflow-run01/receipt.json` — SHA256 `b7384fc792afca7d5a1045faa4ecf741cba0dc3f6563549f9145dd92fbcb9d74`.
- rootReview: `/tmp/barocss-d511-root01/root-review.json` — SHA256 `0a098c1e5cd62035337e2f5d59a5f9ff1a10113c372e1f95b29d3af7f0510010`.
- checks: `/tmp/barocss-d511-material-checks01/receipt.json` — SHA256 `d1a22eae46d2aeb9bef084eb7c392ea42a37bf72eacb764a6a6b5d666d53fdc5`.
- reuse: `/tmp/barocss-d511-material-rootprep01/reuse-checks01.json` — SHA256 `cac5c9ddc460e2c366c292d17043f0c99a2646d5bfe5d7f23bf04c54046bc2f2`.
- geometryManifest: `/tmp/barocss-d511-geometry01/manifest.json` — SHA256 `48db598bc0bb5a80e24247711d150db793cc6376a1a2ecc12519c5396f6817d3`.
- config: `/tmp/barocss-d511-material-driver01/config.json` — SHA256 `e852ca2dff2fe02ab24e2db76cc41d8627a92a3c2d28224a0e3d4f8284e6cdd5`.
- sourceInput: `/tmp/barocss-d511-material-driver01/retained-d490-source-H14.bcad` — SHA256 `3ace5ca3ba8ec449ce97e50abebd8d70d7cadd5eb328379cda98b9e620200595`.
- assemblyInput: `/tmp/barocss-d511-material-driver01/retained-d490-assembly-H14.bcad` — SHA256 `1b64f056276789d59db3f06e0af39f568e684e50ed63010b3f5cf81015ace646`.

```sh
python3 /tmp/barocss-d511-material-rootprep01/prepare-checks.py
bash /tmp/barocss-d511-material-rootprep01/run-checks01.sh
python3 /tmp/barocss-d511-material-rootprep01/seal-actual01.py
bash /tmp/barocss-d511-material-rootprep01/run-studio01.sh
```

Raw evidence remains outside Git.

High final: `/tmp/barocss-d511-high-final01/final-summary.json`, SHA256 `6b6eeaa007e364506b752fb1147f948dba07ed8e1e1a34fa24be603eee4b1ecb`. Parent #538 and research #2233 remain open; this one workflow does not meet their broader acceptance. Core readiness remains NOT_MEASURED.

Priority C4; primary row10, related rows12/16. Validation tier small: no product/test/API/kernel source changes. Source/test preparation used GPT-6.1 Sol Medium; geometry and saved-data review used GPT-6.1 Sol High. Root executed the actual Studio flow and viewed the nine original images.

Parallel D509 CAD React source is applied in 33 preserved uncommitted paths; focused76 unique tests/types/lint and4semantic mutants pass. Its GUI/native/Studio/docs actuals remain NOT_RUN at this D511 checkpoint.

Saved review commands: `python3 /tmp/barocss-d511-root01/review-actual.py` and `python3 /tmp/barocss-d511-high-final01/audit-saved02.py`.
