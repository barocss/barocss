---
work_id: D603
artifact_type: bounded-product-qualification
status: repaired-and-verified
last_updated: 2026-11-11
---

# D603 — Measure placed nested assemblies in the tool summary

P0 automation, B09 follow-up, rows 04, 10 and 16. FULL review and mutations for the public `assembly.get` response. D602 records both nested-only hosts as zero bodies and zero volume. Their listed occurrence paths were valid.

The nested summary evaluates the existing placed recipe and reads world bounds from the placed meshes. For a derived weld bead, it matches the origin body by key and applies Studio's rigid body placement to copied buffers. A missing placement result or a typed refusal returns an error on that host without numeric geometry. Successful empty geometry retains zero bodies and zero volume. A body with unavailable volume keeps the volume unknown. Ordinary top-level rows and local member interface keys keep their previous behavior.

| Group | Result | Evidence |
| --- | --- | --- |
| A01 | PASS | Actual local MCP and desktop Studio agree on one body per host and volumes of 800 mm³ and 1,400 mm³. The world boxes are [30, 0, 8]–[50, 10, 12] mm and [60, 0, 15]–[80, 10, 22] mm. A root edit, browser project Save and fresh Open retain both. Native B-rep reads and independent prism arithmetic cover both leaves. |
| A02 | PASS | Two separated solids rotated 45 degrees report two bodies, 12 mm³ and bounds from [9.293, 20, 30] to [11.414, 27.778, 33] mm. A real mixed welded host with a nested solid reports four bodies and 568,686 mm³. Its bounds move to [980, −20, 0]–[1500, 20, 800] mm. The ordinary body key stays the same. |
| A03 | PASS | A missing evaluation, a placement refusal and an invalid translation retain an error without dimensions. Actual MCP reports “Sizes must be greater than zero” for the broken host and retains the healthy sibling's 1,400 mm³. A controlled successful body with missing volume keeps a null volume. |
| A04 | PASS | A hidden child is excluded, and a subtree with both children hidden is valid empty geometry. Both nested requirement requests retain their explicit refusal. |

Independent Sol Medium code and Sol High architecture reviews caught earlier gaps in derived weld placement and native transform refusal. The final source verdicts are APPROVE and CLEAR. The first Model type check found a malformed association in a refusal test. The corrected fixture uses the actual association schema.

Actual desktop recorded five states and 769 unchanged source pins. Focused Model and Studio tests passed 109/109 and 47/47. Both TypeScript checks, lint, Studio build and five isolated targeted mutations passed. See [commands and hashes](qualification.json).

Positive nested requirement evidence, general curved-mesh agreement across independent tessellation, live AI, mobile and whole suites are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial product scenarios have accepted ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
