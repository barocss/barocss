# Kernel lane brief: K16, the Boolean features' self-union (D260) (2026-10-24)

## Role

As in kernel-k15.md. You own `packages/barocss-cad/**` and commit directly on integration
(`review/cad-gpu-engine-2026-10-14`).
- Never amend, rebase or reset.
- Never commit files you did not change.

## Read first

1. `common.md`.
2. `kernel-k15.md`, then `kernel-k14.md` for the method, verification and report format.
3. In `decisions.md`:
   - D260, the finding and the measurements;
   - D265, K15's closing record;
   - D261 through D264.

## The problem (D260)

The part model's Boolean features unite their first tool part with itself:
`tool.reduce(...)` starts from `tool[0]` and runs over every part, including `tool[0]`. This has been so since
a306e499d.

With `slice(1)`:
- 25#49 builds;
- across the 197 corpus documents with Boolean features, Booleans drop from 443 to 241, and time from 67.0 s to
  53.5–56.2 s.

But three suites depend on the self-union's extra rebuild:
1. `r12c-fits` refuses with FIT_TABLE_MISS at Ø50. When the bore is the tool's own cylinder, the nominal size comes out
   a few ulps past the row's "up to 50".
2. `r12-2`'s flat DXF has 49 entities, against the file's 52.
3. `r10-b`: the r 2 foot that was pinned as refused now builds. Whether that body is right needs the R10.1 section
   oracle.

## Queue (K16)

1. **The fits nominal.** Find why the nominal size drifts by a few ulps without the rebuild. Fix it where it's
   computed: snap or derive it exactly, not by loosening the table's "up to". Then r12c-fits passes with `slice(1)`.
2. **The flat DXF count.** Diff the 49 entities against the 52. Decide which set is right, and say why.
   - If the self-union produced three spurious entities, the expected file changes, and the decision record says so.
   - If `slice(1)` loses three real ones, fix the loss.
3. **r10-b.** Judge the r 2 foot that now builds against the R10.1 section oracle, or the ray oracle if the section
   oracle doesn't apply.
   - If it's right, the pin moves from refused to valid.
   - If it's wrong, find the cause.
4. **Land `slice(1)`** once all three are explained. Record the fingerprint delta and the D240 and corpus timings.
5. **If any budget is left,** take K15's open list in D265's order: 26#34, then 25#190, and so on.

Stop after step 4, plus at most 3 of K15's open cases, and write a closing record.

## Verification

As in K14 and K15, at T2 per checkpoint:
- the suite with the test-name diff;
- RB;
- the fingerprint with its changed lines;
- cad-model and studio;
- the four fuzz seeds.

A browser flow is needed only if something visible in the studio changes. The DXF count is one, so run the flow's
R11b/R12 steps through the gate if the expected file changes.
