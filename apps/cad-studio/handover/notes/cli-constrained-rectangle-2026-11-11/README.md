---
work_id: D590
artifact_type: constrained-rectangle-authoring-qualification
status: b09-v1-accepted
last_updated: 2026-11-11
---

# D590 — Author a two-length rectangle from the CLI

P0, B09 A01, rows 04, 07 and 16. FULL qualification of the existing raw feature input. The direct CLI failure in [D587](../b09-editable-consumer-2026-11-11/README.md) is preserved. This decision verifies the original frozen B09 v1 matrix at **9/9** on one continuous CLI-created file.

The existing `feature()` and grouped `features.add` use one admission check. It accepts an authored `outline` on a single straight rectangle in the default XY plane. Ordered numeric bounds define the four points. They start at the lower-left corner and follow counter-clockwise order. Edges 0 and 2 are horizontal. Edges 1 and 3 are vertical. Edges 0 and 1 carry the two driving lengths. The lengths must match the represented sides at the existing numerical XY solver's 1e−7 mm residual. The existing solver also checks admission and zero remaining degrees of freedom. Stored bounds, lengths and side tags retain their authored values. Compact rectangle inputs keep their earlier rules.

The two independent reviews separated solver admission from saved geometry and examined the shared public validation path. The review found that downstream side IDs allow 32 characters, and that a string-like array used as `kind` would otherwise reach a strict geometry switch. The final gate matches the existing side-ID limit and requires the actual sketch kind string. It preserves the existing locked-reference refusal. Actual MCP `describe` lists the bounded input. The CLI guide shows the same feature form.

| Frozen group | Result | Current evidence |
| --- | --- | --- |
| A01 Direct authoring | PASS | Actual CLI starts from empty, writes the 20 × 10 × 6 mm plate and Ø4 through-hole, and passes both hard checks. Native read retains the exact outline, two driving lengths and four side IDs. The reopened sketch solves at zero DOF. |
| A02–A05 Script refusal, query, revision and rollback | PASS | The CLI and actual stdio MCP preserve exact files on invalid input. Grouped MCP inspects the same file, binds H, revises from 6 to 7 mm, refuses a hard-limit break, tests dry-run and rolls back the failed batch. Retry reaches 8 mm. A duplicate keeps the file identical. |
| A06–A08 Actual Studio handoff | PASS | Fresh MCP reads the open 9 mm proposal at accepted 8 mm. Actual Studio previews and approves it, edits H to 10 mm, verifies first Undo and Redo, saves to the browser project and opens those bytes fresh. |
| A09 Saved output | PASS | Fresh CLI replay returns both hard checks. Fresh MCP reads the same accepted revision and produces an `al6061` BOM line at 5.061 g. A stale revision is refused. |
| C01–C03 Input controls | PASS | Actual MCP advertises and writes the same raw sketch. CLI and MCP refuse malformed second inputs without changing their files. Model tests cover translated fractional geometry, the existing compact path and invalid metadata, including nonstring kind, bad lengths, corners, axes, side IDs and unsupported profiles. |

The independent Python oracle checks native vertices, inward cylindrical supports, volume and centroid at five accepted heights. Native tolerance is 1e−8 in the relevant units. The final volume is 1874.3362938564087 mm³. The bore radius is 2 mm at (5, 5) mm. The BOM agrees with the independent density calculation at its existing 0.001 g precision. Root reviewed the actual proposal preview and reopened plate.

- **PASS** — Nine frozen B09 groups, actual CLI and stdio MCP, actual desktop Studio, independent native and BOM checks, focused tests, six mutations, both type checks, affected lint, docs samples and Studio build.
- **FAIL** — Historical D587 direct authoring refusal. The first D590 Model type check caught an excess property in the test fixture. Lint then caught two unused bindings in the compact control. Both checks pass after the test corrections. The aggregate docs check still fails on the inherited refusal table and API inventory snapshots. In fresh processes the parent and current inventories are byte-identical at 6,520 exposures. Both sources also regenerate identical refusal tables. The stored inventory expects 6,472 exposures. The original evidence remains separate.
- **NOT_RUN** — General solver authoring, non-XY or multiloop authored profiles, broad browser and kernel suites, live providers, mobile and release.

B01, B02, B04 and B09 are four accepted scenarios of the ten named initial cases at their recorded scopes. Whole CAD and core readiness remain NOT_MEASURED. Next, use the existing checks to scope one structured current-revision evidence report for [#2279](https://github.com/barocss/barocss/issues/2279). That research and the [AI parent](https://github.com/barocss/barocss/issues/2402) remain open.

[Commands and evidence custody](qualification.json).
