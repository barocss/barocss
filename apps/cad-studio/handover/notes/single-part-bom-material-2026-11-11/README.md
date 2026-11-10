---
work_id: D588
artifact_type: standalone-bom-material-repair
status: verified
last_updated: 2026-11-11
---

# D588 — Preserve known standalone BOM material

P0, B09, rows 04, 10 and 16. SMALL repair of an existing output field. [D587](../b09-editable-consumer-2026-11-11/README.md) reproduced the failure on an actual saved plate.

The standalone BOM row previously always carried a null material, even when the body used a known material for its mass. The producer now uses the existing part material resolution and confirms the ID in the library. One known material appears when every body uses it. Mixed, unset and unavailable materials still give an empty aggregate material. Quantity and mass use the existing calculation.

| Check | Result | Evidence |
| --- | --- | --- |
| S01 Same D587 native file | PASS | Actual Studio opens the receipt-bound 20 × 10 × 10 mm plate and shows one part at 5.1 g. Actual stdio MCP returns `al6061`, 5.061 g and the same file bytes. |
| S02 Body override and first Undo | PASS | Actual Studio changes the body to mild steel and shows 14.7 g. First Undo restores the exact native document and 5.1 g. Fresh MCP reads the UI-authored override and returns `steel`, 14.714 g and quantity one. |
| S03 Standalone aggregate control | PASS | Empty, unset, one common brief, mixed overrides, one common override and repeated unavailable ID. The test checks material, quantity and mass. An existing standalone frame control now checks steel. |
| S04 Existing consumers | PASS | 77 Model tests and 21 Studio tests cover assembly, BOM, tool contracts, linked BOM and Drawing. Both type checks and affected lint pass. |

Python independently computes 1874.3362938564082 mm³ from the plate dimensions and through-hole radius. It uses densities of 0.0027 and 0.00785 g/mm³. Raw volume tolerance is 1e−8 mm³. The Studio BOM shows mass at 0.1 g precision. The MCP artifact reports 0.001 g.

- **PASS** — Actual desktop Open, material change, BOM quantity/mass, first Undo, two stdio reads, independent arithmetic, focused tests, syntax, lint and types. Root reviewed the actual steel case.
- **FAIL** — Before the fix, both actual MCP outputs returned null for the material while the numerical checks passed. Early driver attempts exposed a missing source pin and an incorrect assumption of two decimal places in the existing Studio display. The retained baseline run uses the actual one-place display.
- **NOT_RUN** — Whole kernel, broad browser suite, mobile, new export formats and release. B09 v1 remains at 8/9 because the direct CLI sketch authoring case has its own input boundary.

Next is the read-first review for [#2279](https://github.com/barocss/barocss/issues/2279). Map the existing provenance and diagnostic contracts before selecting an actual Studio revision boundary. The issue remains open.

[Commands and evidence custody](qualification.json).
