# D909 — measure the rematch of a missing inner corner reference

2026-11-13 · SMALL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) stays open.

The independently authored R1 inset ring has a signed R0.2 Fillet on `n1.side[e10]|n1.top`. The native Fillet propagates around the inner tangent rim. The sharp 2.5 mm candidate has no e10 side. When Studio opens that candidate with the original signed Fillet still present, it changes the edge to outer `n1.side[e2]|n1.top`, keeps the old signature, marks the rematch in References and evaluates the Fillet on the outer rim before confirmation. The mark and native result survive project Save and fresh Open. Opening the original rounded bytes again gives the original inner-rim Fillet.

| State | Independent volume | Native volume |
| --- | ---: | ---: |
| Rounded, inner Fillet | 533.8137355665644 mm³ | 533.8137355665577 mm³ |
| Sharp, before any Fillet | 1215.6637061435918 mm³ | D908 measured 1215.663706143591 mm³ |
| Sharp, marked rematch to outer Fillet | 1215.180545747084 mm³ | 1215.1805457470857 mm³ |

The independent oracle integrates the square-minus-quarter-disk section around the rim. Moving from the inner wall into the ring increases corner radius, so the curvature term adds to removed material. Moving inward from the outer wall decreases radius, so it subtracts. Both evaluated native solids are strict and their volumes and Worker results meet 1e-7 mm³.

Use the generic marked rematch as the existing contract for ordinary documents. A future associative inset must carry the retired source-side identity and refuse direct references to its retired corners before generic signature matching. Start with the private geometry and identity plan. Live edit admission and persistence need their own verification.

## Results

- **PASS** Actual desktop Studio WebGPU, both strict native quantities, independent review, 92 Model tests, 16 Studio tests, driver syntax and diff checks.
- **FAIL** The first observer overcounted the straight inner perimeter by 4 mm. The second expected a held feature but reproduced a marked rematch with changed geometry. The third checked the exact edge names before opening Technical details.
- **NOT_RUN** An associative topology edit, automatic reference recovery, confirmation, a new retired-ID rule, full suites and mobile.

[Commands, numeric results and receipt hashes](qualification.json).
