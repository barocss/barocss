# D373 — Row 03 closed: linear repeat of a cut feature (CG2)

Tier: **small** (close-out). Owner order "Go to 01–06", 2026-10-31. [Qualification](qualification.json).

The feature, its model tests (17520 mm³) and its refusals already existed. The row's only open item was the separate actual Studio run. That run used the shared helper (driver `95c7ec69f`, [run-01](run-01/receipt.json)) and passed on the first try:
1. **Refusal.** Count 1 is refused with its reason, Apply stays disabled, and the document is unchanged.
2. **Apply.** Count 3 at spacing 16 adds one pattern node. The original nodes are unchanged, so no stock copies are made. Volume 17520, bounds 60×30×10.
3. **Undo and Redo.** Both work.
4. **Files.** Save and a fresh Open give an identical document.
5. **Edit.** Count 2 in the feature editor gives 17680; back to 3 gives 17520.

There were 4 independent volume oracles, and errors were 0. All 265 frozen files equal the commit.

**Limits.**
- The HUD refusal shows the internal prefix "BarocssError: [VALUE]". This is a cosmetic follow-up candidate.
- Only the x direction and the reference case are driven.
- CI and release NOT_RUN.
