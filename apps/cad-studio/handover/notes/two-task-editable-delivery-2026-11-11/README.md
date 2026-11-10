---
work_id: D615
artifact_type: bounded-product-qualification
status: verified-existing-workflow
last_updated: 2026-11-11
---

# D615 — Deliver two reviewed worker tasks to an editable Studio model

P0 automation, B09 follow-up, rows 04, 12 and 16. Focused qualification of the existing local workflow. It connects two real worker candidates and terminal approvals to one editable native assembly and its current Studio output.

The fixture contains two independent rectangular parts with written height requirements. Base has a 20 × 10 mm profile and a 6 ± 0.001 mm target. Lid has a 12 × 8 mm profile and a 4 ± 0.001 mm target. Lid is placed 45 mm from the origin along X. The run starts from heights of 5 and 3 mm.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Both local tasks reach the decision state. Studio previews Base at 6 mm and keeps the accepted model at 5 and 3 mm. The exact terminal approval makes one native commit. |
| K02 | PASS | Base's commit retires the original Lid attempt. The old receipt is refused and preserves the run record and writer entries. The refreshed Lid receipt matches Base's accepted file and the updated spec. Studio previews Lid at 4 mm, then the exact terminal approval makes the second commit. |
| K03 | PASS | Studio opens each checkpoint and shows its task, occurrence, revision and original checks. The final native heights are 6 and 4 mm. The two commits form one accepted chain and preserve the other occurrence at each step. |
| K04 | PASS | Studio edits Lid from 4 to 5 mm. Its current height check fails. Its historical approval stays at Fail · 3 mm and Pass · 4 mm with the same evidence revisions. Browser project Save and page reload reopen the edited native bytes. The worker store and its three native stages keep their bytes. |
| K05 | PASS | Studio exports the reopened working model. The test captures its 3MF bytes at the download boundary. An independent ZIP/XML reader checks two build items in millimetres, both placed bounds, closed oriented triangle edges and signed-volume magnitudes. Base is 1,200 mm³ and Lid is 480 mm³. |

The first desktop run reached the edited assembly and stopped in the Save observer. The browser project omits its Open button for the active file. The final driver waits for the file row at Save and uses Open after reload. [Commands and hashes](qualification.json).

This profile uses controlled workers and a hand-authored run config. Live providers, other task families, a physical print, mobile and whole suites are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
