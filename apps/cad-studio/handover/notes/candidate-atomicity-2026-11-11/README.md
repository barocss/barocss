---
work_id: D585
artifact_type: candidate-atomicity-qualification
status: fixed-and-qualified-in-one-process
last_updated: 2026-11-11
---

# D585 — Commit one verified candidate per accepted revision

P0, B09, rows 04 and 16. FULL qualification of the existing CandidateBoard in one process. [#2400](https://github.com/barocss/barocss/issues/2400).

The previous board checked its token before integration and then published after awaiting native evidence and file replay. Both replay completion orders allowed two accepts from one token. A successful cancellation during replay also allowed the cancelled candidate to commit. The three original regressions use native evaluation and explicit replay barriers.

The board reserves the operation ID before it starts work. Repeating the same pending request gives `OPERATION_PENDING`. A different request under that ID gives `OPERATION_CONFLICT`. A completed repeat returns the original outcome with the existing `DUPLICATE` code. That receipt retains the original token and geometry even after later board operations. The accepted token itself only increases. JSON requests with non-finite numbers or cycles are refused.

Native computation and file replay run without a global lock. The board owns copies of the accepted inputs and the evaluation results. Before it publishes a build or commits an accept, it checks the original token, exact candidate generation, candidate status, accepted prerequisites and current row-file authority. A late build cannot republish after cancellation, deadline, replacement or a competing commit. Commit replaces one accepted snapshot and creates one Undo entry in the same synchronous step. Cancel after commit reports `ALREADY_COMMITTED`. Cancel prevents publication and may leave kernel work running until it returns. Undo and Redo restore accepted generations with their document. A new branch drops dependencies that only existed in the discarded history.

Controlled native tests cover both accept orders, duplicate IDs and conflicts, cancellation during integration, evidence and replay, late build deadlines, token ABA, candidate replacement, source and evidence isolation, row authority revocation, and evaluator or reader exceptions. The legacy scenario also checks native replay in a fresh process. Its cases still distinguish unreadable files, changed facts and changed verdicts. A hard unknown still blocks acceptance.

In the desktop run the host accepted one candidate at 6 mm and rejected the competing 7 mm candidate as stale. Studio opened the resulting native file, saved the exact bytes to the browser project, and opened those bytes in a fresh context. Studio then changed the height to 8 mm and exercised first Undo and Redo. Independent prism volumes are 1,000 mm³ for the baseline, 1,200 mm³ for the winner, 1,400 mm³ for the losing candidate and 1,600 mm³ after the Studio edit. The browser compares volume and centroid within an absolute tolerance of 1e-8 in their respective units.

- **PASS** — 39 Studio runner tests, 48 Model tests, seven targeted mutation controls, affected lint, both type checks, Studio build and actual desktop. The final Studio run preserved 942 source pins through cleanup.
- **FAIL** — three original publication regressions. The first browser driver also compared the centroid by exact floating-point equality. A first evaluator-alias test selected its result by an exact volume comparison and missed the native callback. Final checks use the stated tolerance and the authored height to select that callback. Studio type-check also caught two optional assertion messages, which the final test supplies explicitly.
- **NOT_RUN** — live providers, task approval inside the Studio UI, durable reservation or worker restart, cross-process atomic publication, whole Model/kernel suites and whole B09 acceptance.

The normal native file stores the accepted document. Candidate generations, operation reservations and Undo history belong to the running board. The existing CLI and proposal paths remain in place. [Commands and receipts](qualification.json).

Whole CAD remains **NOT_MEASURED**. Next is D586, P0 B09, rows 04 and 16, to build the first two-worker execution and restart profile. [#2401](https://github.com/barocss/barocss/issues/2401).
