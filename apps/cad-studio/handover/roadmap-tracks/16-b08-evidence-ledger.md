# B08 v1 — Project, version and failure recovery evidence ledger

[Product baseline](04-product-baseline.md) · [P0 reliability](01-reliability.md)

## Frozen scope

One desktop Studio with an owned browser project and ordinary editable native documents. Public Save, version, branch and recovery controls are the acceptance entry points. A scheduled failure must hold or fail a real storage boundary. Each receipt records the accepted document and relevant working, saved, version-log or recovery bytes. Failed and delayed operations must preserve the accepted owner's state and recoverable work.

| Group | Required behavior | Evidence |
| --- | --- | --- |
| B08-01 | Make a named version, edit and Save a newer working document, Restore the named snapshot as dirty and prove the newer bytes stay until explicit Save. Close, reload, Open and re-edit the restored document. Verify the native document, version log and current geometry. | **PASS, current Studio [D764](../notes/named-version-working-and-saved-2026-11-12/README.md)**. [D470](../notes/named-version-restore-physical-2026-11-03/README.md) retains the earlier bounded case. |
| B08-02 | Create and switch branches, merge a compatible edit and refuse a conflicting edit. Verify exact version parents, snapshot and current working document through project reopen. | **PASS, current Studio [D765](../notes/project-branch-merge-and-conflict-2026-11-12/README.md)**. |
| B08-03 | Delay a branch or merge completion while opening another document, closing or detaching the project. The late completion must preserve the new owner's document, log, version rows and history. | **PASS, current Studio [D766](../notes/project-branch-receipt-owner-2026-11-12/README.md)**. [D521](../notes/project-version-completion-ownership-2026-11-05/README.md) retains the controlled cases and the original actual branch-to-B case. |
| B08-04 | Edit the active document while a version operation waits. Verify the edit and explicit saved bytes retain their owners when the delayed operation settles. | **PASS, current Studio [D767](../notes/project-version-concurrent-edit-2026-11-12/README.md)**. [D521](../notes/project-version-completion-ownership-2026-11-05/README.md) retains the controlled cases. |
| B08-05 | Interrupt or fail a native autosave write, retain valid saved/recovery bytes and show the current failure. Then restore a valid recovery copy in a later project session. | **PASS, current Studio [D768](../notes/autosave-write-denial-and-restore-2026-11-12/README.md)**. [D522](../notes/project-autosave-feedback-2026-11-05/README.md) and [D596](../notes/interrupted-project-autosave-2026-11-11/README.md) retain their earlier actual results. |
| B08-06 | Open a valid saved part with unreadable or malformed recovery data. Verify the saved document, the retained recovery bytes, visible reason and later recovery after a successful write. | **PASS, current Studio [D769](../notes/project-recovery-read-and-restore-2026-11-12/README.md)**. [D522](../notes/project-autosave-feedback-2026-11-05/README.md) retains controlled coverage. |

D769 accepts B08 v1 at 6/6 current groups. Initial scenarios reach 7/10. Whole CAD and core readiness remain **NOT_MEASURED**. Separate filesystem providers, collaboration servers, broad operating-system failures and mobile remain outside this matrix.
