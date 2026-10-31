# D388 — Row 10 ②c: selecting a part inside a sub-assembly

Tier: **feature** (one audit, a targeted re-check and an actual run). Owner order "Go to row 10". Issues: #2180; #538 stays open. [Qualification](qualification.json).

## What it does

- **Outliner.** A sub-assembly row expands to show its parts. Selecting one, for example Block B in Sub, selects that part by its path.
- **Viewport.** Only that part's bodies are highlighted. Selecting Sub highlights all of them, as before.
- **Panel.** A read-only card shows Sub › Block B: its path, bodies, volume, definition and placement in Sub, and says how to edit it (through the sub-assembly's definition).
- **Placement actions.** The gizmo, mates and placement actions are not offered. The Render panel's appearance editing is disabled for a part-only selection.
- **Viewport clicks.** These are unchanged: a click still selects the sub-assembly.

## Audit ([audit](review/audit.md), [re-check](review/recheck.md))

**CHANGES_REQUIRED.**
- **Performance.** The viewport repainted every instance on every commit.
- **Render panel.** It styled the whole sub-assembly for a nested selection.
- **Wrong source document.** Paths were read through a different document than the one evaluated, giving a wrong highlight, or an exception if that document's fold was refused.
- **Volume.** An unknown volume was shown as 0.

All were fixed. The re-check returned ACCEPT.

## Verification

- **Tests:** Studio 583/583; model body-origin 4/4. tsc PASS.
- **Actual [run02](run02/receipt.json):** the steps above, with Delete changing nothing. The root reviewed the screenshots: only Block B is lit, then both blocks are.

## Follow-ups

- During re-evaluation the card mixes the current title with the old volume.
- Clicking into a sub-assembly in the viewport is not in v1.
