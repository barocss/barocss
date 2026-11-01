# D357 independent audit (claude-opus-5-5 sub-agent, 2026-10-30)

The audit was read-only, on 8885f19be plus the D357 diff before the audit fixes. Probes `p1`–`p3` (base and current templates) and the mutation runner are in [../audit](../audit). `muts.json` is the audit's sweep; `muts2.json` holds M11, M12 and M15, rewritten after the fix moved their target strings.

**Verdict: CHANGES_REQUIRED (small).** The core claim held.

## Holds (base → current)

- `profileMiddle` of a rectangle with `max: [W, 40]`, W = 40: `[null, 20]` → `[20, 20]`.
- Extrude handle `at`: `[null, null, null]` → `[20, 20, 8]`.
- Revolve and edit-revolve handles: null → finite. With params `{}`, W = Infinity, NaN, `"40"` or undefined, the handles are `[]`.
- Plain Loft of two bound rectangles: null section copies and the evaluation refusal "segment 1 start must be a finite length" → numeric copies that evaluate to `[0,0,0]–[40,40,30]`.
- The reversed pick `[2, 0]` and the three-section smooth Loft `[2, 1, 0]` (the recursion path) now produce numeric copies.
- NURBS-guided Loft: null arc starts → numeric copies.
- Loft `available` with W = Infinity: `ok` → refused.
- Nothing rebuilds Loft section copies from `from`. `from` is read only by `parentsOf`, the flatten remap and the chat remap, so no later path can bring NaN back.
- The Parameters panel is not rendered while a command is active, and `removeParameter` inlines the value into features. A parameter therefore cannot go missing mid-command through the UI.
- The App rings memo depends on `shownDoc.parameters`.
- Checks: new test 9/9; 11 related files 168/168; both type checks and eslint pass. Against base source the new test fails 9/9, each for the right reason.

## Findings and root disposition

- **F1 (medium): fixed.** A Loft from bound sketches silently stopped following the parameters. With W changed from 40 to 80, an Extrude of the source follows but the Loft stays.
  - Fix: a "Sizes" step, "Copied at W = 60: later parameter changes do not update this loft.", shown on every Loft path when a picked sketch is bound. Features.md says the same.
- **F2 (low): recorded.** On base, `framedLoftSections` (the Bézier-guided path) cloned the node with its bindings. Its copies followed the parameter, and a changed radius failed loudly in the kernel. Now the copies are numbers and the change is silent.
  - The snapshot is the better choice, because the copied guide cannot follow a resize. The decision record states the change, and the F1 notice covers it in the UI.
- **F3 (low/medium): fixed.** Mutants M7 (NURBS-guided build without params), M8 (framed build), M9 (guided steps) and M10 (recursion drops params) survived.
  - Fix: tests for the Bézier-guided, NURBS-guided, reversed NURBS-guided and reversed unguided Lofts. All four mutants are now killed.
  - M4 (offset-face `profileMiddle` without params) is equivalent, because that profile is built from face geometry and its numbers are always plain.
- **F4 (cosmetic): fixed.** The refusal showed "[PARAMETER_UNKNOWN] the sketch uses …". It now reads "Sketch 2 uses parameter B, which this document does not have", without the code prefix, in `available` and the steps.

## Side notes

- **S1 (open):** the public `loopOf` still returns NaN for a bound sketch. Its internal callers all pass resolved or freshly drawn nodes.
- **S2 (fixed):** the public `loftTop`, which has no callers, would write NaN for a bound sketch. It now refuses.
- **S3 (fixed):** Studio `ringsOf` swallowed every error. It now catches only `PARAMETER_UNKNOWN`.
- **Checked safe:**
  - Each of these resolves parameters or refuses: `editFields`, frame `sketchEdges`, DXF export, fill-pattern snapshots, `cylindricalWrap`, `routeBundle`, chat drafts and the edit-extrude handles.
  - Pipe/sweep and the revolve axis read no sketch sizes.
