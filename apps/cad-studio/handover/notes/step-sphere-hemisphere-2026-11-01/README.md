---
work_id: D422
artifact_type: step-sphere-hemisphere-qualification
status: done
owner_role: executor
source_request: "Continue the roadmap and report the row and overall progress"
last_updated: 2026-11-01
---

# Translation-stable STEP hemisphere selection and display normals

D422 is QUALIFIED for the bounded ordinary-sphere import and mesh-arithmetic profile. Rows 13 and 16 remain open. The coarse overall estimate is 43%, from equal row weights; it is not release acceptance. [Commands, counts, hashes, failures and limits](qualification.json).

A radius-0.001 sphere at `[999000,999000,999000]` passes strict topology at baseline but both native faces cover the same hemisphere. The existing equal-gap selector loses the closed-ring area in world-coordinate cancellation. Subtracting each ring's first point preserves the exact area formula and retains the intended complementary faces. No new STEP surface family is admitted.

The first actual run then exposes a separate blocker in the same translated input: STEP import takes about 4 ms, but display tessellation and the real Model read exceed a 20-second child limit; Studio remains at “reading the solids” until its 60-second test wait fails. Normal sampling subtracts large world D0 values over a small fixed UV step. The second correction prepares one private normal-only local control net per face. It shifts only same-sign, factor-two axes, so each subtraction is exact by Sterbenz and coordinate limits remain valid. Other axes retain their original arithmetic. Only the normal stencil uses that evaluator. World positions, inversion, finite steps, pole fallback, tolerances, quality and refinement caps stay unchanged. The same q8 mesh now takes about 40–50 ms and has 1,020 triangles.

Full-tier validation includes source/math rounds, importer checks 8/8, normal checks 16/16, four affected existing checks, independent literal/range controls, exact arithmetic and two isolated arithmetic-reversion mutants. Both mutants produce intended raw assertions; no timeout or crash is counted as an assertion kill. CAD build/types, final Model types, lint, syntax and unchanged code-shape counts pass. Normal-control names explicitly describe multiplicity-two knots with matching derivatives, not genuine geometric kinks. No whole-suite or general translation-invariance claim follows.

Actual run02 passes the same two direct STEP Opens without a native-project workaround or larger timeout. Real native Model inspection and 60 independent centered-control-point Cox samples confirm distinct opposite hemispheres; duplicated-face canaries fail as intended. All 746 frozen files match before, after and after cleanup. Page/console errors, worktree changes and downloads are zero. Context, Chrome and server close. Root reviews both images: the Open toast and fresh one-body state are visible, but the tiny-far shape is not discernible and the centered small sphere appears as a point. Tiny-body rendering quality is NOT ACCEPTED; the cause is not diagnosed here. Native data evidence, not those images, establishes the bounded hemisphere witness. The sample tolerance is a comparison threshold, not an imported edge tolerance.

All failed attempts remain explicit: initial fixture/bundle setup, excessive support-midpoint and ordered-equality oracles, tilted-pole and pinned-boundary oracle errors, the first actual timeout and the bounded consumer timeouts. Corrected final controls do not rewrite those receipts. Report-only labels/logging/key changes retain their source/AST limits. Raw files and images remain outside git.

D423 is the next accuracy boundary before spherical OFFSET support. A compound-rotated tiny sphere has about 19.5% volume and 40.8% area error; rounded near-pole points introduce arbitrary longitude into its support extent. The old/current patch sets match exactly after face correspondence, with only scalar roundoff differences. Broad support alone does not prove missing trimmed coverage, but the measured mass discrepancy remains NOT ACCEPTED. General exchange, rendering, C0/high-degree and release acceptance remain open. OCP stays removed; no download, dependency, public API, B-rep topology-core, schema, further develop merge or release change occurs.
