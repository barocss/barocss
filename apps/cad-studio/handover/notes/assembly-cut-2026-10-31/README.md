# D392 — Row 10 ⑤: a cut across parts in assembly context (v1)

Tier: **full**: kernel-routed geometry, a public API and a new document field. Four audit rounds with mutation and one actual run. [Qualification](qualification.json).

## What it does

**Cutting in the assembly**
- **Assembly cut** (command palette, Modify group) makes a hole or pocket across the placed parts you pick, in the assembly's frame.
- Each part's definition stays whole; only that occurrence is cut. Two occurrences of one part can differ.
- The HUD shows only the primary fields: profile (circle or rectangle), size, centre, direction, depth or Through, and the parts as chips with **Add selected**. The name and an explanation sit under a closed Details.
- The viewport previews the cut; nothing changes until **Cut** (or **Apply** when editing), which is one Undo step. The Browser lists each cut with edit and delete.

**Where the cut reaches**
- Everything that reads an occurrence's geometry reads the cut part: the viewport, drawings, STEP, 3MF, explode, clearance, robot calculations and exports, mass and the BOM.
- The BOM gives a cut part its own line; copies cut alike share one line.
- **Through** cuts the whole part along the direction, both ways from the profile plane, sized from the part's own box.

**Guards**
- A cut that would remove a part, cannot be built or is too long for the kernel is refused when it is made.
- A part a cut targets cannot be turned into a sub-assembly by a revision or an in-place edit.
- A file whose cut target has since become uncuttable still opens; the cut is reported, not made.

## Audits ([1](review/audit-round1.md), [2](review/audit-round2.md), [3](review/audit-round3.md), [4](review/audit-round4.md))

- **Round 1:** two high defects (a file could become unopenable; the BOM ignored a sub-assembly's own cuts), three medium, four low. All fixed.
- **Round 2:** one high defect (a posed flexible sub-assembly lost its own cut), one medium (partial or part-removing through cuts), one low. All fixed.
- **Round 3 (targeted):** two wrong results (a stale through-cut box after a row change; a cut end cap lost its BOM plate line) and per-keystroke build trials. All fixed.
- **Round 4 (narrow):** ACCEPT.

## Actual run

[run03](run03/receipt.json) on `apps/cad-studio/test/fixtures/assembly-cut.bcad` with real clicks: a Ø8 through cut on both plates (one turned 90°), then edited to Plate 2 only, Undo/Redo, Save and a fresh Open, then deleted. The oracle checked the volumes by arithmetic (12000 − π·4²·5) and that definitions and placements never changed.

## Limits and follow-ups

- Mates still read the definition's uncut faces.
- Top-level parts only: sub-assemblies and parts inside them are refused.
- A cut plate's BOM area is the uncut stock's.
- After Undo with the HUD open, an old check result can show for up to 250 ms; Apply re-checks.
