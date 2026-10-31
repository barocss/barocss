# D397 — Row 11 ③b: inch display and dual dimensions (CG5 DR-7)

Tier: **full**: drawing document fields, a public API and printed numbers. Three audit rounds with mutation and property probes, plus one actual run. [Qualification](qualification.json).

## What it adds

**Settings**
- Drawing **units** can be mm or inch. This is display only: the model stays in mm.
- **Dual units** prints the other unit in brackets after the value, for example `1.181 [30]`.
- The decimal places for each unit can be set under Details.
- The UNITS cell in the title block follows the setting.

**Inch format**
- Inch values follow ASME: no leading zero, and zeros kept to the precision (`.500`).

**Tolerances**
- A dimension with a tolerance prints limits that always lie inside the true zone.
- The nominal is rounded first. The deviations are then rounded inward relative to it.
- Decimals are added as needed so that no tolerance prints as zero and the zone keeps at least 80% of its width. If that is not possible, a warning is raised.
- The nominal and the tolerance print at the same decimals.
- Plain mm tolerances now print as entered. Before, they were rounded to 0.01, so ±0.125 showed as ±0.13, a wider zone.

**What converts**
- Fits keep their designation.
- GD&T zone widths round down and projected heights round up.
- Weld sizes, hole callouts, datum target sizes and table columns convert.
- A dual text that does not fit between the arrowheads is lifted clear.

## Audits ([1](review/audit-round1.md), [2](review/audit-round2.md), [3](review/audit-round3.md))

- **Round 1:** found wrong numbers. Tolerances, frame values and fit deviations printed as zero or wider than the true zone. Weld sizes were unconverted. The root found dual text running over an arrowhead.
- **Round 2:** printed limits still fell outside the true zone in 27–40% of 20k random cases, because the nominal's rounding was not included. Fits mixed their decimals.
- **Round 3 (targeted):** ACCEPT, with 0 outside in the auditor's own 20k-case probes for every setting.

## Actual run

[run03](run03/receipt.json) on `bracket.bcad` switched units to inch, turned on dual, set two inch decimals, used Undo/Redo, then Save and a fresh Open. The oracle checked the exported texts against its own arithmetic:
- inch: `1.181`;
- dual: `1.181 [30]`;
- two decimals: `1.18 [30]`.

It also checked the UNITS cell.

## Follow-ups

- A zero-width zone prints an inverted pair in inch.
- Non-dual short dimensions can still touch their arrowheads (kernel DXF fixture).
- The chat hint does not list the new settings.
