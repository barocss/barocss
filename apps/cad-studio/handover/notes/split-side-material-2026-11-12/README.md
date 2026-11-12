# D789 — Keep the negative Split body's material and visibility through Move

P1, rows 08, 12 and 16. SMALL fix to Model look ownership. D788 verified the authored positive-side Move and native geometry. This driver opens one existing Split at X24 on 60 × 30 × 10 mm stock and assigns mild steel to the negative body and ABS to the positive body using the inspector. It then moves only the negative body by +40 mm in Y.

| Result | Check |
| --- | --- |
| FAIL | Before the fix, the accepted Move retained the negative reference and both stored look entries. Look resolution gave both bodies ABS, reduced displayed BOM mass from 67.8 g to 18.7 g and hid both bodies when the user hid only the moved body. The first driver attempt also missed the collapsed Inspect group. The corrected driver opens the group through its public control. |
| PASS | Model keeps the negative side's existing look key when a downstream feature follows that body. The positive side keeps the original root key. The same lookup supplies definition, occurrence target and available-key resolution. The document uses its existing keys. |
| PASS | After the fix, Studio retains steel and ABS and shows 67.8 g. Hiding the moved body hides only that body. Undo/Redo of Hide and Move restore the exact documents. Project Save writes 1,212 bytes. Reload and Open restore that document and its distinct visibility. A real click picks the visible ABS body and misses the hidden steel body. Show makes the steel body pickable again. |
| PASS | Editing the reopened Split from X24 to X30 preserves the exact material ownership and yields 80 g in the current BOM. An independent rectangular-volume calculation at 1e-8 mm³ and the existing 7.85/1.04 g/cm³ catalog densities predict 67.752 g and 80.01 g. The comparisons use the BOM's display precision. |
| PASS | Driver syntax, both type checks and 47/47 focused Model tests. The focused occurrence regression verifies both keys through an additional placement transform. Visual review covers the hidden, reshown and edited desktop states. No browser errors or downloads in the passing run. |
| NOT_RUN | Full suites, mobile, other browsers, nested Split lineage, automatic attribution of already misassigned legacy looks and placed-assembly browser qualification. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The core parametric and linked-property issues retain broader acceptance. [#534](https://github.com/barocss/barocss/issues/534), [#2233](https://github.com/barocss/barocss/issues/2233).
