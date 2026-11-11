---
work_id: D646
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D646 — Approve an existing through-hole diameter in Studio

P0 automation, B09 follow-up, rows 04, 07 and 16. FULL qualification of the bounded native task and its tool contract. Sol High implemented the geometry admission and native checks. The Studio and CLI use the same Model contract.

The task binds a single ordinary +Z through-hole in a rectangular extrusion to a stated hard millimetre diameter requirement. It checks the stable Hole feature and its cylindrical inner face before and after editing. The submitted value is a diameter. The native Hole stores half that value as its radius. The planner refuses parts that participate in shared assembly hole patterns.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Desktop Studio refuses H1 at planning with `SHARED_HOLE_PATTERN`. It creates no run or offer. The independent fixture has a stable `n2.side0` requirement and shows Ø4 to Ø6 mm. |
| K02 | PASS | Model controls reject the wrong feature or face, inch units, invalid tolerance, blind and patterned holes, wrong submission fields, a radius-shaped value and diameters outside the plate. Altered native outer-face and short-span records fail. |
| K03 | PASS | Studio previews Ø4 to Ø6 mm and a −94.248 mm³ volume change. One explicit approval changes native radius from 2 to 3 mm and keeps the protected occurrence unchanged. A fresh Studio session opens the exact native checkpoint. Current evidence reads Ø6 mm and passes. |
| K04 | PASS | The independent reader binds both native files to the commit and derives volume and centroid from a 40 × 30 × 6 mm plate with a through cylinder centred at (12, 9). The Model native check confirms the same inner cylinder and its full axial span. |
| K05 | PASS | The CLI runs the Studio-generated dimension plan. Studio width and shared-hole height regressions, focused Model and Studio suites, type checks, lint and the Studio build pass. |

The first type check rejected an intentionally malformed test submission at compile time. The runtime refusal test now passes that fixture at the input boundary. The first Studio run found a height label on the diameter plan. The final Studio run uses the dimension label. An intermediate check read the middle dot incorrectly from the captured response. The final check reads the label rendered in Studio. The first width regression lacked its historical checkpoint input. The final regression uses the retained D622 bytes.

[Commands and hashes](qualification.json). Other hole profiles, coordinated shared-pattern changes, live providers, whole kernel suites and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
