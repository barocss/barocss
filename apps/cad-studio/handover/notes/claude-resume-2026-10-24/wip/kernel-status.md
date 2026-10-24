Kernel lane status at the stop, 2026-10-24 (K16, the Boolean features' self-union, D260)

ON INTEGRATION (review/cad-gpu-engine-2026-10-14)
- b54bae6d8  fix(cad): K16 checkpoint 1, D266 + D267, with their records in decisions.md and the README §0 rows.
  - D266 (src/machine/fits.ts): lookupFit snaps the nominal size to 1e-6 mm before the range test. A Ø50 bore
    measured 25.000000000000007 off its arc missed "up to 50" without the self-union's rebuild.
  - D267 (src/blend/rolling-ball.ts, chainPath): (x % L + L) % L sent x an ulp below L to 0. The general fillet's
    tool folded back on itself. Every r10-b foot now builds, with or without slice(1).
  - Verified at T2 (scratch tree = this commit's kernel):
    - kernel 1677/1684 (the one failure is the native-split Node assertion); names +2, 1 renamed (r10-b);
    - RB: no NEW, the same 3 TODOs;
    - fingerprint 866 cases 17c1d5c4 (from 6fe8417d): 20 fillet/shell lines, areas <= 3e-8, volumes <= 1.8e-11,
      no status change;
    - fuzz refusals 15/9/11/10 (seeds 25/26/23/24), unchanged;
    - cad-model 1027, studio 286.
- Nothing else of K16 is on integration. slice(1) is NOT landed.

PATCHES (in this folder; apply on b54bae6d8 or later with `git apply`, checked against 4cf580ff6)
1. k16-slice1-d269-d270.patch: THE ONE TO USE. Checkpoint 2, complete but its final T2 not run.
   - src/part/part-model.ts: the Boolean features join tool parts as tool.slice(1).reduce(..., tool[0]) (D260's
     fix, to be recorded as D268).
   - conformance/r12/flat-dxf/{channel-hole,tray-holes}/expected.*.dxf and oracle.*.json, regenerated with
     `DXF_ORACLE_PYTHON=~/.cache/barocss-ezdxf/bin/python node scripts/flat-dxf-fixtures.mjs`.
     - Same entities (9/28/29); 36 numbers move by <= 2.8e-14. D260's "49 vs 52 entities" was a misreading: those
       were the byte diff's ASCII '1' (49) and '4' (52).
   - src/brep/analytic-boolean.ts:
     - toPoles (D269): a march that ran past a pole (within 1000 tol) is cut back while the pole lies behind its last
       point, then the pole is appended. 24#154: the curve stopped 4.4e-4 past the ball's pole, the appended pole made
       a hook, paramOf found the cut's own end 1.8e-4 off, and mergePieces dropped the open piece.
     - triangulatePinched (D270 part a): a pinched outer ring with holes; each hole goes with the CCW lobe holding
       it. Also adds a module-level helper, inRing.
   - src/brep/brep-tessellate.ts, surfaceTriangles (D270 part b): the same 3D boundary point met twice, its uv
     within 1e-9 of the domain span, takes one uv. Pole points are excluded; seams lie a period apart and are left
     alone. In 23#110 the near-pinch was 6e-14 apart, and ear clipping failed where an exact pinch passes.
   - test/fuzz-k16-findings.test.mjs (new): D260's 25#49 test, D269's 24#154 test, D270's 23#110 test. The last two
     fail on the slice(1) tree without D269/D270.
   - robustness/corpus/fuzz/fuzz-20261025-49.json, fuzz-20261024-154.json, fuzz-20261023-110.json (new, shrunk
     trees, written by save.mjs from K15's scratch).
2. k16-slice1-first-cut-superseded.patch: reference only. The first slice(1) tree, cut against 8ec90bc49. It contains
   the D266/D267 changes, already in b54bae6d8, and lacks D269/D270. Do not apply it.

LAST VERIFIED
- Patch 1's tree: lint and type-check of packages/barocss-cad are clean. fuzz-k16-findings, r10-b, r12c-fits and r12-2
  pass: 20/20.
- The first slice(1) tree (patch 2's content, no D269/D270) ran a full T2:
  - kernel 1678/1685, names +1 (25#49's test);
  - RB: no NEW, 25#49 passes;
  - fingerprint 867 cases 850d4008 against 17c1d5c4: 351 lines, 20 of them F/E/V changes.
    - Status changes: 23:13 refused → valid. Valid → refused: 24:154, 23:110 (D269 and D270 fix both) and 23:9.
    - 23:9 is near-degenerate: its nudges refuse 4/4 as fuzzed at HEAD too. Recorded and left open, as the
      coordinator decided.
  - fuzz refusals 11/9/12/11 against 15/9/11/10 (45 → 43);
  - cad-model 1027, studio 286.
  With D269/D270 the fingerprint will change again: expect 24:154 and 23:110 back to valid, 3 corpus cases added.
- Timings (D240 open harness, cp1 = without slice(1), k16 = with it; 3 runs a scene, 2 passes). The digests are
  identical, and the four scenes use no Boolean features, so the differences are noise:
  - frames 11878/11017 against 11633/11165;
  - spring 3666/3319 against 3456/3359;
  - worm 2172/1899 against 1939/1960;
  - A9 4485/4358 against 4341/4568.
- Timings (the corpus documents with union/difference/intersect features, best of 3; t260.mjs):
  - cp1: 199 docs, 71923 / 66355 ms, 453 Booleans;
  - k16: 200 docs, 54093 ms (pass 1; pass 2 stopped at the order to stop), 249 Booleans.
  That is −18 to −25 %, in line with D260's −15 to −20 %. The timing run was killed before its last pass.

NEXT
1. Apply patch 1 in a scratch tree with its own node_modules. Run T2:
   - the kernel suite with the name diff against b54bae6d8's names;
   - RB, the fingerprint (diff against 17c1d5c4), the four fuzz seeds, cad-model and studio.
   brep core changed, so it needs the full suite.
2. Write the records, then commit on integration:
   - D268: slice(1) landed, with the DXF fixture change and why (independent oracle: ezdxf, and the geometry identical
     to 2.8e-14), the fingerprint delta, the timings above and 23:9 open;
   - D269 and D270: the fixes above, with their tests and corpus cases.
3. The coordinator's addition, not started: an RB property for the Boolean's commutativity.
   - Over the fuzz corpus's union and intersection pairs, A∪B against B∪A and A∩B against B∩A must both build to one
     volume within e, or both refuse. A one-sided refusal is a robust refusal.
   - If it finds more than a handful, report the count to the coordinator before fixing them.
4. K16's closing record. Open: 23:9; K15's list in D265's order (26#34, 25#190, ...); B ∪ B of 25#49's inner body.
5. Then the R7 queue the coordinator relayed (R7.3a cad's errors, R7.3b results as data/MMGS, R7.3d legacy out).

SCRATCH (session 637b5b42's scratchpad; can be deleted)
- Worktrees base, k16 and dev (detached).
- Debugging tools in the scratchpad: pair.mjs, pieces.mjs, rings.mjs, merge.mjs, bodies.mjs, tree.mjs, shrink.mjs,
  nudge.mjs, save.mjs.
