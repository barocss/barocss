# D380 — Row 20 ④ ⑥: a value box at the handle; Enter applies, Esc cancels

Tier: **feature** (one independent audit and one actual run). Owner order "Go to 20/21", 2026-10-31. [Qualification](qualification.json), [audit](review/independent-audit.md).

## Before

Enter already applied a handle drag, Esc cancelled it, and letting go alone did not apply it. That matches the owner's reference CAD, so letting go still does not apply. Two things were missing:
- **④** Nothing on screen said the result was only a preview.
- **⑥** There was no box at the handle to type a value.

## Change

When a dimension arrow is let go, a small box appears beside its tip: the label, the value, the unit, and "Preview · Enter applies · Esc cancels" ([HandleValueBox](../../../src/viewport/HandleValueBox.tsx)).
- **Same value as the HUD.** The box edits the value the HUD shows, and either one follows the other.
- **Placement.** The box sits right of and below the tip, and moves left of or above it at the viewport's edge.
- **When it shows.** Only for the command whose handle was let go, and not during a drag.

## Audit

The independent audit returned ACCEPT. F1 (low): a command started over a running one, with a handle of the same id, showed the box without a drag. It was fixed: the box is keyed by the handle and its command.

## Verification

- **Unit:** HandleValueBox 3/3; Studio 570/570. **tsc, eslint:** PASS.
- **Actual [run03](run03/receipt.json)**, on the final source, with the oracle independent of the product:
  1. Drag, let go, type 72, Enter: applied (oracle PASS). Undo/Redo match.
  2. Drag, Esc in the box: the drag is cancelled and the document is unchanged.
  3. Drag, then type 65 in the HUD: the box shows 65. Apply: applied (oracle PASS).
  4. Save and a fresh Open: equal (oracle PASS).
  - No page or console errors.
- **Retained failure:** in run01, a tip at the viewport's edge pushed the box 155 px away. It was fixed with the flip described under Change.

## Limits

- The box may cover a little of the model next to the tip.
- Puck (two-value) handles get no box.
- Typed values are not snapped or bounded, as in the HUD.
- CI and release NOT_RUN.
