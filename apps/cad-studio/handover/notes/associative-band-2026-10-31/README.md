# D369 — Associative 2D band (B1)

Status: **BOUNDED_QUALIFIED**. This is the first item after bounded 09, from the owner's request of 2026-10-30: "a band that changes when a shape on one side grows". Source commit `4a135b1cb` (28 paths). [Qualification](qualification.json), [design brief](design/brief.md), [Korean report](report.ko.md), [independent audit](review/independent-audit.md).

## What it does

- **Making a band.** In a sketch, the **Band** tool (M) picks two or more closed shapes. **Make band** turns them into construction sources. The sketch stores only `{ sources: their side ids, offset?, width? }`, never copied geometry.
- **Regeneration.** Wherever the sketch is evaluated, the band is regenerated as the exact outer envelope of its sources: common tangent lines plus wrap arcs. That covers part evaluation, previews and rings, loft sections and DXF. A source edit, a parameter change, Undo and Open therefore always see a fresh band.
- **Offset and width.** Offset grows the band outward. Width makes a strip: the loop at offset + width, with the loop at offset as its hole.
- **Refusals.** Each refusal names the band, for example "Sketch 1 band b1: sources e1 and e2 overlap". The refused cases are:
  - overlap, touching or containment;
  - a source that never reaches the outline;
  - a non-convex source;
  - kernel limits;
  - more than 32 sources.

  A refused parameter edit leaves the document unchanged.
- **Identity.**
  - Construction shapes now get side ids at Finish, and reopen no longer reuses them.
  - Bindings on source sizes, offset and width survive reopen → Finish.
  - The Extrude editor lists Band offset/width and each source's radius and centre, all bindable with ƒ.
- **v1 rule.** A band sketch holds only the band and its construction sources.

## Retained failures and corrections

1. **Design.** An Opus Plan agent wrote the brief, and the root approved it with the v1 rule and no agent action in v1. The model (A) and the Studio (B) were then built in parallel against a frozen API. The root fixed the integration: reopen now uses the resolved band, not the stored one.
2. **Actual run01: product failure.** Picked shapes were not highlighted. `toggleBandPick` computed ids but did not store them, which also left the picks unanchored. The root fixed it with a regression assertion. Run02 passed.
3. **Independent Opus audit: CHANGES_REQUIRED.** The geometry was exact over 5,634 random bands with an independent oracle, and every regeneration path was fresh. Findings:
   - **F1:** repeated-piece tags `_0`/`_1` swapped under continuous rotation. They are now named by the preceding source, for example `b1_e1-e2`.
   - **F2:** a midpoint tie check refused valid inputs carrying 1e-10 of noise. It was removed.
   - **F3:** the run01 pick defect.
   - **F4:** the guided-loft hole check came before resolving the band.
   - **F5:** malformed files threw TypeErrors.

   All fixed with tests that fail without each fix. There was one round and no re-audit, per the owner's time concern.
4. **Run03 passed** on the final source.

## Verification

- **Model:** full suite 2233/2233; targeted 323/323. Types and lint PASS.
- **Studio:** 556/556. Types PASS.
- **Docs:** inventory, refusals and check-docs PASS.
- **Actual [run-03](studio/run-03/receipt.json):** one Chrome, two contexts.
  1. Draw construction circles r20 and r10, 60 mm apart.
  2. Band tool: pick both, set width 3, Make band, Finish.
  3. Extrude 10. The volume equals the independent closed-form strip area × 10.
  4. Set source radius 25 in the Extrude editor: the volume follows.
  5. Bind it to parameter R and set R=28: it follows.
  6. Set R=55: refused, naming the overlap, and the document is unchanged.
  7. Reopen and Finish unchanged.
  8. Undo/Redo, Save, fresh Open: equal.
  - Errors 0. All 901 frozen files equal the commit.

## Boundaries

- Convex sources only.
- No crossed or inner bands.
- No agent action.
- In-sketch Ctrl+Z does not undo Make/Remove band; document Undo does.
- A topology change renames repeated-piece tags. References to a removed tag are refused, not rebound.
- NOT_RUN: CI, release.
