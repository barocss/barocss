---
work_id: D512
artifact_type: existing-workflow-qualification
status: done
last_updated: 2026-11-04
---

# D512 — Nested selection and BOM across a retained revision

The first integrated Studio run passes both declared groups: open captured D384 mated A and select Block B with a fresh BOM; then accept the exact old parent revision B and reselect the same nested path with a fresh BOM. Two accepted Docs have two current native captures and two fresh consumer bindings, with no native reuse. No product or test source changes. The existing Undo/Redo/Save chain is not replayed.

The selected path stays sub1/p2, while its card placement changes from [20,0,0] to [20,0,5] mm. Native current folded face mapping changes n3.top to n4.top; the mate retains sub1/p2/n1.top. Block B's volume stays 1000 mm³, so that equal scalar alone does not prove freshness. Its selected native world centroid changes [25,5,5] to [25,5,10] mm. Root, selected Block B and Pin use the unchanged 1e-9 box-proof budgets. B Block A's existing rounded Hole is captured raw with strict diagnostics only. Ideal-circle geometry and independent B aggregate mass precision remain NOT_MEASURED.

Fresh public BOM changes one nested quantity-2 row to two quantity-1 rows. Totals 51.6 g and 51.3 g are literal UI observations, not independent aggregate mass certificates. The current exact full Doc, native fold ownership and settled public card/BOM context are bound separately. Raw nested evaluated-entry identity, placed Worker V/C and a selected render-owner hook are unavailable; none is invented.

Five selected existing tests pass (two Model, three Studio), with zero failures/skips. Seven storage tests and D494 semantic build, lint and final Studio/Model types are reused through exact source closures. Root reviewed five original PNGs and confirmed ten unique labels/thirty JSON/HTML/PNG paths, 1940 wrapper/1941 frozen helper pins, PID 12928 absent and owned resource cleanup. All 33 inherited D509 paths remain unchanged.

The selected path and full card placement are visible, and Block B and Pin visibly move up. BOM names are ellipsized; complete names are retained in the original DOM/title records only. Part of the base is under the palette. Full viewport fit and raster precision remain NOT_MEASURED. This settled-state result does not claim to fix D388's transient title/old-volume follow-up.

High final saved-only review passes 38,953 predicates with zero failures; exact Fraction volume/centroid residuals are zero. These are saved-data predicates, separate from product tests.

## Evidence and commands

- actual: `/tmp/barocss-d512-nested-workflow-run01/receipt.json` — SHA256 `8c2a63b6469158640e7f2511da10abb7ee38dc3ca74c0c4ca14d575f7f290fa9`.
- rootReview: `/tmp/barocss-d512-root-review01/review.json` — SHA256 `f0349fb7e1a361ddc1c4ba96ef08873eba77169520a9975c056f2949cee1b7f9`.
- checks: `/tmp/barocss-d512-nested-checks01/receipt.json` — SHA256 `3d2f3e0687f48adcf4b1639e478f9192b8b0154491dd7215b17b6aaf2355e183`.
- reuse: `/tmp/barocss-d512-nested-rootprep01/reuse-checks01.json` — SHA256 `9f5a855643b066fb5c78ad9b3a6f4d28546e318e24dbd539abf977f72896d903`.
- geometryManifest: `/tmp/barocss-d512-geometry01/manifest.json` — SHA256 `b221b8dbfc127c7a03ff161d196373ad91120e568dacb8a0458dabf335325235`.
- config: `/tmp/barocss-d512-nested-driver01/config.json` — SHA256 `97c0eb0825581a61c8438ecc3ea005d77631c1180bafe868855255335b4d1b06`.
- actualAExtraction: `/tmp/barocss-d512-nested-driver01/retained-mated-A.bcad` — SHA256 `77c4daf02bf758f02407411d3b3a95b9b2f3369fee335b7f73ab5b36b010cfbc`.
- oldRevisionBExtraction: `/tmp/barocss-d512-nested-driver01/nested-mate-rev-b.bcad` — SHA256 `8fbec7c767aed1b54a5a97f874c81c98af2af539cd371374fa6b0c66537cf249`.

```sh
python3 /tmp/barocss-d512-nested-rootprep01/prepare-checks.py
bash /tmp/barocss-d512-nested-rootprep01/run-checks01.sh
python3 /tmp/barocss-d512-nested-rootprep01/seal-actual01.py
bash /tmp/barocss-d512-nested-rootprep01/run-studio01.sh
```

Input files preserve actual old receipt content with a new TMP serialization; they are not claimed as retained old public Save bytes. Raw evidence remains outside Git. Next MAIN is not selected; source-gap audit only after this close.

Final High: `/tmp/barocss-d512-high-final01/final-summary02.json`, SHA256 `86a8e148e13f66f052f77a13951dc205946b5e707325085c3a0d92be09991144`. Maximum native volume error is 3.64e-12 mm³, centroid error 3.56e-15 mm and mass error 1.43e-14 g. Complete pcurve/carrier/bounds error is zero. These bounds apply to the declared native boxes only.

Priority C4, primary row10 and related rows12/16. Tier small: no product/test/API/kernel changes. Source/test preparation used GPT-6.1 Sol Medium; geometry/saved review used GPT-6.1 Sol High. Root ran Studio and reviewed five original images. #2180 is already CLOSED as research; #538 remains OPEN with broader acceptance unmet. No issue comment, close or reopen was sent.

D509 CAD React is separate WIP: GUI/native bounded validation passes; Studio/aux/docs remain NOT_RUN. No CAD React source is included in this publication.
