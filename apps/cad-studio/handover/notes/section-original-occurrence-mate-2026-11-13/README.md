# D1014 — qualify Mate on original Section occurrence faces

2026-11-13 · SMALL · P0 rows 05, 15, 16 and 20 · [#2446](https://github.com/barocss/barocss/issues/2446)

- **PASS** In desktop WebGPU Studio, Section across X at 25 mm exposes caps on two placed copies of the same rectangular part. Clicking the cap on Plate B selects the occurrence and offers no Mate face. This preserves the empty draft and later the pending first face on Plate A.
- **PASS** Click the two retained top faces to create one coincident mate. The saved references are `plate-a/n1.top` and `plate-b/n1.top`, preserving the distinct occurrence IDs. Grounded Plate A stays at [0, 0, 5] mm. Plate B moves from Z = 0 to Z = 5 mm and the local top faces align at Z = 17 mm. The part definitions remain unchanged.
- **PASS** Visual review, 29 focused Studio tests, driver syntax and diff check. The existing occurrence pick path passes this case with no production changes.
- **FAIL** None.
- **NOT_RUN** Preselected vertex Measure, clipped edge Measure, Zebra seam, nested placements, WebGL2, production build, type-checks, full suites and mobile.

Desktop QA remains 7/54 while the linked checklist failures are reviewed. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
