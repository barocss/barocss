# B08 v1 — Project, version and failure recovery evidence ledger

[Product baseline](04-product-baseline.md) · [P0 reliability](01-reliability.md)

## Frozen scope

One desktop Studio with an owned browser project and ordinary editable native documents. Public Save, version, branch and recovery controls are the acceptance entry points. A scheduled failure must hold or fail a real storage boundary. Each receipt records the accepted document and relevant working, saved, version-log or recovery bytes. Failed and delayed operations must preserve the accepted owner's state and recoverable work.

| Group | Required behavior | Evidence |
| --- | --- | --- |
| B08-01 | Make a named version, edit and Save a newer working document, Restore the named snapshot as dirty and prove the newer bytes stay until explicit Save. Close, reload, Open and re-edit the restored document. Verify the native document, version log and current geometry. | **PASS, current Studio [D764](../notes/named-version-working-and-saved-2026-11-12/README.md)**. [D470](../notes/named-version-restore-physical-2026-11-03/README.md) retains the earlier bounded case. |
| B08-02 | Create and switch branches, merge a compatible edit and refuse a conflicting edit. Verify exact version parents, snapshot and current working document through project reopen. | Current Studio pending. |
| B08-03 | Delay a branch or merge completion while opening another document, closing or detaching the project. The late completion must preserve the new owner's document, log, version rows and history. | [D521](../notes/project-version-completion-ownership-2026-11-05/README.md) qualifies selected controlled cases and the earlier actual branch-to-B case. Current branch and merge boundaries pending. |
| B08-04 | Edit the active document while a version operation waits. Verify the edit and explicit saved bytes retain their owners when the delayed operation settles. | [D521](../notes/project-version-completion-ownership-2026-11-05/README.md) retains controlled evidence. Current Studio pending. |
| B08-05 | Interrupt or fail a native autosave write, retain valid saved/recovery bytes and show the current failure. Then restore a valid recovery copy in a later project session. | [D522](../notes/project-autosave-feedback-2026-11-05/README.md) and [D596](../notes/interrupted-project-autosave-2026-11-11/README.md) retain bounded actual results. Current combined acceptance pending. |
| B08-06 | Open a valid saved part with unreadable or malformed recovery data. Verify the saved document, the retained recovery bytes, visible reason and later recovery after a successful write. | [D522](../notes/project-autosave-feedback-2026-11-05/README.md) retains controlled coverage. Current Studio pending. |

D764 qualifies 1/6 current groups. Initial scenarios remain 6/10 while B08 is pending. Whole CAD and core readiness remain **NOT_MEASURED**. Separate filesystem providers, collaboration servers, broad operating-system failures and mobile remain outside this matrix.
