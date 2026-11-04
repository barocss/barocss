---
work_id: D513
artifact_type: bounded-defect-fix
status: done
last_updated: 2026-11-04
---

# D513 — Keep nested selection metadata and quantities current

A nested card could show a new name and placement with an old evaluated volume during revision Undo/Redo. The original public Studio control records nine mixed samples in 88 recognized samples. Its runner PASS means the defect was observed; product correctness was FAIL.

The card now reads the displayed document (`shownDoc`). App admits an evaluated entry only when its source key and placement match that displayed context. The internal card requires an explicit freshness flag. A stale entry shows pending and does not attribute old faces or publish old quantities. Semantic clones remain valid; object reference equality is not required. No Model API, geometry, schema or tolerance changes.

Root ran the same public revision / FIRST Undo / Redo trigger with the same read-only MutationObserver and animation-frame criteria. The fixed tape has **87 recognized samples, zero mixed samples, six pending samples**, zero unclassified samples and no overflow. Both A and B occur and settle. Pending is OBSERVED, not inferred from screenshots. Settled volumes are the actual UI literals 1000 and 2000 mm³; no independent B physical certificate follows.

All 13 affected tests pass (nine retained, four new), with no failures or skips. Scoped lint, fresh Studio types, final Model types after the last test edit, and diff checks pass. Root reviewed three original fixed images. All 1686 frozen helper inputs remain exact through cleanup and image review; owned context, browser and server close. Zero new native captures or physical oracles; only exact A's physical subproof and 466 unchanged native producer inputs are reused. Raw placed Worker V/C remains unavailable.

Tier SMALL; priority C4, rows 10/16. Implementation and tests used GPT-6.1 Sol Medium; root ran Studio and reviewed images. Preserve the original pure-run exact-integer observer assertion and its saved-only numerical qualification. Do not replay passing original product evaluations. #538 remains OPEN because broader assembly acceptance is unmet; no issue write or closure.

## Commands and evidence

```sh
python3 /tmp/barocss-d513-check-prep01/prepare-after-adoption.py
bash /tmp/barocss-d513-check-prep01/run-checks01.sh
python3 /tmp/barocss-d513-studio-prep02/seal-fixed01.py
bash /tmp/barocss-d513-studio-prep02/run-fixed01.sh
```

- originalStudio: `/tmp/barocss-d513-studio-original-run01/receipt.json`, SHA256 `cc35681a6ccb242e56a74345744952486d431783477e9bac7066258e753c189d`.
- originalSavedReview: `/tmp/barocss-d513-studio-original-saved01/qualification.json`, SHA256 `d1e56f83269609c56bc8429deb3037a63cfe24891867696bf70e2e5d8bf7216a`.
- checks: `/tmp/barocss-d513-checks01/receipt.json`, SHA256 `a0f083cee31a91e3e6f2331277e23c99ee47a66b0fae0db27197d7023766cfc5`.
- fixedStudio: `/tmp/barocss-d513-studio-fixed-run01/receipt.json`, SHA256 `b4bdafa802b7a7c19fbcaea061e83847c05928bb6280c5ac9ee4bfaf9096a13f`.
- fixedClassification: `/tmp/barocss-d513-studio-fixed-run01/03-observer-classification-before-expectations.json`, SHA256 `b39bedbb125c7e7254a112297b1dcfbfe81d6293e51887d860c28bf32e12d193`.
- rootReview: `/tmp/barocss-d514-root/d513-actual-root-review.json`, SHA256 `f2db3fcd541d89f8ab69bbfff715621d9be8f5543775b16f5c2f9bde4ff2fefb`.
- fixedConfig: `/tmp/barocss-d513-studio-driver02/config.json`, SHA256 `555575bde315785cb7e05d0afc241fdda565e3fe211daa95e21cd18674e2ca7b`.


Evidence stays outside Git. The parent moved D513/D514 ahead of unfinished parallel D509 documentation after all D509 actuals closed. Its 33 inherited paths and historical full source maps are preserved. D509 source reconciliation/docs/preview are NOT_RUN; those historical full maps are not claimed current after App/renderer changes.

Core completion remains NOT_MEASURED, the global denominator UNENUMERATED and legacy 43% frozen. D514 is the separate owner-selected native-edge display correction; nested in-place editing, held UI redesign and other HOLDs remain separate.
