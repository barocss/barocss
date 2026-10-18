# Implementation session checkpoints (2026-10-18, continued)

Peer messaging from the implementation session was paused by the app (10 messages since the owner last typed). Checkpoints continue here until it resumes.

## Stale-recovery fix (coordinator's request on B13): fbf0a6bc1
- Decision: clear the stale copy, not mark it; recorded in D82 §B13 follow-up.
- `writeRecovery` returns 'ok' | 'too-large' | 'refused' and calls `clearRecovery()` whenever it does not write.
- The App shows a toast once per document ("Crash recovery is off for this document" / "No recovery copy"), again only after a successful write.
- Test: `test/recovery.test.ts`, with a quota'd fake storage.
- The AM4 load-sensitive timing test is recorded in README §0 TODOs.
- Studio 363/363, browser flow 119/119.
- Ordering: C15 (8e5a9dfd9, docs only) was committed before the request arrived.

## C16, part 1: gears (e8ac2a995, plus e4ad465fa, a type-only fix)
- Interfering report 5.8 s → 1.17 s. The output is identical: five cases hashed.
- The sweep cache key leaves out face widths; the axial and total contact ratios are recomputed for each width.
- Budgets: 11.5 s → 2.4 s and 450 ms → 300 ms.

## C16, part 2 — SubD: 2298f6eb0
- The caps' key no longer includes the cage extent. The dependent G1 conditions' misses are kept and re-checked against the current size, so a refusal comes out the same.
- A drag that raises the top vertex: 109–162 → 35–69 ms.
- The topology is read from the mesh that is already built (SD1 and SD2). `opposite()` is counted in one pass.
- Builds hash identical. The new test fails on the old code.

## C16, part 3 — kernel: d716605c0
- Quadrature is kept per B-rep, so mass and area share one run. Plate STEP export: 732 → 512 ms.
- Long texts are exact ids in the reuse keys. An edit beside a 10 MB import: 27 → 1 ms.
- STEP tokens use sticky regexes: reads are 10–25% faster.
- All outputs hash identical.

## C16, part 4 — studio: e8182d908
- Cage overlay: 3.6 → 1.5 ms a frame. Its validation is kept for the whole extrude drag.
- render_views with a highlight: 215–263 → 83–106 ms.
- Library fit ends are kept per library.
- Outputs identical. Browser flow 119/119.
- Open items are in c16-review-findings.md.

Next: C17 (nested functions), then D20.

## C17: 8f49f6d5d
- Hot-path closures hoisted or written out: the ray-triangle test, vertex normals, frustum planes, the frame sorts and request callback, lights and bounds, the vertex snap, SubD nets, twoIrregular.
- bodyMesh now finds a display edge's mate among its face pair only (it was O(E²)): a sharp 12k mesh 270 → 161 ms.
- Hashes identical.
- The AM4 wall-clock test bound is raised from 2 s to 6 s, with a comment that the bench row holds it to 1.2 s.
- Browser flow 119/119; bench:browser within budget.

## D20: 4aba4dea9
- RB trend and properties rows for HEAD: 205 cases, 0 new, the 8 known TODOs, 0 improvements; all properties pass.
- todo.json checked and unchanged: all 8 rows still fail. The note that two graze rows pass no longer holds.

**PERF3 complete.** Next: R8.2 rest (agent cage tools, the browser-flow step).
