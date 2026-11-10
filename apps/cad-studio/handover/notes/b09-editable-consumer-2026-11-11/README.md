---
work_id: D587
artifact_type: editable-consumer-qualification
status: partial-b09-v1
last_updated: 2026-11-11
---

# D587 — Read, revise and reopen a constrained part

P0, B09, rows 04, 12 and 16. The frozen B09 v1 matrix has eight passing groups and one failed group. The tested plate starts at 20 × 10 × 6 mm. Its Ø4 through-hole has centre (5, 5) mm. The rectangle has two driving lengths and zero remaining degrees of freedom. D537 establishes an earlier named sketch binding. D583, D585 and D586 establish separate local MCP, candidate and worker contracts. D587 uses a new end-to-end desktop run to qualify the joins.

| Group | Result | Evidence |
| --- | --- | --- |
| A01 CLI authors the constrained plate from empty | FAIL | `feature()` refuses the rectangle's authored `outline` at line 1, column 8 and creates no file. The existing sketch input schema admits compact dimensions and profiles. |
| A02 CLI refuses a script and keeps accepted bytes | PASS | A valid height edit precedes an invalid field. The diagnostic names line 2 and the file bytes stay identical. |
| A03 MCP reads the current part | PASS | An actual stdio process initializes the grouped contract, lists tools, reads the three features and checks both hard requirements. Its body key and rounded volume agree with the native read. |
| A04 MCP binds and revises | PASS | The named height changes from 6 to 7 mm. The sketch, hole and body identity survive. |
| A05 MCP rejects unsafe or failed edits | PASS | Height 11 breaks a hard requirement. Dry-run and failure at the second operation keep the exact file at 7 mm. The first operation can be retried to reach 8 mm. The same-session duplicate keeps the exact 8 mm bytes. |
| A06 Stage, open, preview and approve | PASS | A new MCP process sees accepted height 8 mm and the open 9 mm proposal. Actual Studio shows a +187.43 mm³ preview while the accepted part stays at 8 mm. The explicit approval records the user and commits 9 mm. |
| A07 Edit and use history | PASS | The Studio Parameters panel changes 9 to 10 mm. First Undo restores the exact 9 mm document. Redo restores the exact 10 mm document. |
| A08 Save and reopen | PASS | Studio saves to the local browser project. A fresh desktop context opens those actual bytes and shows the constrained plate at 10 mm with its stable feature IDs, parameter binding and approval history. |
| A09 Independent saved output | PASS | A fresh CLI replay returns both passing requirements. A fresh stdio MCP process reads the same revision, writes no source bytes, and returns BOM JSON. A stale revision is refused. Python checks native vertices, inward cylindrical supports, volume, centroid and BOM mass. |

A02–A09 start from a typed Model seed of the same zero-DOF sketch. The CLI opens that seed, adds the extrusion and through-hole, sets the brief and requirements, and writes the accepted file. The typed seed stays byte-identical. This continues the frozen workflow after A01 and preserves its failure. No product source changed.

The native checks cover heights 6, 7, 8, 9 and 10 mm. Each build has one valid native solid with one closed shell. The independent area is 187.4336293856408 mm². The final volume is 1874.3362938564087 mm³, centre of mass is approximately (10.335222, 5, 5) mm, and reported BOM mass is 5.061 g. Native comparisons use an absolute tolerance of 1e−8 in their respective units. CLI and MCP rounded volume comparisons use 0.0005 mm³. The BOM check uses the existing 0.001 g precision.

The final read reports Aluminium 6061 as the resolved body material and its native mass matches that density. The BOM's standalone part line carries `material: null`. The single-part BOM producer sets that field explicitly to null while calculating mass from the resolved material. Preserve this output discrepancy as the next bounded product repair. After that, review the existing revision-linked diagnostic and provenance consumers for [#2279](https://github.com/barocss/barocss/issues/2279). The [AI parent](https://github.com/barocss/barocss/issues/2402) stays open.

- **PASS** — Eight frozen groups, the final actual desktop run, visual review of the proposal preview and reopened plate, independent geometry and BOM mass, focused checks and type checks.
- **FAIL** — A01 refuses the authored sketch metadata. The initial inspector used an incorrect import and later an incorrect B-rep validation field. A later run compared CLI rounded output at native precision. The next run exposed the standalone BOM material omission. The final driver applies each documented precision and records the material discrepancy separately.
- **NOT_RUN** — Full kernel and broad browser suites, other sketch families, external agent providers, mobile, full B09 acceptance and release.

[Commands, counts and evidence custody](qualification.json).
