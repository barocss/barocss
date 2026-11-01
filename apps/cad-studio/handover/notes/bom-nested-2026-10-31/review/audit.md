# Independent audit: nested BOM (roadmap 10 ②b, #2180), feature tier, one round

Verdict: **CHANGES_REQUIRED**

Probes: `probe.test.ts` (bundled with `build.mjs` to `out/probe.test.mjs`). Logs: `run1.log`, `run2.log`. `old/` holds pre-change copies of `bom/core.ts` and `bom/bom.ts`, taken from HEAD, used for the byte-identity comparison.

## Findings

1. **HIGH: balloons on nested lines point at the wrong part.** `drawing/balloons.ts:44` maps a nested id to `hostOf(id)`, so every nested line targets the longest visible edge of the whole sub-assembly. Probe P7 places Sub ⊃ {Shaft with a key, Block}. Balloons 1 (Sub), 2 (Shaft) and 3 (Block) all land on the same edge, `s1/p1/n0.seat2#2~sil0`, so Block's balloon points at the shaft. Expected: Block's balloon on an `s1/p2/…` edge (stableNames already gives the path prefix).
   - Nested element line (`s1/p1:n1`, the key): `targetOf` returns inst `s1/p1` (line 46), but `edgeOf` splits at the first `/` and yields `s1`. The key line therefore never gets a balloon: `noEdge: [4]`.

2. **MEDIUM-HIGH: nested fasteners lose their sub-assembly's rows.** `bom/core.ts:100` calls `fastenerOfPart(doc, inst.doc)` with the *root* doc. Rows inherit downward only (resolveShopTree), so a sub-assembly's own fastener rows are missed. In probe P1b, a sub-assembly with row F1 (socket-screw M6×20) gives `[F1, estimate false, 'a test row']` when opened alone. Nested, it gives `[null, estimate true, null]`. purchase.csv then loses the row and source and flags the screws as estimates. checkBom passes, because the line and the part agree on null. The lookup should use the containing (resolved) document.

3. **MEDIUM: the drawing BOM table cannot show nesting.** `drawing/tables.ts:54` emits nested lines with no level or parent. P7's MASS column reads Sub 173.151, Shaft 100.251, Block 72.9: the sub-assembly line already contains its children. The note still says "1 part". A reader summing QTY or MASS double counts. Needs indentation or a parent marker, or a note that nested rows are inside the line above.

4. **LOW-MEDIUM: one fastener size gets split purchase rows.** P3b: a top-level M6×20 screw and four M6×20 screws inside a sub-assembly come out as two purchase.csv rows (qty 1 and qty 4). Before this change, equal parts always merged into one line. The quantities are correct, but the list isn't consolidated. Fix it, or confirm it is intended.

5. **LOW: kid order affects merging.** `bom/core.ts:110`: the merge key uses kid order, so two sub-assemblies that are physically identical but list their parts in a different order become two lines (P3a). Sorting kids in the key would fix it.

6. **LOW, not a regression:** setBought silently ignores unknown paths (`s/zz:n1`, `zz:n1`), as before (P5). A bought flag set on a pattern occurrence's nested part alone (`pat1-1/p:…`) is lost on expandPatterns (P4). The panel always passes the seed's path too, so this only affects direct API callers. The same was true for flat occurrences before.

## Verified with no defect
- Rolled-up mass matches Σ volume × density over own and nested bodies in four different materials, across three levels and two copies. Total = 2× (P2). checkBom is clean.
- Pattern of a sub-assembly (3 occurrences): S ×3, nested ×6 with perParent 2, totalQty 3, checkBom clean (P4).
- Byte-identity, comparing the old and new view, BOM, panel data and purchase.csv including made parts: identical on all 7 fixtures that have instances but no sub-assembly (including both pattern fixtures), on a synthetic pattern document, and on two fastener-instance documents (P6).
- A nested bought flag survives encodeStudioFile → readStudioFile (P5).
- Hidden nested parts are excluded consistently from the view, elements and made list.
- The freshness model and material inputs are already recursive.
- BomPanel labels come from view data. The meaning of the totals text is unchanged.
- The existing `bom-nested` and `bom-balloons` tests pass (9/9).
