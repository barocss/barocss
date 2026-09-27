# Shadow parity evidence

The corrected fallback probe rejects both document adoption and document style insertion. It records adoption attempts and requires zero document rules in fallback mode. Shadow-root sheet adoption is left available. This distinguishes fallback initial values from successful document registration.

## Chromium correction for #442

The 2026-09-27 run used Node 22.22.0, existing Playwright core 1.60.0 and Chromium revision 1223 (148.0.7778.96). A fresh esbuild browser bundle was built from runtime source at `32491477e1de6136bdc66b6a87709bc08fb32d07`; this correction changes no runtime source. Bundle SHA-256: `97a9353f96c40fbbfc343d7c91d1e9abc4c5279197584d9cd66c68d823689087`. Exact build/probe commands were preregistered in Issue #442.

The earlier #442 result (before the #445 fix) recorded:

| Corpus | Normal shadow | Forced fallback | Document rules in fallback |
| --- | --- | --- | --- |
| Corpus | 372/372 match | 372/372 match | 0 |
| Held-out | 575/575 match | 574/575 match | 0 |

The #445 patch gives the unregistered fallback gradient stop an explicit transparent value when its alpha variable is unset. A fresh branch build now exits **0**: normal shadow and forced fallback both match the document for all 372 corpus and 575 held-out classes. The runner asserts the regression token remains in the held-out corpus, that the fallback attempted document registration, and that no document rules were inserted. Registered-property behavior remains at 575/575.


The existing Firefox/WebKit JSON files are historical measurements from the earlier probe. They were not rerun with both registration routes blocked, and are not evidence of corrected fallback parity. The before-384 JSON is also historical. Keep those records for provenance; do not combine them into a three-engine fallback claim.
