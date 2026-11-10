---
work_id: D558
artifact_type: body-clipboard-pending-admission
status: qualified-for-one-owned-pending-evaluation
last_updated: 2026-11-10
---

# D558 — Keep refused body Paste free of side effects

P0, rows 12 and 16. The parent is `bd0572433479afe6a2fa9deb5e11f90b97d4651f`. This is the pending-evaluation case of [#2310](https://github.com/barocss/barocss/issues/2310), after the [D556 Open history repair](../body-clipboard-history-2026-11-10/README.md).

## Actual Studio

Open the retained D326 B box, 12 × 13 × 14 mm. Copy b1 and Paste once at X +22 mm. The new b4 is selected. Press Right Arrow to nudge b4 to X +23 mm. The test holds the real successful main Worker reply and queues later messages from that Worker. Press Paste while Studio is pending and observe the existing refusal. Deliver the main reply, wait for Studio to install it, then deliver the queued messages in order. All edits use public Studio controls.

The first harness run showed the refusal and an unchanged document, selection and history during the wait. The harness delivered the held reply and the mass patch in the same turn. The patch arrived before Studio installed the body. The mass-ready check timed out. The next harness version preserves that delivery boundary. The first run and its driver stay in external evidence.

The corrected harness reproduced the product failure. The refused Paste kept the accepted nudge document, current bodies, selection, history buttons and rows, and dirty state at the time of refusal. Once the pending nudge settled, its expected b4 selection was lost. The next accepted Paste used X +66 mm, one spacing step beyond the expected +44 mm. Undo and Redo showed that the refusal had added no history entry.

## Repair and verification

App checks the existing document work guard before preparing Paste. Only a successful commit advances the clipboard count and hands off the new body selection. The Worker and history contracts stay in their existing owners.

The fixed run preserved the pending state and selected b4 after the nudge settled. The next accepted Paste used X +44 mm and selected the new b7. The first Undo returned the exact nudge document. The second returned the exact first-Paste document. Two Redo actions restored those edits in order. Independent box arithmetic checked three accepted states at an absolute tolerance of 1e-9. The final volumes were 2,184 mm³ each, with X centroids at 6, 29 and 50 mm.

The two complete runs used the same driver, with only App.tsx differing in their frozen source maps. Root reviewed the before and after Studio captures. All three runs closed their owned context, Chrome and Vite. Commands, timings, counts and evidence hashes are in [qualification](qualification.json).

- **PASS** — refusal preserves the pending document, history and selection. Selection survives evaluation, the next Paste uses the correct offset, and two Undo and Redo actions restore the exact documents. Syntax, Studio and final Model types, 13 ownership tests and cleanup passed.
- **FAIL** — original selection loss and skipped Paste spacing. The first harness run also timed out at the mass-ready check.
- **NOT_RUN** — other pending edit types, refused Open clipboard ownership, other #2310 replacement contexts, full kernel and mobile.

[#2310](https://github.com/barocss/barocss/issues/2310) remains open. Next is D559, P0 rows 12 and 16, for clipboard preservation when a native Open fails. Whole CAD remains NOT_MEASURED.
