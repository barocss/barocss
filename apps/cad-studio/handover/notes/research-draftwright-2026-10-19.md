# Draftwright editor — reference for R14 drawings and A6 inputs (coordinator, 2026-10-19)

Design input only; the roadmap order is unchanged. Observed by the coordinating session in the public web app
https://editor.draftwright.io/ with its built-in sample "mounting plate" (no sign-in, nothing uploaded; the app says it
runs locally and needs a free account only for STEP, SVG and CSV export). What follows is what the UI showed; the
internal rules (how it infers threads, how it places dimensions) are not public.

## 1. The flow
1. **Specify** — after a part opens, a question panel ("1 to answer, 4 suggestions to check, 0/5 done"):
   - *Required*: "What material is the part made from?"
   - *Worth a check* (suggestions the user accepts or edits): "Ø4.2 hole: M5 tapped" (thread inferred from the
     hole diameter); general notes "General tolerance: ISO 2768-m", "Surface finish: Ra 3.2", "Edges: Break sharp
     edges 0.2 max".
   - A tolerancing switch: "± dimensions" (holes located by dimensions, no datums) or "Geometric" (adds datums and
     position tolerances), changeable later.
   - "Accept 4 suggestions as they are"; "Nothing is blocked. Answers add annotations; the drawing lists any that then
     overlap."
2. **Drawing** — a generated sheet: top, front and side views plus an isometric view, a title block, hole-pattern
   dimensions grouped as count × pitch ("2× 30"), through-hole and thread callouts on the holes ("M5×0.8-6H THRU"),
   overall sizes; an **Issues** tab ("1 drawing issue · Wrong on the sheet") next to Annotations and Sheet tabs; tools to
   move overlapping annotations ("Edit handles").
3. **Export** — PDF for the shop, STEP to keep.

## 2. What maps onto our roadmap
- **A6 inputs, clarifying policy** ("ask only about blocking unknowns, in 1–2 batches; everything else becomes an
  editable assumption"): the Specify panel is a working example — required vs. worth-a-check, a progress count,
  accept-all, and "nothing is blocked".
- **Manufacturing intent inferred from geometry**: hole diameter → tapped thread suggestion. We can do this from our
  sourced fastener data (`apps/cad-studio/src/app/fasteners.ts`, tap-drill sizes with source records) and feed it to A3
  requirements/checks; every inferred value is a suggestion, never silently applied.
- **R14 automatic drawings**: grouped hole-pattern dimensions (count × pitch), callouts attached to features (through,
  tapped, depth), overall sizes, views chosen and laid out automatically; today our dimensions are placed by hand.
- **R14 acceptance — a drawing issue list**: overlapping or unreadable annotations, missing dimensions, annotations
  that no longer match the model, listed and fixable; use it as R14's "the drawing is right" check.
- **Tolerancing mode switch**: ± dimensions vs. geometric (datums, position). This is the UX side of the open
  "GD&T/PMI without ISO text" question noted in the earlier research.

## 3. Constraints for us
- Naming a tolerance class (e.g. ISO 2768-m) is fine; its tolerance tables must be sourced or flagged as estimates —
  no ISO text ingested (standing data rule).
- Thread/tap inference must come from our sourced data, with the rule and its source shown to the user.
- Nothing here is to be copied (UI, assets, code); only the workflow is a reference.
