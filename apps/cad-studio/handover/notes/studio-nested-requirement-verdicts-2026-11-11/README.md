---
work_id: D605
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D605 — Show local requirement verdicts for a selected nested part

P0 automation, B09 follow-up, rows 04, 10, 12 and 16. FEATURE qualification for the existing read-only nested inspector. D604's reopened Studio capture has a path and volume but no local requirement verdicts. The matching D604 MCP read already supplies the evidence.

The inspector uses the D604 evidence producer and the existing read slot of the Studio Worker. It shows the authored criterion and current local measurement for the full selected path. The source document, selection, evaluator and Worker generation own the result. While a read is pending, the previous result is absent. A retired read cannot update the inspector or start more Worker probes. The root Requirements list remains separate. An assembly-cut draft suppresses local verdicts. The report is transient and is recomputed after Open.

| Group | Result | Evidence |
| --- | --- | --- |
| V01 | PASS | The left `p1/p1` is 4 mm and passes. The right `p2/p1` is 7 mm and fails the same 5 mm limit. Effective steel masses are 6.28 g and 10.99 g. The root height requirement is separate. |
| V02 | PASS | A real decoded Worker result for the left leaf is held while the right result settles, then released. The right verdict remains 7 mm and fail. After replacing the file with the same path but a 6 mm left leaf, a second held 4 mm result cannot overwrite the new 6 mm failure. Both reads leave the documents unchanged. |
| V03 | PASS | A root edit is saved to the browser project. A fresh context opens the exact saved bytes. The nested verdicts are 6 mm and 7 mm, with masses 9.42 g and 10.99 g. The separate root result is 3 mm and fails its 2 mm limit. Python verifies all five sampled local results against independent prism arithmetic with a 10⁻⁸ g mass tolerance. |
| V04 | PASS | A real committed circular assembly cut yields an inline refusal and no numeric verdict. A leaf without requirements has no local requirements section. |

The first desktop assertion did not account for the verdict glyph. The second compared an omitted JSON field with an explicit undefined field in the fixture. Both failures are retained. The final desktop run passed eight captures with no page errors, console errors, downloads or worktree writes. Root reviewed the reopened verdict and assembly-cut refusal images. The affected Model and Studio suites passed 61/61 and 68/68. See [commands and hashes](qualification.json).

Nested repair and approval history, placed-coordinate measurements, live providers, whole browser and kernel suites, and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial product scenarios have accepted ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
