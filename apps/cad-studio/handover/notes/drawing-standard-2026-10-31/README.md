# D396 — Row 11 ③a: ISO / ASME drawing standard (CG5 DR-7)

Tier: **full**, because this adds a drawing document field and a public API. Two audit rounds with mutation and one actual run. [Qualification](qualification.json).

## What it adds

**A Standard setting**
- A new select under the drawing sheet settings: Not set, ISO or ASME. It is also available through the chat `set_drawing` tool and the facade.
- **Not set** draws exactly as before. The auditor compared 91 outputs across 11 fixtures and found them byte-identical.

**What each standard changes**
- **ISO:** 3.5 mm lettering and 15° arrowheads (3 × 0.8). Dimension text is aligned above the dimension line, and line datum targets are drawn ISO 5459 style.
- **ASME:** 3 mm lettering and 3:1 arrowheads (3 × 1). Dimension text is horizontal, inside a break of the dimension line, or beside the line when it does not fit. Concentricity and symmetry raise a warning, since Y14.5-2018 removed them.
- **Both:** a projection symbol in the ISO 5456-2 form, sized by the lettering. Metric numbers keep their leading zero and drop trailing zeros.

**Implementation:** the preset is passed as an explicit parameter everywhere; there is no hidden module state.

## Audits ([1](review/audit-round1.md), [2](review/audit-round2.md))

**Round 1** found two medium findings and several low ones. The mediums:
- the module-level preset was read by paths that never set it;
- the agent could not set the standard.

All are fixed, except the DXF header, which belongs to the kernel lane and is recorded as a follow-up.

**Round 2** (targeted) accepted. Afterwards the root restored two words the description shortening had dropped, and added the word "standard" to the description.

## Actual run

[run03](run03/receipt.json) on `bracket.bcad` auto-dimensioned the part, switched between ASME, ISO and Not set, used Undo/Redo, saved and did a fresh Open. The oracle checked [ASME](run03/02-asme.svg) and [ISO](run03/04-iso.svg) for:
- text heights and rotation;
- arrowhead proportions;
- projection symbols;
- the unset sheet staying identical.

## Follow-ups

- The DXF DIMSTYLE header (kernel lane).
- Under ASME, 2.5 mm view names and tables fall below the 3 mm minimum.
- Inch display and dual dimensions (11③b).
