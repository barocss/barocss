# D371 — Associative 3D band surface (B2)

Status: **BOUNDED_QUALIFIED**. This is the 3D half of the owner's band request (2026-10-30). Source commit `9ccfae37c` (32 paths). [Qualification](qualification.json), [design brief](design/brief.md), [Korean report](report.ko.md), [independent audit](review/independent-audit.md).

Tier, under the post-B1 retro rule:
- **Kernel part: FULL.** The mutation set ran, and the kernel findings were re-checked by the root.
- **Model and Studio: FEATURE.** One audit round plus an actual run.

## What it does

**Making a band**
- **Band surface** picks an edge chain or loop on one body (A) and another on a second body (B). A face stands for its edges.
- A kernel feature resolves the stored edge names on every evaluation and builds an exact ruled sheet between the two chains. An upstream edit, such as a radius, a height or a fillet, therefore regenerates the band.

**Pairing the two sides**
- Open chains pair with open chains, and closed loops with closed loops.
- B is seamed at the point nearest A's start.
- When that point is one of B's joints and the piece counts match, the pieces pair one to one. Otherwise they pair by normalized length.
- Each patch is an exact rational ruled surface. The boundary deviation is reported (≈1e-14 mm).

**Refusals**
- References are strict:
  - a lost name is refused with `[BAND_EDGE_LOST]` naming the edge;
  - a moved name is held "could be …" on Open;
  - nothing is retargeted silently.
- Twisted pairings and bands that touch, fold, sit oblique or exceed the pole budget are refused with `BAND_*` tags.

**Editing and other paths**
- The band is edited in its command HUD: Flip and Re-pick (side A or side B). Deleting a body the band uses asks first and names the band.
- v1 has no thickening. Exact thicken replaces faceted output (#2258), so a thickness is refused.
- STEP leaves the sheet out and says so. The agent gets a raw node; there is no chat command or facade verb.

## Retained failures and corrections

1. **Design.** An Opus Plan agent wrote the brief. The root set the tier split, ruled-only, strict references and a raw agent node. The coordinator then corrected one point: no faceted strip thicken (#2258).
2. **Implementation.** Three parallel agents (kernel, model, Studio + driver) built it against a frozen API.
3. **Independent Opus audit: CHANGES_REQUIRED.** Findings:
   - **F1 (KERNEL, high):** a closed band twisted when the loops' seams sat at different angles (−12.3% area, no refusal).
   - **F2 (KERNEL):** a ruling shrinking to zero between samples was not refused.
   - **F3:** an edit was refused after a later feature consumed a parent.
   - **F4:** STEP dropped the band silently.
   - **F5:** test gaps.
   - **F6:** jargon messages.
4. **User pause.** The user paused the work ("too many agents") while the fix agents were running. By then most of the fixes had landed with tests. Afterwards the root went step by step:
   - re-checked F1 with the audit's own probes (the twist is gone; a residual 3.6e-5 skew remains when a seam falls inside a span, which the user chose to record as a limit);
   - re-checked F2 (refused at the exact crossing);
   - confirmed F3, F4 and F6;
   - reran both mutation sweeps against the current tests. Kernel: 30 killed plus 4 new seam mutants killed, with 1 equivalent survivor. Model: 23/23. The first kernel rerun was discarded because it ran against a stale test copy.
5. **Actual runs.**
   - Run01 failed in the oracle: it compared the faceted mesh area to the exact frustum.
   - **Run02 failed on the product:** the band edit could not be reached from its history entry. Fixed in App.tsx.
   - Run03 and run04 failed in the driver, which did not know that deleting a feature asks a cascade question. Run04 also saw an unexplained mid-run page reload, which did not recur.
   - Run05 failed in the driver, which expected a hold where Studio's Open refuses a lost name.
   - **Run06 passed** with nothing else running.

## Verification

- **Kernel:** band test 19/19. Cone area exact to 1.7e-15.
- **Model:** 2253/2253.
- **Studio:** 559/559.
- **Types and docs:** tsc PASS for all three packages; docs tables PASS. The inventory churn is TypeScript union order only, as the audit confirmed.
- **Actual [run-06](studio/run-06/receipt.json):**
  1. Make the band between two cylinders.
  2. The kernel's exact area equals the frustum (1.7e-15, and 2.2e-15 after R 20 → 25).
  3. Names are unchanged; Undo/Redo, Save and fresh Open are equal.
  4. The edit HUD shows Flip, Re-pick and "2↔2 pieces → 2 patches".
  5. The delete asks first, and Cancel leaves the document unchanged.
  6. A lost edge is named in the refusal and not retargeted.
  - Errors 0. All 682 frozen files equal the commit.

## Boundaries

See [qualification](qualification.json) → limits:
- in-span seam skew;
- Studio Open holds only moved names;
- a generic "chamfer or fillet" title on the lost-edge message;
- the body is named after A;
- no thicken (#2258);
- no tangent loft, closed↔open, features on band edges or library bands;
- STEP omits the sheet;
- sheets have no mass.

NOT_RUN: CI, release. The full kernel suite after the fixes was not rerun; only the band and touched-area tests were.
