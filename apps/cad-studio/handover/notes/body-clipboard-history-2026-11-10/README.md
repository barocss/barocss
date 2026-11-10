---
work_id: D556
artifact_type: body-clipboard-history-ownership
status: qualified-for-open-history
last_updated: 2026-11-10
---

# D556 — Keep body clipboard ownership across Open history

P0, rows 12 and 16. [#2310](https://github.com/barocss/barocss/issues/2310) remains open. The parent is `1027d07557e6778a2629afd14af0cf48669f5847`. [D552](../body-clipboard-owner-2026-11-10/README.md) qualifies direct same-tab Open. It clears the clipboard after successful replacement. Undo and Redo can cross that replacement through separate history code.

Use the same two [D326 native boxes](../project-open-ownership-2026-10-29/README.md). They have independent documents with body key b1. A is 10 × 10 × 10 mm. B is 12 × 13 × 14 mm. Check volume and centroid with independent Python box arithmetic at 1e-9 absolute tolerance. Use real Open, Copy, Paste, Undo and Redo actions in desktop Studio.

## Original failure

Open A, open B, copy B's body, then Undo the Open. A's exact document and fresh 1,000 mm³ body return. Paste from B's stale clipboard appends a second A body, 1,000 mm³ at centroid [25, 5, 5] mm. First Undo takes back the unintended Paste and returns A. The characterization passed with seven snapshots and five independent joins. The product result is FAIL. The original receipt and executed test driver are retained outside Git.

## Repair and actual result

A private history entry marks a successful document replacement. The mark follows the reciprocal entry when Undo, Redo or an owned Stop takes that edge. The transition clears the body clipboard synchronously. The undo stack and the Worker reservation receive the same history entry. The marker uses the replacement scope. A validated whole-candidate Route edit is still a same-document edit. The existing successful Open clear stays in place.

In the fixed run, stale Paste preserved the exact document, fresh bodies, selection, dirty state and history buttons in both directions. The next Undo reached the exact startup document. Redo restored A, then B. After a fresh B Copy, the two admitted copies stayed at +22 and +44 mm even with Undo and Redo of the first Paste between them. The original and the copies measured 2,184 mm³ each. Their keys were b1, b4 and b7, with centroids [6, 6.5, 7], [28, 6.5, 7] and [50, 6.5, 7] mm. The prior Copy notice can remain visible after the clipboard clears.

The fixed run captured 16 snapshots and 11 independent joins. Both runs verified 300 source pins through cleanup and used the same test driver. App and the private history type account for the two source changes. Both runs closed the owned context, Chrome and Vite. No page errors, console errors, source changes during a run or downloads were recorded. Root reviewed the original and fixed stale-Paste captures. Commands, timings, process IDs and hashes are in [qualification](qualification.json).

- **PASS** — original characterization, fixed Open Undo and Redo crossings, same-document repeat Paste, independent box arithmetic, Studio and final Model types, 59 focused ownership tests and cleanup.
- **FAIL** — the original product duplicated the wrong body after Undo of Open.
- **NOT_RUN** — actual Stop across replacement, pending Paste refusal, other #2310 replacement contexts, native Save and fresh Open, full kernel and mobile. Whole CAD is NOT_MEASURED.

Next is D557, the pending evaluation refusal and offset case in [#2310](https://github.com/barocss/barocss/issues/2310).
