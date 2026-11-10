---
work_id: D582
artifact_type: keepout-chord-interval-qualification
status: fixed-and-qualified-for-single-body-keepout-interval
last_updated: 2026-11-10
---

# D582 — Preserve uncertainty across keep-out requirement intervals

P0, B09, rows 04 and 16. Bounded FULL qualification of the existing single-body keep-out requirement checker. [#2422](https://github.com/barocss/barocss/issues/2422).

The original checker used the center value when both ends of the chord interval failed. That gave a false pass when a narrow equality or range contained the center. It gave a false fail when the interval contained an offset acceptable value. The controlled Model repro supplies a 10 mm gap and 1 mm chord depth through the existing measurement path. The independent expected results use the literal interval [9, 11].

The checker now also detects an acceptable value inside the interval when both endpoints fail. The equality target or first allowed range value supplies that witness. This keeps the point comparator's original floating-point behavior and inclusive boundaries. Full containment still passes and disjoint intervals still fail. The test matrix covers one-sided comparisons, singleton bands, boundary touch, the producer's unbounded sentinel, zero chord, a missing reference and exact native overlap. Chord production, reference geometry and requirement admission retain their existing contracts.

A native 10 mm cube sits 5 mm from a cylinder of radius 5 mm. Local MCP reported clearance 5 mm and chord 0.0240634060843 mm. The independent circular sag control is within 0.0001 mm. Grouped requirements changed from 2 pass, 1 fail to 1 pass, 2 unknown, with exact IDs and reasons. Only the clear lower bound enters `passedHard`. Read-only checks preserve the document and file bytes. Existing approval policies still distinguish definite failures from unknown outcomes according to their own rules.

Root used actual desktop Studio with the same geometry and nine authored requirements. Four false certainty cases became unknown. The other five verdicts stayed consistent. The summary changed from 4 pass, 4 fail and 1 unknown to 2 pass, 2 fail and 5 unknown. An independent decimal oracle verifies the result across the displayed rounding bands. The Requirements filter, document and history boundary, project Save and public Open in a fresh context pass. The tool and UI fixtures were authored programmatically.

- **PASS** — focused Model and Studio tests, native-file grouped MCP, desktop Studio, five targeted mutations, affected lint, both type checks and Studio build.
- **FAIL** — original Model, MCP and Studio verdicts for the interior-band cases. The original Model run fails the two D582 tests. The first successful desktop runs omit the driver path from the capsule. The first pinned run records a watcher event with identical source hashes. The final pinned run passes. A range-boundary mutation survived the first run, so the test now checks the single point left by the existing epsilon.
- **NOT_RUN** — multi-body minimum aggregation, wider chord bound accuracy, whole Model/kernel suites, live agents, mobile and whole B09 acceptance.

[Commands, scope and receipts](qualification.json). Whole CAD remains **NOT_MEASURED**. Next is D583, P0 B09, rows 04 and 16, to reproduce whether overlapping typed tool calls share one call's requirement override or response mode. [#2398](https://github.com/barocss/barocss/issues/2398).
