---
work_id: D648
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D648 — Normalize an explicit inch through-hole diameter

P0 automation, B09 follow-up, rows 04, 07 and 16. FEATURE qualification with targeted tolerance and mutation checks.

The authored requirement remains **0.25 ± 0.001 in**. Planning returns **6.35 ± 0.0254 mm**. The worker submits a diameter in millimetres. The accepted Hole stores a **3.175 mm** radius. Current evidence uses the authored unit and compares the raw measurement before it rounds for display.

| Check | Result | Evidence |
| --- | --- | --- |
| Original boundary | FAIL | The initial native Ø4 mm bore appeared as 4 in. Planning refused the inch requirement. |
| Studio plan and approval | PASS | CLI and Studio MCP agree on the target and tolerance. Studio reviews Ø4 → Ø6.35 mm, shows the authored inch requirement and approves one candidate. Opening the exact approved checkpoint shows Fail · 0.1575 in and Pass · 0.25 in. The sibling remains byte-equivalent as a parsed document. |
| Independent native read | PASS | An independent reader checks the original and accepted bytes, target conversion, the cylindrical wall's axis and 6 mm span, and analytic volume and centroid. Measured volume is approximately 7009.984695338433 mm³. |
| Input and tolerance controls | PASS | Studio refuses missing units, a radius query in place of diameter and the shared H1 bore. The Model rejects ambiguous units, invalid ranges and submissions in the wrong native scale. It tests both tolerance edges and two raw readings with the same rounded display and opposite verdicts. An equivalent unit rewrite does not trigger replanning. |
| Existing millimetre tasks | PASS | The desktop independent bore and mixed height/diameter flows pass. The legacy unitless native-mm measurement remains available. |

The first after-run assertion required bit-exact radius equality on the evaluated cylinder. It observed 3.1750000000000007 mm, while the persisted feature already held exactly 3.175 mm. The final test uses a 1e-10 mm bound on the evaluated cylinder and retains exact persisted-value and file-byte assertions. The first focused assertion also distinguished a signed zero from zero. The final check preserves the legacy result.

[Commands and hashes](qualification.json). Live model execution, whole CAD/kernel suites and mobile are **NOT_RUN**. Four of ten initial scenarios have accepted v1 ledgers. B09 remains 9/9 and whole CAD/core readiness remains **NOT_MEASURED**. [#2402](https://github.com/barocss/barocss/issues/2402) and [#2279](https://github.com/barocss/barocss/issues/2279) remain open.
