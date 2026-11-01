# D395 — Row 11 ②: line and area datum targets (CG5 DR-6)

Tier: **full**, because this adds drawing document fields and a public API. It went through two audit rounds with mutation and one actual run. [Qualification](qualification.json).

## What it adds

- **Target kinds.** Datum targets can now be lines and areas as well as points.
  - An **area** is a circle Ø d or a rectangle w × h. It is drawn as a phantom outline with 45° hatching, and its leader ends at a dot.
  - A **line** is a single phantom line in the direct view (ASME Y14.5).
- **Symbol.** The datum target symbol shows the area size above its split line ("Ø4", "6×4") and the letter and number below it.
- **Moveable targets.** A moveable point target uses the ASME symbol: the circle drawn out to a point by two tangent lines, with the point facing away from the leader.
- **Warning.** A line or area target that falls outside the part in its view is now reported. Before, it went stale silently.
- **Outputs.** The sheet SVG, PDF and DXF agree with each other and with the 3D annotation data. DXF gets a PHANTOM linetype only when it is used.
- **Studio.** The Datum targets section gains Kind, area shape and size. To place a target, you click in a view: two ends for a line, the centre for an area. Moveable sits under Details.
- **Chat.** The chat schema is now per kind. The shared chat validator understands `const`, `not`, `oneOf`, `minimum` and `maximum` without false double matches.

## Audits ([1](review/audit-round1.md), [2](review/audit-round2.md))

**Round 1** had two medium findings and several low ones:
- stale line and area targets were not reported;
- the moveable symbol was not in the ASME form;
- the line target mixed ASME and ISO conventions;
- the schema was looser than the checker;
- some tests were missing.

All were fixed.

**Round 2** verified the fixes, including the moveable symbol at 84 leader angles. It found one regression: the validator ignored `const`, so it refused valid drawing scopes. That was fixed, and the root checked it.

## Actual run

[run04](run04/receipt.json) on `bracket.bcad` placed an area target and a line target with real clicks, then did Undo/Redo, Save and a fresh Open. The oracle checked the exported [SVG](run04/05-sheet.svg): the hatching sits inside the phantom circle, the line target has no X marks, and the symbols carry their texts.

## Limits

- The outside check uses the view's box, not its silhouette.
- Line and area targets do not follow geometry.
- ISO variants wait for the 11③ standard setting.
