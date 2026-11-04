# D510 — View-attached leader Note lifecycle

Six public Studio groups pass for the retained D398 two-sheet drawing: create a view-attached leader Note with text A; edit it to B; move Top from S2 to S1; FIRST Undo to S2B and Redo to S1B; own project Save/Close/same-context reload/Open S1B; then move Top back to S2 after Open. This adds no product source, geometry or CAD React Note export.

Seven accepted Docs have fourteen saved observations of both sheets. The Note appears only on the sheet that owns Top. The actual generated ID is n1, paper position is [20,20] mm, and stored Top-local anchor is [14.999999305725101,6.00000084686279] mm. The declared pointer target was [15,6]; its ideal placement at 1e-9 mm is not certified. No coordinate was rewritten or snapped by the driver.

Standard stays absent. Current PLAIN text has height 3.5 mm, first-line offset 2.975 mm and line gap 5 mm. Affine leader endpoint and arrow checks use only the SVG serialization envelope of 0.000050001 mm. The unsigned Open, pre-commit Drawing and first Note commit each contain zero reference signatures. None were added, injected or certified.

The non-Drawing Doc, current Worker values and model history remain unchanged. Authored dimension references/near/place and sheet ownership remain exact. Raw dimension labels 12, 30 and 6 are observations, not an independent dimension value certificate. There are zero native captures and zero physical oracles.

One fresh selected pure sheet-ownership test passes. One existing note test, seven storage tests and D494 build/lint/final Studio/Model types are reused through exact source closures. The saved-only audit passes 2199 Doc/SVG/hash/arithmetic checks; this is not a product test count. Root reviewed nine original PNGs. All 26 generic labels and 78 JSON/HTML/PNG paths are unique. Source maps remain exact through cleanup/root review; PID 88309 is absent, the owned project is removed, resources are closed and errors/downloads are zero.

Empty S2 retains the existing no-view warning after Top moves. The owned filename changes the unauthored title fallback. No issue-free, full C3, standards, PDF, mobile or release claim follows. D501/D505 custody failures, all HOLDs, overall NOT_MEASURED and frozen legacy43 remain unchanged. The first actual run passed without a failed SUT attempt or replay. Parallel D509 remains unadopted source preparation at this checkpoint.

## Evidence and commands

- actual: `/tmp/barocss-d510-leader-workflow-run01/receipt.json` — SHA256 `015cf9172c8e7155cda5ec60912a5e88a22c88431f83b793a1087199ef8a7495`.
- rootReview: `/tmp/barocss-d510-root-review01/review.json` — SHA256 `36f3bf5a1ff01834117127442af1c342ea657fff26a74ef26338efda5b6a952f`.
- savedReview: `/tmp/barocss-d510-publication-prep01/saved-review.json` — SHA256 `a4e6bd8f18614ff625b89fc4744c58e779397f88be52ca68ffe64fe0386f4651`.
- checks: `/tmp/barocss-d510-leader-checks01/receipt.json` — SHA256 `5b828c3a58c17c73c23b17da3dcbc6d5efe6c03b231867baf78a4cc58ac0a9fc`.
- reuse: `/tmp/barocss-d510-leader-rootprep01/reuse-checks01.json` — SHA256 `a94cc84ce7385b337e4927f3e3171602986923bb6331ad305495a69b75bdf89b`.
- config: `/tmp/barocss-d510-leader-driver01/config.json` — SHA256 `5309e07554025c29b00cdef6bbef01741a2370609608a3fbb093a781888ef259`.
- seal: `/tmp/barocss-d510-leader-rootprep01/actual-seal01.json` — SHA256 `e5b6852159a3b5024b270fd5d3f4c4334281cd7d1b1d1f0b66fdd3210576e0dd`.
- input: `/tmp/barocss-d510-leader-driver01/retained-d398-two-sheets.bcad` — SHA256 `9962d4fe41afea65cfb6ebd58493fc26af1d831012e8d7353fdb44883ff922eb`.

```sh
python3 /tmp/barocss-d510-leader-rootprep01/prepare-checks.py
bash /tmp/barocss-d510-leader-rootprep01/run-checks01.sh
python3 /tmp/barocss-d510-leader-rootprep01/seal-actual01.py
bash /tmp/barocss-d510-leader-rootprep01/run-studio01.sh
python3 /tmp/barocss-d510-publication-prep01/audit-saved.py
```

Raw artifacts remain outside Git.

Read-only review leaves #540 open: this one note workflow does not meet all engineering drawing requirements. No issue comment or closure was sent. Next MAIN is the D511 C4 source-availability audit of driven-pattern material propagation and BOM totals; its actual flow is NOT_RUN.
