# D393 — Row 10 ⑥: assembly instruction steps (v1)

Tier: **full** (a new document field and a public API): two audit rounds with mutation and one actual run. Issue #2251. [Qualification](qualification.json).

## What it does

- **Assembly steps** (command palette) opens a Steps panel in the right dock. It explains an existing assembly in order, part by part.
- **New step from selection** makes a step from the selected parts; **Add selected** adds more. A part is introduced in one step only.
- **Prev** and **Next**, the step rows and **Go to its step** (from a selected part) all reach the same step state.
- At each step, the parts still waiting are hidden and the step's own parts are highlighted. A step can carry an explode scale and a recommended view (**Capture view** / **Reset view**).
- The note, "Show waiting parts faded" and the notes about missing parts sit under a closed Details.
- Steps are presentation only. They never move a part or change a mate, the geometry, the BOM or an export. Closing the panel shows every part and puts the explode back.

**Guards**
- Removing a part a step names is refused in words.
- A file whose step names a part that is gone still opens. The step is kept and reported, and a new part never takes that id. This also protects D392's cut targets.

## Audits ([1](review/audit-round1.md), [2](review/audit-round2.md))

- **Root review (run02 images):** the gizmo of a hidden, waiting part floated in mid-air. Fixed.
- **Round 1:** one wrong result: a stale step id was reused by a new part. Also two minor defects. All fixed; 12/12 mutants caught.
- **Round 2 (targeted):** the product was correct; three tests were added for surviving mutants.

## Actual run

[run05](run05/receipt.json) on `apps/cad-studio/test/fixtures/assembly-steps.bcad` covers:
- three steps built with real clicks;
- identical steps from Prev/Next and from jumps, with no gizmo on a hidden waiting part;
- Go to its step;
- the refused Remove;
- Undo/Redo, Save and a fresh Open;
- closing the panel.

The oracle confirmed the steps as built and every instance untouched.

## Limits

- No playback and no chat tool (the per-turn tool budget is full).
- Top-level occurrences only.
