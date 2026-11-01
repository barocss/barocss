# D394 — Row 11 ①: GD&T completion (CG5 DR-6)

Tier: **full** (drawing document fields and a public API): two audit rounds with mutation and one actual run. [Qualification](qualification.json).

## What it adds

**New callouts**
- Spherical zone **SØ** on position frames.
- Statistical tolerance **ST** in a hexagon.
- Unequal profile **Ⓤ** with its amount.
- **All around** and **all over** on profile frames.
- **Stacked frames**: a second, independent frame drawn directly below.
- **Composite frames** now work for profile, not only position.

**Frame rules**
- Rules both ISO 1101 and ASME Y14.5 agree on. For example, a form tolerance takes no datum, and an orientation tolerance needs one.
- Authoring refuses only a new rule break, so an old frame can still be repaired one field at a time.
- Opening a file never refuses a broken frame. It is reported as FRAME_RULE.
- Datum letters a frame names but the sheet never defines are reported, including those in stacked rows.

**Output**
- The sheet (SVG, PDF and DXF) and the 3D annotation data agree.
- Tolerance numbers show as entered: up to 4 decimals, never rounded to 0.01.

**Round trip**
- Every drawing commit goes through the same reader Open uses, so an authored drawing reopens unchanged. The key-order mismatch fixed here predated this record.

**Editor**
- Shows the common fields.
- Projected height, free state, tangent plane, datum modifiers, ST and unequal sit under a closed Details.

## Audits ([1](review/audit-round1.md), [2](review/audit-round2.md))

**Round 1:** two high defects, two medium, two low, and one wrong display:
- edits next to an old broken frame were refused;
- an old frame with two rule breaks could not be repaired;
- ISO-allowed Ⓜ was refused on symmetry and coaxiality;
- the 3D data disagreed with the sheet;
- SØ was lost on lower rows;
- Ⓣ was accepted with Ø or Ⓟ;
- values were rounded to 0.01.

All were fixed. **Round 2** (targeted) accepted.

## Actual run

[run06](run06/receipt.json) on `bracket.bcad` used real clicks to build a profile frame with all around, a stacked frame and ST. Two rule-breaking changes were refused in words. Undo and Redo worked, and Save followed by a fresh Open gave an equal document.

The independent oracle read the exported SVG [04-sheet.svg](run06/04-sheet.svg) and found:
- two frames, the stacked one directly below the first;
- the ST hexagon;
- the all-around ring.

## Follow-ups

- Tests for the surviving wiring and width mutants.
- Datum target areas and lines (11②).
- The ISO/ASME setting with standard-specific rules (11③).
