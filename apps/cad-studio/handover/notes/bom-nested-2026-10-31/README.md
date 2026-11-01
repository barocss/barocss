# D387 — Row 10 ②b: the BOM descends into sub-assemblies

Tier: **feature**. The BOM data gains optional fields; this item had one audit, a targeted re-check and an actual run. Owner order "Go to row 10". Issues: #2180; #538 stays open. [Qualification](qualification.json).

## Before

A sub-assembly's BOM line had mass **0** and its parts were missing. Sub, made of two 10 mm cubes, showed 0 g.

## Now

**BOM data**
- A sub-assembly's line rolls up the mass of its own bodies and of its parts. Each part keeps its own material, and the roll-up is recursive.
- Its parts follow as indented lines, `Sub › Block A ×2`, each carrying its path.
- Totals count each body once.
- Purchase lists count bought items once and merge the same item across levels.

**Fasteners**
- A fastener inside a sub-assembly uses that sub-assembly's rows.

**Drawings**
- Each nested line's balloon sits on that part's own edge.
- The drawing BOM table marks nesting.

**Unchanged**
- Documents without sub-assemblies are byte-identical to before.

## Audit ([audit](review/audit.md), [re-check](review/recheck.md))

**Audit: CHANGES_REQUIRED.**
- **High:** nested balloons pointed at the wrong part.
- **Medium-high:** nested fasteners lost their rows.
- **Medium:** the drawing table showed no nesting.
- **Low:** fastener purchase rows were split, and merging depended on the parts' order.

All of these were fixed. The targeted re-check passed all five.

## Verification

- **Model:** 2309/2309.
- **Studio:** 574/574.
- **Actual [run03](run03/receipt.json):** the BOM panel shows Sub 5.4 g with Block A ×2 indented under it, Pin and the plate, 51.6 g in all. Every value matches the independent oracle, and Save and a fresh Open give the same BOM.

## Follow-ups

- Unknown paths given to setBought are ignored.
- A bought flag set only on a pattern copy's nested part is lost.
- When a sub-assembly has no bodies of its own, its balloon can share a leader tip with another.
- Long nested names are truncated in the panel; the tooltip shows the full name.
