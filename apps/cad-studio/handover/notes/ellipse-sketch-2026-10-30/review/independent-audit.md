# D366 independent audit (claude-opus-5-5 sub-agent, three rounds, 2026-10-30)

The audit was read-only, on 1a2108d3f plus the uncommitted Ellipse diff. It used its own code throughout. The probes and outputs are in [../audit](../audit):
- `geom` (geometry), `edges`, `saveopen`;
- `inter` (interactions), `order`, `perf`/`perf2`/`fscale.sh` (performance);
- `side`/`side2` (the refusal);
- `mutate.py` with `mutate*.out.txt` (mutation sweeps).

## Round 1: CHANGES_REQUIRED

**Holds.**
- **Deviation.** With its own bulge-to-arc conversion and exact distance to the ellipse, the worst deviation is 6.517e-6 × the longer semi-axis. The sweep covered sizes 0.06–2500 mm, ratios 0.2–1, 8 angles and far centres.
- **Outline and NURBS.**
  - Fit points lie on the ellipse within 3e-11, and the outline is simple. The area is within 1e-6 of π·rx·ry.
  - `ellipseCurve`, evaluated with its own Cox–de Boor code, lies on the ellipse within 4e-15. It is closed, anticlockwise, and starts at +rx.
  - The extruded volume is within 2e-5.
- **Refusal boundaries.**
  - The ratio limit 0.2 holds, as does the curvature radius limit of 0.0101 mm.
  - Large and narrow shapes beyond the kernel's limits on coordinates and arc centres are refused, and nothing is clamped silently.
  - Every entry path is guarded: the tool, the panel and reopen.
- **Identity and files.**
  - Ids are stable across panel edits, and a reopen with an unchanged Finish is idempotent.
  - A stale outline drops its definition safely.
  - Save/Open is exact, at about 79 KB per ellipse sketch.

**Findings.**
- **F1 (high): refused by root decision.** A one-edge fillet on an ellipse extrude took about 112 s, against 0.2 s for a circle, and grew roughly quadratically with the face count. A rim of 192 edges is refused by the kernel's 64-edge limit, under a wrong "chamfer" title. See [fillet-scaling.md](../audit/fillet-scaling.md).
- **F2 (low): documented.** The definition is kept only for the sketch's main shape.
- **F3 (low): fixed.** A comment contradicted the code.
- **F4 (low): fixed.** Angles were not normalised; they are now stored in [0, 360), and |angle| > 1e6 is refused.
- **Mutants.** 29 of 34 were killed.

## Round 2: CHANGES_REQUIRED

- **R1 (high): fixed.** `ellipseSideEdge` read the feature id `n<k>` as node index k.
  - Missed: after a delete, sketch `n2` with extrude `n3` sat at indices 0 and 1, and the edges were not refused.
  - Wrong: a rectangle extrude `n2` resolved to the ellipse extrude at index 2, so its edges were refused.
  - Fix: resolve the feature by id, the same way `featureId` does.
- **R2 (medium): fixed.** Chat `add_features` (`checkNode`) bypassed the refusal.
- **R3 (low): fixed.** Sweep faces `n1.s0.side[…]` were not matched.
- **R4 (low): documented.** Documents made before the refusal still open and evaluate, slowly.
- **Mutants.** 40 of 44 were killed. The two real gaps, "any side refused" and "tag not checked", are now killed by negative tests: a hole, a region, a joined extrude, and ids that differ from indices.

## Round 3: PASS

- **Coverage.**
  - B and C: 384/384 edges and 0/12 edges, as expected.
  - Splits: 0/24 for a rectangle and 768/768 for an ellipse.
  - Region sides: 0/12. Mirror: 384/384.
  - Chat `edit_feature` is covered through `checkNode`.
- **Low gaps.**
  - Linear-pattern copies `side[…]@k` were not matched; root added `(?:@\d+)?` with a test that fails without it.
  - The `#k` split suffix is never exercised; no probe produced such a side name.
- **Mutants.** 47 of 50 were killed: two equivalent settle mutants, masked by the 64-segment solver limit, and the `#k` suffix survived.
