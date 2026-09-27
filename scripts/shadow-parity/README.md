# Shadow parity evidence

The corrected fallback probe rejects both document adoption and document style insertion. It records adoption attempts and requires zero document rules in fallback mode. Shadow-root sheet adoption is left available. This distinguishes fallback initial values from successful document registration.

## Chromium correction for #442

The 2026-09-27 run used Node 22.22.0, existing Playwright core 1.60.0 and Chromium revision 1223 (148.0.7778.96). A fresh esbuild browser bundle was built from runtime source at `32491477e1de6136bdc66b6a87709bc08fb32d07`; this correction changes no runtime source. Bundle SHA-256: `97a9353f96c40fbbfc343d7c91d1e9abc4c5279197584d9cd66c68d823689087`. Exact build/probe commands were preregistered in Issue #442.

`result.chromium.json` records:

| Corpus | Normal shadow | Forced fallback | Document rules in fallback |
| --- | --- | --- | --- |
| Corpus | 372/372 match | 372/372 match | 0 |
| Held-out | 575/575 match | 574/575 match | 0 |

The probe exits **1**, preserving the known fallback failure. `via-[rgb(0_0_255)]/(--o)` computes `background-image: none` under fallback while document mode has a gradient. This is the pre-existing #445 parity defect; #442 does not fix it. The corrected harness exposes it instead of accidentally testing the successful adoption path twice. No non-property document rules were observed. The recorded 28/27 rejected adoption attempts prove that the intended registration failure was exercised.

The existing Firefox/WebKit JSON files are historical measurements from the earlier probe. They were not rerun with both registration routes blocked, and are not evidence of corrected fallback parity. The before-384 JSON is also historical. Keep those records for provenance; do not combine them into a three-engine fallback claim.
