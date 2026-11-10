---
work_id: D596
artifact_type: interrupted-project-autosave
status: verified
last_updated: 2026-11-11
---

# D596 — Open a project after an interrupted first autosave

P0 reliability, rows 12 and 16. SMALL repair to the private recovery reader. The desktop D595 run had reported an unreadable recovery copy. Its exact recovery bytes were unavailable. D596 reproduces the same warning by interrupting a real first autosave in browser storage.

The native directory creates the destination before the writable closes. Studio had already forwarded the new bytes to the writable when the test held its close and reloaded the page. The destination remained zero bytes. The previous reader sent that entry to the CAD document parser and showed a corruption warning.

The recovery reader now treats a zero-byte entry as having no committed recovery document. It leaves the entry available for a later write. Nonempty bytes still go through the existing decoder. The main project file uses the same decoder even when it is empty.

| Group | Result | Evidence |
| --- | --- | --- |
| R01 First interruption | PASS | Actual Studio saves a 10 mm plate, edits it to 11 mm, and reloads before the first native autosave close. The zero-byte destination and saved file remain byte-identical. Open completes with the saved 10 mm plate and no recovery offer or corruption warning. |
| R02 Prior committed copy | PASS | A later 11 mm autosave closes successfully. Studio then edits to 12 mm and interrupts the overwrite. The earlier committed bytes survive. Actual project Open offers the 11 mm recovery and Restore opens it. |
| R03 Read controls | PASS | After saving the 11 mm model, its equal recovery copy produces no offer. A nonempty malformed sidecar still warns and remains byte-identical. The saved model opens unchanged. A controlled empty primary file still refuses. |

- **PASS** — Seven actual desktop states, 100 focused Studio checks, types, production build and syntax.
- **FAIL** — Before the fix, the actual interrupted first write showed the unreadable-copy warning. The first post-fix run reached all product assertions but the source watcher reported change events from setup. The final run passes with no source changes.
- **NOT_RUN** — Abrupt OS shutdown, host permission or quota failure on this fixture, local-folder interruption, live providers, mobile, broad browser/kernel suites and release. D522 retains its separate write-denial evidence.

This result covers first-write placeholders and the prior-copy control. Four of ten initial product scenarios have accepted v1 evidence. B09 v1 remains 9/9. Whole CAD readiness remains NOT_MEASURED.

[Commands and evidence custody](qualification.json).
