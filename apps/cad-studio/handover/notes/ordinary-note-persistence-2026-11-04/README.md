# D506 — existing plain-paper Note persistence

Five groups and six required Doc/Worker/SVG/text observations pass: public Note creation with text A, edit to B, FIRST Undo A and Redo B, own project Save/Close/reload/Open B, then post-Open edit to C. This is one existing Studio Notes lifecycle, not a CAD React Note export or whole C3 acceptance. No product source changes or runtime reruns occur in this saved review.

The exact 2,092-byte input is D505's actual public ASME save and has no notes. Public creation generates actual ID `n1`, default text `NOTE`, paper position `[20,20]` and no leader. The observed two lines are `Review note A/B/C` and `Line 2`. Height is 3 mm, initial Y offset 2.55 mm and line spacing 5 mm. The separate four-decimal SVG serialization envelope is 0.000050001 mm; it is not a native geometry tolerance or font-quality certificate.

Whole non-drawing Doc, feature history, original dimension/table/weld text and the two current Worker bodies' keys, volumes and centroids remain exact. FIRST Undo/Redo and fresh project Open retain the expected whole document. Independent native captures and physical oracles are **zero**; independent physical geometry is **NOT_RUN**.

One fresh existing named note test passes. Forty-three existing style tests and seven storage tests are reused, together with D494 semantic build/lint/final types at verified current dependency closure. The test adapter selects the existing note test without executing the unrelated PDF or row-loaded thread tests. Exact commands are in qualification.json. The 4,115 saved hash/JSON/XML checks are separate from product tests.

All 15 generic capture labels and 45 JSON/HTML/PNG paths are unique, including the explicit project-Open label; no aggregate receipt is a capture target. Wrapper 1,889 and runner 1,890 source pins remain exact through cleanup and current review. Own PID 42908 is absent, the project namespace is removed and browser/context/server close with zero errors, console errors or downloads. Root viewed the six original required PNGs. That visual PASS does not certify font metrics, raster precision or PDF.

Two preserved saved-auditor stops concern raw-observation filtering and the logical OPFS filename. Their corrections only read the correct saved dialect/artifact. No product runtime or acceptance criterion is changed. D501 and D505 historical custody FAIL remain.

Root's read-only issue review leaves canonical #536 and #540 OPEN, each with eight unchecked parent requirements. No comment or closure is made. Next MAIN work is source-gap inventory before selection; parallel D507 is prepared but NOT_RUN. Core readiness remains NOT_MEASURED; legacy 43% remains frozen. HOLDs and the deferred PDF investigation remain unchanged.

## Evidence

- `actual`: `/tmp/barocss-d506-workflow-run01/receipt.json`, SHA256 `5baba10934ed1f35aa981a9e26a1539edfbb522a6ef1cbd09dbcfa4f5c65d127`.
- `savedReview`: `/tmp/barocss-d506-saved-review01/review.json`, SHA256 `58998861c71996329c24fb795e1a1956e52a6768d08b05a05a3c5ad7c7ed4bac`.
- `rootVisual`: `/tmp/barocss-d506-root-review01/review.json`, SHA256 `1073834df67f299a8a8714e5b5f609e78a0caf4d82d031f5152d53bd3e10fc00`.
- `checks`: `/tmp/barocss-d506-checks01/receipt.json`, SHA256 `18e9bbdea5039f071e297e8d3c4bf6dc53eb1432388a286b783c69bf3e1eb17c`.
- `reuse`: `/tmp/barocss-d506-root-prep01/reuse-checks01.json`, SHA256 `d436b40504daa0764572d2fa9109d13cf40766ef560df81754c1feb45773fe3d`.
- `config`: `/tmp/barocss-d506-driver01/config.json`, SHA256 `d497924bdc36a6d93661f7e9c4ff7f5eb78a7f2c7340ad0a875d9b766d2e9c58`.
- `sourceSeal`: `/tmp/barocss-d506-root-prep01/actual-seal01.json`, SHA256 `6503b73e7f4d3aac4b4a778472e209fa2a334c15bc042c7cf60188cb01f77104`.
- `issues`: `/tmp/barocss-d506-root-issues01.json`, SHA256 `85e305a47d9d25135f2145aa4008f80b62944d482312ff243d859f708b88a5a3`.

## Execution commands

With Node 22.19.0 on PATH, root ran `python3 /tmp/barocss-d506-root-prep01/prepare-checks.py`, `bash /tmp/barocss-d506-root-prep01/run-checks01.sh`, `python3 /tmp/barocss-d506-root-prep01/seal-actual01.py` and `bash /tmp/barocss-d506-root-prep01/run-studio01.sh`. Heavy checks and Studio used the gate serially. Saved review ran `python3 /tmp/barocss-d506-saved-review01/audit03.py` without product replay. No Model test source changed; no extra Model tsc is required.
