---
work_id: D606
artifact_type: bounded-product-qualification
status: existing-repair-verified-root-proposal-gap-reproduced
last_updated: 2026-11-11
---

# D606 — Verify a nested repair through a host revision

P0 automation, B09 follow-up, rows 04, 10, 12 and 16. SMALL evidence-only milestone. It uses the D604 scoped reports, D605 inspector, existing proposals and existing Studio revision control.

The local MCP creates a proposal in a private copy of the left subassembly. It cannot accept the assembly change at autonomy 4. A Studio user reviews and accepts that proposal in the subassembly, saves it, and offers the file to the original root assembly. Offering the file leaves the root failure in place. A second user action accepts Rev B into the root.

| Group | Result | Evidence |
| --- | --- | --- |
| R01 | PASS | The proposal preview leaves the private host unchanged. Its Studio approval records matching before and after host revisions. The root still shows 6 mm and fail while Rev B waits. |
| R02 | PASS | Accept Rev B changes `p1/p1` from 6 mm and fail to 4 mm and pass. Its effective steel mass changes from 9.42 g to 6.28 g. The sibling `p2/p1` stays at 7 mm and fail, 10.99 g. Placement, occurrence looks and the sibling document stay equal. Undo restores the failure and waiting revision. Redo restores the accepted correction. |
| R03 | PASS | Two named root versions retain the original failure and the accepted correction. Reload and project Open retain both. Fresh MCP reads the original snapshot unchanged and refuses its revision pin on the accepted file. Independent prism arithmetic checks eight measurements against Studio and MCP at 10⁻⁸ absolute tolerance. |
| R04 | FAIL | Root MCP reads both exact paths, but `features.parameters` and a proposal containing that operation both refuse `p1/p1` as an unknown part. Both preserve the root file byte for byte. This is the first blocker for a direct root-scoped repair proposal. |
| R05 | FAIL | The root Versions comparison shows the changed placed host and retains the two snapshots. It has no approved-check comparison for this imported correction. The saved root has no matching approval record. The embedded approval belongs to the private host and does not prove a root-scoped approval. |

The existing repair is usable with two explicit decisions and a saved host file. D607 will address the direct root proposal first. This gives the ordinary proposal approval path ownership of the exact root revision pair before any historical UI is extended.

Root reviewed the desktop control after acceptance and the saved comparison. The actual run captured six states, kept 304 source pins identical through cleanup, and recorded zero page errors, console errors or downloads. Focused Model and Studio tests passed 53/53 and 59/59. See [commands and hashes](qualification.json).

Direct root nested proposal acceptance, historical nested approval comparison, whole suites, mobile, and live providers remain **NOT_RUN** as positive workflows. The two missing capabilities above have actual negative evidence. B09 remains 9/9 scoped groups. Four of ten initial product scenarios have accepted ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
